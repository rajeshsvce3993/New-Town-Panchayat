import { extractCalendarDateYMD } from '@/lib/inspectionDate';

/** Denormalized fields for fast report $match / $group (IST calendar date). */
export function deriveSubmittedDateYmd(work: any): string | null {
  if (!work || typeof work !== 'object') return null;
  if (work.submittedDateYmd && /^\d{4}-\d{2}-\d{2}$/.test(String(work.submittedDateYmd))) {
    return String(work.submittedDateYmd);
  }
  const fd = work.fieldsData;
  const fromFields =
    fd && typeof fd === 'object'
      ? fd['if_7'] || fd['Inspection Date'] || fd['inspectionDate']
      : null;
  return (
    extractCalendarDateYMD(work.submittedAt) ||
    extractCalendarDateYMD(work.createdAt) ||
    extractCalendarDateYMD(work.date) ||
    extractCalendarDateYMD(work.inspectionDate) ||
    extractCalendarDateYMD(fromFields)
  );
}

/** One-time / batch backfill for existing Mongo rows (run after deploy). */
export async function backfillInspectionWorksReportIndexFields(limit = 2000): Promise<{ scanned: number; updated: number }> {
  const { getMongoClient, getActiveMongoDb, getCollectionWithAliases } = await import('@/lib/storage');
  const client = await getMongoClient();
  if (!client) return { scanned: 0, updated: 0 };
  const db = await getActiveMongoDb(client);
  const col = await getCollectionWithAliases(db, 'inspectionWorks');
  const cursor = col
    .find({
      $or: [
        { submittedDateYmd: { $exists: false } },
        { submittedDateYmd: null },
        { submittedDateYmd: '' },
      ],
    })
    .limit(Math.min(Math.max(limit, 1), 10_000));
  let scanned = 0;
  let updated = 0;
  for await (const doc of cursor) {
    scanned += 1;
    const next = attachInspectionWorkReportIndexFields(doc);
    if (next.submittedDateYmd && next.submittedDateYmd !== doc.submittedDateYmd) {
      await col.updateOne({ _id: doc._id }, { $set: { submittedDateYmd: next.submittedDateYmd } });
      updated += 1;
    }
  }
  return { scanned, updated };
}

export function attachInspectionWorkReportIndexFields(work: any): any {
  if (!work || typeof work !== 'object') return work;
  const submittedDateYmd = deriveSubmittedDateYmd(work);
  const wardNumber =
    work.wardNumber ??
    work.wardNo ??
    work.ward ??
    (work.wardNumber === 0 ? 0 : undefined);
  return {
    ...work,
    ...(submittedDateYmd ? { submittedDateYmd } : {}),
    ...(wardNumber !== undefined && wardNumber !== null && wardNumber !== ''
      ? { wardNumber: String(wardNumber) }
      : {}),
  };
}
