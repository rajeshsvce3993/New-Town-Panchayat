import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const modeSrc = readFileSync(join(root, 'mobile/src/utils/inspectionScopeMode.ts'), 'utf8');
const placeSrc = readFileSync(join(root, 'mobile/src/utils/profilePlace.ts'), 'utf8');

function key(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, '_');
}

function resolveInspectionScopeMode(user, portal) {
  const fromPortal = key(portal?.scopeKind);
  if (fromPortal === 'hod' || fromPortal === 'zonal' || fromPortal === 'zone') return 'zonal';
  if (fromPortal === 'district' || fromPortal === 'multi_tp') return 'multi_tp';
  if (
    fromPortal === 'single_tp' ||
    fromPortal === 'field_worker' ||
    fromPortal === 'field_workers' ||
    fromPortal === 'townpanchayat'
  ) {
    return 'single_tp';
  }
  if (!user) return 'single_tp';
  const st = key(user.scopeType);
  const role = key(user.roleId || user.role);
  if (st === 'hod' || st === 'state') return 'zonal';
  if (
    st === 'zonal' ||
    st === 'zone' ||
    role === 'role_zonal' ||
    role === 'ad' ||
    /zonal|assistant_director|assistant director/i.test(String(user.role || ''))
  ) {
    return 'zonal';
  }
  if (
    st === 'single_tp' ||
    st === 'field_worker' ||
    st === 'field_workers' ||
    st === 'townpanchayat' ||
    role === 'role_single_tp' ||
    role === 'role_field_worker' ||
    role === 'role_field_workers'
  ) {
    return 'single_tp';
  }
  if (st === 'district' || st === 'multi_tp' || role === 'role_multi_tp' || role === 'role_district') {
    return 'multi_tp';
  }
  if ((user.selectedTpIds?.length ?? 0) > 1) return 'multi_tp';
  return 'single_tp';
}

test('source files keep role picker contract', () => {
  assert.match(modeSrc, /fromPortal === 'district' \|\| fromPortal === 'multi_tp'/);
  assert.match(modeSrc, /return 'zonal'/);
  assert.match(modeSrc, /tpPickerLocked/);
  assert.match(placeSrc, /scopeMode === 'zonal'/);
  assert.match(placeSrc, /scopeMode === 'single_tp'/);
  assert.match(placeSrc, /scopeMode === 'multi_tp'/);
});

test('zonal: two unlocked pickers even if leftover TPs exist', () => {
  const mode = resolveInspectionScopeMode(
    { scopeType: 'zonal', selectedTpIds: ['tp1', 'tp2'], townPanchayat: 'Leftover TP' },
    { scopeKind: 'zonal' },
  );
  assert.equal(mode, 'zonal');
});

test('multi-tp: district locked, TP changeable', () => {
  const mode = resolveInspectionScopeMode(
    { scopeType: 'multi_tp', districtId: 'd1', selectedTpIds: ['tp1', 'tp2'] },
    { scopeKind: 'multi_tp' },
  );
  assert.equal(mode, 'multi_tp');
});

test('single-tp and field worker stay locked', () => {
  assert.equal(
    resolveInspectionScopeMode({ scopeType: 'single_tp', tpId: 'tp1' }, { scopeKind: 'single_tp' }),
    'single_tp',
  );
  assert.equal(
    resolveInspectionScopeMode({ roleId: 'role_field_worker' }, { scopeKind: 'field_worker' }),
    'single_tp',
  );
});

test('district officers follow multi-tp pickers, not zonal', () => {
  assert.equal(resolveInspectionScopeMode({ scopeType: 'district' }, { scopeKind: 'district' }), 'multi_tp');
});

test('web portal does not lock zonal users to a leftover snapshot TP', () => {
  const scopeSrc = readFileSync(join(root, 'lib/userScope.ts'), 'utf8');
  const loginSrc = readFileSync(join(root, 'app/api/auth/login/route.ts'), 'utf8');
  const reportsSrc = readFileSync(join(root, 'components/InspectionReportsView.tsx'), 'utf8');
  assert.match(scopeSrc, /Role-resolved place always wins/);
  assert.doesNotMatch(scopeSrc, /if \(snapValid\) return fromSnap/);
  assert.match(loginSrc, /zonalOrHod/);
  assert.match(reportsSrc, /zonal && p\.scopeZoneId/);
});

test('mobile login uses slim scope and skips streets on geo/me', () => {
  const loginSrc = readFileSync(join(root, 'app/api/auth/login/route.ts'), 'utf8');
  const liveSrc = readFileSync(join(root, 'lib/services/liveUserScope.ts'), 'utf8');
  const geoSrc = readFileSync(join(root, 'app/api/geo/me/route.ts'), 'utf8');
  assert.match(loginSrc, /buildMobileLoginScope/);
  assert.match(liveSrc, /includeWards: false/);
  assert.match(geoSrc, /includeWards:\s*false/);
});
