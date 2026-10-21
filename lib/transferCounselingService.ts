import type { Db } from 'mongodb';

export const APPLICANTS_COL = 'transfer_counseling_applicants';
export const VACANCIES_COL = 'transfer_counseling_vacancies';
export const HISTORY_COL = 'transfer_counseling_history';

const ELIGIBLE_STATUSES = ['PENDING', 'IN_COUNSELING'] as const;

function unwrapUpdateResult(res: unknown): Record<string, any> | null {
  if (!res || typeof res !== 'object') return null;
  const r = res as { value?: Record<string, any> | null; document?: Record<string, any> | null };
  if (r.document) return r.document;
  if (r.value !== undefined) return r.value;
  if ('counselingEmployeeId' in r || 'vacancyId' in r || 'availableSlots' in r) {
    return res as Record<string, any>;
  }
  return null;
}

export type CounselingApplicantFilter = 'all' | 'pending' | 'in_counseling' | 'allocated';

function startOfTodayUtcLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const APPLICANT_LIST_PROJECTION = {
  counselingEmployeeId: 1,
  employeeName: 1,
  seniorityNo: 1,
  currentDistrict: 1,
  currentTownPanchayat: 1,
  counselingCategory: 1,
  counselingStatus: 1,
  transferRequestMarked: 1,
  allocatedDistrict: 1,
  allocatedTownPanchayat: 1,
  allocatedAt: 1,
  sourceSlNo: 1,
};

function countFromFacet(facet: Record<string, { n: number }[]> | undefined, key: string): number {
  return facet?.[key]?.[0]?.n ?? 0;
}

/** Not yet allocated — includes PENDING, IN_COUNSELING, and legacy/missing status (normalized to PENDING). */
const NOT_COMPLETED_STATUS = { counselingStatus: { $ne: 'ALLOCATED' } } as const;

type CounselingGlobal = typeof globalThis & {
  _transferCounselingStatusSynced?: boolean;
  _transferCounselingIndexesEnsured?: boolean;
};

function counselingGlobal(): CounselingGlobal {
  return globalThis as CounselingGlobal;
}

/** Ensure every applicant has a valid counselingStatus in DB (default PENDING). Runs at most once per process unless bad rows exist. */
export async function normalizeCounselingApplicantStatuses(db: Db) {
  if (counselingGlobal()._transferCounselingStatusSynced) return;

  const col = db.collection(APPLICANTS_COL);
  const invalidQuery = { counselingStatus: { $nin: ['PENDING', 'IN_COUNSELING', 'ALLOCATED'] } };
  const needsFix = await col.findOne(invalidQuery, { projection: { _id: 1 } });
  if (needsFix) {
    const now = new Date().toISOString();
    await col.updateMany(invalidQuery, { $set: { counselingStatus: 'PENDING', updatedAt: now } });
  }
  counselingGlobal()._transferCounselingStatusSynced = true;
}

function isBenignIndexError(err: unknown): boolean {
  const code = (err as { code?: number })?.code;
  return code === 85 || code === 86 || code === 68;
}

async function safeCreateIndex(
  col: ReturnType<Db['collection']>,
  spec: Record<string, 1 | -1>,
  options?: { background?: boolean; unique?: boolean }
) {
  try {
    await col.createIndex(spec, options);
  } catch (err) {
    if (!isBenignIndexError(err)) throw err;
  }
}

/** Index hints for counseling queries (best-effort; never blocks reads). */
async function ensureCounselingIndexes(db: Db) {
  if (counselingGlobal()._transferCounselingIndexesEnsured) return;
  const applicants = db.collection(APPLICANTS_COL);
  const vacancies = db.collection(VACANCIES_COL);
  try {
    await Promise.all([
      safeCreateIndex(applicants, { counselingStatus: 1 }, { background: true }),
      safeCreateIndex(applicants, { counselingStatus: 1, allocatedAt: -1 }, { background: true }),
      safeCreateIndex(applicants, { counselingEmployeeId: 1 }, { background: true }),
      safeCreateIndex(applicants, { sourceSlNo: 1, seniorityNo: 1, counselingEmployeeId: 1 }, { background: true }),
      safeCreateIndex(vacancies, { availableSlots: 1, district: 1, townPanchayat: 1 }, { background: true }),
      safeCreateIndex(vacancies, { vacancyId: 1 }, { background: true }),
    ]);
  } finally {
    counselingGlobal()._transferCounselingIndexesEnsured = true;
  }
}

