import type { InspectionWorksFilterMasters, InspectionWorksFilterQuery } from '@/lib/inspectionWorksQueryFilters';
import { buildReportsMongoMatch } from '@/lib/inspectionWorksReportsAggregate';
import { getActiveMongoDb, getCollectionWithAliases, getMongoClient } from '@/lib/storage';

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

function mongoYes(expr: unknown) {
  return {
    $regexMatch: {
      input: { $toLower: { $trim: { input: mongoString(expr) } } },
      regex: '^(yes|true|1|ஆம்)|(^y$)',
    },
  };
}

function mongoNo(expr: unknown) {
  return {
    $regexMatch: {
      input: { $toLower: { $trim: { input: mongoString(expr) } } },
      regex: '^(no|false|0|இல்லை)|(^n$)',
    },
  };
}

function firstValue(paths: string[]) {
  return paths.reduceRight((acc, path) => ({ $ifNull: [path, acc] }), '');
}

function fieldValueExpr(key: string) {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return `$fieldsData.${key}`;
  return { $getField: { field: key, input: { $ifNull: ['$fieldsData', {}] } } };
}

function collectFieldExprs(masters: InspectionWorksFilterMasters | undefined, pred: (blob: string) => boolean, extras: string[] = []) {
  const exprs: unknown[] = [];
  const seen = new Set<string>();
  const add = (key: string) => {
    const k = String(key || '').trim();
    if (!k || seen.has(k)) return;
    seen.add(k);
    exprs.push(fieldValueExpr(k));
  };
  extras.forEach(add);
  for (const field of masters?.inspectionFields || []) {
    const blob = [field?.id, field?.nameEn, field?.nameTa, field?.fieldName, field?.fieldNameTa]
      .map((x) => String(x || '').toLowerCase())
      .join(' | ');
    if (!pred(blob)) continue;
    add(field.id);
    add(field.fieldName);
    add(field.nameEn);
    add(field.nameTa);
  }
  return exprs;
}

function yesOnExprs(exprs: unknown[]) {
  return exprs.length ? { $or: exprs.map((expr) => mongoYes(expr)) } : false;
}

