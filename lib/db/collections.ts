/**
 * Collection access — re-exported from legacy storage during migration.
 * New code should import from here or repositories, not `@/lib/storage` directly.
 */
export { getCollectionWithAliases, getCollectionData } from '@/lib/storage';