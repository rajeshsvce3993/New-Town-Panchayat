import type { InspectionWork } from '../types/models';

/** One row per client id; synced server workId wins over pending duplicate ids. */
export function dedupeInspectionWorks(list: InspectionWork[]): InspectionWork[] {
  const byKey = new Map<string, InspectionWork>();
  for (const w of list) {
    if (!w) continue;
    const idKey = String(w.id || '').trim();
    const widKey = String(w.workId || '').trim();
    const key = widKey ? `wid:${widKey.toLowerCase()}` : idKey ? `id:${idKey}` : '';
    if (!key) continue;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, w);
      continue;
    }
    const prevSynced = !!String(prev.workId || '').trim();
    const nextSynced = !!widKey;
    if (!prevSynced && nextSynced) byKey.set(key, w);
  }
  return [...byKey.values()];
}
