import * as FileSystem from 'expo-file-system/legacy';
import type { InspectionWork, QueuedWorkEntry } from '../types/models';
import { QUEUE_STATUS } from '../types/models';
import { isAssignedWorkId } from '../utils/workSaveResult';

const QUEUE_DIR = `${FileSystem.documentDirectory}offline_queue/`;
const WORKS_DIR = `${FileSystem.documentDirectory}offline_works/`;
const IMAGES_DIR = `${FileSystem.documentDirectory}offline_images/`;

let storeTail: Promise<void> = Promise.resolve();

function withStoreLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = storeTail.then(fn, fn);
  storeTail = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function safeName(id: string) {
  return String(id || 'unknown')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80);
}

function clientFolder(id: string) {
  return `${IMAGES_DIR}${safeName(id)}`;
}

async function ensureDir(dir: string) {
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
}

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const raw = await FileSystem.readAsStringAsync(path);
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Write dest only after tmp is valid. Never delete dest first. */
async function writeJsonFile(path: string, value: unknown) {
  const tmp = `${path}.tmp`;
  const payload = JSON.stringify(value);
  await FileSystem.writeAsStringAsync(tmp, payload);
  const verify = await FileSystem.readAsStringAsync(tmp);
  JSON.parse(verify);
  try {
    await FileSystem.copyAsync({ from: tmp, to: path });
  } catch {
    await FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
    await FileSystem.copyAsync({ from: tmp, to: path });
  }
  const dest = await FileSystem.readAsStringAsync(path);
  JSON.parse(dest);
  await FileSystem.deleteAsync(tmp, { idempotent: true }).catch(() => undefined);
}

async function promoteTmpIfNeeded(dir: string, names: string[]) {
  for (const name of [...names]) {
    if (!name.endsWith('.json.tmp')) continue;
    const dest = name.replace(/\.tmp$/, '');
    if (names.includes(dest)) continue;
    try {
      await FileSystem.copyAsync({ from: `${dir}${name}`, to: `${dir}${dest}` });
      JSON.parse(await FileSystem.readAsStringAsync(`${dir}${dest}`));
      names.push(dest);
    } catch {
      /* leave tmp for the next pass */
    }
  }
}

async function listJsonFiles<T>(dir: string): Promise<T[]> {
  await ensureDir(dir);
  let names: string[] = [];
  try {
    names = await FileSystem.readDirectoryAsync(dir);
  } catch {
    return [];
  }
  await promoteTmpIfNeeded(dir, names);
  const out: T[] = [];
  for (const name of names) {
    if (!name.endsWith('.json') || name.endsWith('.tmp')) continue;
    const item = await readJsonFile<T>(`${dir}${name}`);
    if (item) out.push(item);
  }
  return out;
}

