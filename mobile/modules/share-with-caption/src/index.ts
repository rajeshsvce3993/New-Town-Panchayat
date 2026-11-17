import { requireOptionalNativeModule } from 'expo-modules-core';

type NativeShare = {
  shareAsync: (fileUri: string, mimeType: string, caption: string, dialogTitle: string) => Promise<void>;
};

const native = requireOptionalNativeModule<NativeShare>('ShareWithCaption');

export function isShareWithCaptionAvailable() {
  return !!native?.shareAsync;
}

export async function shareFileWithCaption(options: {
  uri: string;
  mimeType: string;
  caption: string;
  dialogTitle: string;
}) {
  if (!native?.shareAsync) {
    throw new Error('ShareWithCaption native module is not available');
  }
  await native.shareAsync(
    options.uri,
    options.mimeType || 'image/jpeg',
    options.caption || '',
    options.dialogTitle || 'Share'
  );
}
