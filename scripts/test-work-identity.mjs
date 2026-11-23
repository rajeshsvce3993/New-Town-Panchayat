import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function normalizeWorkIdentity(value) {
  return String(value || '').trim().toLowerCase();
}

function isLoosePersonName(value) {
  const v = String(value || '').trim();
  if (!v) return true;
  if (/^\d{10,12}$/.test(v)) return false;
  if (/^(iu|tp|wrk)[_-]/i.test(v)) return false;
  if (/^[a-z0-9._-]{3,}$/i.test(v) && !/\s/.test(v)) return false;
  return /\s/.test(v);
}

function workIdentityKeys(work) {
  return [
    work?.username,
    work?.submittedByUserId,
    work?.submittedByUserName,
    work?.userId,
    work?.mobile,
    work?.employeeId,
  ]
    .map((v) => normalizeWorkIdentity(v))
    .filter((v) => v && !isLoosePersonName(v));
}

function workBelongsToLogin(work, login) {
  const needle = normalizeWorkIdentity(login);
  if (!needle) return false;
  if (workIdentityKeys(work).includes(needle)) return true;
  const wid = String(work?.workId || '').toLowerCase();
  if (needle.length >= 8 && (wid.startsWith(`wrk-${needle}-`) || wid.includes(`-${needle}-`))) return true;
  return false;
}

test('Theni login does not receive Thiruvannamalai works by display name', () => {
  const theniLogin = '8870715287';
  const foreignWork = {
    username: '9944123456',
    submittedByUserId: 'iu_other',
    submittedByUserName: 'Ramesh Kumar',
    workId: 'WRK-9944123456-041126120000',
  };
  assert.equal(workBelongsToLogin(foreignWork, theniLogin), false);
  assert.equal(workBelongsToLogin(foreignWork, 'Ramesh Kumar'), false);
});

test('older work stored with mobile still belongs to the same login', () => {
  const oldWork = {
    submittedByUserName: '8870715287',
    workId: 'TP01041200001',
  };
  assert.equal(workBelongsToLogin(oldWork, '8870715287'), true);
});

test('older work stored with employeeId still belongs to the same login', () => {
  const oldWork = {
    employeeId: 'EMP001',
    workId: 'TP01041200001',
  };
  assert.equal(workBelongsToLogin(oldWork, 'EMP001'), true);
});

test('owner list matches either login username or user id', () => {
  const ownById = {
    submittedByUserId: 'iu_theni',
    submittedByUserName: 'Ramesh Kumar',
    workId: 'TP01041200001',
  };
  assert.equal(workBelongsToLogin(ownById, 'iu_theni'), true);
  assert.equal(workBelongsToLogin(ownById, '8870715287'), false);
});

test('exact username / user id still match the owner', () => {
  const own = {
    username: '8870715287',
    submittedByUserId: 'iu_theni',
    submittedByUserName: '8870715287',
    workId: 'WRK-8870715287-041126120000',
  };
  assert.equal(workBelongsToLogin(own, '8870715287'), true);
  assert.equal(workBelongsToLogin(own, 'iu_theni'), true);
});

test('source no longer uses includes() username matching or name-based inspector lookup', () => {
  const filters = readFileSync(join(root, 'lib/inspectionWorksQueryFilters.ts'), 'utf8');
  const storage = readFileSync(join(root, 'lib/storage.ts'), 'utf8');
  const geo = readFileSync(join(root, 'lib/inspectionWorkGeoStamp.ts'), 'utf8');
  const mobile = readFileSync(join(root, 'mobile/src/utils/workFilters.ts'), 'utf8');
  const addWork = readFileSync(join(root, 'mobile/app/(tabs)/add-work.tsx'), 'utf8');
  assert.match(filters, /workBelongsToLogin/);
  assert.doesNotMatch(filters, /u\.includes\(uLower\)/);
  assert.doesNotMatch(storage, /nameEn: String\(userName\)/);
  assert.match(geo, /inspectorAssignedWins/);
  assert.match(mobile, /workBelongsToUser/);
  assert.match(addWork, /tpId: activeTpId/);
  assert.match(addWork, /username: user\?\.username/);
});
