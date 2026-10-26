import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { DEFAULT_SERVER_URL, IS_PROD_MOBILE, isNonProductionServerUrl } from '../constants/config';
import type { AppUser, InspectionWork, NotificationItem, PortalState, QueuedWorkEntry, UserScopeData } from '../types/models';
import { effectivePhotoUrl } from '../types/models';
import {
  importLegacyLists,
  listOfflineWorks,
  listQueuedWorks,
  removeOfflineWorkFile,
  removeQueuedWorkFile,
  saveOfflineWorkAtomic,
  updateQueuedWorkFile,
  writeOfflineWork,
  writeQueuedWork,
} from './offlineQueueStore';

const K = {
  theme: 'theme_id',
  tamil: 'is_tamil',
  server: 'server_url',
  user: 'current_user',
  savedUser: 'saved_username',
  lastUser: 'last_logged_username',
  loginDate: 'login_date',
  loginSessionPeriod: 'login_session_period',
  lastInteract: 'last_interaction_time',
  offline: 'offline_works',
  portal: 'cached_portal_state',
  scopeSync: 'last_scope_sync_time',
  scopeVerStr: 'last_scope_version',
  scopeVer: 'scope_version_int',
  userScope: 'cached_user_scope_data',
  queue: 'work_queue_entries',
  queueMigrated: 'offline_queue_files_migrated_v1',
  tone: 'notification_alert_tone',
  fcm: 'fcm_token',
  readIds: 'read_notification_ids',
  notifiedIds: 'notified_notification_ids',
  notifs: 'cached_notifications',
  appIcon: 'app_icon_url',
  loginLogo: 'login_logo_url',
  localPhoto: 'local_user_profile_photo_path',
};

const SECURE_TOKEN = 'auth_token';
const SECURE_PASS = 'saved_password';
const SECURE_LAST_PASS = 'last_logged_password';

async function getStr(key: string): Promise<string | null> {
  return AsyncStorage.getItem(key);
}
async function setStr(key: string, value: string | null) {
  if (value == null) await AsyncStorage.removeItem(key);
  else await AsyncStorage.setItem(key, value);
}

export function profilePhotoFile(): string {
  return `${FileSystem.documentDirectory}user_profile_photo.jpg`;
}

