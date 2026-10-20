export interface AppUser {
  id: string;
  username: string;
  name: string;
  nameEn?: string;
  nameTa?: string;
  mobile?: string;
  role: string;
  roleId?: string;
  roleNameTa?: string;
  designation?: string;
  designationId?: string;
  designationNameTa?: string;
  designationNameEn?: string;
  designationNameEnField?: string;
  townPanchayat?: string;
  townPanchayatTa?: string;
  zone?: string;
  zoneTa?: string;
  district?: string;
  districtTa?: string;
  districtCode?: string;
  tpCode?: string;
  districtId?: string;
  tpId?: string;
  townPanchayatId?: string;
  scopeType?: string;
  scopeId?: string;
  assignedWards?: string[];
  selectedWards?: string[];
  subjectIds?: string[];
  assignedSubjects?: string[];
  assignedSubjectNames?: string[];
  categoryIds?: string[];
  assignedCategories?: string[];
  assignedCategoryNames?: string[];
  selectedTpIds?: string[];
  employeeId?: string;
  isInspectionUser?: boolean;
  profilePhotoUrl?: string | null;
  avatarUrl?: string | null;
  profileImage?: string | null;
  status?: string;
  forceLoggedOut?: boolean;
}

export function effectivePhotoUrl(user?: AppUser | null): string | null {
  if (!user) return null;
  const raw = user.profilePhotoUrl?.trim() || user.avatarUrl?.trim() || user.profileImage?.trim() || null;
  if (!raw || raw.startsWith('data:')) return null;
  return raw;
}

export function isInspectionUser(user?: AppUser | null): boolean {
  if (!user) return false;
  if (user.isInspectionUser === true) return true;
  const role = user.role || '';
  return /inspection|inspector|field|officer|worker|animator|supervisor|\btp\b|zonal/i.test(role);
}

export function designationNameEn(user?: AppUser | null): string {
  return user?.designationNameEnField?.trim() || user?.designationNameEn?.trim() || user?.designation || '';
}

export interface InspectionDesignation {
  id?: string;
  nameEn?: string;
  nameTa?: string;
  code?: string;
}

function isDisplayDesignation(value: string, designationId?: string) {
  const v = value.trim();
  if (!v) return false;
  if (designationId && v === designationId) return false;
  if (/^[a-z]{1,4}_[a-z0-9]+$/i.test(v) && !/\s/.test(v)) return false;
  return true;
}

export function resolveOfficerDesignation(
  user?: AppUser | null,
  portal?: PortalState | null,
  isTamil = false,
): string {
  const designations = portal?.inspectionDesignations || [];
  const desigId = String(user?.designationId || '').trim();
  const matched = designations.find(
    (d) =>
      String(d.id || '') === desigId ||
      String(d.id || '') === String(user?.designation || '').trim() ||
      String(d.nameEn || '').toLowerCase() === desigId.toLowerCase() ||
      String(d.nameEn || '').toLowerCase() === String(user?.designation || '').trim().toLowerCase() ||
      String(d.nameTa || '') === desigId ||
      String(d.nameTa || '') === String(user?.designation || '').trim(),
  );
  const candidates = isTamil
    ? [
        matched?.nameTa,
        matched?.nameEn,
        user?.designationNameTa,
        user?.designationNameEn,
        user?.designation,
        user?.roleNameTa,
        user?.role,
      ]
    : [
        matched?.nameEn,
        matched?.nameTa,
        user?.designationNameEnField,
        user?.designationNameEn,
        user?.designation,
        user?.role,
      ];
  return (
    candidates
      .map((value) => String(value || '').trim())
      .find((value) => isDisplayDesignation(value, desigId)) || ''
  );
}

export function effectiveWards(user?: AppUser | null): string[] {
  if (!user) return [];
  return (user.assignedWards?.length ? user.assignedWards : user.selectedWards) || [];
}

export function effectiveSubjectIds(user?: AppUser | null): string[] {
  if (!user) return [];
  return (user.subjectIds?.length ? user.subjectIds : user.assignedSubjects) || [];
}

export function effectiveCategoryIds(user?: AppUser | null): string[] {
  if (!user) return [];
  return (user.categoryIds?.length ? user.categoryIds : user.assignedCategories) || [];
}

export function resolvedTpId(user?: AppUser | null): string {
  if (!user) return '';
  if (user.tpId?.trim()) return user.tpId;
  if (user.townPanchayatId?.trim()) return user.townPanchayatId;
  const st = (user.scopeType || '').toLowerCase();
  if ((st === 'townpanchayat' || st === 'single_tp') && user.scopeId?.trim()) return user.scopeId;
  return '';
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string | null;
  user?: AppUser | null;
  message?: string | null;
  scopeVersion?: number;
  userScope?: UserScopeData | null;
}

export interface ChangePasswordResponse {
  success: boolean;
  message?: string | null;
}

export interface Subject {
  id: string;
  nameEn: string;
  nameTa: string;
  icon?: string | null;
  code?: string;
}

export interface Category {
  id: string;
  subjectId: string;
  nameEn: string;
  nameTa: string;
  description?: string | null;
  code?: string | null;
}