function applicantSearchMatch(search: string): Record<string, unknown> | null {
  const s = search.trim();
  if (!s) return null;
  const re = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  return {
    $or: [
      { counselingEmployeeId: re },
      { employeeName: re },
      { currentDistrict: re },
      { currentTownPanchayat: re },
    ],
  };
}

function statsFromApplicantFacet(facet: Record<string, { n: number }[]>) {
  return {
    totalEmployees: countFromFacet(facet, 'total'),
    pending: countFromFacet(facet, 'pending'),
    inCounseling: countFromFacet(facet, 'inCounseling'),
    completed: countFromFacet(facet, 'completed'),
    vacanciesAllocatedToday: countFromFacet(facet, 'allocatedToday'),
  };
}

function filterCountsFromFacet(facet: Record<string, { n: number }[]>): CounselingFilterCounts {
  return {
    all: countFromFacet(facet, 'all'),
    pending: countFromFacet(facet, 'pending'),
    in_counseling: countFromFacet(facet, 'in_counseling'),
    allocated: countFromFacet(facet, 'allocated'),
  };
}

const APPLICANT_FILTER_FACET = {
  all: [{ $match: { counselingStatus: { $ne: 'ALLOCATED' } } }, { $count: 'n' }],
  pending: [{ $match: { counselingStatus: 'PENDING' } }, { $count: 'n' }],
  in_counseling: [{ $match: { counselingStatus: 'IN_COUNSELING' } }, { $count: 'n' }],
  allocated: [{ $match: { counselingStatus: 'ALLOCATED' } }, { $count: 'n' }],
};

/** One applicants aggregation for KPI stats + filter tab counts (single collection scan). */
export async function getCounselingMetrics(db: Db, search: string) {
  await Promise.all([normalizeCounselingApplicantStatuses(db), ensureCounselingIndexes(db)]);

  const todayStart = startOfTodayUtcLocal().toISOString();
  const searchMatch = applicantSearchMatch(search);
  const filterCountStages: Record<string, unknown>[] = searchMatch ? [{ $match: searchMatch }] : [];
  filterCountStages.push({ $facet: APPLICANT_FILTER_FACET });

  const statsFacet = {
    total: [{ $count: 'n' }],
    pending: [{ $match: NOT_COMPLETED_STATUS }, { $count: 'n' }],
    inCounseling: [{ $match: { counselingStatus: 'IN_COUNSELING' } }, { $count: 'n' }],
    completed: [{ $match: { counselingStatus: 'ALLOCATED' } }, { $count: 'n' }],
    allocatedToday: [
      {
        $match: {
          counselingStatus: 'ALLOCATED',
          allocatedAt: { $gte: todayStart },
        },
      },
      { $count: 'n' },
    ],
  };

  const applicantsCol = db.collection(APPLICANTS_COL);
  const filterPipeline: Record<string, unknown>[] = [...filterCountStages];

  const [statsAgg, filterAgg, vacAgg] = await Promise.all([
    applicantsCol.aggregate([{ $facet: statsFacet }]).toArray(),
    applicantsCol.aggregate(filterPipeline).toArray(),
    db
      .collection(VACANCIES_COL)
      .aggregate([
        {
          $facet: {
            totalSlots: [{ $group: { _id: null, t: { $sum: '$availableSlots' } } }],
            openSlots: [
              { $match: { availableSlots: { $gt: 0 } } },
              { $group: { _id: null, t: { $sum: '$availableSlots' } } },
            ],
          },
        },
      ])
      .toArray(),
  ]);

  const statsFacetOut = statsAgg[0] as Record<string, { n: number }[]> | undefined;
  const filterFacetOut = (filterAgg[0] ?? {}) as Record<string, { n: number }[]>;

  const vacFacet = vacAgg[0] as { totalSlots?: { t: number }[]; openSlots?: { t: number }[] };
  const coreStats = statsFromApplicantFacet(statsFacetOut ?? {});

  return {
    stats: {
      ...coreStats,
      totalAvailableVacancies: vacFacet?.totalSlots?.[0]?.t ?? 0,
      remainingVacancies: vacFacet?.openSlots?.[0]?.t ?? 0,
    },
    filterCounts: filterCountsFromFacet(filterFacetOut),
  };
}

/** One aggregation on applicants + one on vacancies (not 7 separate counts). */
export async function getCounselingStats(db: Db) {
  const { stats } = await getCounselingMetrics(db, '');
  return stats;
}

