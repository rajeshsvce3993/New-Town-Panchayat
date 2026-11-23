import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('Add Work GPS is mandatory and shows the system allow prompt', () => {
  const addWork = readFileSync(join(root, 'mobile/app/(tabs)/add-work.tsx'), 'utf8');
  const gps = readFileSync(join(root, 'mobile/src/utils/gpsLocation.ts'), 'utf8');
  const ctx = readFileSync(join(root, 'mobile/src/context/AppContext.tsx'), 'utf8');

  assert.doesNotMatch(addWork, /useState\(12\.7244\)/);
  assert.doesNotMatch(addWork, /useState\(80\.1873\)/);
  assert.doesNotMatch(addWork, /acquireGps\(\{ forSubmit: true, silent: true \}\)/);
  assert.match(addWork, /forSubmit: true, silent: false/);
  assert.match(addWork, /GPS location is required to add work/);
  assert.match(addWork, /isPlaceholderCoord\(submitLat, submitLng\)/);
  assert.match(gps, /mayShowUserSettingsDialog:\s*true/);
  assert.doesNotMatch(ctx, /Location\.requestForegroundPermissionsAsync/);
});

test('Reports/details keep the work document place and do not infer district from leftover TP', () => {
  const wp = readFileSync(join(root, 'mobile/src/utils/workPlace.ts'), 'utf8');
  assert.match(wp, /const workTp = liveName\(isTamil, work\.tpNameTa, work\.tpNameEn\)/);
  assert.match(wp, /findById\(portal\.districts, row\.districtId\)/);
  assert.doesNotMatch(wp, /findById\(portal\.districts, tp\?\.districtId\)/);
  assert.doesNotMatch(wp, /findById\(portal\.zones, tp\?\.zoneId/);
});

test('POST inspection-works reads live Mongo scope, not user_scope_cache', () => {
  const route = readFileSync(join(root, 'app/api/inspection-works/route.ts'), 'utf8');
  assert.match(route, /buildLiveUserScope/);
  assert.doesNotMatch(route, /getUserScopeDetails/);
  assert.doesNotMatch(route, /user_scope_cache/);
});

test('offline queue/sync files are not rewritten by this GPS/place change', () => {
  const pipeline = readFileSync(join(root, 'mobile/src/services/workPipeline.ts'), 'utf8');
  const sync = readFileSync(join(root, 'mobile/src/services/queueSync.ts'), 'utf8');
  assert.match(pipeline, /submitAddWork/);
  assert.match(sync, /syncPendingWorks/);
});
