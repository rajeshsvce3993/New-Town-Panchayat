import * as FileSystem from 'expo-file-system/legacy';
import type { AppUser } from '../types/models';
import { effectivePhotoUrl } from '../types/models';
import { api, isRemotePhotoUrl, resolveProfilePhotoUrl } from '../api/client';
import { profilePhotoFile } from '../storage/preferences';

function safeId(user?: AppUser | null): string {
  const raw = String(user?.id || user?.username || 'user')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_');
  return raw || 'user';
}

/** Fetch latest profile photo URL from Mongo (not device scope cache). */
export async function fetchLiveProfilePhotoUrl(user: AppUser): Promise<string | null> {
  const u = String(user.username || '').trim();
  if (!u) return effectivePhotoUrl(user);
  try {
    const resp = await api.getMobileProfile(u);
    const fromDb = resp.profilePhotoUrl?.trim();
    if (fromDb) return fromDb;
  } catch {
    /* fall back to session user */
  }
  return effectivePhotoUrl(user);
}

async function downloadToPath(remoteUrl: string, dest: string): Promise<boolean> {
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
  } catch {
    /* */
  }
  const bust = remoteUrl.includes('?') ? `${remoteUrl}&` : `${remoteUrl}?`;
  const url = `${bust}t=${Date.now()}`;
  const result = await FileSystem.downloadAsync(url, dest);
  return result.status >= 200 && result.status < 300;
}

/** Download current user's profile photo into a user-specific local file. */
export async function syncProfilePhotoFromServer(user: AppUser | null | undefined): Promise<string | null> {
  if (!user) return null;
  const liveRaw = await fetchLiveProfilePhotoUrl(user);
  if (!liveRaw) return null;

  const resolved = resolveProfilePhotoUrl(liveRaw);
  const dest = profilePhotoFile(user);

  if (isRemotePhotoUrl(resolved)) {
    const ok = await downloadToPath(resolved, dest);
    if (ok) return dest;
    return resolved;
  }
  if (resolved?.startsWith('file:') || resolved?.startsWith('/')) {
    return resolved;
  }
  return resolved || null;
}

export { safeId as profileUserFileKey };