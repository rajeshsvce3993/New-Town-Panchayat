import type { InspectionWorksFilterMasters, InspectionWorksFilterQuery } from '@/lib/inspectionWorksQueryFilters';
import { buildReportsMongoMatch } from '@/lib/inspectionWorksReportsAggregate';
import { getActiveMongoDb, getCollectionWithAliases, getMongoClient } from '@/lib/storage';
import { MONGO_NO_ANSWER_REGEX, MONGO_YES_ANSWER_REGEX } from '@/lib/yesNoAnswer';

export type SwmSummaryGroup = {
  zoneId: string;
  zoneNameEn: string;
  zoneNameTa: string;
  districtId: string;
  districtNameEn: string;
  districtNameTa: string;
  tpId: string;
  tpNameEn: string;
  tpNameTa: string;
  wardNumber: string;
  streetName: string;
  householdsSurveyed: number;
  segregating: number;
  notSegregating: number;
  doorLocked: number;
  homeComposting: number;
};

function mongoString(expr: unknown) {
  return { $convert: { input: expr, to: 'string', onError: '', onNull: '' } };
}

function unwrapFieldValue(expr: unknown) {
  return {
    $let: {
      vars: { raw: expr },
      in: {
        $cond: [
          { $eq: [{ $type: '$$raw' }, 'object'] },
          {
            $ifNull: [
              { $getField: { field: 'value', input: '$$raw' } },
              {
                $ifNull: [
                  { $getField: { field: 'label', input: '$$raw' } },
                  { $ifNull: [{ $getField: { field: 'nameEn', input: '$$raw' } }, ''] },
                ],
              },
            ],
          },
          { $ifNull: ['$$raw', ''] },
        ],
      },
    },
  };
}

function fieldValueExpr(key: string) {
  const raw = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
    ? `$fieldsData.${key}`
    : { $getField: { field: key, input: { $ifNull: ['$fieldsData', {}] } } };
  return unwrapFieldValue(raw);
}

function firstFieldValue(keys: string[]) {
  const unique = [...new Set(keys.map((k) => String(k || '').trim()).filter(Boolean))].slice(0, 8);
  return unique.reduceRight((acc: unknown, key) => {
    const expr = fieldValueExpr(key);
    return {
      $let: {
        vars: { cur: expr },
        in: {
          $cond: [
            {
              $or: [
                { $eq: ['$$cur', null] },
                { $eq: ['$$cur', ''] },
                { $eq: [{ $toString: { $ifNull: ['$$cur', ''] } }, ''] },
              ],
            },
            acc,
            '$$cur',
          ],
        },
      },
    };
  }, '');
}

function collectIdentKeys(
  masters: InspectionWorksFilterMasters | undefined,
  pred: (blob: string) => boolean,
  extras: string[]
) {
  const keys = [...extras];
  for (const field of masters?.inspectionFields || []) {
    const blob = [field?.id, field?.nameEn, field?.nameTa, field?.fieldName, field?.fieldNameTa]
      .map((x) => String(x || '').toLowerCase())
      .join(' | ');
    if (!pred(blob)) continue;
    keys.push(
      String(field?.id || '').trim(),
      String(field?.fieldKey || '').trim(),
      String(field?.fieldName || '').trim(),
      String(field?.nameEn || '').trim(),
      String(field?.nameTa || '').trim()
    );
  }
  return keys;
}

function normalizedAnswer(expr: unknown) {
  return {
    $toLower: {
      $trim: { input: mongoString(expr) },
    },
  };
}

function mongoIsYes(expr: unknown) {
  return {
    $regexMatch: {
      input: normalizedAnswer(expr),
      regex: MONGO_YES_ANSWER_REGEX,
      options: 'i',
    },
  };
}

function mongoIsNo(expr: unknown) {
  return {
    $regexMatch: {
      input: normalizedAnswer(expr),
      regex: MONGO_NO_ANSWER_REGEX,
      options: 'i',
    },
  };
}

function swmHouseholdSums() {
  return {
    householdsSurveyed: { $sum: 1 },
    segregating: {
      $sum: { $cond: [{ $and: [{ $not: ['$swmFlags.doorLocked'] }, '$swmFlags.segYes'] }, 1, 0] },
    },
    notSegregating: {
      $sum: { $cond: [{ $and: [{ $not: ['$swmFlags.doorLocked'] }, '$swmFlags.segNo'] }, 1, 0] },
    },
    doorLocked: { $sum: { $cond: ['$swmFlags.doorLocked', 1, 0] } },
    homeComposting: { $sum: { $cond: ['$swmFlags.compost', 1, 0] } },
  };
}