function mapVacancyRow(v: Record<string, any>) {
  return {
    vacancyId: v.vacancyId,
    district: v.district,
    townPanchayat: v.townPanchayat,
    designation: v.vacancyType ?? v.designation ?? '',
    totalSlots: v.totalSlots,
    availableSlots: v.availableSlots,
    status: v.status ?? '',
  };
}

export type CounselingFilterCounts = {
  all: number;
  pending: number;
  in_counseling: number;
  allocated: number;
};

/** Tab badge counts for the current search (same rules as list filters). */
export async function getApplicantFilterCounts(db: Db, search: string): Promise<CounselingFilterCounts> {
  const { filterCounts } = await getCounselingMetrics(db, search);
  return filterCounts;
}

function districtsFromVacancyRows(rows: { district?: string; availableSlots?: number }[]) {
  const map = new Map<string, number>();
  for (const v of rows) {
    if (!v.district || (v.availableSlots ?? 0) < 1) continue;
    map.set(v.district, (map.get(v.district) || 0) + (v.availableSlots ?? 0));
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([district, availableSlots]) => ({ district, availableSlots }));
}

/** Single round-trip payload for the counseling screen (one HTTP call). */
export async function getCounselingBootstrap(
  db: Db,
  filter: CounselingApplicantFilter,
  search: string
) {
  const todayStart = startOfTodayUtcLocal().toISOString();
  const applicantsCol = db.collection(APPLICANTS_COL);
  const vacanciesCol = db.collection(VACANCIES_COL);

  const [metrics, applicantRows, openVacancyRows, todayRows] = await Promise.all([
    getCounselingMetrics(db, search),
    applicantsCol
      .find(applicantFilterQuery(filter, search))
      .project(APPLICANT_LIST_PROJECTION)
      .sort({ sourceSlNo: 1, seniorityNo: 1, counselingEmployeeId: 1 })
      .limit(500)
      .toArray(),
    vacanciesCol
      .find({ availableSlots: { $gt: 0 } })
      .project({
        vacancyId: 1,
        district: 1,
        townPanchayat: 1,
        vacancyType: 1,
        designation: 1,
        totalSlots: 1,
        availableSlots: 1,
        status: 1,
      })
      .sort({ district: 1, townPanchayat: 1 })
      .toArray(),
    applicantsCol
      .find({
        counselingStatus: 'ALLOCATED',
        allocatedAt: { $gte: todayStart },
      })
      .project({
        counselingEmployeeId: 1,
        employeeName: 1,
        currentTownPanchayat: 1,
        currentDistrict: 1,
        allocatedDistrict: 1,
        allocatedTownPanchayat: 1,
        allocatedDesignation: 1,
        vacancyType: 1,
        allocationRemarks: 1,
        allocatedBy: 1,
        allocatedAt: 1,
        counselingStatus: 1,
      })
      .sort({ allocatedAt: -1 })
      .limit(200)
      .toArray(),
  ]);

  const applicants = applicantRows.map((r) => ({
    counselingEmployeeId: r.counselingEmployeeId,
    employeeName: r.employeeName,
    seniorityNo: r.seniorityNo,
    currentDistrict: r.currentDistrict,
    currentTownPanchayat: r.currentTownPanchayat,
    counselingCategory: r.counselingCategory,
    counselingStatus: r.counselingStatus,
    transferRequestMarked: !!r.transferRequestMarked,
    allocatedDistrict: r.allocatedDistrict,
    allocatedTownPanchayat: r.allocatedTownPanchayat,
    allocatedAt: r.allocatedAt,
  }));

  const allVacancies = openVacancyRows.map(mapVacancyRow);
  const districts = districtsFromVacancyRows(openVacancyRows);

  const allocations = todayRows.map((r, idx) => ({
    sno: idx + 1,
    counselingEmployeeId: r.counselingEmployeeId,
    employeeName: r.employeeName,
    previousPosting: [r.currentTownPanchayat, r.currentDistrict].filter(Boolean).join(', '),
    allocatedDistrict: r.allocatedDistrict,
    allocatedTownPanchayat: r.allocatedTownPanchayat,
    post: r.allocatedDesignation ?? r.vacancyType ?? '',
    remarks: r.allocationRemarks,
    allocatedBy: r.allocatedBy,
    allocatedAt: r.allocatedAt,
    status: r.counselingStatus ?? '',
  }));

  const { stats, filterCounts } = metrics;
  return { stats, filterCounts, applicants, allVacancies, districts, allocations };
}