function noOnExprs(exprs: unknown[]) {
  return exprs.length ? { $or: exprs.map((expr) => mongoNo(expr)) } : false;
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
  const match = buildReportsMongoMatch(filter, masters, { useReportDate: true, includeSecondary: true });
  const buildingType = String(opts?.buildingType || '').trim().toLowerCase();

  const segregateExprs = collectFieldExprs(
    masters,
    (blob) => blob.includes('segregat') && blob.includes('source') && !blob.includes('worker') && !blob.includes('collected'),
    ['fld_is_waste_segregated_at_source__jdua', 'Is waste segregated at source?', 'is_waste_segregated_at_source']
  );
  const lockedExprs = collectFieldExprs(
    masters,
    (blob) =>
      blob.includes('door locked') ||
      blob.includes('house locked') ||
      blob.includes('is_door_locked') ||
      blob.includes('வீடு பூட்ட') ||
      (blob.includes('பூட்ட') && blob.includes('வீடு')),
    ['fld_is_door_locked__r98z', 'Is door locked?', 'is_door_locked', 'Is house locked?', 'is house locked']
  );
  const compostExprs = collectFieldExprs(
    masters,
    (blob) => blob.includes('compost') || blob.includes('உரம்'),
    ['fld_home_composting_available___c5p9', 'Home composting available?', 'home_composting_available', 'Is compost created at home?', 'is compost created at home']
  );
  const buildingExprs = collectFieldExprs(
    masters,
    (blob) => blob.includes('building type') || blob.includes('கட்டிட'),
    ['fld_building_type_cu5l', 'Building Type', 'building_type']
  );

  const pipeline: Record<string, unknown>[] = [
    { $match: match },
    {
      $project: {
        tpId: { $ifNull: ['$tpId', '$townPanchayatId'] },
        tpNameEn: { $ifNull: ['$tpNameEn', ''] },
        tpNameTa: { $ifNull: ['$tpNameTa', ''] },
        districtId: { $ifNull: ['$districtId', ''] },
        districtNameEn: { $ifNull: ['$districtNameEn', ''] },
        districtNameTa: { $ifNull: ['$districtNameTa', ''] },
        zoneId: { $ifNull: ['$zoneId', ''] },
        zoneNameEn: { $ifNull: ['$zoneNameEn', ''] },
        zoneNameTa: { $ifNull: ['$zoneNameTa', ''] },
        swmWard: {
          $trim: { input: mongoString(firstValue(['$wardNumber', '$wardNo', '$ward'])) },
        },
        swmStreet: {
          $trim: { input: mongoString(firstValue(['$streetName', '$streetNameEn', '$street'])) },
        },
        swmDoorLocked: yesOnExprs(lockedExprs),
        swmDoorUnlocked: { $cond: [yesOnExprs(lockedExprs), false, true] },
        swmSegregatedYes: yesOnExprs(segregateExprs),
        swmSegregatedNo: noOnExprs(segregateExprs),
        swmCompost: yesOnExprs(compostExprs),
        swmBuilding: { $toLower: { $trim: { input: mongoString(buildingExprs[0] || firstValue(['$fieldsData.building_type'])) } } },
      },
    },
  ];
  if (buildingType === 'residential' || buildingType === 'commercial') {
    pipeline.push({
      $match: {
        swmBuilding: buildingType === 'commercial' ? /commercial|வணிகம்/i : /residential|குடியிருப்பு/i,
      },
    });
  }
  pipeline.push({
    $group: {
      _id: {
        tpId: '$tpId',
        tpNameEn: '$tpNameEn',
        tpNameTa: '$tpNameTa',
        districtId: '$districtId',
        districtNameEn: '$districtNameEn',
        districtNameTa: '$districtNameTa',
        zoneId: '$zoneId',
        zoneNameEn: '$zoneNameEn',
        zoneNameTa: '$zoneNameTa',
        ward: '$swmWard',
        street: '$swmStreet',
      },
      householdsSurveyed: { $sum: 1 },
      segregating: {
        $sum: { $cond: [{ $and: ['$swmDoorUnlocked', '$swmSegregatedYes'] }, 1, 0] },
      },
      notSegregating: {
        $sum: { $cond: [{ $and: ['$swmDoorUnlocked', '$swmSegregatedNo'] }, 1, 0] },
      },
      doorLocked: { $sum: { $cond: ['$swmDoorLocked', 1, 0] } },
      homeComposting: { $sum: { $cond: ['$swmCompost', 1, 0] } },
    },
  });

  const rows = await col.aggregate(pipeline, { allowDiskUse: true, maxTimeMS: 45000 }).toArray();
  const groups: SwmSummaryGroup[] = rows.map((row: any) => {
    const id = row._id || {};
    return {
      zoneId: String(id.zoneId || ''),
      zoneNameEn: String(id.zoneNameEn || ''),
      zoneNameTa: String(id.zoneNameTa || ''),
      districtId: String(id.districtId || ''),
      districtNameEn: String(id.districtNameEn || ''),
      districtNameTa: String(id.districtNameTa || ''),
      tpId: String(id.tpId || ''),
      tpNameEn: String(id.tpNameEn || ''),
      tpNameTa: String(id.tpNameTa || ''),
      wardNumber: String(id.ward || '').replace(/^0+/, '') || '0',
      streetName: String(id.street || '').trim() || '-',
      householdsSurveyed: Number(row.householdsSurveyed) || 0,
      segregating: Number(row.segregating) || 0,
      notSegregating: Number(row.notSegregating) || 0,
      doorLocked: Number(row.doorLocked) || 0,
      homeComposting: Number(row.homeComposting) || 0,
    };
  });
  return { groups, source: 'mongo-swm-aggregate' };
}
