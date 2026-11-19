/**
 * S3 entrypoint — implementation still lives in `lib/storage.ts` until Phase B extract.
 */
export {
  getS3Client,
  getPresignedS3Url,
  uploadInspectionMediaToS3,
  uploadApkReleaseToS3,
} from '@/lib/storage';