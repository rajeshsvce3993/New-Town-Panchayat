import { 
  LayoutDashboard, 
  Layers, 
  ShieldAlert, 
  Sliders, 
  ClipboardCheck, 
  UserCheck, 
  FileSpreadsheet, 
  Calculator, 
  Users, 
  AlertTriangle, 
  Bell, 
  UserCircle, 
  Settings,
  ArrowLeftRight
} from 'lucide-react';

export interface SystemPage {
  id: string;
  nameEn: string;
  nameTa: string;
  descriptionEn: string;
  descriptionTa: string;
  categoryEn: string;
  categoryTa: string;
  icon: any;
  isCoreAdmin?: boolean;
}

export const SYSTEM_PAGES: SystemPage[] = [
  {
    id: 'dashboard',
    nameEn: 'Dashboard',
    nameTa: 'டாஷ்போர்டு',
    descriptionEn: 'High-level administration summary, KPI metrics and statistics',
    descriptionTa: 'நிர்வாக அளவீடுகள், முக்கிய புள்ளிவிவரங்கள் மற்றும் சுருக்கம்',
    categoryEn: 'Core Overview',
    categoryTa: 'பொது கண்ணோட்டம்',
    icon: LayoutDashboard
  },
  {
    id: 'masters',
    nameEn: 'Master Management',
    nameTa: 'முதன்மை மேலாண்மை',
    descriptionEn: 'Zones, Districts, Town Panchayats, Groups, Categories & Posts',
    descriptionTa: 'மண்டலங்கள், மாவட்டங்கள், பேரூராட்சிகள், குழுக்கள் மற்றும் பதவிகள்',
    categoryEn: 'System Administration',
    categoryTa: 'கணினி நிர்வாகம்',
    icon: Layers,
    isCoreAdmin: true
  },
  {
    id: 'users',
    nameEn: 'User Management & Permissions',
    nameTa: 'பயனர் & பக்க அனுமதி மேலாண்மை',
    descriptionEn: 'User accounts, role assignments, jurisdictions and page permissions',
    descriptionTa: 'பயனர் கணக்குகள், பங்கு ஒதுக்கீடு மற்றும் பக்க அனுமதி கட்டுப்பாடு',
    categoryEn: 'System Administration',
    categoryTa: 'கணினி நிர்வாகம்',
    icon: ShieldAlert,
    isCoreAdmin: true
  },
  {
    id: 'modules',
    nameEn: 'Dynamic Module Management',
    nameTa: 'தொகுதி மேலாண்மை',
    descriptionEn: 'Configurable dynamic modules, categories and validation fields',
    descriptionTa: 'மாறும் தனிப்பயன் தொகுதிகள் மற்றும் சரிபார்ப்பு புலங்கள்',
    categoryEn: 'System Administration',
    categoryTa: 'கணினி நிர்வாகம்',
    icon: Sliders,
    isCoreAdmin: true
  },
  {
    id: 'inspectionModules',
    nameEn: 'Field Inspection Work Types',
    nameTa: 'கள ஆய்வு தொகுதி மேலாண்மை',
    descriptionEn: 'Inspection subjects, categories, dynamic field schema builder',
    descriptionTa: 'ஆய்வுப் பிரிவுகள், வகைகள் மற்றும் புல அமைப்புகள்',
    categoryEn: 'Field Inspections',
    categoryTa: 'கள ஆய்வுகள்',
    icon: ClipboardCheck
  },
  {
    id: 'inspectionEmployees',
    nameEn: 'Inspection Staff Management',
    nameTa: 'கள ஆய்வு பணியாளர்கள்',
    descriptionEn: 'Contractual field inspectors, supervisors and mobile app logins',
    descriptionTa: 'கள ஆய்வாளர்கள் மற்றும் மொபைல் செயலி பயனர்கள்',
    categoryEn: 'Field Inspections',
    categoryTa: 'கள ஆய்வுகள்',
    icon: UserCheck
  },
  {
    id: 'inspectionReports',
    nameEn: 'Field Inspection Reports & GIS',
    nameTa: 'ஆய்வு அறிக்கைகள் (GIS)',
    descriptionEn: 'Detailed audit slips, abstracts, geo-tagged photos and ward GIS map',
    descriptionTa: 'தணிக்கை சீட்டுகள், சுருக்க அறிக்கைகள் மற்றும் வரைபடங்கள்',
    categoryEn: 'Field Inspections',
    categoryTa: 'கள ஆய்வுகள்',
    icon: FileSpreadsheet
  },
  {
    id: 'pfManagement',
    nameEn: 'Provident Fund (PF) Management',
    nameTa: 'வருங்கால வைப்பு நிதி (PF)',
    descriptionEn: 'Town Panchayat PF ledger, subscriptions, interest calculation & withdrawals',
    descriptionTa: 'PF சந்தா கணக்குகள், வட்டி கணக்கீடு மற்றும் திரும்பப் பெறுதல்',
    categoryEn: 'Employee & Finance',
    categoryTa: 'பணியாளர் & நிதி',
    icon: Calculator
  },
  {
    id: 'employees',
    nameEn: 'Employee Management & Transfers',
    nameTa: 'பணியாளர் மேலாண்மை',
    descriptionEn: 'Cadre employee records, sanctioned post tracking, transfers and audit logs',
    descriptionTa: 'பணியாளர் சேவை ஆவணங்கள் மற்றும் பணியிட மாறுதல்கள்',
    categoryEn: 'Employee & Finance',
    categoryTa: 'பணியாளர் & நிதி',
    icon: Users
  },
  {
    id: 'transferCounseling',
    nameEn: 'Employee Transfer Counseling',
    nameTa: 'பணியிட மாற்று ஆலோசனை',
    descriptionEn: 'Counseling session: review applicants, vacancies, and allocate transfers with remarks',
    descriptionTa: 'விண்ணapanங்கள், காலியிடங்கள் மற்றும் இடமாற்ற ஒதுக்கீடு',
    categoryEn: 'Employee & Finance',
    categoryTa: 'பணியாளர் & நிதி',
    icon: ArrowLeftRight
  },
  {
    id: 'pendingIssues',
    nameEn: 'Pending Issues & Complaints',
    nameTa: 'நிலுவையிலுள்ள புகார்கள் & சிக்கல்கள்',
    descriptionEn: 'Public complaints, municipal sanitation issues and escalation tracking',
    descriptionTa: 'பொதுமக்கள் புகார்கள் மற்றும் தீர்வு கண்காணிப்பு',
    categoryEn: 'Operations & Grievance',
    categoryTa: 'இயக்கங்கள் & புகார்கள்',
    icon: AlertTriangle
  },
  {
    id: 'appManagement',
    nameEn: 'App Updates & Notifications',
    nameTa: 'அறிவிப்பு & பதிப்பு மேலாண்மை',
    descriptionEn: 'APK release publishing, version checks and push broadcast alerts',
    descriptionTa: 'APK பதிப்புகள் வெளியீடு மற்றும் புஷ் அறிவிப்புகள்',
    categoryEn: 'Mobile & Broadcast',
    categoryTa: 'மொபைல் & அறிவிப்புகள்',
    icon: Bell
  },
  {
    id: 'userSettings',
    nameEn: 'Personal Profile & Settings',
    nameTa: 'பயனர் அமைப்புகள்',
    descriptionEn: 'Profile information, password changes and theme color preferences',
    descriptionTa: 'சுயவிவரம், கடவுச்சொல் மாற்றம் மற்றும் வண்ண விருப்பங்கள்',
    categoryEn: 'Preferences',
    categoryTa: 'விருப்பத்தேர்வுகள்',
    icon: UserCircle
  },
  {
    id: 'webappSettings',
    nameEn: 'System Webapp Settings',
    nameTa: 'இணையதள அமைப்புகள்',
    descriptionEn: 'MongoDB connectivity, AWS S3 storage parameters and global portal controls',
    descriptionTa: 'MongoDB மற்றும் AWS S3 சேமிப்பக அமைப்புகள்',
    categoryEn: 'System Administration',
    categoryTa: 'கணினி நிர்வாகம்',
    icon: Settings,
    isCoreAdmin: true
  }
];

