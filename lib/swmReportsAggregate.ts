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

function firstValue(paths: string[]) {
  return paths.reduceRight((acc, path) => ({ $ifNull: [path, acc] }), '');
}

function yesOnPaths(paths: string[]) {
  return { $or: paths.map((path) => mongoYes(path)) };
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

  const segregatePaths = [
    '$fieldsData.fld_is_waste_segregated_at_source__jdua',
    '$fieldsData.Is waste segregated at source?',
    '$fieldsData.is_waste_segregated_at_source',
  ];
  const lockedPaths = [
    '$fieldsData.fld_is_door_locked__r98z',
    '$fieldsData.Is door locked?',
    '$fieldsData.is_door_locked',
  ];
  const compostPaths = [
    '$fieldsData.fld_home_composting_available___c5p9',
    '$fieldsData.Home composting available?',
    '$fieldsData.home_composting_available',
  ];
  const buildingPaths = [
    '$fieldsData.fld_building_type_cu5l',
    '$fieldsData.Building Type',
    '$fieldsData.building_type',
  ];

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
        swmSegregating: yesOnPaths(segregatePaths),
        swmDoorLocked: yesOnPaths(lockedPaths),
        swmCompost: yesOnPaths(compostPaths),
        swmBuilding: { $toLower: { $trim: { input: mongoString(firstValue(buildingPaths)) } } },
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
      segregating: { $sum: { $cond: ['$swmSegregating', 1, 0] } },
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
      doorLocked: Number(row.doorLocked) || 0,
      homeComposting: Number(row.homeComposting) || 0,
    };
  });
  return { groups, source: 'mongo-swm-aggregate' };
}