function indexFriendlyMatch(_filter: InspectionWorksFilterQuery, rest: Record<string, unknown>) {
  return rest && Object.keys(rest).length ? [{ $match: rest }] : [{ $match: {} }];
}

function buildSwmPreparedPipeline(
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters,
  opts?: { buildingType?: string | null }
) {
  const needsSecondary = !!(filter.street || filter.search || filter.adminFieldId);
  const match = buildReportsMongoMatch(filter, masters, {
    useReportDate: true,
    includeSecondary: needsSecondary,
  });
  const buildingType = String(opts?.buildingType || '').trim().toLowerCase();
  const lockedRaw = normalizedAnswer(
    firstFieldValue(
      collectIdentKeys(
        masters,
        (blob) =>
          blob.includes('door locked') ||
          blob.includes('house locked') ||
          blob.includes('is_door_locked') ||
          blob.includes('வீடு பூட்ட'),
        ['fld_is_door_locked__r98z', 'is_door_locked', 'Is Door Locked?', 'Is house locked?', 'வீடு பூட்டப்பட்டுள்ளதா?']
      )
    )
  );
  const segregateRaw = normalizedAnswer(
    firstFieldValue(
      collectIdentKeys(
        masters,
        (blob) => blob.includes('segregat') && blob.includes('source') && !blob.includes('worker'),
        ['fld_is_waste_segregated_at_source__jdua', 'is_waste_segregated_at_source', 'Is waste segregated at source?']
      )
    )
  );
  const compostRaw = normalizedAnswer(
    firstFieldValue(
      collectIdentKeys(
        masters,
        (blob) => blob.includes('compost') || blob.includes('உரம்'),
        ['fld_home_composting_available___c5p9', 'home_composting_available', 'Is compost created at home?']
      )
    )
  );
  const pipeline: Record<string, unknown>[] = [
    ...indexFriendlyMatch(filter, match),
    {
      $addFields: {
        tpId: { $ifNull: ['$tpId', '$townPanchayatId'] },
        swmWard: { $ifNull: ['$wardNumber', { $ifNull: ['$wardNo', '$ward'] }] },
        swmStreet: { $ifNull: ['$streetName', { $ifNull: ['$streetNameEn', '$street'] }] },
        swmFlags: {
          $let: {
            vars: { locked: lockedRaw, seg: segregateRaw, compost: compostRaw },
            in: {
              doorLocked: mongoIsYes('$$locked'),
              segYes: mongoIsYes('$$seg'),
              segNo: mongoIsNo('$$seg'),
              compost: mongoIsYes('$$compost'),
            },
          },
        },
      },
    },
  ];
  if (buildingType === 'residential' || buildingType === 'commercial') {
    const buildingRaw = normalizedAnswer(
      firstFieldValue(['fld_building_type_cu5l', 'building_type', 'Building Type'])
    );
    pipeline.push({
      $match: {
        $expr: {
          $regexMatch: {
            input: buildingRaw,
            regex: buildingType === 'commercial' ? 'commercial|வணிகம்' : 'residential|குடியிருப்பு',
            options: 'i',
          },
        },
      },
    });
  }
  return pipeline;
}

export type SwmGroupBy = 'tp' | 'ward' | 'street';

function geoGroupId(groupBy: SwmGroupBy) {
  const id: Record<string, unknown> = {
    tpId: { $toLower: mongoString({ $ifNull: ['$tpId', '$tpNameEn'] }) },
  };
  if (groupBy === 'ward' || groupBy === 'street') {
    id.ward = { $toLower: mongoString('$swmWard') };
  }
  if (groupBy === 'street') {
    id.street = { $toLower: mongoString('$swmStreet') };
  }
  return id;
}

function geoFirsts() {
  return {
    zoneId: { $first: '$zoneId' },
    zoneNameEn: { $first: '$zoneNameEn' },
    zoneNameTa: { $first: '$zoneNameTa' },
    districtId: { $first: '$districtId' },
    districtNameEn: { $first: '$districtNameEn' },
    districtNameTa: { $first: '$districtNameTa' },
    tpNameEn: { $first: '$tpNameEn' },
    tpNameTa: { $first: '$tpNameTa' },
    rawTpId: { $first: '$tpId' },
    rawWard: { $first: '$swmWard' },
    rawStreet: { $first: '$swmStreet' },
  };
}

