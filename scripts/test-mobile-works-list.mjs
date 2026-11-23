import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('username my-works lists skip the default today date window', () => {
  const repo = readFileSync(join(root, 'lib/inspectionWorksMongoRepository.ts'), 'utf8');
  assert.match(repo, /if \(filter\.username \|\| filter\.userId\) return filter;/);
});

test('mobile bootstrap fetches the user works all-time, not today only', () => {
  const client = readFileSync(join(root, 'mobile/src/api/client.ts'), 'utf8');
  assert.match(client, /allTime=1/);
  assert.match(client, /userId=/);
  assert.match(client, /mobile=/);
  assert.match(client, /fetchMyInspectionWorks/);
  assert.doesNotMatch(client, /includeFields=1&allTime=1/);
});

test('All date chip reloads that user full history', () => {
  const home = readFileSync(join(root, 'mobile/app/(tabs)/index.tsx'), 'utf8');
  const reports = readFileSync(join(root, 'mobile/app/(tabs)/reports.tsx'), 'utf8');
  assert.match(home, /void loadMyWorks\(\)/);
  assert.match(reports, /void loadMyWorks\(\)/);
});

test('username lite load uses targeted identity query, not everyone-today fallback', () => {
  const loader = readFileSync(join(root, 'lib/inspectionWorksLiteLoader.ts'), 'utf8');
  const route = readFileSync(join(root, 'app/api/inspection-works/route.ts'), 'utf8');
  const filters = readFileSync(join(root, 'lib/inspectionWorksQueryFilters.ts'), 'utf8');
  assert.match(loader, /myWorksOnly/);
  assert.match(loader, /getTargetedInspectionWorks\(\{/);
  assert.match(loader, /userId: filter\.userId/);
  assert.match(route, /mongo-user-all-time/);
  assert.match(filters, /skipDateWindow/);
});

test('dashboard and reports keep Today as the default date filter', () => {
  const reports = readFileSync(join(root, 'mobile/app/(tabs)/reports.tsx'), 'utf8');
  const home = readFileSync(join(root, 'mobile/app/(tabs)/index.tsx'), 'utf8');
  assert.match(reports, /useState\(todayDdMmYyyy\)/);
  assert.match(home, /useState\(todayDdMmYyyy\)/);
  assert.match(home, /isListedWork\(w\)/);
});

test('refresh keeps saved works even when workId is an older TP id or only on id', () => {
  const ctx = readFileSync(join(root, 'mobile/src/context/AppContext.tsx'), 'utf8');
  const save = readFileSync(join(root, 'mobile/src/utils/workSaveResult.ts'), 'utf8');
  assert.match(save, /export function isListedWorkId/);
  assert.match(save, /export function isListedWork/);
  assert.match(ctx, /isListedWork\(w\)/);
  assert.match(save, /isAssignedWorkId/);
});

test('work details lookup returns any saved work, not only WRK- ids', () => {
  const client = readFileSync(join(root, 'mobile/src/api/client.ts'), 'utf8');
  const route = readFileSync(join(root, 'app/api/inspection-works/route.ts'), 'utf8');
  const identity = readFileSync(join(root, 'lib/inspectionWorkIdentity.ts'), 'utf8');
  assert.match(client, /if \(fromWork\) return fromWork/);
  assert.doesNotMatch(client, /if \(fromWork && \/\^WRK-\/i/);
  assert.match(identity, /export function inspectionWorkLookupKeys/);
  assert.match(route, /inspectionWorkLookupKeys\(lookupId\)/);
});

test('mongo login identity uses indexed fields first, workId regex only on miss', () => {
  const identity = readFileSync(join(root, 'lib/inspectionWorkIdentity.ts'), 'utf8');
  const storage = readFileSync(join(root, 'lib/storage.ts'), 'utf8');
  const route = readFileSync(join(root, 'app/api/inspection-works/route.ts'), 'utf8');
  assert.match(identity, /export function loginIdentityMongoOr/);
  assert.match(identity, /export function loginIdentityWorkIdRegexOr/);
  assert.match(storage, /loginIdentityMongoOr\(uStr/);
  assert.match(storage, /loginIdentityWorkIdRegexOr/);
  assert.match(route, /loginIdentityMongoOr\(username \|\| '', \{ userId, mobile, employeeId \}\)/);
});