export interface FieldDefinition {
  id?: string;
  categoryId?: string;
  fieldName?: string;
  fieldNameTa?: string;
  nameEn?: string | null;
  nameTa?: string | null;
  fieldType?: string;
  type?: string | null;
  isRequired?: boolean;
  isMandatory?: boolean | null;
  options?: string[];
  dependsOnFieldId?: string | null;
  dependsOnValue?: string | null;
  conditionType?: string | null;
  conditionalAction?: string | null;
  conditionalTriggerValue?: string | null;
  placeholderEn?: string | null;
  placeholderTa?: string | null;
  isUnique?: boolean;
  order?: number | null;
  sequence?: number | null;
}

export interface DistrictModel {
  id: string;
  zoneId?: string;
  nameEn: string;
  nameTa: string;
  code?: string;
}

export interface TownPanchayatModel {
  id: string;
  districtId?: string;
  nameEn: string;
  nameTa: string;
  code?: string;
}

export interface WardAndStreet {
  id?: string | null;
  tpId?: string | null;
  tpNameEn?: string | null;
  tpNameTa?: string | null;
  wardNo: string;
  streetNameEn: string;
  streetNameTa?: string | null;
}

export interface InspectionWork {
  id: string;
  workId: string;
  districtCode?: string;
  tpCode?: string;
  subjectId: string;
  subjectNameEn: string;
  subjectNameTa: string;
  categoryId: string;
  categoryNameEn: string;
  categoryNameTa: string;
  tpNameEn: string;
  tpNameTa: string;
  zoneNameEn: string;
  zoneNameTa: string;
  districtNameEn: string;
  districtNameTa: string;
  wardNumber: string;
  streetName: string;
  latitude: number;
  longitude: number;
  fieldsData: Record<string, unknown>;
  imageUrl?: string | null;
  imageCaption?: string;
  documentName?: string | null;
  documentUrl?: string | null;
  submittedAt: string;
  submittedByUserName: string;
  submittedByUserId: string;
  status?: string;
}

export interface PortalState {
  districts?: DistrictModel[];
  townPanchayats?: TownPanchayatModel[];
  inspectionSubjects?: Subject[];
  inspectionCategories?: Category[];
  inspectionFields?: FieldDefinition[];
  wardsAndStreets?: WardAndStreet[];
  inspectionWorks?: InspectionWork[];
  subjects?: Subject[];
  categories?: Category[];
  fields?: FieldDefinition[];
  works?: InspectionWork[];
  user?: AppUser | null;
  inspectionDesignations?: InspectionDesignation[];
  appIconUrl?: string | null;
  loginLogoUrl?: string | null;
  settings?: {
    googleMapsApiKey?: string;
    [key: string]: unknown;
  };
}

export function portalSubjects(p: PortalState): Subject[] {
  return p.inspectionSubjects?.length ? p.inspectionSubjects : p.subjects || [];
}
export function portalCategories(p: PortalState): Category[] {
  return p.inspectionCategories?.length ? p.inspectionCategories : p.categories || [];
}
export function portalFields(p: PortalState): FieldDefinition[] {
  return p.inspectionFields?.length ? p.inspectionFields : p.fields || [];
}
export function portalWorks(p: PortalState): InspectionWork[] {
  return p.inspectionWorks?.length ? p.inspectionWorks : p.works || [];
}

export interface SubmitWorkResponse {
  success: boolean;
  message?: string | null;
  work?: InspectionWork | null;
  workId?: string | null;
  jobId?: string | null;
  queued?: boolean | null;
}

export interface QueueEnqueueResponse {
  success: boolean;
  jobId?: string | null;
  status?: string | null;
  queuePosition?: number | null;
  message?: string | null;
}

export interface QueueJobDetail {
  jobId?: string;
  status?: string;
  progress?: number;
  statusMessage?: string;
  workId?: string | null;
  error?: string | null;
  result?: InspectionWork | null;
}

export interface QueueStatusResponse {
  success: boolean;
  job?: QueueJobDetail | null;
  message?: string | null;
}

export const QUEUE_STATUS = {
  IMAGE_COMPRESSING: 'COMPRESSING',
  IN_QUEUE: 'IN_QUEUE',
  PROCESSING: 'PROCESSING',
  SUBMITTED: 'SUBMITTED',
  REJECTED_RETRY: 'REJECTED_RETRY',
} as const;

export interface QueuedWorkEntry {
  clientTaskId: string;
  work: InspectionWork;
  localPhotoPath?: string | null;
  compressedPhotoPath?: string | null;
  status: string;
  progress: number;
  workId?: string | null;
  serverJobId?: string | null;
  errorMessage?: string | null;
  attemptCount: number;
  createdAt: number;
}