export const prefs = {
  async getAuthToken() {
    return SecureStore.getItemAsync(SECURE_TOKEN);
  },
  async setAuthToken(v: string | null) {
    if (!v) await SecureStore.deleteItemAsync(SECURE_TOKEN);
    else await SecureStore.setItemAsync(SECURE_TOKEN, v);
  },
  async getSavedPassword() {
    return (await SecureStore.getItemAsync(SECURE_PASS)) || (await SecureStore.getItemAsync(SECURE_LAST_PASS));
  },
  async setSavedPassword(v: string | null) {
    if (!v) {
      await SecureStore.deleteItemAsync(SECURE_PASS);
      await SecureStore.deleteItemAsync(SECURE_LAST_PASS);
    } else {
      await SecureStore.setItemAsync(SECURE_PASS, v);
      await SecureStore.setItemAsync(SECURE_LAST_PASS, v);
    }
  },
  async getThemeId() {
    return (await getStr(K.theme)) || 'ocean_wave';
  },
  async setThemeId(id: string) {
    await setStr(K.theme, id);
  },
  async getIsTamil() {
    return (await getStr(K.tamil)) === 'true';
  },
  async setIsTamil(v: boolean) {
    await setStr(K.tamil, v ? 'true' : 'false');
  },
  async getServerUrl() {
    const stored = (await getStr(K.server))?.trim();
    if (IS_PROD_MOBILE) {
      if (!stored || isNonProductionServerUrl(stored)) {
        if (stored && isNonProductionServerUrl(stored)) await setStr(K.server, DEFAULT_SERVER_URL);
        return DEFAULT_SERVER_URL;
      }
      return stored.replace(/\/$/, '');
    }
    return (stored || DEFAULT_SERVER_URL).replace(/\/$/, '');
  },
  async setServerUrl(v: string) {
    const clean = v.trim().replace(/\/$/, '');
    if (IS_PROD_MOBILE && isNonProductionServerUrl(clean)) {
      await setStr(K.server, DEFAULT_SERVER_URL);
      return;
    }
    await setStr(K.server, clean);
  },
  async getCurrentUser(): Promise<AppUser | null> {
    const json = await getStr(K.user);
    if (!json) return null;
    try {
      return JSON.parse(json) as AppUser;
    } catch {
      return null;
    }
  },
  async setCurrentUser(u: AppUser | null) {
    await setStr(K.user, u ? JSON.stringify(u) : null);
  },
  async getSavedUsername() {
    return (await getStr(K.savedUser)) || (await getStr(K.lastUser));
  },
  async setSavedUsername(v: string | null) {
    await setStr(K.savedUser, v);
    if (v) await setStr(K.lastUser, v);
  },
  async getLastLoggedUsername() {
    return (await getStr(K.lastUser)) || (await getStr(K.savedUser));
  },
  async getLoginDate() {
    return getStr(K.loginDate);
  },
  async setLoginDate(v: string | null) {
    await setStr(K.loginDate, v);
  },
  async getLoginSessionPeriod() {
    return getStr(K.loginSessionPeriod);
  },
  async setLoginSessionPeriod(v: string | null) {
    await setStr(K.loginSessionPeriod, v);
  },
  async getLastInteraction(): Promise<number> {
    const v = await getStr(K.lastInteract);
    return v ? Number(v) : 0;
  },
  async setLastInteraction(v: number) {
    await setStr(K.lastInteract, String(v));
  },
  async getJson<T>(key: string, fallback: T): Promise<T> {
    const json = await getStr(key);
    if (!json) return fallback;
    try {
      return JSON.parse(json) as T;
    } catch {
      return fallback;
    }
  },
  async getOfflineWorks() {
    await this.migrateQueueToFiles();
    return listOfflineWorks();
  },
  async setOfflineWorks(v: InspectionWork[]) {
    const keep = new Set(v.map((w) => w.id).filter(Boolean));
    const current = await listOfflineWorks();
    for (const w of current) {
      if (!keep.has(w.id)) await removeOfflineWorkFile(w.id);
    }
    for (const w of v) await writeOfflineWork(w);
  },
  async mutateOfflineWorks(fn: (list: InspectionWork[]) => InspectionWork[]) {
    const next = fn(await listOfflineWorks());
    await this.setOfflineWorks(next);
    return next;
  },
  async getPortal(): Promise<PortalState | null> {
    return this.getJson<PortalState | null>(K.portal, null);
  },
  async setPortal(v: PortalState | null) {
    await setStr(K.portal, v ? JSON.stringify(v) : null);
  },
  async getScopeVersionInt() {
    const v = await getStr(K.scopeVer);
    return v ? Number(v) : 0;
  },
  async setScopeVersionInt(v: number) {
    await setStr(K.scopeVer, String(v));
  },
  async getUserScope(): Promise<UserScopeData | null> {
    return this.getJson<UserScopeData | null>(K.userScope, null);
  },
  async setUserScope(v: UserScopeData | null) {
    await setStr(K.userScope, v ? JSON.stringify(v) : null);
  },
  async migrateQueueToFiles() {
    const queue = await this.getJson<QueuedWorkEntry[]>(K.queue, []);
    const works = await this.getJson<InspectionWork[]>(K.offline, []);
    if (queue.length || works.length) {
      await importLegacyLists(queue, works);
      await setStr(K.queue, null);
      await setStr(K.offline, null);
    }
    await setStr(K.queueMigrated, '1');
  },
  async getQueue(): Promise<QueuedWorkEntry[]> {
    await this.migrateQueueToFiles();
    return listQueuedWorks();
  },
  async setQueue(v: QueuedWorkEntry[]) {
    const keep = new Set(v.map((e) => e.clientTaskId).filter(Boolean));
    const current = await listQueuedWorks();
    for (const e of current) {
      if (!keep.has(e.clientTaskId)) await removeQueuedWorkFile(e.clientTaskId);
    }
    for (const e of v) await writeQueuedWork(e);
  },
  async mutateQueue(fn: (current: QueuedWorkEntry[]) => QueuedWorkEntry[]) {
    const next = fn(await listQueuedWorks());
    await this.setQueue(next);
    return next;
  },
  async enqueueWork(entry: QueuedWorkEntry) {
    await writeQueuedWork(entry);
  },
  async upsertOfflineWork(work: InspectionWork) {
    await writeOfflineWork(work);
  },
  async enqueueOfflineWorkAtomic(entry: QueuedWorkEntry, pendingWork: InspectionWork) {
    await saveOfflineWorkAtomic(entry, pendingWork);
  },
  async removeOfflineWork(id: string) {
    if (!String(id || '').trim()) return;
    await removeOfflineWorkFile(id);
  },
  async updateQueuedWork(clientTaskId: string, update: (e: QueuedWorkEntry) => void) {
    if (!String(clientTaskId || '').trim()) return;
    await updateQueuedWorkFile(clientTaskId, update);
  },
  async removeQueuedWork(clientTaskId: string) {
    if (!String(clientTaskId || '').trim()) return;
    await removeQueuedWorkFile(clientTaskId);
  },
  async removeQueuedWorkMatching(pred: (e: QueuedWorkEntry) => boolean) {
    const current = await listQueuedWorks();
    for (const e of current) {
      if (pred(e)) await removeQueuedWorkFile(e.clientTaskId);
    }
  },
  async getTone() {
    return (await getStr(K.tone)) || 'default';
  },
  async setTone(v: string) {
    await setStr(K.tone, v);
  },
  async getReadIds(): Promise<string[]> {
    return this.getJson<string[]>(K.readIds, []);
  },
  async setReadIds(v: string[]) {
    await setStr(K.readIds, JSON.stringify(v));
  },
  async markNotificationRead(id: string) {
    const cur = new Set(await this.getReadIds());
    cur.add(id);
    await this.setReadIds([...cur]);
  },
  async markAllRead(ids: string[]) {
    const cur = new Set(await this.getReadIds());
    ids.forEach((id) => cur.add(id));
    await this.setReadIds([...cur]);
  },
  async getNotifiedIds(): Promise<string[]> {
    return this.getJson<string[]>(K.notifiedIds, []);
  },
  async setNotifiedIds(v: string[]) {
    await setStr(K.notifiedIds, JSON.stringify(v));
  },
  async getNotifications() {
    return this.getJson<NotificationItem[]>(K.notifs, []);
  },
  async setNotifications(v: NotificationItem[]) {
    await setStr(K.notifs, JSON.stringify(v));
  },
  async getAppIconUrl() {
    return getStr(K.appIcon);
  },
  async setAppIconUrl(v: string | null) {
    await setStr(K.appIcon, v);
  },
  async getLoginLogoUrl() {
    return getStr(K.loginLogo);
  },
  async setLoginLogoUrl(v: string | null) {
    await setStr(K.loginLogo, v);
  },
  async getLocalPhotoPath() {
    return getStr(K.localPhoto);
  },
  async setLocalPhotoPath(v: string | null) {
    await setStr(K.localPhoto, v);
  },
  async hasDownloadedScope(user: AppUser | null, scope: UserScopeData | null, portal: PortalState | null): Promise<boolean> {
    if (user) {
      const role = user.role || '';
      if (/admin|super|director/i.test(role)) return true;
      if ((user.assignedWards?.length || 0) > 0 || (user.selectedWards?.length || 0) > 0 || (user.subjectIds?.length || 0) > 0 || (user.assignedSubjects?.length || 0) > 0) {
        return true;
      }
    }
    if (scope && ((scope.wardsAndStreets?.length || 0) > 0 || (scope.assignedWards?.length || 0) > 0 || (scope.subjects?.length || 0) > 0))
      return true;
    return !!(portal && ((portal.wardsAndStreets?.length || 0) > 0 || (portal.inspectionSubjects?.length || portal.subjects?.length || 0) > 0));
  },
  async updateUserPhoto(photoUrl: string, serverUrl: string) {
    let clean = photoUrl;
    if (clean.includes('amazonaws.com') && clean.includes('?')) {
      clean = clean.split('?')[0];
    }
    if (
      !(
        clean.startsWith('http://') ||
        clean.startsWith('https://') ||
        clean.startsWith('file://') ||
        clean.startsWith('/data/') ||
        clean.includes('user_profile_photo.jpg')
      )
    ) {
      if (clean.startsWith('/')) clean = `${serverUrl.replace(/\/$/, '')}${clean}`;
    }
    const u = await this.getCurrentUser();
    if (!u) return u;
    const updated = { ...u, profilePhotoUrl: clean, avatarUrl: clean };
    await this.setCurrentUser(updated);
    return updated;
  },
  async logoutClear() {
    await this.setAuthToken(null);
    await this.setCurrentUser(null);
    await this.setLoginDate(null);
    await this.setLoginSessionPeriod(null);
    await this.setLastInteraction(0);
  },
};

export { effectivePhotoUrl };
