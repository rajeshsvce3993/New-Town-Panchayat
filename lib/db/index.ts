/**
 * Prefer importing Mongo helpers from here in new server code instead of `@/lib/storage`.
 */
export { getMongoClient, getActiveMongoDb, ensureDatabaseIndexes, warmMongoOnBoot } from './mongo';

export {
  getDefaultDbName,
  getCollectionWithAliases,
  resetMongoClient,
} from '@/lib/storage';