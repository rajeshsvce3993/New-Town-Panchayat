package expo.modules.sharewithcaption

import android.content.ClipData
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import androidx.core.content.FileProvider
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class ShareWithCaptionModule : Module() {
  private var pendingPromise: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("ShareWithCaption")

    AsyncFunction("shareAsync") { fileUri: String, mimeType: String?, caption: String?, dialogTitle: String?, promise: Promise ->
      if (pendingPromise != null) {
        promise.reject("SHARE_IN_PROGRESS", "A share is already in progress", null)
        return@AsyncFunction
      }
      try {
        val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
        val parsed = Uri.parse(fileUri)
        if (parsed.scheme != "file") {
          throw IllegalArgumentException("Only local file URLs are supported")
        }
        val path = parsed.path ?: throw IllegalArgumentException("File path is missing")
        val file = File(path)
        if (!file.exists() || !file.canRead()) {
          throw IllegalArgumentException("File is not readable")
        }
        val contentUri = FileProvider.getUriForFile(
          context,
          context.packageName + ".ShareWithCaptionFileProvider",
          file
        )
        val type = mimeType?.takeIf { it.isNotBlank() } ?: "image/jpeg"
        val note = caption?.trim().orEmpty()
        val send = Intent(Intent.ACTION_SEND).apply {
          this.type = type
          putExtra(Intent.EXTRA_STREAM, contentUri)
          if (note.isNotEmpty()) {
            putExtra(Intent.EXTRA_TEXT, note)
            putExtra(Intent.EXTRA_SUBJECT, dialogTitle ?: "")
          }
          clipData = ClipData.newUri(context.contentResolver, dialogTitle ?: file.name, contentUri)
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val chooser = Intent.createChooser(send, dialogTitle ?: "Share")
        context.packageManager.queryIntentActivities(chooser, PackageManager.MATCH_DEFAULT_ONLY).forEach { resolve ->
          context.grantUriPermission(
            resolve.activityInfo.packageName,
            contentUri,
            Intent.FLAG_GRANT_READ_URI_PERMISSION
          )
        }
        pendingPromise = promise
        appContext.throwingActivity.startActivityForResult(chooser, REQUEST_CODE)
      } catch (error: Throwable) {
        pendingPromise = null
        promise.reject("SHARE_FAILED", error.message, error)
      }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_CODE) return@OnActivityResult
      pendingPromise?.resolve(null)
      pendingPromise = null
    }
  }

  companion object {
    private const val REQUEST_CODE = 8631
  }
}
