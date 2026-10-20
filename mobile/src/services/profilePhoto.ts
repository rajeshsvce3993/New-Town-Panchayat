import * as ImagePicker from 'expo-image-picker';
import { getApiBaseUrl } from '../api/client';
import { api } from '../api/client';
import { prefs, profilePhotoFile } from '../storage/preferences';
import { compressImageLocally, savePersistentBytes } from '../utils/imageCompression';

export async function pickAndUploadProfile(source: 'camera' | 'gallery', userId: string, username: string) {
  const perm =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Permission denied');
  const res =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
  if (res.canceled || !res.assets[0]) return null;
  const uri = res.assets[0].uri;
  const dest = profilePhotoFile();
  await savePersistentBytes(uri, dest);
  const compressed = await compressImageLocally(uri, `comp_prof_${Date.now()}.jpg`);
  const uploadUri = compressed || dest;
  const resp = await api.uploadProfilePhoto(userId, username, uploadUri);
  const stored = (resp.rawS3Url || resp.profilePhotoUrl || '').trim();
  if (resp.success && stored) {
    let raw = stored.startsWith('/') ? `${getApiBaseUrl().replace(/\/$/, '')}${stored}` : stored;
    await prefs.updateUserPhoto(raw, getApiBaseUrl());
    return { local: dest, remote: raw, message: resp.message };
  }
  return { local: dest, remote: dest, message: resp.message || 'Photo saved locally' };
}