function applicantFilterQuery(filter: CounselingApplicantFilter, search: string) {
  const q: Record<string, unknown> = {};
  if (filter === 'pending') q.counselingStatus = 'PENDING';
  else if (filter === 'in_counseling') q.counselingStatus = 'IN_COUNSELING';
  else if (filter === 'allocated') q.counselingStatus = 'ALLOCATED';
  else q.counselingStatus = { $ne: 'ALLOCATED' };

  const s = search.trim();
  if (s) {
    const re = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    q.$or = [
      { counselingEmployeeId: re },
      { employeeName: re },
      { currentDistrict: re },
      { currentTownPanchayat: re },
    ];
  }
  return q;
}

export async function listCounselingApplicants(
  db: Db,
  filter: CounselingApplicantFilter,
  search: string
) {
  const rows = await db
    .collection(APPLICANTS_COL)
    .find(applicantFilterQuery(filter, search))
    .project(APPLICANT_LIST_PROJECTION)
    .sort({ sourceSlNo: 1, seniorityNo: 1, counselingEmployeeId: 1 })
    .limit(500)
    .toArray();
  return rows.map((r) => ({
    counselingEmployeeId: r.counselingEmployeeId,
    employeeName: r.employeeName,
    seniorityNo: r.seniorityNo,
    currentDistrict: r.currentDistrict,
    currentTownPanchayat: r.currentTownPanchayat,
    counselingCategory: r.counselingCategory,
    counselingStatus: r.counselingStatus,
    transferRequestMarked: !!r.transferRequestMarked,
    allocatedDistrict: r.allocatedDistrict,
    allocatedTownPanchayat: r.allocatedTownPanchayat,
    allocatedAt: r.allocatedAt,
  }));
}

export async function getCounselingEmployeeDetail(db: Db, counselingEmployeeId: string) {
  const id = counselingEmployeeId.trim();
  const applicant = await db.collection(APPLICANTS_COL).findOne({ counselingEmployeeId: id });
  if (!applicant) return null;

  const history = await db.collection(HISTORY_COL).findOne({ counselingEmployeeId: id });

  const postingTimeline: { label: string; period?: string }[] = [];
  if (history) {
    if (history.townPanchayat || history.district) {
      postingTimeline.push({
        label: [history.townPanchayat, history.district].filter(Boolean).join(', '),
        period: history.presentStationJoiningDate,
      });
    }
    for (const key of ['previousWorkingStation3', 'previousWorkingStation2', 'previousWorkingStation1'] as const) {
      const raw = history[key];
      if (raw && String(raw).trim()) {
        postingTimeline.push({ label: String(raw).trim() });
      }
    }
  }

  return {
    applicant,
    history,
    postingTimeline,
  };
}

export async function markEmployeeInCounseling(db: Db, counselingEmployeeId: string) {
  const res = await db.collection(APPLICANTS_COL).findOneAndUpdate(
    {
      counselingEmployeeId: counselingEmployeeId.trim(),
      counselingStatus: { $in: [...ELIGIBLE_STATUSES] },
    },
    { $set: { counselingStatus: 'IN_COUNSELING', counselingStartedAt: new Date().toISOString() } },
    { returnDocument: 'after' }
  );
  return unwrapUpdateResult(res);
}

