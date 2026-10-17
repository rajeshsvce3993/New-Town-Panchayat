import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

const MAX_DIMENSION = 1280;
const TARGET_MAX_BYTES = 500 * 1024;

export async function compressImageLocally(inputUri: string, outputFileName?: string): Promise<string | null> {
  try {
    let quality = 0.75;
    let width = MAX_DIMENSION;
    let result = await ImageManipulator.manipulateAsync(inputUri, [{ resize: { width } }], {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    let info = await FileSystem.getInfoAsync(result.uri);
    let size = 'size' in info && typeof info.size === 'number' ? info.size : 0;
    while (size > TARGET_MAX_BYTES && quality > 0.35) {
      quality -= 0.1;
      if (quality < 0.5 && width > 1024) width = 1024;
      result = await ImageManipulator.manipulateAsync(inputUri, [{ resize: { width } }], {
        compress: Math.max(quality, 0.35),
        format: ImageManipulator.SaveFormat.JPEG,
      });
      info = await FileSystem.getInfoAsync(result.uri);
      size = 'size' in info && typeof info.size === 'number' ? info.size : 0;
    }
    if (outputFileName && FileSystem.cacheDirectory) {
      const dest = `${FileSystem.cacheDirectory}compressed_uploads`;
      const dir = await FileSystem.getInfoAsync(dest);
      if (!dir.exists) await FileSystem.makeDirectoryAsync(dest, { intermediates: true });
      const out = `${dest}/${outputFileName}`;
      await FileSystem.copyAsync({ from: result.uri, to: out });
      return out;
    }
    return result.uri;
  } catch {
    return null;
  }
}

export async function fileToBase64DataUri(uri: string): Promise<string | null> {
  try {
    const b64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
    return `data:image/jpeg;base64,${b64}`;
  } catch {
    return null;
  }
}

export async function cleanLocalFile(filePath?: string | null) {
  if (!filePath || filePath.startsWith('http') || filePath.startsWith('data:')) return;
  try {
    const info = await FileSystem.getInfoAsync(filePath);
    if (info.exists) await FileSystem.deleteAsync(filePath, { idempotent: true });
  } catch {
    /* ignore */
  }
}

export async function savePersistentBytes(uri: string, dest: string): Promise<string> {
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export async function ensureDir(path: string) {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) await FileSystem.makeDirectoryAsync(path, { intermediates: true });
}
