import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { stampWorkGeoFromMasters, workHasMasterTpId } = require(join(root, 'lib/stampWorkGeo.js'));

const masters = {
  townPanchayats: [
    { id: '64abc123def456', nameEn: 'Theni TP', nameTa: 'தேனி', districtId: 'dist_theni', zoneId: 'z_madurai' },
    { id: 'tp_leftover', nameEn: 'Tiruvannamalai TP', districtId: 'dist_tvmalai', zoneId: 'z_tvmalai' },
  ],
  districts: [
    { id: 'dist_theni', nameEn: 'Theni', zoneId: 'z_madurai' },
    { id: 'dist_tvmalai', nameEn: 'Tiruvannamalai', zoneId: 'z_tvmalai' },
  ],
  zones: [
    { id: 'z_madurai', nameEn: 'Madurai' },
    { id: 'z_tvmalai', nameEn: 'Tiruvannamalai' },
  ],
  inspector: {
    tpId: 'tp_leftover',
    selectedTpIds: ['tp_leftover'],
  },
};

test('workHasMasterTpId accepts any non-empty tp id, not only tp_ prefix', () => {
  assert.equal(workHasMasterTpId({ tpId: '64abc123def456' }), true);
  assert.equal(workHasMasterTpId({ tpId: 'tp_theni' }), true);
  assert.equal(workHasMasterTpId({ townPanchayatId: 'custom-tp-id' }), true);
  assert.equal(workHasMasterTpId({}), false);
});

test('selected master id wins over leftover inspector TP', () => {
  const stamped = stampWorkGeoFromMasters(
    { tpId: '64abc123def456', tpNameEn: 'Theni TP' },
    masters
  );
  assert.equal(stamped.tpId, '64abc123def456');
  assert.equal(stamped.districtId, 'dist_theni');
  assert.equal(stamped.zoneId, 'z_madurai');
  assert.equal(stamped.districtNameEn, 'Theni');
});

test('inspector leftover TP is not copied when the work already has a tpId', () => {
  const stamped = stampWorkGeoFromMasters(
    { tpId: 'unknown-selected-tp', tpNameEn: 'Theni TP', districtId: 'dist_theni', zoneId: 'z_madurai' },
    masters
  );
  assert.equal(stamped.tpId, 'unknown-selected-tp');
  assert.notEqual(stamped.tpId, 'tp_leftover');
  assert.notEqual(stamped.districtId, 'dist_tvmalai');
});

test('single-TP save overwrites leftover Kilpennathur tpId with assigned place', () => {
  const geo = readFileSync(join(root, 'lib/inspectionWorkGeoStamp.ts'), 'utf8');
  const scope = readFileSync(join(root, 'lib/inspectionScopeMasters.ts'), 'utf8');
  assert.match(geo, /inspectorAssignedWins/);
  assert.match(geo, /export function isSingleTpScope/);
  assert.match(scope, /return single \? \[single\] : \[\]/);
});
