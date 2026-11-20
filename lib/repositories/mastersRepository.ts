import type { Db } from 'mongodb';
import { getMongoClient, getActiveMongoDb, warmMongoOnBoot } from '@/lib/db/mongo';
import { getInspectionWorksDashboardStats } from '@/lib/storage';

const QUERY_MS = 8000;

let dbWarmStarted = false;

export async function getDb(): Promise<Db | null> {
  const client = await getMongoClient();
  if (!client) return null;
  if (!dbWarmStarted) {
    dbWarmStarted = true;
    void warmMongoOnBoot();
  }
  return getActiveMongoDb(client);
}

/** Inspection KPI + subjects only — no bulk geo (use /api/masters/geo). */
export async function loadSlimCoreMasters(db: Db) {
  const [
    inspectionSubjects,
    inspectionCategories,
    inspectionFields,
    inspectionRoles,
    inspectionDesignations,
    roles,
    pendingIssues,
    pendingIssuesSchema,
    inspectionWorkStats,
  ] = await Promise.all([
    db.collection('inspectionSubjects').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    db.collection('inspectionCategories').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    db.collection('inspectionFields').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    db.collection('inspectionRoles').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    db.collection('inspectionDesignations').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    db.collection('roles').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    db.collection('pendingIssues').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    db.collection('pendingIssuesSchema').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    getInspectionWorksDashboardStats(),
  ]);

  return {
    districts: [] as any[],
    townPanchayats: [] as any[],
    zones: [] as any[],
    inspectionSubjects,
    inspectionCategories,
    inspectionFields,
    inspectionRoles,
    inspectionDesignations,
    roles,
    pendingIssues,
    pendingIssuesSchema,
    inspectionWorkStats,
    wardsAndStreets: [] as any[],
    inspectionUsers: [] as any[],
    users: [] as any[],
    employees: [] as any[],
    notifications: [] as any[],
    inspectionWorks: [] as any[],
  };
}

/** Core master tables for web first paint — excludes users and wards (loaded separately). */
export async function loadCoreMasters(db: Db) {
  const [
    districts,
    townPanchayats,
    zones,
    inspectionSubjects,
    inspectionCategories,
    inspectionFields,
    inspectionRoles,
    inspectionDesignations,
    roles,
    pendingIssues,
    pendingIssuesSchema,
    inspectionWorkStats,
  ] = await Promise.all([
    db.collection('districts').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    db.collection('townPanchayats').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    db.collection('zones').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    db.collection('inspectionSubjects').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    db.collection('inspectionCategories').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    db.collection('inspectionFields').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    db.collection('inspectionRoles').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    db.collection('inspectionDesignations').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    db.collection('roles').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    db.collection('pendingIssues').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    db.collection('pendingIssuesSchema').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    getInspectionWorksDashboardStats(),
  ]);

  return {
    districts,
    townPanchayats,
    zones,
    inspectionSubjects,
    inspectionCategories,
    inspectionFields,
    inspectionRoles,
    inspectionDesignations,
    roles,
    pendingIssues,
    pendingIssuesSchema,
    inspectionWorkStats,
    wardsAndStreets: [] as any[],
    inspectionUsers: [] as any[],
    users: [] as any[],
    employees: [] as any[],
    notifications: [] as any[],
    inspectionWorks: [] as any[],
  };
}

export async function loadWardsForTp(db: Db, tpId: string, opts: { page: number; limit: number }) {
  const filter = tpId
    ? { $or: [{ tpId }, { townPanchayatId: tpId }] }
    : {};
  const limit = Math.min(Math.max(opts.limit, 1), 500);
  const page = Math.max(opts.page, 1);
  const skip = (page - 1) * limit;

  const col = db.collection('wardsAndStreets');
  const [items, total] = await Promise.all([
    col
      .find(filter, {
        projection: { _id: 0, id: 1, tpId: 1, townPanchayatId: 1, wardNo: 1, wardNumber: 1, streetNameEn: 1, streetNameTa: 1 },
        maxTimeMS: QUERY_MS,
        skip,
        limit,
      })
      .toArray(),
    col.countDocuments(filter, { maxTimeMS: QUERY_MS }),
  ]);

  return { items, total, page, limit, hasMore: skip + items.length < total };
}

export async function loadPaginatedCollection(
  db: Db,
  collection: string,
  opts: { page: number; limit: number; filter?: Record<string, unknown> },
  projection?: Record<string, 0 | 1>,
) {
  const limit = Math.min(Math.max(opts.limit, 1), 1000);
  const page = Math.max(opts.page, 1);
  const skip = (page - 1) * limit;
  const filter = opts.filter || {};

  const col = db.collection(collection);
  const [items, total] = await Promise.all([
    col.find(filter, { projection: projection || { _id: 0, password: 0, passwordHash: 0 }, maxTimeMS: QUERY_MS, skip, limit }).toArray(),
    col.countDocuments(filter, { maxTimeMS: QUERY_MS }),
  ]);

  return { items, total, page, limit, hasMore: skip + items.length < total };
}

/** PF / post reference tables (masters → employee masters tab). */
export async function loadEmployeePostMasters(db: Db) {
  const [employeeGroups, employeeCategories, postNatures, payLevels, posts, transferReasons] = await Promise.all([
    db.collection('employeeGroups').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    db.collection('employeeCategories').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    db.collection('postNatures').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    db.collection('payLevels').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    db.collection('posts').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
    db.collection('transferReasons').find({}, { projection: { _id: 0 }, maxTimeMS: QUERY_MS }).toArray(),
  ]);
  return { employeeGroups, employeeCategories, postNatures, payLevels, posts, transferReasons };
}