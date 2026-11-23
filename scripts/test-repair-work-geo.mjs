import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyInspectorScope,
  geoDiffers,
  geoPatchFromMasters,
  inspectorNeedles,
  isLoosePersonName,
  pickTargetTp,
  streetPatchFromRows,
  workOwnerFilter,
} from './repair-inspection-works-geo.mjs';

test('identity needles skip display names', () => {
  assert.equal(isLoosePersonName('Ramesh Kumar'), true);
  assert.equal(isLoosePersonName('8870715287'), false);
  assert.deepEqual(inspectorNeedles({ username: '8870715287', id: 'iu_theni', mobile: '8870715287' }), [
    '8870715287',
    'iu_theni',
  ]);
  const filter = workOwnerFilter(['8870715287', 'iu_theni'], '8870715287');
  assert.ok(filter.$or.some((clause) => clause.username === '8870715287'));
  assert.ok(!JSON.stringify(filter).includes('Ramesh'));
});

test('single-TP leftover Tiruvannamalai TP is replaced by assigned Theni TP', () => {
  assert.equal(classifyInspectorScope({ roleId: 'role_field_worker', tpId: 'tp_theni' }), 'single_tp');
  const theni = { id: 'tp_theni', nameEn: 'Aundipatti', districtId: 'd_theni' };
  const picked = pickTargetTp({ tpId: 'tp_tvmalai', tpNameEn: 'Tiruvannamalai' }, [theni], 'single_tp');
  assert.equal(picked.id, 'tp_theni');
  const patch = geoPatchFromMasters(theni, { id: 'd_theni', nameEn: 'Theni', zoneId: 'z_south' }, { id: 'z_south', nameEn: 'South' });
  assert.equal(geoDiffers({ tpId: 'tp_tvmalai', districtNameEn: 'Tiruvannamalai' }, patch), true);
  assert.equal(patch.districtNameEn, 'Theni');
});

test('zonal works keep an in-zone selected TP and do not fall back to leftover selectedTpIds[0]', () => {
  assert.equal(classifyInspectorScope({ roleId: 'role_zonal', zoneId: 'z_south', selectedTpIds: ['tp_tvmalai'] }), 'zonal');
  const zoneTps = [
    { id: 'tp_theni', nameEn: 'Aundipatti' },
    { id: 'tp_cumbum', nameEn: 'Cumbum' },
  ];
  const keep = pickTargetTp({ tpId: 'tp_cumbum' }, zoneTps, 'zonal');
  assert.equal(keep.id, 'tp_cumbum');
  const leftover = pickTargetTp({ tpId: 'tp_tvmalai' }, zoneTps, 'zonal');
  assert.equal(leftover, null);
});

test('street/ward remap only when unique on the target TP', () => {
  const rows = [
    { id: 's1', wardNo: '4', streetNameEn: 'Selvaraj Street', streetNameTa: 'செல்வராஜ் தெரு' },
    { id: 's2', wardNo: '5', streetNameEn: 'Market Road', streetNameTa: 'மார்க்கெட் ரோடு' },
  ];
  const patch = streetPatchFromRows({ streetName: 'Selvaraj Street', wardNumber: '9' }, rows);
  assert.equal(patch.wardNumber, '4');
  assert.equal(patch.streetNameTa, 'செல்வராஜ் தெரு');
  assert.equal(streetPatchFromRows({ streetName: 'Unknown Lane' }, rows), null);
});