export async function aggregateSwmStreetGroups(
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters,
  opts?: { buildingType?: string | null }
): Promise<{ groups: SwmSummaryGroup[]; source: string }> {
  const client = await getMongoClient();
  if (!client) return { groups: [], source: 'empty' };
  const db = await getActiveMongoDb(client);
  const col = await getCollectionWithAliases(db, 'inspectionWorks');
  const pipeline = [
    ...buildSwmPreparedPipeline(filter, masters, opts),
    {
      $group: {
        _id: geoGroupId('street'),
        ...geoFirsts(),
        ...swmHouseholdSums(),
      },
    },
  ];
  const rows = await runSwmAggregate(col, pipeline, filter);
  const groups: SwmSummaryGroup[] = rows.map((row: any) => {
    const id = row._id || {};
    return {
      zoneId: String(row.zoneId || id.zoneId || ''),
      zoneNameEn: String(row.zoneNameEn || ''),
      zoneNameTa: String(row.zoneNameTa || ''),
      districtId: String(row.districtId || ''),
      districtNameEn: String(row.districtNameEn || ''),
      districtNameTa: String(row.districtNameTa || ''),
      tpId: String(row.rawTpId || id.tpId || ''),
      tpNameEn: String(row.tpNameEn || ''),
      tpNameTa: String(row.tpNameTa || ''),
      wardNumber: String(row.rawWard || id.ward || '').replace(/^0+/, '') || '0',
      streetName: String(row.rawStreet || id.street || '').trim() || '-',
      householdsSurveyed: Number(row.householdsSurveyed) || 0,
      segregating: Number(row.segregating) || 0,
      notSegregating: Number(row.notSegregating) || 0,
      doorLocked: Number(row.doorLocked) || 0,
      homeComposting: Number(row.homeComposting) || 0,
    };
  });
  return { groups, source: 'mongo-swm-aggregate' };
}

export type SwmReportRow = {
  zoneNameEn: string;
  zoneNameTa: string;
  districtNameEn: string;
  districtNameTa: string;
  tpNameEn: string;
  tpNameTa: string;
  wardNumber?: string;
  streetName?: string;
  totalWards: number;
  wardsSurveyed: number;
  totalStreets: number;
  streetsSurveyed: number;
  householdsSurveyed: number;
  segregating: number;
  segregatingPct: number;
  notSegregating: number;
  notSegregatingPct: number;
  doorLocked: number;
  doorLockedPct: number;
  homeComposting: number;
  homeCompostingPct: number;
};

export type SwmReportTotals = {
  totalWards: number;
  wardsSurveyed: number;
  totalStreets: number;
  streetsSurveyed: number;
  householdsSurveyed: number;
  segregating: number;
  notSegregating: number;
  doorLocked: number;
  homeComposting: number;
};

function pct(count: number, total: number) {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}

function normWard(value: unknown) {
  const digits = String(value || '').replace(/[^0-9]/g, '');
  return digits.replace(/^0+/, '') || digits || String(value || '').trim();
}

const MASTER_GEO_TTL_MS = 5 * 60_000;
let masterGeoCache: { ts: number; data: Map<string, { wards: Set<string>; streets: number; wardStreets: Map<string, number> }> } | null = null;

