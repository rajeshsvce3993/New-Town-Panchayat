import type { InspectionWorksFilterQuery } from '@/lib/inspectionWorksQueryFilters';
import { aggregateSwmTotals } from '@/lib/swmReportsAggregate';
import { resolveInspectionFilterMasters } from '@/lib/inspectionWorksFilterMastersServer';
import { getDb } from '@/lib/repositories/mastersRepository';

const DOC_ID = 'dashboard_swm_totals_global';

export type SwmTotalsDoc = {
  _id: string;
  totals: Awaited<ReturnType<typeof aggregateSwmTotals>>;
  builtAt: Date;
  filterKey: string;
};

const allTimeFilter = (): InspectionWorksFilterQuery => ({
  fromDate: null,
  toDate: null,
  dateParam: null,
  zoneId: null,
  districtId: null,
  tpId: null,
  ward: null,
  username: null,
  subjectId: null,
  categoryId: null,
  street: null,
  search: null,
  adminFieldId: null,
  adminFieldValue: null,
  scopeTpId: null,
  scopeZoneId: null,
  scopeDistrictId: null,
});

export async function refreshSwmDashboardTotals(requestOrigin?: string): Promise<SwmTotalsDoc | null> {
  try {
    const masters = await resolveInspectionFilterMasters(requestOrigin);
    const filter = allTimeFilter();
    const totals = await aggregateSwmTotals(filter, masters);
    const doc: SwmTotalsDoc = {
      _id: DOC_ID,
      totals,
      builtAt: new Date(),
      filterKey: 'global-allTime',
    };
    const db = await getDb();
    if (!db) return null;
    await db.collection('dashboard_swm_totals').updateOne({ _id: DOC_ID }, { $set: doc }, { upsert: true });
    return doc;
  } catch (err) {
    console.warn('[swmDashboardTotals] refresh:', err);
    return readSwmDashboardTotals();
  }
}

export async function readSwmDashboardTotals(): Promise<SwmTotalsDoc | null> {
  const db = await getDb();
  if (!db) return null;
  return (await db.collection<SwmTotalsDoc>('dashboard_swm_totals').findOne({ _id: DOC_ID })) as SwmTotalsDoc | null;
}