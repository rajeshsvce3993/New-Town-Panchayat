import type { CachedUserScope } from '@/lib/userScopeCache';
import {
  getUserScopeDetails,
  getUserScopeDetailsForLogin,
  getUserScopeFromCacheOnly,
} from '@/lib/userScopeCache';
import { isLiveDataOnly } from '@/lib/productionFlags';
import { buildLiveUserScope, useLiveInspectionScope } from '@/lib/services/liveUserScope';

export type ResolveScopeOptions = {
  mobileClient?: boolean;
  timeoutMs?: number;
  login?: boolean;
};

/**
 * Single entry for inspection scope: live Mongo when production flags / mobile; legacy cache otherwise.
 */
export async function resolveInspectionUserScope(
  identifier: string,
  opts: ResolveScopeOptions = {},
): Promise<CachedUserScope | null> {
  const key = (identifier || '').trim();
  if (!key) return null;

  const live = useLiveInspectionScope(opts.mobileClient) || isLiveDataOnly();
  const ms = Math.min(Math.max(opts.timeoutMs ?? 10_000, 4_000), 15_000);

  if (live) {
    return buildLiveUserScope(key, ms);
  }

  if (opts.login) {
    const cached = await getUserScopeFromCacheOnly(key);
    if (cached) return cached;
    return getUserScopeDetailsForLogin(key, ms);
  }

  return getUserScopeDetails(key);
}