async function loadMasterGeoIndex(masters: InspectionWorksFilterMasters) {
  if (masterGeoCache && Date.now() - masterGeoCache.ts < MASTER_GEO_TTL_MS) {
    return masterGeoCache.data;
  }
  const client = await getMongoClient();
  const byKey = new Map<string, { wards: Set<string>; streets: number; wardStreets: Map<string, number> }>();
  const tpByKey = new Map<string, any>();
  for (const item of masters.townPanchayats || []) {
    [item.id, item.nameEn, item.nameTa].forEach((value) => {
      const key = String(value || '').trim().toLowerCase();
      if (key) tpByKey.set(key, item);
    });
  }
  const remember = (keys: string[], ward: string, streetCount: number) => {
    const aliases = [...new Set(keys.map((k) => k.trim().toLowerCase()).filter(Boolean))];
    if (!aliases.length) return;
    let bucket = aliases.map((k) => byKey.get(k)).find(Boolean);
    if (!bucket) bucket = { wards: new Set<string>(), streets: 0, wardStreets: new Map() };
    aliases.forEach((k) => byKey.set(k, bucket!));
    bucket.streets += streetCount;
    if (ward) {
      bucket.wards.add(ward);
      bucket.wardStreets.set(ward, (bucket.wardStreets.get(ward) || 0) + streetCount);
    }
  };

  if (client) {
    const db = await getActiveMongoDb(client);
    const col = await getCollectionWithAliases(db, 'wardsAndStreets');
    const rows = await col.aggregate(
      [
        {
          $group: {
            _id: {
              tpId: { $toLower: mongoString({ $ifNull: ['$tpId', { $ifNull: ['$townPanchayatId', ''] }] }) },
              tpNameEn: { $toLower: mongoString({ $ifNull: ['$tpNameEn', { $ifNull: ['$tpName', ''] }] }) },
              tpNameTa: { $toLower: mongoString({ $ifNull: ['$tpNameTa', ''] }) },
              ward: mongoString({ $ifNull: ['$wardNo', { $ifNull: ['$wardNumber', '$ward'] }] }),
            },
            streets: { $sum: 1 },
          },
        },
      ],
      { allowDiskUse: true, maxTimeMS: 20000 }
    ).toArray();
    for (const row of rows) {
      const id = row._id || {};
      const tp =
        tpByKey.get(String(id.tpId || '').toLowerCase()) ||
        tpByKey.get(String(id.tpNameEn || '').toLowerCase()) ||
        tpByKey.get(String(id.tpNameTa || '').toLowerCase());
      remember(
        [id.tpId, id.tpNameEn, id.tpNameTa, tp?.id, tp?.nameEn, tp?.nameTa].map((v) => String(v || '')),
        normWard(id.ward),
        Number(row.streets) || 0
      );
    }
  }
  masterGeoCache = { ts: Date.now(), data: byKey };
  return byKey;
}

async function runSwmAggregate(col: any, pipeline: Record<string, unknown>[], filter: InspectionWorksFilterQuery) {
  const options: Record<string, unknown> = { allowDiskUse: true, maxTimeMS: 12000 };
  if (filter.categoryId) options.hint = { categoryId: 1, submittedAt: -1 };
  try {
    return await col.aggregate(pipeline, options).toArray();
  } catch {
    return await col.aggregate(pipeline, { allowDiskUse: true, maxTimeMS: 20000 }).toArray();
  }
}

function lookupMaster(
  index: Map<string, { wards: Set<string>; streets: number; wardStreets: Map<string, number> }>,
  keys: string[]
) {
  for (const key of keys) {
    const k = String(key || '').trim().toLowerCase();
    if (k && index.has(k)) return index.get(k)!;
  }
  return null;
}

const SWM_REPORT_CACHE_TTL_MS = 90_000;
const swmReportCache = new Map<string, { ts: number; data: { rows: SwmReportRow[]; totals: SwmReportTotals; source: string } }>();