export async function listAvailableVacancies(db: Db, districtFilter?: string) {
  const match: Record<string, unknown> = { availableSlots: { $gt: 0 } };
  if (districtFilter?.trim()) {
    match.district = new RegExp(`^${districtFilter.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
  }
  const rows = await db
    .collection(VACANCIES_COL)
    .find(match)
    .sort({ district: 1, townPanchayat: 1 })
    .toArray();

  return rows.map((v) => ({
    vacancyId: v.vacancyId,
    district: v.district,
    townPanchayat: v.townPanchayat,
    designation: v.vacancyType ?? v.designation ?? '',
    totalSlots: v.totalSlots,
    availableSlots: v.availableSlots,
    status: v.status ?? '',
  }));
}

export async function listDistrictsWithVacancies(db: Db) {
  const rows = await db
    .collection(VACANCIES_COL)
    .aggregate([
      { $match: { availableSlots: { $gt: 0 } } },
      { $group: { _id: '$district', slots: { $sum: '$availableSlots' } } },
      { $sort: { _id: 1 } },
    ])
    .toArray();
  return rows.map((r) => ({ district: r._id, availableSlots: r.slots }));
}

export async function listTodayAllocations(db: Db) {
  const todayStart = startOfTodayUtcLocal();
  const rows = await db
    .collection(APPLICANTS_COL)
    .find({
      counselingStatus: 'ALLOCATED',
      allocatedAt: { $gte: todayStart.toISOString() },
    })
    .sort({ allocatedAt: -1 })
    .limit(200)
    .toArray();

  return rows.map((r, idx) => ({
    sno: idx + 1,
    counselingEmployeeId: r.counselingEmployeeId,
    employeeName: r.employeeName,
    previousPosting: [r.currentTownPanchayat, r.currentDistrict].filter(Boolean).join(', '),
    allocatedDistrict: r.allocatedDistrict,
    allocatedTownPanchayat: r.allocatedTownPanchayat,
    post: r.allocatedDesignation ?? r.vacancyType ?? '',
    remarks: r.allocationRemarks,
    allocatedBy: r.allocatedBy,
    allocatedAt: r.allocatedAt,
    status: r.counselingStatus ?? '',
  }));
}

export async function allocateTransferCounseling(
  db: Db,
  input: {
    counselingEmployeeId: string;
    vacancyId: string;
    remarks: string;
    allocatedBy: string;
  }
): Promise<{ success: boolean; message: string; applicant?: unknown }> {
  const counselingEmployeeId = input.counselingEmployeeId.trim();
  const vacancyId = input.vacancyId.trim();
  const remarks = input.remarks.trim();
  const allocatedBy = input.allocatedBy.trim() || 'Authority';

  if (!counselingEmployeeId || !vacancyId) {
    return { success: false, message: 'Employee ID and vacancy are required.' };
  }
  if (!remarks) {
    return { success: false, message: 'Remarks are mandatory before allocation.' };
  }

  const applicants = db.collection(APPLICANTS_COL);
  const vacancies = db.collection(VACANCIES_COL);

  const vacancyBefore = await vacancies.findOne({ vacancyId });
  if (!vacancyBefore || (vacancyBefore.availableSlots ?? 0) < 1) {
    return {
      success: false,
      message: 'This vacancy is no longer available. Please select another Town Panchayat.',
    };
  }

  const vacUpdated = unwrapUpdateResult(
    await vacancies.findOneAndUpdate(
      { vacancyId, availableSlots: { $gte: 1 } },
      {
        $inc: { availableSlots: -1 },
        $set: { updatedAt: new Date().toISOString() },
      },
      { returnDocument: 'after' }
    )
  );

  if (!vacUpdated) {
    return {
      success: false,
      message: 'Vacancy was just allocated by another session. Please refresh and try again.',
    };
  }

  const newSlots = typeof vacUpdated.availableSlots === 'number' ? vacUpdated.availableSlots : 0;
  if (newSlots <= 0) {
    await vacancies.updateOne({ vacancyId }, { $set: { status: 'FILLED', availableSlots: 0 } });
    vacUpdated.availableSlots = 0;
    vacUpdated.status = 'FILLED';
  } else {
    await vacancies.updateOne({ vacancyId }, { $set: { status: 'AVAILABLE' } });
  }

  const now = new Date().toISOString();
  const applicantUpdated = unwrapUpdateResult(
    await applicants.findOneAndUpdate(
      {
        counselingEmployeeId,
        counselingStatus: { $in: [...ELIGIBLE_STATUSES] },
      },
      {
        $set: {
          counselingStatus: 'ALLOCATED',
          allocatedVacancyId: vacancyId,
          allocatedDistrict: vacUpdated.district,
          allocatedTownPanchayat: vacUpdated.townPanchayat,
          allocatedDesignation: vacUpdated.vacancyType || vacUpdated.designation,
          allocationRemarks: remarks,
          allocatedBy,
          allocatedAt: now,
        },
      },
      { returnDocument: 'after' }
    )
  );

  if (!applicantUpdated) {
    await vacancies.updateOne(
      { vacancyId },
      {
        $inc: { availableSlots: 1 },
        $set: {
          status: 'AVAILABLE',
          updatedAt: new Date().toISOString(),
        },
      }
    );
    return {
      success: false,
      message: 'Employee is not eligible or was already allocated.',
    };
  }

  return {
    success: true,
    message: 'Transfer allocation completed successfully.',
    applicant: applicantUpdated,
  };
}