export function queuedDisplayStatus(entry: QueuedWorkEntry, isTamil: boolean): string {
  switch (entry.status) {
    case QUEUE_STATUS.IMAGE_COMPRESSING:
      return isTamil ? 'பட செயலாக்கம் (சுருக்குதல்)...' : 'Data processing (image compression)...';
    case QUEUE_STATUS.IN_QUEUE:
      return isTamil ? 'வரிசையில் உள்ளது (FIFO Queue)...' : 'In Queue (Waiting)...';
    case QUEUE_STATUS.PROCESSING:
      return isTamil ? 'சர்வரில் செயலாக்கப்படுகிறது...' : 'Processing on AWS Server...';
    case QUEUE_STATUS.SUBMITTED:
      return isTamil
        ? `வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது (${entry.workId})`
        : `Submitted (${entry.workId})`;
    case QUEUE_STATUS.REJECTED_RETRY:
      return isTamil ? 'தாமதம் - வரிசையின் இறுதியில் மறுமுயற்சி' : 'Slow/Timeout - Retrying at end of queue';
    default:
      return entry.status;
  }
}

export interface ScopeVersionResponse {
  success: boolean;
  scopeVersion?: number;
  updatedAt?: string;
  hasUpdate?: boolean;
  message?: string | null;
}

export interface ScopeTownPanchayat {
  id: string;
  nameEn: string;
  nameTa: string;
  districtId?: string | null;
  districtNameEn?: string | null;
  districtNameTa?: string | null;
}

export interface ValidationRule {
  required?: boolean | null;
  mandatory?: boolean | null;
  errorMessageTa?: string | null;
  errorMessageEn?: string | null;
  minLength?: number | null;
  maxLength?: number | null;
  pattern?: string | null;
  unique?: boolean | null;
}

export interface UserScopeData {
  userId?: string;
  username?: string;
  scopeVersion?: number;
  updatedAt?: string;
  user?: AppUser | null;
  townPanchayat?: ScopeTownPanchayat | null;
  assignedWards?: string[];
  wardsAndStreets?: WardAndStreet[];
  subjects?: Subject[];
  categories?: Category[];
  fields?: FieldDefinition[];
  validationRules?: Record<string, ValidationRule> | null;
}

export interface UserScopeResponse {
  success: boolean;
  scopeVersion?: number;
  updatedAt?: string;
  scope?: UserScopeData | null;
  message?: string | null;
}

export interface ProfilePhotoUploadResponse {
  success: boolean;
  profilePhotoUrl?: string | null;
  rawS3Url?: string | null;
  message?: string | null;
}

export interface VersionCheckResponse {
  success?: boolean;
  latestVersionCode?: number;
  latestVersionName?: string;
  minRequiredVersionCode?: number;
  forceUpdate?: boolean;
  apkDownloadUrl?: string;
  releaseNotes?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  mediaUrl?: string | null;
  imageUrl?: string | null;
  fileUrl?: string | null;
  fileType?: string | null;
  fileName?: string | null;
  actionUrl?: string | null;
  createdAt?: string | null;
  expiresAt?: string | null;
  expiryDate?: string | null;
  validTill?: string | null;
  validUntil?: string | null;
  endDate?: string | null;
  status?: string | null;
  isExpired?: boolean;
  active?: boolean;
  isRead?: boolean;
}

export function effectiveMediaUrl(n: NotificationItem): string | null {
  return n.mediaUrl?.trim() || n.imageUrl?.trim() || n.fileUrl?.trim() || null;
}

function notificationExpiryRaw(n: NotificationItem): string {
  return String(n.expiresAt || n.expiryDate || n.validTill || n.validUntil || n.endDate || '').trim();
}

export function isNotificationActive(n: NotificationItem): boolean {
  if (n.isExpired === true || n.active === false) return false;
  const status = String(n.status || '').trim().toLowerCase();
  if (status === 'expired' || status === 'inactive' || status === 'disabled') return false;
  const raw = notificationExpiryRaw(n);
  if (!raw) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const end = new Date(`${raw}T23:59:59.999`);
    return !Number.isNaN(end.getTime()) && end.getTime() >= Date.now();
  }
  const t = Date.parse(raw);
  return Number.isNaN(t) ? true : t >= Date.now();
}

export function activeNotifications(list: NotificationItem[] | null | undefined): NotificationItem[] {
  return (list || []).filter(isNotificationActive);
}

export function effectiveFileType(n: NotificationItem): string {
  if (n.fileType && n.fileType !== 'none') return n.fileType.toLowerCase();
  const url = (effectiveMediaUrl(n) || '').toLowerCase();
  if (url.endsWith('.pdf')) return 'pdf';
  if (/\.(xlsx|xls|csv)$/.test(url)) return 'excel';
  if (/\.(jpg|jpeg|png|webp)$/.test(url)) return 'image';
  if (url) return 'file';
  return 'none';
}

export interface NotificationsListResponse {
  success?: boolean;
  count?: number;
  notifications?: NotificationItem[];
  message?: string | null;
}

export const emptyPortal = (): PortalState => ({
  districts: [],
  townPanchayats: [],
  inspectionSubjects: [],
  inspectionCategories: [],
  inspectionFields: [],
  wardsAndStreets: [],
  inspectionWorks: [],
  subjects: [],
  categories: [],
  fields: [],
  works: [],
});