export const ALL_PAGE_IDS = SYSTEM_PAGES.map(p => p.id);

export const DEFAULT_ROLE_PAGES: Record<string, string[]> = {
  admin: ALL_PAGE_IDS,
  ad: ['dashboard', 'inspectionModules', 'inspectionEmployees', 'inspectionReports', 'pfManagement', 'employees', 'transferCounseling', 'pendingIssues', 'userSettings'],
  eo: ['dashboard', 'inspectionModules', 'inspectionEmployees', 'inspectionReports', 'pfManagement', 'employees', 'transferCounseling', 'pendingIssues', 'userSettings'],
  zonal: ['dashboard', 'inspectionModules', 'inspectionEmployees', 'inspectionReports', 'pfManagement', 'employees', 'transferCounseling', 'pendingIssues', 'userSettings']
};

export const getDefaultRolePages = (roleId: string): string[] => {
  const cleanId = (roleId || '').toLowerCase().trim();
  if (cleanId === 'admin' || cleanId.includes('admin') || cleanId.includes('director')) {
    return [...ALL_PAGE_IDS];
  }
  if (DEFAULT_ROLE_PAGES[cleanId]) {
    return [...DEFAULT_ROLE_PAGES[cleanId]];
  }
  return [
    'dashboard',
    'inspectionModules',
    'inspectionEmployees',
    'inspectionReports',
    'pfManagement',
    'employees',
    'transferCounseling',
    'pendingIssues',
    'userSettings'
  ];
};

export const getUserEffectiveAllowedPages = (user: any, roles: any[] = []): string[] => {
  if (!user) return [];

  // Employee accounts
  if (user.isEmployee) {
    if (Array.isArray(user.customPagePermissions) && user.customPagePermissions.length > 0) {
      return user.customPagePermissions;
    }
    return ['employeeManagement', 'inspectionReports', 'pfManagement', 'userSettings'];
  }

  // Check 1: User-wise custom permissions override
  if (Array.isArray(user.customPagePermissions) && user.customPagePermissions.length > 0) {
    return user.customPagePermissions;
  }

  // Check 2: Role-wise permissions
  const userRoleId = (user.roleId || user.role || '').toLowerCase().trim();
  const matchedRole = roles.find((r: any) => 
    r.id?.toLowerCase() === userRoleId || 
    r.code?.toLowerCase() === userRoleId
  );

  if (matchedRole?.pagePermissions && Array.isArray(matchedRole.pagePermissions) && matchedRole.pagePermissions.length > 0) {
    return matchedRole.pagePermissions;
  }

  // Fallback to role defaults
  return getDefaultRolePages(userRoleId);
};