export async function aggregateSwmReport(
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters,
  opts?: { buildingType?: string | null; groupBy?: SwmGroupBy }
): Promise<{ rows: SwmReportRow[]; totals: SwmReportTotals; source: string }> {
  const groupBy: SwmGroupBy = opts?.groupBy === 'street' || opts?.groupBy === 'ward' ? opts.groupBy : 'tp';
  const cacheKey = JSON.stringify({ filter, buildingType: opts?.buildingType || '', groupBy });
  const hit = swmReportCache.get(cacheKey);
  if (hit && Date.now() - hit.ts < SWM_REPORT_CACHE_TTL_MS) return hit.data;

  const client = await getMongoClient();
  if (!client) return { rows: [], totals: emptyTotals(), source: 'empty' };
  const db = await getActiveMongoDb(client);
  const col = await getCollectionWithAliases(db, 'inspectionWorks');
  const groupStage: Record<string, unknown> = {
    _id: geoGroupId(groupBy),
    ...geoFirsts(),
    ...swmHouseholdSums(),
  };
  if (groupBy === 'tp') groupStage.wardSet = { $addToSet: '$swmWard' };
  if (groupBy !== 'street') {
    groupStage.streetSet = {
      $addToSet: {
        $concat: [
          { $ifNull: [mongoString('$swmWard'), ''] },
          '|',
          { $toLower: { $ifNull: [mongoString('$swmStreet'), ''] } },
        ],
      },
    };
  }
  const pipeline = [
    ...buildSwmPreparedPipeline(filter, masters, opts),
    { $group: groupStage },
  ];
  const [aggRows, master] = await Promise.all([
    runSwmAggregate(col, pipeline, filter),
    loadMasterGeoIndex(masters),
  ]);

  const rows: SwmReportRow[] = aggRows.map((row: any) => {
    const id = row._id || {};
    const ward = String(row.rawWard || id.ward || '').replace(/^0+/, '') || '0';
    const street = String(row.rawStreet || id.street || '').trim() || '-';
    const found = lookupMaster(master, [row.rawTpId, id.tpId, row.tpNameEn, row.tpNameTa]);
    const surveyed = Number(row.householdsSurveyed) || 0;
    const segregating = Number(row.segregating) || 0;
    const notSegregating = Number(row.notSegregating) || 0;
    const doorLocked = Number(row.doorLocked) || 0;
    const homeComposting = Number(row.homeComposting) || 0;
    return {
      zoneNameEn: String(row.zoneNameEn || ''),
      zoneNameTa: String(row.zoneNameTa || ''),
      districtNameEn: String(row.districtNameEn || ''),
      districtNameTa: String(row.districtNameTa || ''),
      tpNameEn: String(row.tpNameEn || ''),
      tpNameTa: String(row.tpNameTa || ''),
      wardNumber: ward,
      streetName: street,
      totalWards: groupBy === 'tp' ? found?.wards.size || 0 : 1,
      wardsSurveyed: groupBy === 'tp' ? (Array.isArray(row.wardSet) ? row.wardSet.filter(Boolean).length : 0) : 1,
      totalStreets: groupBy === 'street' ? 1 : groupBy === 'ward' ? found?.wardStreets.get(ward) || 0 : found?.streets || 0,
      streetsSurveyed: groupBy === 'street' ? 1 : (Array.isArray(row.streetSet) ? row.streetSet.filter(Boolean).length : 0),
      householdsSurveyed: surveyed,
      segregating,
      segregatingPct: pct(segregating, surveyed),
      notSegregating,
      notSegregatingPct: pct(notSegregating, surveyed),
      doorLocked,
      doorLockedPct: pct(doorLocked, surveyed),
      homeComposting,
      homeCompostingPct: pct(homeComposting, surveyed),
    };
  }).sort((a, b) =>
    String(a.zoneNameEn).localeCompare(String(b.zoneNameEn))
    || String(a.districtNameEn).localeCompare(String(b.districtNameEn))
    || String(a.tpNameEn).localeCompare(String(b.tpNameEn))
    || String(a.wardNumber || '').localeCompare(String(b.wardNumber || ''), undefined, { numeric: true })
    || String(a.streetName || '').localeCompare(String(b.streetName || ''))
  );

  const totals = rows.reduce(
    (acc, row) => {
      acc.totalWards += row.totalWards;
      acc.wardsSurveyed += row.wardsSurveyed;
      acc.totalStreets += row.totalStreets;
      acc.streetsSurveyed += row.streetsSurveyed;
      acc.householdsSurveyed += row.householdsSurveyed;
      acc.segregating += row.segregating;
      acc.notSegregating += row.notSegregating;
      acc.doorLocked += row.doorLocked;
      acc.homeComposting += row.homeComposting;
      return acc;
    },
    emptyTotals()
  );
  const data = { rows, totals, source: 'mongo-swm-report' };
  swmReportCache.set(cacheKey, { ts: Date.now(), data });
  if (swmReportCache.size > 60) {
    const first = swmReportCache.keys().next().value;
    if (first) swmReportCache.delete(first);
  }
  return data;
}

function emptyTotals(): SwmReportTotals {
  return {
    totalWards: 0,
    wardsSurveyed: 0,
    totalStreets: 0,
    streetsSurveyed: 0,
    householdsSurveyed: 0,
    segregating: 0,
    notSegregating: 0,
    doorLocked: 0,
    homeComposting: 0,
  };
}

export async function aggregateSwmTotals(
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters,
  opts?: { buildingType?: string | null }
): Promise<SwmReportTotals & { source: string }> {
  const client = await getMongoClient();
  if (!client) return { ...emptyTotals(), source: 'empty' };
  const db = await getActiveMongoDb(client);
  const col = await getCollectionWithAliases(db, 'inspectionWorks');
  const pipeline = [
    ...buildSwmPreparedPipeline(filter, masters, opts),
    {
      $group: {
        _id: null,
        ...swmHouseholdSums(),
      },
    },
  ];
  const [row] = await runSwmAggregate(col, pipeline, filter);
  return {
    ...emptyTotals(),
    householdsSurveyed: Number(row?.householdsSurveyed) || 0,
    segregating: Number(row?.segregating) || 0,
    notSegregating: Number(row?.notSegregating) || 0,
    doorLocked: Number(row?.doorLocked) || 0,
    homeComposting: Number(row?.homeComposting) || 0,
    source: 'mongo-swm-totals',
  };
}
