import { BG_SCOPE_TASK } from '../constants/config';
import { isExpoGo } from '../utils/expoGo';

if (!isExpoGo) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const TaskManager = require('expo-task-manager') as typeof import('expo-task-manager');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BackgroundFetch = require('expo-background-fetch') as typeof import('expo-background-fetch');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { syncPendingWorks } = require('./queueSync') as typeof import('./queueSync');
    TaskManager.defineTask(BG_SCOPE_TASK, async () => {
      try {
        await syncPendingWorks();
        return BackgroundFetch.BackgroundFetchResult.NewData;
      } catch {
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
  } catch {
    /* Expo Go / missing native module */
  }
}

export async function registerBackgroundSync() {
  if (isExpoGo) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BackgroundFetch = require('expo-background-fetch') as typeof import('expo-background-fetch');
    await BackgroundFetch.registerTaskAsync(BG_SCOPE_TASK, {
      minimumInterval: 5 * 60,
      stopOnTerminate: false,
      startOnBoot: true,
    });
  } catch {
    /* Expo Go / simulator */
  }
}
