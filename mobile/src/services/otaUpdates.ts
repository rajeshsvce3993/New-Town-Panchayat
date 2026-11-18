import * as Updates from 'expo-updates';

/** Pull JS bundle updates from EAS (no new APK) when the native build includes expo-updates. */
export async function checkAndApplyOtaUpdate(): Promise<void> {
  if (__DEV__) return;
  try {
    if (!Updates.isEnabled) return;
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return;
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
  } catch {
    /* OTA optional — missing config or offline should not block the app */
  }
}