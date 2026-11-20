/** Inspection custom field types that capture or upload a photo/image. */
export const INSPECTION_PHOTO_FIELD_TYPES = [
  'camera',
  'image',
  'image_upload',
  'gallery',
  'camera_gallery',
  'camera_or_gallery',
] as const;

export function normalizeInspectionFieldType(type: unknown): string {
  return String(type || 'text').trim().toLowerCase();
}

export function isInspectionPhotoFieldType(type: unknown): boolean {
  const t = normalizeInspectionFieldType(type);
  if (t === 'image') return true;
  if (t === 'gallery') return true;
  return (INSPECTION_PHOTO_FIELD_TYPES as readonly string[]).includes(t);
}

export function isCameraGalleryFieldType(type: unknown): boolean {
  const t = normalizeInspectionFieldType(type);
  return t === 'camera_gallery' || t === 'camera_or_gallery' || t === 'camera_and_gallery';
}