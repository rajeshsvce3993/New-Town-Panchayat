/** Single place for S3 bucket resolution (production .env). */
export function getS3BucketName(): string {
  return (
    process.env.S3_BUCKET_NAME?.trim() ||
    process.env.S3_BUCKET?.trim() ||
    'townpanchayat'
  );
}

export function getS3Region(): string {
  return process.env.S3_REGION?.trim() || 'ap-south-1';
}

/** Try primary bucket first, then legacy bucket names used in older uploads. */
export function getS3BucketCandidates(): string[] {
  const primary = getS3BucketName();
  const legacy = ['tms-2026', 'townpanchayat'];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const b of [primary, ...legacy]) {
    const key = String(b || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

export function legacyS3ObjectUrl(objectKey: string): string {
  const key = String(objectKey || '').replace(/^\/+/, '');
  if (!key) return '';
  const bucket = getS3BucketName();
  const region = getS3Region();
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}