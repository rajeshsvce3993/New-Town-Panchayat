import ExpoModulesCore
import UIKit

public final class ShareWithCaptionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ShareWithCaption")

    AsyncFunction("shareAsync") { (fileUri: String, mimeType: String, caption: String, dialogTitle: String, promise: Promise) in
      guard let url = URL(string: fileUri) else {
        promise.reject("SHARE_FAILED", "Invalid file URL")
        return
      }
      var items: [Any] = [url]
      let note = caption.trimmingCharacters(in: .whitespacesAndNewlines)
      if !note.isEmpty {
        items.insert(note, at: 0)
      }
      let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
      controller.completionWithItemsHandler = { _, _, _, _ in
        promise.resolve(nil)
      }
      guard let current = self.appContext?.utilities?.currentViewController() else {
        promise.reject("SHARE_FAILED", "Cannot present the share sheet")
        return
      }
      if UIDevice.current.userInterfaceIdiom == .pad {
        controller.popoverPresentationController?.sourceView = current.view
        controller.popoverPresentationController?.sourceRect = CGRect(
          x: current.view.bounds.midX,
          y: current.view.bounds.maxY,
          width: 0,
          height: 0
        )
      }
      current.present(controller, animated: true)
    }
    .runOnQueue(.main)
  }
}