async function listQueuedWorksUnlocked(): Promise<QueuedWorkEntry[]> {
  return (await listJsonFiles<QueuedWorkEntry>(QUEUE_DIR))
    .filter((e) => e && e.work && e.clientTaskId)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

async function listOfflineWorksUnlocked(): Promise<InspectionWork[]> {
  return (await listJsonFiles<InspectionWork>(WORKS_DIR)).filter((w) => w && w.id);
}

async function writeQueuedWorkUnlocked(entry: QueuedWorkEntry): Promise<void> {
  const id = String(entry.clientTaskId || entry.work?.id || '').trim();
  if (!id) return;
  await ensureDir(QUEUE_DIR);
  await writeJsonFile(`${QUEUE_DIR}${safeName(id)}.json`, { ...entry, clientTaskId: id });
}

async function writeOfflineWorkUnlocked(work: InspectionWork): Promise<void> {
  const id = String(work.id || '').trim();
  if (!id) return;
  await ensureDir(WORKS_DIR);
  await writeJsonFile(`${WORKS_DIR}${safeName(id)}.json`, { ...work, workId: work.workId || '' });
}

async function removeQueuedWorkFileUnlocked(clientTaskId: string): Promise<void> {
  const id = String(clientTaskId || '').trim();
  if (!id) return;
  const base = `${QUEUE_DIR}${safeName(id)}`;
  await FileSystem.deleteAsync(`${base}.json`, { idempotent: true }).catch(() => undefined);
  await FileSystem.deleteAsync(`${base}.json.tmp`, { idempotent: true }).catch(() => undefined);
}

async function removeOfflineWorkFileUnlocked(id: string): Promise<void> {
  const key = String(id || '').trim();
  if (!key) return;
  const base = `${WORKS_DIR}${safeName(key)}`;
  await FileSystem.deleteAsync(`${base}.json`, { idempotent: true }).catch(() => undefined);
  await FileSystem.deleteAsync(`${base}.json.tmp`, { idempotent: true }).catch(() => undefined);
}

type OfflineDraft = { work: InspectionWork; createdAt: number };

async function readDraft(id: string): Promise<OfflineDraft | null> {
  return readJsonFile<OfflineDraft>(`${clientFolder(id)}/meta.json`);
}

export async function writeOfflineDraft(work: InspectionWork): Promise<string> {
  return withStoreLock(async () => {
    const id = String(work.id || '').trim();
    if (!id) throw new Error('Missing client work id');
    const dir = clientFolder(id);
    await ensureDir(dir);
    await writeJsonFile(`${dir}/meta.json`, { work: { ...work, id, workId: '' }, createdAt: Date.now() });
    return dir;
  });
}

async function pendingIdsUnlocked(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const e of await listQueuedWorksUnlocked()) {
    if (e.status === QUEUE_STATUS.SUBMITTED) continue;
    if (e.clientTaskId) ids.add(e.clientTaskId);
    if (e.work?.id) ids.add(e.work.id);
  }
  for (const w of await listOfflineWorksUnlocked()) {
    if (isAssignedWorkId(w.workId)) continue;
    if (w.id) ids.add(w.id);
  }
  return ids;
}

function firstPhotoInFields(work: InspectionWork, folder: string, files: string[]): InspectionWork {
  const photos = files.filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  const fields = { ...(work.fieldsData || {}) };
  let imageUrl = work.imageUrl || '';
  for (const file of photos) {
    const uri = `${folder}/${file}`;
    if (!imageUrl || imageUrl === '' || !imageUrl.includes(folder)) imageUrl = uri;
  }
  return { ...work, imageUrl, fieldsData: fields, workId: '' };
}

async function recoverOrphansUnlocked(): Promise<void> {
  await ensureDir(IMAGES_DIR);
  let folders: string[] = [];
  try {
    folders = await FileSystem.readDirectoryAsync(IMAGES_DIR);
  } catch {
    return;
  }
  const queued = await listQueuedWorksUnlocked();
  const known = new Set(queued.map((e) => e.clientTaskId));
  for (const e of queued) {
    if (e.work?.id) known.add(e.work.id);
  }

  for (const name of folders) {
    if (!name || name.startsWith('.')) continue;
    const folder = `${IMAGES_DIR}${name}`;
    const info = await FileSystem.getInfoAsync(folder);
    if (!info.exists || !info.isDirectory) continue;

    const synced = await readJsonFile<{ workId?: string }>(`${folder}/synced.json`);
    if (synced && isAssignedWorkId(synced.workId) && !known.has(name)) continue;

    if (known.has(name)) continue;

    const draft = await readDraft(name);
    if (!draft?.work?.id || isAssignedWorkId(draft.work.workId)) continue;
    const files = await FileSystem.readDirectoryAsync(folder).catch(() => [] as string[]);

    const work = firstPhotoInFields(draft.work, folder, files);
    if (!work.id) continue;
    await writeOfflineWorkUnlocked(work);
    await writeQueuedWorkUnlocked({
      clientTaskId: work.id,
      work,
      localPhotoPath: work.imageUrl || null,
      status: QUEUE_STATUS.IN_QUEUE,
      progress: 10,
      attemptCount: 0,
      createdAt: draft?.createdAt || Date.now(),
    });
    known.add(work.id);
  }
}

