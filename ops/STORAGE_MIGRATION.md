# `lib/storage.ts` split (incremental)

`storage.ts` remains the compatibility layer for saves, bootstrap, and S3 uploads. New code should import from dedicated entrypoints:

| Module | Use for |
|--------|---------|
| `@/lib/db` / `@/lib/db/mongo` | Mongo client, indexes, collection names |
| `@/lib/s3` | S3 client, presigned URLs, media/APK upload helpers |

## Done

- `lib/db/mongo.ts` — boot warm + re-exports
- `lib/db/index.ts` — barrel for server routes
- `lib/s3/index.ts` — barrel re-export (impl still in storage)

## Phase B (optional follow-up)

1. Move `getS3Client` + pool into `lib/s3/client.ts` (read creds from `process.env` only; drop `readLocalDb()` dependency).
2. Move `getCollectionWithAliases` + partition helpers into `lib/db/collections.ts`.
3. Keep `saveCollectionData` / `getPortalBootstrapState` in `storage.ts` until dedicated REST masters write API exists.

Admin **writes** still `POST /api/state`; reads use `GET /api/masters/list` via `lib/portalMastersClient.ts`.