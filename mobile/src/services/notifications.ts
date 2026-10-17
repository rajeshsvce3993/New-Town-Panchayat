import { Platform } from 'react-native';
import { prefs } from '../storage/preferences';
import { isExpoGo } from '../utils/expoGo';

type NotificationsModule = typeof import('expo-notifications');

let Notifications: NotificationsModule | null = null;

function getNotifications(): NotificationsModule | null {
  if (isExpoGo) return null;
  if (Notifications) return Notifications;
  try {
    // Loaded only outside Expo Go — static import crashes SDK 53+ Go on Android.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications') as NotificationsModule;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch {
    Notifications = null;
  }
  return Notifications;
}

function channelId(tone: string) {
  switch (tone) {
    case 'high_alert':
      return 'tp_high_alert_channel';
    case 'chime':
      return 'tp_chime_channel';
    case 'gentle':
      return 'tp_gentle_channel';
    case 'vibrate':
      return 'tp_vibrate_channel';
    default:
      return 'tp_inspections_channel';
  }
}

export async function createNotificationChannel(alertTone = 'default') {
  const N = getNotifications();
  if (!N || Platform.OS !== 'android') return;
  const id = channelId(alertTone);
  const name =
    alertTone === 'high_alert'
      ? 'High Alert Announcements (உயர் எச்சரிக்கை)'
      : alertTone === 'chime'
        ? 'Chime Notifications (மணி ஒலி)'
        : alertTone === 'gentle'
          ? 'Gentle Updates (மென்மையான ஒலி)'
          : alertTone === 'vibrate'
            ? 'Vibrate Only (அதிர்வு மட்டும்)'
            : 'Town Panchayat Field Inspections';
  await N.setNotificationChannelAsync(id, {
    name,
    importance: alertTone === 'gentle' ? N.AndroidImportance.DEFAULT : N.AndroidImportance.HIGH,
    vibrationPattern: alertTone === 'high_alert' ? [0, 300, 200, 300, 200, 300] : [0, 250],
    enableVibrate: true,
    sound: alertTone === 'vibrate' ? undefined : 'default',
  });
}

export async function requestNotificationPermission() {
  const N = getNotifications();
  if (!N) return false;
  const { status } = await N.requestPermissionsAsync();
  return status === 'granted';
}

export function subscribeNotificationResponses(
  handler: (data: Record<string, string>) => void
): () => void {
  const N = getNotifications();
  if (!N) return () => undefined;
  const sub = N.addNotificationResponseReceivedListener((resp) => {
    handler((resp.notification.request.content.data || {}) as Record<string, string>);
  });
  return () => sub.remove();
}

export async function showInspectionNotification(workId: string, subject: string, isTamil: boolean) {
  if (!workId) return;
  const notifKey = `work_${workId.trim()}`;
  const notified = await prefs.getNotifiedIds();
  if (notified.includes(notifKey)) return;
  await prefs.setNotifiedIds([...notified, notifKey]);
  const N = getNotifications();
  if (!N) return;
  const tone = await prefs.getTone();
  await createNotificationChannel(tone);
  await N.scheduleNotificationAsync({
    content: {
      title: isTamil ? 'பணி வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது!' : 'Work Submitted Successfully!',
      body: isTamil ? `பணி எண்: ${workId} • ${subject}` : `Work ID: ${workId} • ${subject}`,
      data: { OPEN_SCREEN: 'REPORTS' },
      sound: tone === 'vibrate' ? undefined : 'default',
    },
    trigger: null,
  });
}

export async function showRichNotification(opts: {
  title: string;
  message: string;
  mediaUrl?: string | null;
  fileType?: string | null;
  fileName?: string | null;
  actionUrl?: string | null;
  uniqueId?: string | null;
}) {
  if (opts.uniqueId) {
    const key = `rich_${opts.uniqueId.trim()}`;
    const shown = await prefs.getNotifiedIds();
    if (shown.includes(key) || shown.includes(opts.uniqueId.trim())) return;
    await prefs.setNotifiedIds([...shown, key, opts.uniqueId.trim()]);
  }
  const N = getNotifications();
  if (!N) return;
  const tone = await prefs.getTone();
  await createNotificationChannel(tone);
  const target = opts.mediaUrl || opts.actionUrl || '';
  await N.scheduleNotificationAsync({
    content: {
      title: opts.title,
      body: opts.fileName ? `${opts.message}\n📎 ${opts.fileName}` : opts.message,
      data: {
        OPEN_SCREEN: 'NOTIFICATIONS',
        VIEW_MEDIA_URL: target,
        VIEW_FILE_TYPE: (opts.fileType || '').toLowerCase(),
        VIEW_FILE_NAME: opts.fileName || '',
      },
      sound: tone === 'vibrate' ? undefined : 'default',
    },
    trigger: null,
  });
}

export async function showSimpleNotification(title: string, content: string) {
  const N = getNotifications();
  if (!N) return;
  const tone = await prefs.getTone();
  await createNotificationChannel(tone);
  await N.scheduleNotificationAsync({
    content: { title, body: content, sound: tone === 'vibrate' ? undefined : 'default' },
    trigger: null,
  });
}