async function sweepLeftoverUnlocked(force = false): Promise<number> {
  const pending = await pendingIdsUnlocked();
  await ensureDir(IMAGES_DIR);
  let deleted = 0;
  let names: string[] = [];
  try {
    names = await FileSystem.readDirectoryAsync(IMAGES_DIR);
  } catch {
    return 0;
  }
  for (const name of names) {
    if (pending.has(name)) continue;
    const folder = `${IMAGES_DIR}${name}`;
    const draft = await readDraft(name);
    const synced = await readJsonFile<{ workId?: string }>(`${folder}/synced.json`);
    const confirmed = isAssignedWorkId(synced?.workId) || isAssignedWorkId(draft?.work?.workId);
    const files = await FileSystem.readDirectoryAsync(folder).catch(() => [] as string[]);
    const empty = files.length === 0;
    if (!force && !confirmed && !empty) continue;
    await FileSystem.deleteAsync(folder, { idempotent: true }).catch(() => undefined);
    deleted += 1;
  }
  return deleted;
}

export async function listQueuedWorks(): Promise<QueuedWorkEntry[]> {
  return withStoreLock(async () => {
    await recoverOrphansUnlocked();
    return listQueuedWorksUnlocked();
  });
}

export async function listOfflineWorks(): Promise<InspectionWork[]> {
  return withStoreLock(async () => {
    await recoverOrphansUnlocked();
    return listOfflineWorksUnlocked();
  });
}

export async function writeQueuedWork(entry: QueuedWorkEntry): Promise<void> {
  return withStoreLock(() => writeQueuedWorkUnlocked(entry));
}

export async function writeOfflineWork(work: InspectionWork): Promise<void> {
  return withStoreLock(() => writeOfflineWorkUnlocked(work));
}

export async function updateQueuedWorkFile(
  clientTaskId: string,
  update: (e: QueuedWorkEntry) => void
): Promise<QueuedWorkEntry | null> {
  return withStoreLock(async () => {
    const path = `${QUEUE_DIR}${safeName(clientTaskId)}.json`;
    const current = (await readJsonFile<QueuedWorkEntry>(path)) || null;
    if (!current) return null;
    update(current);
    await writeJsonFile(path, current);
    return current;
  });
}

export async function removeQueuedWorkFile(clientTaskId: string): Promise<void> {
  return withStoreLock(() => removeQueuedWorkFileUnlocked(clientTaskId));
}

export async function removeOfflineWorkFile(id: string): Promise<void> {
  return withStoreLock(() => removeOfflineWorkFileUnlocked(id));
}

export async function saveOfflineWorkAtomic(entry: QueuedWorkEntry, work: InspectionWork): Promise<void> {
  return withStoreLock(async () => {
    const id = String(entry.clientTaskId || work.id || '').trim();
    if (!id) throw new Error('Missing client work id');
    const pending: InspectionWork = { ...work, id, workId: '' };
    await writeOfflineWorkUnlocked(pending);
    await writeQueuedWorkUnlocked({
      ...entry,
      clientTaskId: id,
      work: pending,
      status: entry.status || QUEUE_STATUS.IN_QUEUE,
    });
  });
}

export async function markWorkSyncedAndRemove(clientId: string, workId?: string): Promise<void> {
  return withStoreLock(async () => {
    const id = String(clientId || '').trim();
    if (!id || !isAssignedWorkId(workId)) return;
    const stillThere = (await listQueuedWorksUnlocked()).some((e) => e.clientTaskId === id);
    if (!stillThere) return;
    await removeOfflineWorkFileUnlocked(id);
    await removeQueuedWorkFileUnlocked(id);
    await FileSystem.deleteAsync(clientFolder(id), { idempotent: true }).catch(() => undefined);
  });
}

export async function sweepLeftoverOfflineCache(force = false): Promise<number> {
  return withStoreLock(async () => {
    await recoverOrphansUnlocked();
    return sweepLeftoverUnlocked(force);
  });
}

export async function importLegacyLists(queue: QueuedWorkEntry[], works: InspectionWork[]) {
  return withStoreLock(async () => {
    for (const w of works) {
      if (w?.id && !String(w.workId || '').trim()) await writeOfflineWorkUnlocked(w);
    }
    for (const e of queue) {
      if (e?.clientTaskId && e.status !== QUEUE_STATUS.SUBMITTED) await writeQueuedWorkUnlocked(e);
    }
  });
}
