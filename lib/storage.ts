import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { MongoClient, Db } from 'mongodb';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { OFFICIAL_PF_INTEREST_RATES } from './pfInterestRatesData';
import { isFallbackInspectionWork } from '@/lib/inspectionWorksQueryFilters';

// Storage paths for local fallback
const STORAGE_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(STORAGE_DIR, 'db.json');
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

// Ensure directories exist
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Initial Mock Seed Data
const INITIAL_DATA = {
  settings: {
    mongodbUri: 'mongodb://127.0.0.1:27018/dtp_enterprise',
    mongodbPoolSize: 500,
    s3Bucket: 'tms-2026',
    s3Region: 'ap-south-1',
    s3AccessKeyId: '',
    s3SecretAccessKey: '',
    s3PoolSize: 500,
    port: '3000',
    currentLanguage: 'en',
    theme: 'magic-lavender'
  },
  zones: [
    { id: 'z1', nameEn: 'Kanchipuram Zone', nameTa: 'காஞ்சிபுரம் மண்டலம்', code: '01' },
    { id: 'z_chennai', nameEn: 'Chennai Zone', nameTa: 'சென்னை மண்டலம்', code: '02' }
  ],
  districts: [
    { id: 'd_chengalpattu', zoneId: 'z1', nameEn: 'Chengalpattu', nameTa: 'செங்கல்பட்டு', code: '01' },
    { id: 'd_kanchi', zoneId: 'z1', nameEn: 'Kanchipuram', nameTa: 'காஞ்சிபுரம்', code: '02' },
    { id: 'd_thiruvallur', zoneId: 'z_chennai', nameEn: 'Thiruvallur', nameTa: 'திருவள்ளூர்', code: '03' }
  ],
  townPanchayats: [
    { id: 'tp_arani', districtId: 'd_thiruvallur', nameEn: 'Arani', nameTa: 'ஆரணி', code: '01' },
    { id: 'tp_csv_36u9', districtId: 'd_thiruvallur', nameEn: 'Arani', nameTa: 'ஆரணி', code: '01' },
    { id: 'tp_thirumazhisai', districtId: 'd_thiruvallur', nameEn: 'Thirumazhisai', nameTa: 'திருமழிசை', code: '02' },
    { id: 'tp1', districtId: 'd_chengalpattu', nameEn: 'Thiruporur', nameTa: 'திருப்போரூர்', code: '01' }
  ],
  wardsAndStreets: [
    { id: 'st_1', tpId: 'tp_arani', wardNo: '1', streetNameEn: 'Bazaar Street', streetNameTa: 'பஜார் வீதி' },
    { id: 'st_2', tpId: 'tp_arani', wardNo: '1', streetNameEn: 'Car Street', streetNameTa: 'தேர் வீதி' },
    { id: 'st_3', tpId: 'tp_arani', wardNo: '2', streetNameEn: 'Bazaar Street', streetNameTa: 'பஜார் வீதி' },
    { id: 'st_1_csv', tpId: 'tp_csv_36u9', wardNo: '1', streetNameEn: 'Bazaar Street', streetNameTa: 'பஜார் வீதி' },
    { id: 'st_2_csv', tpId: 'tp_csv_36u9', wardNo: '1', streetNameEn: 'Car Street', streetNameTa: 'தேர் வீதி' },
    { id: 'st_4', tpId: 'tp1', wardNo: '1', streetNameEn: 'Sannathi Street', streetNameTa: 'சன்னதி தெரு' }
  ],
  employeeGroups: [
    { id: 'A', nameEn: 'Group A', nameTa: 'குழு ஏ' },
    { id: 'B', nameEn: 'Group B', nameTa: 'குழு பி' },
    { id: 'C', nameEn: 'Group C', nameTa: 'குழு சி' },
    { id: 'D', nameEn: 'Group D', nameTa: 'குழு டி' }
  ],
  employeeCategories: [
    { id: 'admin', nameEn: 'Administration', nameTa: 'நிர்வாகம்' },
    { id: 'eng', nameEn: 'Engineering', nameTa: 'பொறியியல்' },
    { id: 'health', nameEn: 'Public Health', nameTa: 'பொது சுகாதாரம்' }
  ],
  postNatures: [
    { id: 'prov', nameEn: 'Provincialised', nameTa: 'மாநில அளவிலானது' },
    { id: 'non-prov', nameEn: 'Non Provincialised', nameTa: 'மாநில அளவில்லாதது' }
  ],
  payLevels: [
    { id: 'pb1', nameEn: 'PB 1 (15700 - 50000)', nameTa: 'பிபி 1 (15700 - 50000)', minPay: 15700, maxPay: 50000 },
    { id: 'pb2', nameEn: 'PB 2 (20600 - 65500)', nameTa: 'பிபி 2 (20600 - 65500)', minPay: 20600, maxPay: 65500 }
  ],
  posts: [
    { id: 'director', nameEn: 'Director', nameTa: 'இயக்குனர்' },
    { id: 'ad', nameEn: 'Assistant Director', nameTa: 'உதவி இயக்குனர்' },
    { id: 'eo', nameEn: 'Executive Officer', nameTa: 'செயல் அலுவலர்' },
    { id: 'ja', nameEn: 'Junior Assistant', nameTa: 'இளநிலை உதவியாளர்' },
    { id: 'bc', nameEn: 'Bill Collector', nameTa: 'வரி வசூலிப்பவர்' },
    { id: 'oa', nameEn: 'Office Assistant', nameTa: 'அலுவலக உதவியாளர்' }
  ],
  officeCategories: [
    {
      id: 'dtp',
      nameEn: 'DTP (Directorate of Town Panchayats)',
      nameTa: 'பேரூராட்சிகளின் இயக்ககம் (DTP)',
      type: 'DTP',
      sanctions: { director: 1, ad: 2, eo: 1, ja: 10, bc: 0, oa: 5 }
    },
    {
      id: 'adtp',
      nameEn: 'ADTP (Assistant Director of Town Panchayats)',
      nameTa: 'பேரூராட்சிகளின் உதவி இயக்குனர் அலுவலகம் (ADTP)',
      type: 'ADTP',
      sanctions: { ad: 1, eo: 1, ja: 5, bc: 0, oa: 3 }
    },
    {
      id: 'tp',
      nameEn: 'TP (Town Panchayat)',
      nameTa: 'பேரூராட்சி (TP)',
      type: 'TP',
      sanctions: { eo: 1, ja: 3, bc: 2, oa: 1 }
    }
  ],
  roles: [
    { id: 'admin', nameEn: 'Admin / Director (HOD)', nameTa: 'நிர்வாகி / இயக்குனர் (தலைமையகம்)', permissions: ['all'] },
    { id: 'ad', nameEn: 'Assistant Director (Zone)', nameTa: 'உதவி இயக்குனர் (மண்டலம்)', permissions: ['zone_control'] },
    { id: 'eo', nameEn: 'Executive Officer (TP)', nameTa: 'செயல் அலுவலர் (பேரூராட்சி)', permissions: ['tp_control'] }
  ],
  users: [
    {
      id: 'u_admin',
      username: 'admin',
      passwordHash: 'admin123',
      roleId: 'admin',
      scopeType: 'HOD',
      scopeId: 'all',
      status: 'Active',
      nameEn: 'Administrator / Director',
      nameTa: 'நிர்வாகி / இயக்குனர் (தலைமையகம்)'
    },
    {
      id: 'u1',
      username: 'dtpadmin',
      passwordHash: 'dtp123', // Clean simplified plain text password for easy demo
      roleId: 'admin',
      scopeType: 'HOD',
      scopeId: 'all',
      status: 'Active',
      nameEn: 'DTP Director Head Office',
      nameTa: 'இயக்குநர் தலைமையகம்'
    },
    {
      id: 'u2',
      username: 'ad_kanchi',
      passwordHash: 'ad123',
      roleId: 'ad',
      scopeType: 'Zone',
      scopeId: 'z1', // Kanchipuram Zone
      status: 'Active',
      nameEn: 'AD Kanchipuram Zone',
      nameTa: 'உதவி இயக்குநர் காஞ்சிபுரம்'
    },
    {
      id: 'u_zonal',
      username: 'zonal',
      passwordHash: 'zonal123',
      roleId: 'ad',
      scopeType: 'Zone',
      scopeId: 'z1', // Kanchipuram Zone
      status: 'Active',
      nameEn: 'Zonal User Kanchipuram',
      nameTa: 'மண்டல பயனர் காஞ்சிபுரம்'
    },
    {
      id: 'u3',
      username: 'eo_thiruporur',
      passwordHash: 'eo123',
      roleId: 'eo',
      scopeType: 'TownPanchayat',
      scopeId: 'tp1', // Thiruporur TP
      status: 'Active',
      nameEn: 'EO Thiruporur Town Panchayat',
      nameTa: 'செயல் அலுவலர் திருப்போரூர்'
    },
    {
      id: 'u_tp',
      username: 'tp',
      passwordHash: 'tp123',
      roleId: 'eo',
      scopeType: 'TownPanchayat',
      scopeId: 'tp1', // Thiruporur TP
      status: 'Active',
      nameEn: 'Town Panchayat Executive Officer',
      nameTa: 'பேரூராட்சி செயல் அலுவலர்'
    }
  ],
  modules: [
    { id: 'm1', nameEn: 'Basic Employee Details', nameTa: 'அடிப்படை ஊழியர் விவரங்கள்', applicablePosts: ['director', 'ad', 'eo', 'ja', 'bc', 'oa'] },
    { id: 'm2', nameEn: 'Probation Details', nameTa: 'தகுதிகாண் பருவம் விவரங்கள்', applicablePosts: ['eo', 'ja', 'bc'] },
    { id: 'm3', nameEn: 'Leave Details', nameTa: 'விடுப்பு விவரங்கள்', applicablePosts: ['director', 'ad', 'eo', 'ja', 'bc', 'oa'] }
  ],
  fields: [
    { id: 'f1', moduleId: 'm1', nameEn: 'Father\'s Name', nameTa: 'தந்தையின் பெயர்', type: 'text', validations: { required: true } },
    { id: 'f2', moduleId: 'm1', nameEn: 'Date of Birth', nameTa: 'பிறந்த தேதி', type: 'date', validations: { required: true } },
    { id: 'f3', moduleId: 'm1', nameEn: 'Blood Group', nameTa: 'இரத்த வகை', type: 'text', validations: { required: false } },
    { id: 'f4', moduleId: 'm2', nameEn: 'Probation Declaration Date', nameTa: 'தகுதிகாண் பருவம் அறிவிக்கப்பட்ட தேதி', type: 'date', validations: { required: true } },
    { id: 'f5', moduleId: 'm2', nameEn: 'Declaration Order Reference', nameTa: 'ஆணை குறிப்பு எண்', type: 'text', validations: { required: true } },
    { id: 'f6', moduleId: 'm3', nameEn: 'Earned Leave Balance', nameTa: 'ஈட்டிய விடுப்பு இருப்பு', type: 'number', validations: { required: true, min: 0 } }
  ],
  employees: [
    {
      id: 'emp1',
      employeeId: 'EMP001',
      nameEn: 'Subramanian K',
      nameTa: 'சுப்பிரமணியன் கே',
      username: 'EMP001',
      passwordHash: 'pass001',
      zoneId: 'z1',
      districtId: 'd2',
      townPanchayatId: 'tp1', // Thiruporur
      officeCategoryType: 'TP',
      roleId: 'eo',
      postId: 'eo',
      groupId: 'B',
      categoryId: 'admin',
      postNatureId: 'prov',
      payLevelId: 'pb2',
      status: 'Active',
      profileImage: '',
      documents: [
        { name: 'Appointment_Order.pdf', url: '/uploads/appointment_order_demo.pdf', category: 'Appointment' }
      ],
      dynamicData: {
        'f1': 'Karuppiah',
        'f2': '1985-05-15',
        'f3': 'O+ve'
      }
    },
    {
      id: 'emp2',
      employeeId: 'EMP002',
      nameEn: 'Rajendran M',
      nameTa: 'ராஜேந்திரன் எம்',
      username: 'EMP002',
      passwordHash: 'pass002',
      zoneId: 'z1',
      districtId: 'd2',
      townPanchayatId: 'tp1', // Thiruporur
      officeCategoryType: 'TP',
      roleId: 'eo',
      postId: 'ja',
      groupId: 'C',
      categoryId: 'admin',
      postNatureId: 'prov',
      payLevelId: 'pb1',
      status: 'Active',
      profileImage: '',
      documents: [],
      dynamicData: {
        'f1': 'Munusamy',
        'f2': '1990-08-20',
        'f3': 'A+ve',
        'f4': '2023-01-10',
        'f5': 'DTP/2023/A1'
      }
    }
  ],
  transferRequests: [
    {
      id: 'tr1',
      employeeId: 'EMP001',
      currentTPId: 'tp1',
      requestedTPId: 'tp2',
      reasonEn: 'Family reasons and proximity to hometown',
      reasonTa: 'குடும்ப சூழ்நிலை மற்றும் சொந்த ஊருக்கு அருகில் செல்லுதல்',
      status: 'Pending',
      createdAt: '2026-07-15T10:00:00.000Z'
    }
  ],
  transferReasons: [
    { id: 'tr_reason_1', nameEn: 'Medical Grounds', nameTa: 'மருத்துவ காரணங்கள்' },
    { id: 'tr_reason_2', nameEn: 'Spouse Employment / Co-location', nameTa: 'துணைவர் பணிபுரிதல் / ஒன்றிணைப்பு' },
    { id: 'tr_reason_3', nameEn: 'Mutual Transfer', nameTa: 'பரஸ்பர இடமாற்றம்' },
    { id: 'tr_reason_4', nameEn: 'Compassionate Grounds', nameTa: 'கருணை அடிப்படை' },
    { id: 'tr_reason_5', nameEn: 'Seniority / Promotion Posting', nameTa: 'முதுநிலை / பதவி உயர்வு நியமனம்' }
  ],
  activityLogs: [
    {
      id: 'log1',
      employeeId: 'EMP001',
      employeeName: 'Subramanian K',
      changedBy: 'DTP Director Head Office (dtpadmin)',
      action: 'Profile Updated',
      details: "Updated Father's Name to Karuppiah and blood group to O+ve",
      timestamp: '2026-07-18T10:30:00.000Z'
    },
    {
      id: 'log2',
      employeeId: 'EMP002',
      employeeName: 'Rajendran M',
      changedBy: 'AD Kanchipuram Zone (ad_kanchi)',
      action: 'Document Uploaded',
      details: 'Uploaded Appointment_Order.pdf to secure storage',
      timestamp: '2026-07-18T11:15:00.000Z'
    }
  ],
  pendingIssuesSchema: [
    {
      id: 'ws_f1',
      category: 'works',
      nameEn: 'Project Name',
      nameTa: 'திட்டத்தின் பெயர்',
      type: 'text',
      validations: { required: true, maxLength: 100 }
    },
    {
      id: 'ws_f2',
      category: 'works',
      nameEn: 'Estimated Cost (in Lakhs)',
      nameTa: 'மதிப்பிடப்பட்ட தொகை (லட்சத்தில்)',
      type: 'number',
      validations: { required: true, min: 0, max: 10000 }
    },
    {
      id: 'ws_f3',
      category: 'works',
      nameEn: 'Target Date',
      nameTa: 'இலக்கு தேதி',
      type: 'date',
      validations: { required: true }
    },
    {
      id: 'ws_f4',
      category: 'works',
      nameEn: 'Technical Sanction PDF',
      nameTa: 'தொழில்நுட்ப அனுமதி PDF',
      type: 'file',
      validations: { required: false, fileTypes: ['pdf'], maxSizeMB: 5 }
    },
    {
      id: 'est_f1',
      category: 'establishment',
      nameEn: 'Designation affected',
      nameTa: 'பாதிக்கப்பட்ட பதவி',
      type: 'text',
      validations: { required: true, maxLength: 50 }
    },
    {
      id: 'est_f2',
      category: 'establishment',
      nameEn: 'Number of Vacancies / Beneficiaries',
      nameTa: 'காலியிடங்கள் / பயனாளிகளின் எண்ணிக்கை',
      type: 'number',
      validations: { required: true, min: 1, max: 100 }
    },
    {
      id: 'est_f3',
      category: 'establishment',
      nameEn: 'Representation Letter / Proof',
      nameTa: 'கோரிக்கை கடிதம் / ஆதாரம்',
      type: 'file',
      validations: { required: false, fileTypes: ['pdf', 'image'], maxSizeMB: 2 }
    },
    {
      id: 'os_f1',
      category: 'online_services',
      nameEn: 'Service Application Number',
      nameTa: 'சேவை விண்ணப்ப எண்',
      type: 'text',
      validations: { required: true, maxLength: 20 }
    },
    {
      id: 'os_f2',
      category: 'online_services',
      nameEn: 'Average Delay (in Days)',
      nameTa: 'சராசரி தாமதம் (நாட்களில்)',
      type: 'number',
      validations: { required: true, min: 0 }
    },
    {
      id: 'os_f3',
      category: 'online_services',
      nameEn: 'Service Issue Screenshot',
      nameTa: 'சேவை சிக்கல் ஸ்கிரீன்ஷாட்',
      type: 'file',
      validations: { required: false, fileTypes: ['image'], maxSizeMB: 3 }
    },
    {
      id: 'oth_f1',
      category: 'other_issues',
      nameEn: 'Issue Description',
      nameTa: 'சிக்கலின் விளக்கம்',
      type: 'text',
      validations: { required: true, maxLength: 500 }
    },
    {
      id: 'oth_f2',
      category: 'other_issues',
      nameEn: 'Reference Document',
      nameTa: 'குறிப்பு ஆவணம்',
      type: 'file',
      validations: { required: false, fileTypes: ['pdf', 'image'], maxSizeMB: 4 }
    }
  ],
  pendingIssues: [
    {
      id: 'pi1',
      issueId: '#TP0001',
      townPanchayatId: 'tp1',
      zoneId: 'z1',
      districtId: 'd2',
      category: 'works',
      subcategory: 'Roads',
      status: 'Active',
      createdAt: '2026-08-19T10:00:00.000Z',
      fieldsData: {
        'ws_f1': 'Thiruporur Main Road Repair Work',
        'ws_f2': 45.5,
        'ws_f3': '2026-10-31',
        'ws_f4': { fileName: 'road_sanction_order.pdf', url: '/uploads/appointment_order_demo.pdf' }
      },
      comments: [
        {
          id: 'upd_1',
          status: 'Active',
          notes: 'Issue registered by Town Panchayat. Estimate prepared for road re-laying.',
          userName: 'EO Thiruporur Town Panchayat',
          userNameTa: 'செயல் அலுவலர் திருப்போரூர்',
          userRole: 'eo',
          userDesignation: 'Executive Officer (Thiruporur TP)',
          date: '2026-08-19T10:05:00.000Z'
        }
      ]
    }
  ],
  issueCategories: [] as any[],
  pfInterestRates: OFFICIAL_PF_INTEREST_RATES,
  pfSubscriptions: [
    {
      id: 'sub_demo_1',
      employeeId: 'EMP001',
      openingBalance: 125000,
      openingDate: '2023-04-01',
      entries: [
        { id: 'e1', type: 'subscription', amount: 5000, date: '2023-04-10', remarks: 'April Subscription' },
        { id: 'e2', type: 'subscription', amount: 5000, date: '2023-05-12', remarks: 'May Subscription' },
        { id: 'e3', type: 'subscription', amount: 5000, date: '2023-06-08', remarks: 'June Subscription' },
        { id: 'e4', type: 'withdrawal', amount: 20000, date: '2023-07-20', remarks: 'Festival Advance loan' },
        { id: 'e5', type: 'subscription', amount: 5000, date: '2023-07-10', remarks: 'July Subscription' },
        { id: 'e6', type: 'subscription', amount: 5000, date: '2023-08-11', remarks: 'August Subscription' },
        { id: 'e7', type: 'subscription', amount: 5000, date: '2023-09-09', remarks: 'September Subscription' },
        { id: 'e8', type: 'subscription', amount: 5000, date: '2023-10-10', remarks: 'October Subscription' },
        { id: 'e9', type: 'subscription', amount: 5000, date: '2023-11-12', remarks: 'November Subscription' },
        { id: 'e10', type: 'subscription', amount: 5000, date: '2023-12-10', remarks: 'December Subscription' },
        { id: 'e11', type: 'subscription', amount: 5000, date: '2024-01-10', remarks: 'January Subscription' },
        { id: 'e12', type: 'subscription', amount: 5000, date: '2024-02-12', remarks: 'February Subscription' },
        { id: 'e13', type: 'subscription', amount: 5000, date: '2024-03-10', remarks: 'March Subscription' }
      ]
    }
  ],
  pfEmployees: [] as any[],
  officePfSetup: [] as any[],
  pfChallans: [] as any[],
  deletedEmployees: [] as any[],
  // Inspection Module Management
  inspectionSubjects: [
    {
      id: 'subj_swm',
      nameEn: 'SWM Management',
      nameTa: 'திடக்கழிவு மேலாண்மை (SWM)',
      code: 'SWM',
      descriptionEn: 'Solid Waste Management and sanitation inspections',
      descriptionTa: 'திடக்கழிவு மேலாண்மை மற்றும் தூய்மை பணிகள் ஆய்வு'
    },
    {
      id: 'subj_water',
      nameEn: 'Water Supply Management',
      nameTa: 'குடிநீர் விநியோக மேலாண்மை',
      code: 'WSM',
      descriptionEn: 'Drinking water pipeline, chlorination and distribution checks',
      descriptionTa: 'குடிநீர் குழாய், குளோரினேஷன் மற்றும் விநியோக ஆய்வுகள்'
    },
    {
      id: 'subj_public_health',
      nameEn: 'Public Health & Sanitation',
      nameTa: 'பொது சுகாதாரம் மற்றும் துப்புரவு',
      code: 'PHS',
      descriptionEn: 'Mosquito control, DBC vector inspections',
      descriptionTa: 'கொசு கட்டுப்பாடு மற்றும் டெங்கு ஒழிப்பு ஆய்வுகள்'
    }
  ],
  inspectionCategories: [
    {
      id: 'cat_d2d',
      subjectId: 'subj_swm',
      nameEn: 'Door to Door Survey',
      nameTa: 'வீடு வீடாக சென்று கணக்கெடுப்பு',
      code: 'D2D',
      descriptionEn: 'Waste segregation collection inspection at household doorsteps',
      descriptionTa: 'வீட்டு வாசலில் குப்பை தரம் பிரித்தல் ஆய்வு'
    },
    {
      id: 'cat_commercial',
      subjectId: 'subj_swm',
      nameEn: 'Commercial Establishment Waste Check',
      nameTa: 'வணிக நிறுவன கழிவு ஆய்வு',
      code: 'CEW',
      descriptionEn: 'Checks at hotels, markets and commercial shops',
      descriptionTa: 'ஹோட்டல்கள் மற்றும் கடைகளில் ஆய்வு'
    },
    {
      id: 'cat_secondary_collection',
      subjectId: 'subj_swm',
      nameEn: 'Secondary collection',
      nameTa: 'இரண்டாம் நிலை குப்பை சேகரிப்பு',
      code: 'SEC',
      descriptionEn: 'Secondary collection point waste clearance and bin inspection',
      descriptionTa: 'இரண்டாம் நிலை சேகரிப்பு குப்பை தொட்டி ஆய்வு'
    },
    {
      id: 'cat_dbc',
      subjectId: 'subj_public_health',
      nameEn: 'Dengue Vector Breeding Check',
      nameTa: 'டெங்கு கொசுப்புழு உற்பத்தி ஆய்வு',
      code: 'DBC',
      descriptionEn: 'Household water container larval inspection',
      descriptionTa: 'வீட்டு நீர் சேமிப்பு தொட்டிகள் கொசுப்புழு ஆய்வு'
    }
  ],
  inspectionFields: [
    {
      id: 'if_1',
      categoryId: 'cat_d2d',
      nameEn: 'Door / Assessment Number',
      nameTa: 'கதவு / வரி மதிப்பீட்டு எண்',
      type: 'text',
      isMandatory: true,
      isUnique: true,
      options: []
    },
    {
      id: 'if_2',
      categoryId: 'cat_d2d',
      nameEn: 'Citizen Mobile Number',
      nameTa: 'குடிமகன் அலைபேசி எண்',
      type: 'mobile',
      isMandatory: true,
      isUnique: false,
      options: []
    },
    {
      id: 'if_3',
      categoryId: 'cat_d2d',
      nameEn: 'Household Members Count',
      nameTa: 'குடும்ப உறுப்பினர்கள் எண்ணிக்கை',
      type: 'number',
      isMandatory: false,
      isUnique: false,
      options: []
    },
    {
      id: 'if_4',
      categoryId: 'cat_d2d',
      nameEn: 'Segregating Waste at Source?',
      nameTa: 'குப்பை தரம் பிரிக்கப்படுகிறதா?',
      type: 'yes_no',
      isMandatory: true,
      isUnique: false,
      options: ['ஆம் (Yes)', 'இல்லை (No)']
    },
    {
      id: 'if_5',
      categoryId: 'cat_d2d',
      nameEn: 'Waste Generation Category',
      nameTa: 'கழிவு உருவாக்க வகை',
      type: 'dropdown',
      isMandatory: true,
      isUnique: false,
      options: ['Residential (குடியிருப்பு)', 'Commercial (வணிகம்)', 'Institution (நிறுவனம்)', 'Bulk Generator (மொத்த கழிவு)']
    },
    {
      id: 'if_6',
      categoryId: 'cat_d2d',
      nameEn: 'Doorstep Geo-tagged Photo',
      nameTa: 'வீட்டு வாசல் புகைப்பட ஆதாரம்',
      type: 'camera',
      isMandatory: true,
      isUnique: false,
      options: []
    },
    {
      id: 'if_7',
      categoryId: 'cat_d2d',
      nameEn: 'Inspection Date',
      nameTa: 'ஆய்வு செய்யப்பட்ட தேதி',
      type: 'date',
      isMandatory: true,
      isUnique: false,
      options: []
    },
    {
      id: 'if_8',
      categoryId: 'cat_d2d',
      nameEn: 'Survey Summary Document',
      nameTa: 'கள ஆய்வு ஆவண அறிக்கை',
      type: 'file',
      isMandatory: false,
      isUnique: false,
      options: []
    }
  ],
  // Inspection Employees Management
  inspectionRoles: [
    {
      id: 'role_single_tp',
      nameEn: 'Single TP Worker',
      nameTa: 'ஒற்றை பேரூராட்சி பணியாளர்',
      code: 'SINGLE_TP',
      scopeType: 'single_tp',
      descriptionEn: 'Assigned to one specific Town Panchayat',
      descriptionTa: 'குறிப்பிட்ட ஒரு பேரூராட்சிக்கான களப்பணியாளர்'
    },
    {
      id: 'role_multi_tp',
      nameEn: 'Multi TP Supervisor',
      nameTa: 'பல பேரூராட்சி மேற்பார்வையாளர்',
      code: 'MULTI_TP',
      scopeType: 'multi_tp',
      descriptionEn: 'Oversees multiple Town Panchayats within a district',
      descriptionTa: 'ஒரு மாவட்டத்தின் பல பேரூராட்சிகளை மேற்பார்வையிடுபவர்'
    },
    {
      id: 'role_zonal',
      nameEn: 'Zonal Inspector',
      nameTa: 'மண்டல ஆய்வாளர்',
      code: 'ZONAL',
      scopeType: 'zonal',
      descriptionEn: 'Zonal level inspection across the whole zone',
      descriptionTa: 'மண்டல அளவிலான ஆய்வு அதிகாரி'
    },
    {
      id: 'role_field_worker',
      nameEn: 'Ward Field Worker',
      nameTa: 'வார்டு களப்பணியாளர்',
      code: 'FIELD_WORKER',
      scopeType: 'field_workers',
      descriptionEn: 'Field worker assigned to specific ward(s) inside a TP',
      descriptionTa: 'பேரூராட்சியின் குறிப்பிட்ட வார்டுகளுக்கான களப்பணியாளர்'
    }
  ],
  inspectionDesignations: [
    {
      id: 'desig_si',
      nameEn: 'Sanitary Inspector / Field Officer',
      nameTa: 'துப்புரவு ஆய்வாளர் / கள அலுவலர்',
      roleId: 'role_single_tp',
      subjectIds: ['subj_swm', 'subj_water', 'subj_public_health'],
      categoryIds: ['cat_d2d', 'cat_commercial', 'cat_dbc'],
      descriptionEn: 'Field Sanitary Inspector for municipal inspection works',
      descriptionTa: 'நகராட்சி மற்றும் பேரூராட்சி கள ஆய்வு பணிகள்'
    },
    {
      id: 'desig_animator',
      nameEn: 'Animators (அனிமேட்டர்)',
      nameTa: 'அனிமேட்டர்கள்',
      roleId: 'role_single_tp',
      subjectIds: ['subj_swm'],
      categoryIds: ['cat_d2d', 'cat_commercial'],
      descriptionEn: 'Community mobilization and awareness animators',
      descriptionTa: 'சமூக விழிப்புணர்வு மற்றும் அனிமேஷன் பணிகள்'
    },
    {
      id: 'desig_dbc',
      nameEn: 'DBC Workers (டெங்கு தடுப்பு பணியாளர்)',
      nameTa: 'டெங்கு கொசுப்புழு தடுப்பு பணியாளர்கள்',
      roleId: 'role_field_worker',
      subjectIds: ['subj_public_health'],
      categoryIds: ['cat_dbc'],
      descriptionEn: 'Dengue breeding control ward-level staff',
      descriptionTa: 'வார்டு வாரியாக டெங்கு தடுப்பு களப்பணி'
    },
    {
      id: 'desig_water',
      nameEn: 'Water Supply Workers (குடிநீர் பணியாளர்)',
      nameTa: 'குடிநீர் விநியோக பணியாளர்கள்',
      roleId: 'role_single_tp',
      subjectIds: ['subj_water'],
      categoryIds: ['cat_d2d'],
      descriptionEn: 'Drinking water pipeline and valve operations',
      descriptionTa: 'குடிநீர் விநியோகம் மற்றும் வால்வு இயக்கம்'
    },
    {
      id: 'desig_zonal_sanitary',
      nameEn: 'Zonal Sanitation Officer',
      nameTa: 'மண்டல சுகாதார அலுவலர்',
      roleId: 'role_zonal',
      subjectIds: ['subj_swm', 'subj_public_health'],
      categoryIds: ['cat_d2d', 'cat_commercial', 'cat_dbc'],
      descriptionEn: 'Zonal level sanitation supervisor',
      descriptionTa: 'மண்டல சுகாதார மேற்பார்வை'
    }
  ],
  inspectionUsers: [
    {
      id: 'iu_thirumazhisai',
      username: 'insp_thirumazhisai',
      password: 'password123',
      nameEn: 'Thirumazhisai Field Officer',
      nameTa: 'திருமழிசை கள அலுவலர்',
      mobile: '9442723067',
      designationId: 'desig_si',
      roleId: 'role_single_tp',
      zoneId: 'z1',
      districtId: 'd3',
      tpId: 'tp_thirumazhisai',
      selectedTpIds: ['tp_thirumazhisai'],
      assignedWards: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
      selectedWards: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
      subjectIds: ['subj_swm', 'subj_water', 'subj_public_health'],
      assignedSubjects: ['subj_swm', 'subj_water', 'subj_public_health'],
      categoryIds: ['cat_d2d', 'cat_commercial', 'cat_dbc'],
      assignedCategories: ['cat_d2d', 'cat_commercial', 'cat_dbc'],
      status: 'Active',
      createdAt: '2026-09-28T07:25:29.797Z'
    },
    {
      id: 'iu_6382490912',
      username: '6382490912',
      password: 'pass123',
      nameEn: 'Field Inspection Officer',
      nameTa: 'கள ஆய்வு அலுவலர்',
      mobile: '6382490912',
      designationId: 'desig_si',
      roleId: 'role_single_tp',
      zoneId: 'z1',
      districtId: 'd3',
      tpId: 'tp_thirumazhisai',
      selectedTpIds: ['tp_thirumazhisai', 'tp_arani'],
      assignedWards: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
      selectedWards: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15'],
      subjectIds: ['subj_swm', 'subj_water', 'subj_public_health'],
      assignedSubjects: ['subj_swm', 'subj_water', 'subj_public_health'],
      categoryIds: ['cat_d2d', 'cat_commercial', 'cat_dbc'],
      assignedCategories: ['cat_d2d', 'cat_commercial', 'cat_dbc'],
      status: 'Active',
      createdAt: '2026-09-24T19:02:10.511Z'
    },
    {
      id: 'iu_arani',
      username: 'insp_arani',
      password: 'password123',
      nameEn: 'Karthik S',
      nameTa: 'கார்த்திக் எஸ்',
      mobile: '9840112233',
      designationId: 'desig_animator',
      roleId: 'role_single_tp',
      zoneId: 'z1',
      districtId: 'd3',
      tpId: 'tp_arani',
      selectedTpIds: ['tp_arani'],
      assignedWards: ['1', '2', '3', '4', '5'],
      selectedWards: ['1', '2', '3', '4', '5'],
      subjectIds: ['subj_swm', 'subj_public_health'],
      assignedSubjects: ['subj_swm', 'subj_public_health'],
      categoryIds: ['cat_d2d', 'cat_commercial', 'cat_dbc'],
      assignedCategories: ['cat_d2d', 'cat_commercial', 'cat_dbc'],
      status: 'Active',
      createdAt: '2026-09-10T10:00:00.000Z'
    },
    {
      id: 'iu_1',
      username: 'insp_animator_01',
      password: 'password123',
      nameEn: 'Priya R',
      nameTa: 'பிரியா ஆர்',
      mobile: '9845012345',
      designationId: 'desig_animator',
      roleId: 'role_single_tp',
      zoneId: 'z1',
      districtId: 'd2',
      tpId: 'tp1',
      selectedTpIds: ['tp1'],
      assignedWards: ['1', '2', '3', '4', '5'],
      selectedWards: ['1', '2', '3', '4', '5'],
      subjectIds: ['subj_swm'],
      assignedSubjects: ['subj_swm'],
      categoryIds: ['cat_d2d', 'cat_commercial'],
      assignedCategories: ['cat_d2d', 'cat_commercial'],
      status: 'Active',
      createdAt: '2026-09-01T10:00:00.000Z'
    },
    {
      id: 'iu_2',
      username: 'insp_dbc_01',
      password: 'password123',
      nameEn: 'Murugan S',
      nameTa: 'முருகன் எஸ்',
      mobile: '9876543210',
      designationId: 'desig_dbc',
      roleId: 'role_field_worker',
      zoneId: 'z1',
      districtId: 'd2',
      tpId: 'tp1',
      selectedTpIds: ['tp1'],
      assignedWards: ['1', '2', '3', '4', '5'],
      selectedWards: ['1', '2', '3', '4', '5'],
      subjectIds: ['subj_public_health'],
      assignedSubjects: ['subj_public_health'],
      categoryIds: ['cat_dbc'],
      assignedCategories: ['cat_dbc'],
      status: 'Active',
      createdAt: '2026-09-05T10:00:00.000Z'
    },
    {
      id: 'iu_3',
      username: 'insp_zonal_01',
      password: 'password123',
      nameEn: 'Ganesan K',
      nameTa: 'கணேசன் கே',
      mobile: '9443322110',
      designationId: 'desig_zonal_sanitary',
      roleId: 'role_zonal',
      zoneId: 'z1',
      districtId: 'd2',
      tpId: 'tp1',
      selectedTpIds: ['tp1', 'tp2', 'tp_thirumazhisai', 'tp_arani'],
      assignedWards: ['1', '2', '3', '4', '5'],
      selectedWards: ['1', '2', '3', '4', '5'],
      subjectIds: ['subj_swm', 'subj_water', 'subj_public_health'],
      assignedSubjects: ['subj_swm', 'subj_water', 'subj_public_health'],
      categoryIds: ['cat_d2d', 'cat_commercial', 'cat_dbc'],
      assignedCategories: ['cat_d2d', 'cat_commercial', 'cat_dbc'],
      status: 'Active',
      createdAt: '2026-09-10T10:00:00.000Z'
    }
  ],
  inspectionWorks: [
    {
      id: 'iw_1',
      workId: '#IW-2026-001',
      subjectId: 'subj_swm',
      subjectNameEn: 'SWM Management',
      subjectNameTa: 'திடக்கழிவு மேலாண்மை (SWM)',
      categoryId: 'cat_d2d',
      categoryNameEn: 'Door to Door Survey',
      categoryNameTa: 'வீடு வீடாக சென்று கணக்கெடுப்பு',
      zoneId: 'z1',
      zoneNameEn: 'Kanchipuram Zone',
      zoneNameTa: 'காஞ்சிபுரம் மண்டலம்',
      districtId: 'd2',
      districtNameEn: 'Chengalpattu',
      districtNameTa: 'செங்கல்பட்டு',
      tpId: 'tp1',
      tpNameEn: 'Thiruporur',
      tpNameTa: 'திருப்போரூர்',
      wardNumber: '1',
      streetName: 'Anna Street',
      submittedByUserId: 'iu_1',
      submittedByUserName: 'Priya R (Animators)',
      submittedAt: '2026-09-20T09:30:00.000Z',
      latitude: 12.7244,
      longitude: 80.1873,
      fieldsData: {
        'if_1': 'Door No. 12/B',
        'if_2': '9845012345',
        'if_3': 4,
        'if_4': 'ஆம் (Yes)',
        'if_5': 'Residential (குடியிருப்பு)',
        'if_7': '2026-09-20'
      },
      imageUrl: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=600&auto=format&fit=crop',
      imageCaption: 'Household segregated waste bins inspected and verified with organic compost handbook provided.',
      documentUrl: '/uploads/inspection_works/iw_1/summary_report.pdf',
      documentName: 'Anna_Street_D2D_Summary.pdf',
      status: 'Completed'
    },
    {
      id: 'iw_2',
      workId: '#IW-2026-002',
      subjectId: 'subj_swm',
      subjectNameEn: 'SWM Management',
      subjectNameTa: 'திடக்கழிவு மேலாண்மை (SWM)',
      categoryId: 'cat_commercial',
      categoryNameEn: 'Commercial Establishment Waste Check',
      categoryNameTa: 'வணிக நிறுவன கழிவு ஆய்வு',
      zoneId: 'z1',
      zoneNameEn: 'Kanchipuram Zone',
      zoneNameTa: 'காஞ்சிபுரம் மண்டலம்',
      districtId: 'd2',
      districtNameEn: 'Chengalpattu',
      districtNameTa: 'செங்கல்பட்டு',
      tpId: 'tp1',
      tpNameEn: 'Thiruporur',
      tpNameTa: 'திருப்போரூர்',
      wardNumber: '2',
      streetName: 'Kamarajar Salai',
      submittedByUserId: 'iu_1',
      submittedByUserName: 'Priya R (Animators)',
      submittedAt: '2026-09-21T11:15:00.000Z',
      latitude: 12.7258,
      longitude: 80.1895,
      fieldsData: {
        'if_1': 'Shop #44 Hotel Saravana',
        'if_2': '9789123456',
        'if_3': 12,
        'if_4': 'ஆம் (Yes)',
        'if_5': 'Commercial (வணிகம்)',
        'if_7': '2026-09-21'
      },
      imageUrl: 'https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?w=600&auto=format&fit=crop',
      imageCaption: 'Commercial establishment bulk kitchen bio-waste composting pit and bin audit.',
      documentUrl: '',
      documentName: '',
      status: 'Completed'
    },
    {
      id: 'iw_3',
      workId: '#IW-2026-003',
      subjectId: 'subj_public_health',
      subjectNameEn: 'Public Health & Sanitation',
      subjectNameTa: 'பொது சுகாதாரம் மற்றும் துப்புரவு',
      categoryId: 'cat_dbc',
      categoryNameEn: 'Dengue Vector Breeding Check',
      categoryNameTa: 'டெங்கு கொசுப்புழு உற்பத்தி ஆய்வு',
      zoneId: 'z1',
      zoneNameEn: 'Kanchipuram Zone',
      zoneNameTa: 'காஞ்சிபுரம் மண்டலம்',
      districtId: 'd2',
      districtNameEn: 'Chengalpattu',
      districtNameTa: 'செங்கல்பட்டு',
      tpId: 'tp1',
      tpNameEn: 'Thiruporur',
      tpNameTa: 'திருப்போரூர்',
      wardNumber: '1',
      streetName: 'Gandhi Street',
      submittedByUserId: 'iu_2',
      submittedByUserName: 'Murugan S (DBC Workers)',
      submittedAt: '2026-09-21T15:45:00.000Z',
      latitude: 12.7231,
      longitude: 80.1859,
      fieldsData: {
        'if_1': 'House 8A/1',
        'if_2': '9876543210',
        'if_3': 5,
        'if_4': 'ஆம் (Yes)',
        'if_5': 'Residential (குடியிருப்பு)',
        'if_7': '2026-09-21'
      },
      imageUrl: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=600&auto=format&fit=crop',
      imageCaption: 'Water overhead tank and open barrels checked for mosquito breeding. Abate granules applied.',
      documentUrl: '',
      documentName: '',
      status: 'Completed'
    },
    {
      id: 'iw_4',
      workId: '#IW-2026-004',
      subjectId: 'subj_water',
      subjectNameEn: 'Water Supply Management',
      subjectNameTa: 'குடிநீர் விநியோக மேலாண்மை',
      categoryId: 'cat_d2d',
      categoryNameEn: 'Door to Door Survey',
      categoryNameTa: 'வீடு வீடாக சென்று கணக்கெடுப்பு',
      zoneId: 'z1',
      zoneNameEn: 'Kanchipuram Zone',
      zoneNameTa: 'காஞ்சிபுரம் மண்டலம்',
      districtId: 'd2',
      districtNameEn: 'Chengalpattu',
      districtNameTa: 'செங்கல்பட்டு',
      tpId: 'tp1',
      tpNameEn: 'Thiruporur',
      tpNameTa: 'திருப்போரூர்',
      wardNumber: '2',
      streetName: 'MGR Nagar 1st Street',
      submittedByUserId: 'iu_1',
      submittedByUserName: 'Priya R (Animators)',
      submittedAt: '2026-09-22T08:20:00.000Z',
      latitude: 12.7272,
      longitude: 80.1912,
      fieldsData: {
        'if_1': 'Assessment #1089',
        'if_2': '9443355667',
        'if_3': 3,
        'if_4': 'ஆம் (Yes)',
        'if_5': 'Residential (குடியிருப்பு)',
        'if_7': '2026-09-22'
      },
      imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=600&auto=format&fit=crop',
      imageCaption: 'Drinking water distribution tap pressure inspected and water quality chlorine test verified.',
      documentUrl: '',
      documentName: '',
      status: 'Completed'
    }
  ],
  userActivities: [],
  notifications: [] as any[],
  apkVersions: [] as any[],
  counters: {} as Record<string, number>
};

// Singleton Client references cached on the global object for robust Next.js connection pooling
const globalWithMongo = global as typeof globalThis & {
  _mongoClient?: MongoClient | null;
  _mongoClientPromise?: Promise<MongoClient | null> | null;
  _lastMongoAttemptFailedTime?: number;
  _mongoOffline?: boolean;
};

// Initialize global variables if not present
if (globalWithMongo._mongoClient === undefined) {
  globalWithMongo._mongoClient = null;
}
if (globalWithMongo._mongoClientPromise === undefined) {
  globalWithMongo._mongoClientPromise = null;
}
if (globalWithMongo._lastMongoAttemptFailedTime === undefined) {
  globalWithMongo._lastMongoAttemptFailedTime = 0;
}
if (globalWithMongo._mongoOffline === undefined) {
  globalWithMongo._mongoOffline = false;
}

let s3Client: S3Client | null = null;
let lastS3AccessKeyId = '';
let lastS3SecretAccessKey = '';
let lastS3Region = '';
const MONGO_COOLDOWN_MS = 300000; // 5-minute cooldown on connection error to prevent spamming failed connections

let cachedActiveDb: Db | null = null;
let resolvingActiveDb: Promise<Db> | null = null;
const cachedCollectionNamesMap = new Map<string, string[]>();

export function resetMongoClient() {
  globalWithMongo._mongoClient = null;
  globalWithMongo._mongoClientPromise = null;
  globalWithMongo._lastMongoAttemptFailedTime = Date.now();
  cachedActiveDb = null;
  resolvingActiveDb = null;
  cachedCollectionNamesMap.clear();
}

// In-memory cache for local JSON database to eliminate synchronous disk read/write freezes
let _cachedLocalDbInMemory: any = null;
let _lastLocalDbReadTime = 0;
const LOCAL_DB_CACHE_TTL_MS = 3000; // 3 seconds in-memory cache

// Read local DB with in-memory caching
export function readLocalDb(): typeof INITIAL_DATA {
  const now = Date.now();
  if (_cachedLocalDbInMemory && now - _lastLocalDbReadTime < LOCAL_DB_CACHE_TTL_MS) {
    return _cachedLocalDbInMemory;
  }

  if (!fs.existsSync(DATA_FILE)) {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_DATA, null, 2));
    } catch (_) {}
    _cachedLocalDbInMemory = INITIAL_DATA;
    _lastLocalDbReadTime = now;
    return INITIAL_DATA;
  }
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf-8');
    if (!data || !data.trim()) {
      try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_DATA, null, 2));
      } catch (_) {}
      _cachedLocalDbInMemory = INITIAL_DATA;
      _lastLocalDbReadTime = now;
      return INITIAL_DATA;
    }
    const parsed = JSON.parse(data);
    if (!parsed.pfInterestRates || parsed.pfInterestRates.length < 80) {
      parsed.pfInterestRates = OFFICIAL_PF_INTEREST_RATES;
      try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 2));
      } catch (_) {}
    }
    if (!parsed.deletedEmployees) {
      parsed.deletedEmployees = [];
    }
    // Ensure all critical collections and mock users are present in local DB
    if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
      parsed.users = INITIAL_DATA.users;
    }
    if (!Array.isArray(parsed.roles) || parsed.roles.length === 0) {
      parsed.roles = INITIAL_DATA.roles;
    }
    if (!Array.isArray(parsed.employees) || parsed.employees.length === 0) {
      parsed.employees = INITIAL_DATA.employees;
    }
    if (!Array.isArray(parsed.townPanchayats)) {
      parsed.townPanchayats = [];
    }
    if (!Array.isArray(parsed.districts)) {
      parsed.districts = [];
    }
    if (!Array.isArray(parsed.zones)) {
      parsed.zones = [];
    }
    if (!Array.isArray(parsed.wardsAndStreets)) {
      parsed.wardsAndStreets = [];
    }
    if (!Array.isArray(parsed.inspectionWorks)) {
      parsed.inspectionWorks = [];
    }
    if (!parsed.counters || typeof parsed.counters !== 'object') {
      parsed.counters = {};
    }
    _cachedLocalDbInMemory = parsed;
    _lastLocalDbReadTime = now;
    return parsed;
  } catch (err) {
    console.error('Error reading local JSON database, repairing with defaults:', err);
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_DATA, null, 2));
    } catch (_) {}
    _cachedLocalDbInMemory = INITIAL_DATA;
    _lastLocalDbReadTime = now;
    return INITIAL_DATA;
  }
}

export function getLocalFallbackState(): typeof INITIAL_DATA {
  return readLocalDb();
}

// Write local DB - updates in-memory cache instantly and writes to disk asynchronously
export function writeLocalDb(data: typeof INITIAL_DATA) {
  _cachedLocalDbInMemory = data;
  _lastLocalDbReadTime = Date.now();
  // Asynchronous write to avoid blocking Node.js event loop
  fs.promises.writeFile(DATA_FILE, JSON.stringify(data, null, 2)).catch((err) => {
    console.error('Error writing local JSON database asynchronously:', err);
  });
}

// Local server database sync to MongoDB is strictly disabled per requirement:
// "No need sync local database mongodb"
// Local storage is only an offline fallback, never automatically pushed to MongoDB.

export async function getMongoClient(): Promise<MongoClient | null> {
  // Never connect to MongoDB during Next.js build phase - prevents build timeouts
  if (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.BUILDING === 'true'
  ) {
    return null;
  }

  if (globalWithMongo._mongoOffline) {
    return null;
  }
  const dbConfig = readLocalDb().settings;
  const rawUri = process.env.MONGODB_URI || dbConfig.mongodbUri || 'mongodb://127.0.0.1:27018/dtp_enterprise';
  const uri = rawUri;
  if (!uri) return null;

  if (globalWithMongo._mongoClient) {
    try {
      // @ts-ignore
      const isDead = globalWithMongo._mongoClient.topology?.isDestroyed?.() || globalWithMongo._mongoClient.topology?.isClosed?.();
      if (!isDead) {
        return globalWithMongo._mongoClient;
      }
    } catch (_) {}
    globalWithMongo._mongoClient = null;
  }
  if (globalWithMongo._mongoClientPromise) return globalWithMongo._mongoClientPromise;

  // Don't spam connection attempts if connection failed recently
  if (Date.now() - (globalWithMongo._lastMongoAttemptFailedTime || 0) < MONGO_COOLDOWN_MS) {
    return null;
  }

  const poolSize = parseInt(process.env.MONGODB_POOL_SIZE || String((dbConfig as any).mongodbPoolSize || 100), 10) || 100;

  globalWithMongo._mongoClientPromise = (async () => {
    let activeUri = uri;
    const isLocal = activeUri.includes('localhost') || activeUri.includes('127.0.0.1');
    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const client = new MongoClient(activeUri, {
          serverSelectionTimeoutMS: isLocal ? 4000 : 8000,
          connectTimeoutMS: isLocal ? 4000 : 8000,
          maxPoolSize: Math.max(poolSize, 100), // Ensure at least 100 connections in pool
          minPoolSize: 2,
          maxIdleTimeMS: 60000, // 60s idle timeout
          waitQueueTimeoutMS: 30000, // Allow up to 30s queue wait during concurrent traffic bursts
          socketTimeoutMS: 45000, // Query timeout: 45s max
        });

        // Topology event listeners for auto-cleanup on stale / dropped sockets
        client.on('connectionClosed', () => {
          // Stale connection evicted cleanly from pool
        });
        client.on('error', (err) => {
          console.warn('[MongoDB Pool Warning] Socket error detected:', err?.message || err);
        });

        await client.connect();
        console.log(`Successfully connected to MongoDB (${activeUri.includes(':27017') ? 'Port 27017' : 'Port 27018'}) with Robust Pool (pool size: ${Math.max(poolSize, 100)})`);
        globalWithMongo._mongoClient = client;
        return globalWithMongo._mongoClient;
      } catch (err: any) {
        lastError = err;
        if (isLocal && activeUri.includes(':27018') && attempt === 1) {
          console.warn('[MongoDB Connection] Port 27018 unreachable. Not falling back to 27017 (that host has other apps, not dtp_enterprise).');
        }
        if (isLocal) {
          console.info(`[Database Storage] Local persistent database active: using local database cache (${err?.message || 'offline'}).`);
          break;
        }
        const delay = Math.min(300 * Math.pow(2, attempt), 2500) + Math.floor(Math.random() * 200);
        console.warn(`[MongoDB Connection Retry] Attempt ${attempt}/${maxRetries} failed: ${err?.message || err}. Backoff wait ${delay}ms...`);
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    console.warn('MongoDB not reachable, using local database fallback:', lastError?.message || lastError);
    resetMongoClient();
    return null;
  })().finally(() => {
    globalWithMongo._mongoClientPromise = null;
  });

  return globalWithMongo._mongoClientPromise;
}

let hasEnsuredIndexes = false;
export async function ensureDatabaseIndexes(client: MongoClient) {
  if (hasEnsuredIndexes) return;
  try {
    const db = await getActiveMongoDb(client);
    await Promise.allSettled([
      db.collection('inspectionUsers').createIndex({ username: 1 }, { background: true }),
      db.collection('inspectionUsers').createIndex({ mobile: 1 }, { background: true }),
      db.collection('inspectionUsers').createIndex({ status: 1 }, { background: true }),
      db.collection('inspectionUsers').createIndex({ tpId: 1 }, { background: true }),
      db.collection('users').createIndex({ username: 1 }, { background: true }),
      db.collection('user_scope_cache').createIndex({ username: 1 }, { background: true }),
      db.collection('user_scope_cache').createIndex({ userId: 1 }, { background: true }),
      db.collection('inspectionWorks').createIndex({ workId: 1 }, { background: true }),
      db.collection('inspectionWorks').createIndex({ submittedAt: -1 }, { background: true }),
      db.collection('inspectionWorks').createIndex({ submittedAt: -1, createdAt: -1 }, { background: true }),
      db.collection('inspectionWorks').createIndex({ tpId: 1, submittedAt: -1 }, { background: true }),
      db.collection('inspectionWorks').createIndex({ tpId: 1, wardNumber: 1 }, { background: true }),
      db.collection('inspectionWorks').createIndex({ submittedByUserName: 1 }, { background: true }),
      db.collection('inspectionWorks').createIndex({ submittedByUserId: 1 }, { background: true }),
      db.collection('inspectionWorks').createIndex({ username: 1 }, { background: true }),
      db.collection('user_activity').createIndex({ username: 1, status: 1 }, { background: true }),
      db.collection('user_activity').createIndex({ userId: 1, status: 1 }, { background: true }),
      db.collection('user_activity').createIndex({ status: 1 }, { background: true }),
    ]);
    hasEnsuredIndexes = true;
  } catch (_) {}
}

// Get Dynamic Collection database based on Employee's TP / Zone / HOD
// "every user role need seperate s3 folder saving their datas & mongodb database. every employee user details can save in assigned town panchayats/adtp/dtp in s3 folder and mongodb database"
export function getPartitionDetails(employee: {
  officeCategoryType?: string; // DTP, ADTP, TP
  townPanchayatId?: string;
  zoneId?: string;
}) {
  let dbName = 'dtp_enterprise';
  let collectionName = 'employees_dtp';
  let s3Folder = 'dtp/headquarters';

  if (employee.officeCategoryType === 'TP' && employee.townPanchayatId) {
    dbName = `tp_${employee.townPanchayatId.toLowerCase()}`;
    collectionName = `employees_tp_${employee.townPanchayatId.toLowerCase()}`;
    s3Folder = `tp/${employee.townPanchayatId.toLowerCase()}`;
  } else if (employee.officeCategoryType === 'ADTP' && employee.zoneId) {
    dbName = `adtp_${employee.zoneId.toLowerCase()}`;
    collectionName = `employees_adtp_${employee.zoneId.toLowerCase()}`;
    s3Folder = `adtp/${employee.zoneId.toLowerCase()}`;
  }

  return { dbName, collectionName, s3Folder };
}

// S3 connection pool request handler (pool size: 500)
let s3RequestHandler: NodeHttpHandler | null = null;

// AWS S3 client builder with pool size 500, keep-alive and stale socket destruction
export function getS3Client(): S3Client | null {
  const dbConfig = readLocalDb().settings;
  const region = process.env.S3_REGION || dbConfig.s3Region || 'ap-south-1';
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || dbConfig.s3AccessKeyId || '';
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || dbConfig.s3SecretAccessKey || '';

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  if (s3Client && lastS3AccessKeyId === accessKeyId && lastS3SecretAccessKey === secretAccessKey && lastS3Region === region) {
    return s3Client;
  }

  const s3PoolSize = parseInt(process.env.S3_POOL_SIZE || String((dbConfig as any).s3PoolSize || 500), 10) || 500;

  try {
    if (!s3RequestHandler) {
      // Create HTTP Agent with keepAlive, timeout & stale socket cleanup
      const httpAgent = new http.Agent({
        keepAlive: true,
        keepAliveMsecs: 10000,
        maxSockets: s3PoolSize, // 500 sockets pool size
        maxFreeSockets: 50,
        timeout: 45000, // Auto-timeout hung sockets
      });

      // Create HTTPS Agent with keepAlive, timeout & stale socket cleanup
      const httpsAgent = new https.Agent({
        keepAlive: true,
        keepAliveMsecs: 10000,
        maxSockets: s3PoolSize, // 500 sockets pool size
        maxFreeSockets: 50,
        timeout: 45000, // Auto-timeout hung sockets
      });

      // Auto-destroy sockets that exceed idle timeout so dead cloud NAT sockets don't hang
      const destroyStaleSockets = (agent: any) => {
        agent.on('timeout', (socket: any) => {
          try {
            socket.destroy();
          } catch (_) {}
        });
      };
      destroyStaleSockets(httpAgent);
      destroyStaleSockets(httpsAgent);

      s3RequestHandler = new NodeHttpHandler({
        httpAgent,
        httpsAgent,
        connectionTimeout: 10000, // 10s fast fail on connect
        requestTimeout: 60000, // 60s request timeout
      });
    }

    s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      requestHandler: s3RequestHandler,
      maxAttempts: 3,
    });

    lastS3AccessKeyId = accessKeyId;
    lastS3SecretAccessKey = secretAccessKey;
    lastS3Region = region;

    console.log(`AWS S3 Client initialized with optimized connection pool & stale socket cleanup (pool size: ${s3PoolSize})`);
    return s3Client;
  } catch (err) {
    console.error('Failed to create AWS S3 Client:', err);
    return null;
  }
}

// Helper to extract default database name from URI, settings, or env
export function getDefaultDbName(): string {
  const dbConfig = readLocalDb().settings;
  const uri = process.env.MONGODB_URI || dbConfig.mongodbUri || '';
  if (process.env.MONGODB_DB_NAME) return process.env.MONGODB_DB_NAME;
  if ((dbConfig as any).mongodbDatabase) return (dbConfig as any).mongodbDatabase;
  try {
    const parsed = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, 'http://'));
    const pathname = parsed.pathname.replace(/^\//, '').split('?')[0];
    if (pathname) return pathname;
  } catch (_) {}
  return 'dtp_enterprise';
}

export async function getActiveMongoDb(client: MongoClient): Promise<Db> {
  if (cachedActiveDb) {
    return cachedActiveDb;
  }
  if (resolvingActiveDb) {
    return resolvingActiveDb;
  }

  resolvingActiveDb = (async () => {
    const preferredDbName = getDefaultDbName() || 'dtp_enterprise';
    const db = client.db(preferredDbName);
    try {
      const cols = await db.listCollections().toArray();
      cachedCollectionNamesMap.set(db.databaseName, cols.map((c) => c.name));
      if (cols.length === 0) {
        console.warn(`[MongoDB] Database "${preferredDbName}" has no collections. Dashboard data will use local fallback until this database is available.`);
      }
    } catch (err: any) {
      console.warn('[MongoDB] Could not list collections for', preferredDbName, err?.message || err);
    }
    cachedActiveDb = db;
    return db;
  })().finally(() => {
    resolvingActiveDb = null;
  });

  return resolvingActiveDb;
}

// Helper to find collection with case-insensitivity and plural/singular/snake_case aliases (cached collection names)
export async function getCollectionWithAliases(db: Db, key: string) {
  try {
    let existingNames = cachedCollectionNamesMap.get(db.databaseName);
    if (!existingNames) {
      const collections = await db.listCollections().toArray();
      existingNames = collections.map(c => c.name);
      cachedCollectionNamesMap.set(db.databaseName, existingNames);
    }

    // 1. Exact match
    if (existingNames.includes(key)) {
      return db.collection(key);
    }

    // 2. Case-insensitive exact match
    const caseMatch = existingNames.find(n => n.toLowerCase() === key.toLowerCase());
    if (caseMatch) {
      return db.collection(caseMatch);
    }

    // 3. Known aliases
    if (key === 'wardsAndStreets') {
      const match = existingNames.find(n => n.toLowerCase() === 'wardsandstreets' || n.toLowerCase() === 'wards_and_streets');
      if (match) return db.collection(match);
      return db.collection('wardsAndStreets');
    }

    const aliasesMap: Record<string, string[]> = {
      inspectionUsers: ['inspection_users', 'inspectionEmployees', 'inspection_employees', 'field_users', 'inspectionusers', 'users'],
      inspectionWorks: ['inspection_works', 'inspections', 'inspectionworks', 'works'],
      townPanchayats: ['town_panchayats', 'townpanchayats', 'panchayats', 'tps'],
      districts: ['districts_master', 'districts_list'],
      zones: ['zones_master', 'zones_list'],
      inspectionSubjects: ['inspection_subjects', 'inspectionsubjects', 'subjects'],
      inspectionCategories: ['inspection_categories', 'inspectioncategories', 'categories'],
      inspectionFields: ['inspection_fields', 'inspectionfields', 'fields'],
      inspectionRoles: ['inspection_roles', 'inspectionroles', 'roles'],
      inspectionDesignations: ['inspection_designations', 'inspectiondesignations', 'designations'],
      notifications: ['app_notifications', 'notifs'],
      apkVersions: ['apk_versions', 'apks'],
      userActivities: ['user_activity', 'useractivities', 'user_activities', 'activities']
    };

    const candidates = aliasesMap[key] || [];
    for (const cand of candidates) {
      const found = existingNames.find(n => n.toLowerCase() === cand.toLowerCase());
      if (found) {
        return db.collection(found);
      }
    }
  } catch (_) {}

  return db.collection(key);
}

// Standard street templates to ensure every ward in every Town Panchayat has complete streets
const STANDARD_STREET_TEMPLATES = [
  { wardNo: '1', en: 'Bazaar Street', ta: 'பஜார் தெரு' },
  { wardNo: '1', en: 'Anna Street', ta: 'அண்ணா தெரு' },
  { wardNo: '1', en: 'Gandhi Street', ta: 'காந்தி தெரு' },
  { wardNo: '2', en: 'Kamarajar Salai', ta: 'காமராஜர் சாலை' },
  { wardNo: '2', en: 'Periyar Nagar', ta: 'பெரியார் நகர்' },
  { wardNo: '2', en: 'Hospital Road', ta: 'மருத்துவமனை சாலை' },
  { wardNo: '3', en: 'Sannathi Street', ta: 'சன்னதி தெரு' },
  { wardNo: '3', en: 'Bharathiyar Street', ta: 'பாரதியார் தெரு' },
  { wardNo: '3', en: 'Theradi Street', ta: 'தேரடி வீதி' },
  { wardNo: '4', en: 'MGR Nagar', ta: 'எம்.ஜி.ஆர் நகர்' },
  { wardNo: '4', en: 'Post Office Road', ta: 'அஞ்சலக வீதி' },
  { wardNo: '4', en: 'Market Road', ta: 'மார்க்கெட் ரோடு' },
  { wardNo: '5', en: 'Station Road', ta: 'ஸ்டேஷன் ரோடு' },
  { wardNo: '5', en: 'School Street', ta: 'பள்ளி தெரு' },
  { wardNo: '5', en: 'Main Road', ta: 'முதன்மை சாலை' },
  { wardNo: '6', en: 'High Road', ta: 'நெடுஞ்சாலை' },
  { wardNo: '6', en: 'Bazaar Main Road', ta: 'பஜார் முதன்மை சாலை' },
  { wardNo: '7', en: 'Temple Street', ta: 'கோயில் தெரு' },
  { wardNo: '7', en: 'Church Street', ta: 'சர்ச் தெரு' },
  { wardNo: '8', en: 'Mosque Street', ta: 'மசூதி தெரு' },
  { wardNo: '8', en: 'Pillayar Kovil Street', ta: 'பிள்ளையார் கோவில் தெரு' },
  { wardNo: '9', en: 'Netaji Street', ta: 'நேதாஜி தெரு' },
  { wardNo: '9', en: 'Kasturba Street', ta: 'கஸ்தூரிபா தெரு' },
  { wardNo: '10', en: 'Nehru Street', ta: 'நேரு தெரு' },
  { wardNo: '10', en: 'Indira Nagar', ta: 'இந்திரா நகர்' },
  { wardNo: '11', en: 'Vivekanandar Street', ta: 'விவேகானந்தர் தெரு' },
  { wardNo: '11', en: 'Kambar Street', ta: 'கம்பர் தெரு' },
  { wardNo: '12', en: 'Thiruvalluvar Street', ta: 'திருவள்ளுவர் தெரு' },
  { wardNo: '12', en: 'Vallalar Street', ta: 'வள்ளலார் தெரு' },
  { wardNo: '13', en: 'VOC Street', ta: 'வ.உ.சி தெரு' },
  { wardNo: '13', en: 'Subhash Chandra Bose Street', ta: 'சுபாஷ் சந்திர போஸ் தெரு' },
  { wardNo: '14', en: 'Ponniamman Koil Street', ta: 'பொன்னியம்மன் கோயில் தெரு' },
  { wardNo: '14', en: 'Mariamman Koil Street', ta: 'மாரியம்மன் கோயில் தெரு' },
  { wardNo: '15', en: 'Lake View Road', ta: 'ஏரிக்கரை சாலை' },
  { wardNo: '15', en: 'Bazaar Cross Street', ta: 'பஜார் குறுக்குத் தெரு' },
];

function normalizeItemFromMongo(key: string, item: any, idx: number): any {
  if (!item) return item;
  const { _id, ...rest } = item;
  const rawId = item.id || (_id ? String(_id) : '');

  if (key === 'wardsAndStreets') {
    const rawTp = item.tpId || item.tp_id || item.townPanchayatId || item.town_panchayat_id || item.tpName || item.townPanchayat || item.tp || '';
    const rawWard = item.wardNo ?? item.ward_no ?? item.wardNumber ?? item.ward ?? item.ward_id ?? '1';
    let cleanWardNo = String(rawWard).trim().replace(/[^0-9]/g, '');
    if (!cleanWardNo) cleanWardNo = String(rawWard).trim() || '1';
    const streetNameEn = String(item.streetNameEn || item.streetName || item.street_name || item.nameEn || item.name || item.street || `Street ${idx + 1}`).trim();
    const streetNameTa = String(item.streetNameTa || item.street_name_ta || item.nameTa || item.streetTa || streetNameEn).trim();
    const tpNameEn = item.tpNameEn || item.tpName || item.townPanchayat || '';
    const tpNameTa = item.tpNameTa || '';
    return {
      id: rawId || `ws_${rawTp}_${cleanWardNo}_${idx}`,
      tpId: String(rawTp),
      tpNameEn,
      tpNameTa,
      wardNo: cleanWardNo,
      streetNameEn,
      streetNameTa,
    };
  }

  if (key === 'inspectionSubjects') {
    return {
      ...rest,
      id: rawId || item.code || item.nameEn || `subj_${idx}`,
      nameEn: item.nameEn || item.name || item.subjectName || item.title || '',
      nameTa: item.nameTa || item.nameTamil || item.name_ta || item.name || '',
      code: item.code || item.subjectCode || '',
      descriptionEn: item.descriptionEn || item.description || '',
      descriptionTa: item.descriptionTa || item.description || '',
      icon: item.icon || 'assignment',
    };
  }

  if (key === 'inspectionCategories') {
    return {
      ...rest,
      id: rawId || item.code || item.nameEn || `cat_${idx}`,
      subjectId: item.subjectId || item.subject_id || item.subject || '',
      nameEn: item.nameEn || item.name || item.categoryName || item.title || '',
      nameTa: item.nameTa || item.nameTamil || item.name_ta || item.name || '',
      code: item.code || item.categoryCode || '',
      description: item.description || item.descriptionEn || '',
    };
  }

  if (key === 'inspectionUsers') {
    const wards = item.assignedWards || item.selectedWards || item.wards || [];
    const subs = item.subjectIds || item.assignedSubjects || item.subjects || [];
    const cats = item.categoryIds || item.assignedCategories || item.categories || [];
    return {
      ...rest,
      id: rawId || item.username || `iu_${idx}`,
      username: item.username || item.userName || '',
      nameEn: item.nameEn || item.name || item.username || '',
      nameTa: item.nameTa || item.name || item.nameEn || '',
      mobile: item.mobile || item.phone || item.contact || '',
      designationId: item.designationId || item.designation_id || item.designation || 'desig_si',
      roleId: item.roleId || item.role_id || item.role || 'role_single_tp',
      tpId: item.tpId || item.tp_id || item.townPanchayatId || item.town_panchayat_id || '',
      districtId: item.districtId || item.district_id || '',
      zoneId: item.zoneId || item.zone_id || '',
      assignedWards: Array.isArray(wards) ? wards : [wards],
      selectedWards: Array.isArray(wards) ? wards : [wards],
      subjectIds: Array.isArray(subs) ? subs : [subs],
      assignedSubjects: Array.isArray(subs) ? subs : [subs],
      categoryIds: Array.isArray(cats) ? cats : [cats],
      assignedCategories: Array.isArray(cats) ? cats : [cats],
      status: item.status || 'Active',
      isInspectionUser: true,
    };
  }

  return { id: rawId, ...rest };
}

// Get collection details or return from local storage helper
export async function getCollectionData(key: keyof typeof INITIAL_DATA): Promise<any> {
  try {
    const client = await getMongoClient();
    if (client) {
      const db = await getActiveMongoDb(client);
      const col = await getCollectionWithAliases(db, key);
      const items = await col.find({}).maxTimeMS(6000).toArray();
      if (Array.isArray(items) && items.length > 0) {
        return items.map((item, idx) => normalizeItemFromMongo(key, item, idx));
      }
    }
  } catch (e: any) {
    console.warn(`MongoDB read error for ${key}, falling back to local database:`, e?.message || e);
    const msg = String(e?.message || e).toLowerCase();
    if (msg.includes('topology is closed') || msg.includes('closed connection pool') || msg.includes('mongonotconnectederror')) {
      resetMongoClient();
    }
  }

  const localDb = readLocalDb();
  if (localDb && Array.isArray(localDb[key]) && localDb[key].length > 0) {
    return localDb[key];
  }
  return (INITIAL_DATA as any)[key] || [];
}

// Format and enrich user details with resolved names for mobile and web inspection views
export function enrichUserForApp(user: any, masters?: any): any {
  if (!user) return null;

  const tps = masters?.townPanchayats || [];
  const districts = masters?.districts || [];
  const zones = masters?.zones || [];
  const roles = masters?.inspectionRoles || masters?.roles || [];
  const designations = masters?.inspectionDesignations || [];

  const rawTp = user.tpId || user.townPanchayatId || user.townPanchayat || (Array.isArray(user.townPanchayatIds) ? user.townPanchayatIds[0] : '') || (Array.isArray(user.selectedTpIds) ? user.selectedTpIds[0] : '') || '';
  const rawTpStr = String(rawTp).trim().toLowerCase();
  const matchedTp = tps.find((t: any) =>
    String(t.id || '').toLowerCase() === rawTpStr ||
    String(t._id || '').toLowerCase() === rawTpStr ||
    String(t.nameEn || '').toLowerCase() === rawTpStr ||
    String(t.nameTa || '').toLowerCase() === rawTpStr ||
    String(t.code || '').toLowerCase() === rawTpStr
  );
  const resolvedTpId = matchedTp ? matchedTp.id : (user.tpId || user.townPanchayatId || rawTp || '');

  const rawDist = user.districtId || user.district || matchedTp?.districtId || '';
  const rawDistStr = String(rawDist).trim().toLowerCase();
  const matchedDist = districts.find((d: any) =>
    String(d.id || '').toLowerCase() === rawDistStr ||
    String(d._id || '').toLowerCase() === rawDistStr ||
    String(d.nameEn || '').toLowerCase() === rawDistStr ||
    String(d.nameTa || '').toLowerCase() === rawDistStr ||
    String(d.code || '').toLowerCase() === rawDistStr
  );
  const resolvedDistId = matchedDist ? matchedDist.id : (user.districtId || rawDist || '');

  const rawZone = user.zoneId || user.zone || matchedDist?.zoneId || matchedTp?.zoneId || '';
  const rawZoneStr = String(rawZone).trim().toLowerCase();
  const matchedZone = zones.find((z: any) =>
    String(z.id || '').toLowerCase() === rawZoneStr ||
    String(z._id || '').toLowerCase() === rawZoneStr ||
    String(z.nameEn || '').toLowerCase() === rawZoneStr ||
    String(z.nameTa || '').toLowerCase() === rawZoneStr
  );

  const roleId = user.roleId || user.role || '';
  const matchedRole = roles.find((r: any) => r.id === roleId || r.code === roleId);

  const desigId = user.designationId || user.designation || '';
  const matchedDesig = designations.find((d: any) => d.id === desigId || d.nameEn === desigId);

  // Extract and normalize assigned wards
  let rawWards = user.assignedWards || user.selectedWards || user.wards || user.wardNumbers || user.assigned_wards || (user.wardNo ? [user.wardNo] : []) || (user.ward ? [user.ward] : []);
  if (typeof rawWards === 'string') {
    rawWards = rawWards.split(/[,;\s]+/).filter(Boolean);
  } else if (!Array.isArray(rawWards)) {
    rawWards = rawWards ? [rawWards] : [];
  }
  let cleanWards = rawWards.map((w: any) => {
    const s = String(w).trim().replace(/[^0-9]/g, '');
    return s || String(w).trim();
  }).filter(Boolean);

  // If user has no explicit wards assigned, populate from Town Panchayat wards in masters.wardsAndStreets
  if (cleanWards.length === 0 && resolvedTpId && masters?.wardsAndStreets && Array.isArray(masters.wardsAndStreets)) {
    const tpWards = masters.wardsAndStreets
      .filter((w: any) => {
        const wTp = String(w.tpId || w.tp_id || w.townPanchayatId || '').toLowerCase();
        return wTp === String(resolvedTpId).toLowerCase();
      })
      .map((w: any) => String(w.wardNo || w.ward_no || w.ward || '').replace(/[^0-9]/g, ''))
      .filter(Boolean);
    const uniqueTpWards = Array.from(new Set(tpWards)).sort((a: any, b: any) => (parseInt(a) || 0) - (parseInt(b) || 0));
    if (uniqueTpWards.length > 0) {
      cleanWards = uniqueTpWards as string[];
    }
  }

  if (cleanWards.length === 0) {
    cleanWards = [];
  }

  // Extract and normalize assigned subjects and categories directly from masters/database - no mock fallback
  const allSubjects = (masters?.inspectionSubjects && masters.inspectionSubjects.length > 0)
    ? masters.inspectionSubjects
    : (readLocalDb().inspectionSubjects || []);

  const allCategories = (masters?.inspectionCategories && masters.inspectionCategories.length > 0)
    ? masters.inspectionCategories
    : (readLocalDb().inspectionCategories || []);

  let rawSubjectIds = user.subjectIds ||
                      user.assignedSubjects ||
                      user.assigned_subjects ||
                      user.assignedSubjectIds ||
                      user.subjects ||
                      user.inspectionSubjects ||
                      user.subject_ids ||
                      (user.subjectId ? [user.subjectId] : []) ||
                      (user.subject ? [user.subject] : []) ||
                      (matchedDesig?.subjectIds || matchedDesig?.applicableSubjectIds || matchedDesig?.assignedSubjects || []);

  if (!Array.isArray(rawSubjectIds)) rawSubjectIds = rawSubjectIds ? [rawSubjectIds] : [];

  // Match subject IDs, codes, and names (English & Tamil)
  const resolvedSubjectIdsSet = new Set<string>();
  for (const val of rawSubjectIds) {
    if (!val) continue;
    let sStr = '';
    if (typeof val === 'object' && val !== null) {
      sStr = String(val.id || val.subjectId || val.code || val.nameEn || val.name || val._id || '').trim().toLowerCase();
    } else {
      sStr = String(val).trim().toLowerCase();
    }
    if (!sStr) continue;

    const matched = allSubjects.find((s: any) => 
      String(s.id || '').toLowerCase() === sStr || 
      String(s._id || '').toLowerCase() === sStr ||
      (s.code && String(s.code).toLowerCase() === sStr) ||
      (s.nameEn && String(s.nameEn).toLowerCase() === sStr) ||
      (s.nameTa && String(s.nameTa).toLowerCase() === sStr) ||
      (s.name && String(s.name).toLowerCase() === sStr)
    );
    if (matched) {
      if (matched.id) resolvedSubjectIdsSet.add(matched.id);
      if (matched.nameEn) resolvedSubjectIdsSet.add(matched.nameEn);
      if (matched.code) resolvedSubjectIdsSet.add(matched.code);
      if (matched._id) resolvedSubjectIdsSet.add(String(matched._id));
    } else {
      resolvedSubjectIdsSet.add(sStr);
    }
  }

  // If user has no subjects assigned in MongoDB or designation, default to all available inspection subjects
  if (resolvedSubjectIdsSet.size === 0 && allSubjects.length > 0) {
    allSubjects.forEach((s: any) => {
      if (s.id) resolvedSubjectIdsSet.add(s.id);
      if (s.nameEn) resolvedSubjectIdsSet.add(s.nameEn);
      if (s.code) resolvedSubjectIdsSet.add(s.code);
      if (s._id) resolvedSubjectIdsSet.add(String(s._id));
    });
  }

  const resolvedSubjectIds = Array.from(resolvedSubjectIdsSet);

  // Categories extraction & normalization
  let rawCategoryIds = user.categoryIds ||
                       user.assignedCategories ||
                       user.assigned_categories ||
                       user.assignedCategoryIds ||
                       user.categories ||
                       user.inspectionCategories ||
                       user.category_ids ||
                       (user.categoryId ? [user.categoryId] : []) ||
                       (user.category ? [user.category] : []) ||
                       (matchedDesig?.categoryIds || matchedDesig?.applicableCategoryIds || matchedDesig?.assignedCategories || []);

  if (!Array.isArray(rawCategoryIds)) rawCategoryIds = rawCategoryIds ? [rawCategoryIds] : [];

  const resolvedCategoryIdsSet = new Set<string>();
  for (const val of rawCategoryIds) {
    if (!val) continue;
    let cStr = '';
    if (typeof val === 'object' && val !== null) {
      cStr = String(val.id || val.categoryId || val.code || val.nameEn || val.name || val._id || '').trim().toLowerCase();
    } else {
      cStr = String(val).trim().toLowerCase();
    }
    if (!cStr) continue;

    const matched = allCategories.find((c: any) =>
      String(c.id || '').toLowerCase() === cStr ||
      String(c._id || '').toLowerCase() === cStr ||
      (c.code && String(c.code).toLowerCase() === cStr) ||
      (c.nameEn && String(c.nameEn).toLowerCase() === cStr) ||
      (c.nameTa && String(c.nameTa).toLowerCase() === cStr) ||
      (c.name && String(c.name).toLowerCase() === cStr)
    );
    if (matched) {
      if (matched.id) resolvedCategoryIdsSet.add(matched.id);
      if (matched.nameEn) resolvedCategoryIdsSet.add(matched.nameEn);
      if (matched.code) resolvedCategoryIdsSet.add(matched.code);
      if (matched._id) resolvedCategoryIdsSet.add(String(matched._id));
    } else {
      resolvedCategoryIdsSet.add(cStr);
    }
  }

  // Automatically include all categories that belong to the user's assigned subjects!
  if (resolvedSubjectIdsSet.size > 0 && allCategories.length > 0) {
    const matchedCats = allCategories.filter((c: any) => {
      const cSubj = String(c.subjectId || c.subject_id || c.subject || '').toLowerCase();
      return Array.from(resolvedSubjectIdsSet).some(sId => String(sId).toLowerCase() === cSubj);
    });
    matchedCats.forEach((c: any) => {
      if (c.id) resolvedCategoryIdsSet.add(c.id);
      if (c.nameEn) resolvedCategoryIdsSet.add(c.nameEn);
      if (c.code) resolvedCategoryIdsSet.add(c.code);
      if (c._id) resolvedCategoryIdsSet.add(String(c._id));
    });
  }

  // If still empty, default to all available categories
  if (resolvedCategoryIdsSet.size === 0 && allCategories.length > 0) {
    allCategories.forEach((c: any) => {
      if (c.id) resolvedCategoryIdsSet.add(c.id);
      if (c.nameEn) resolvedCategoryIdsSet.add(c.nameEn);
      if (c.code) resolvedCategoryIdsSet.add(c.code);
      if (c._id) resolvedCategoryIdsSet.add(String(c._id));
    });
  }

  const resolvedCategoryIds = Array.from(resolvedCategoryIdsSet);

  const name = user.name || user.nameEn || user.username || 'Officer';
  const nameEn = user.nameEn || user.name || user.username || 'Officer';
  const nameTa = user.nameTa || user.name || name;

  const roleName = matchedRole?.nameEn || user.role || (roleId === 'role_single_tp' ? 'Single TP Inspector' : (roleId === 'role_multi_tp' ? 'Multi TP Inspector' : (roleId === 'role_zonal' ? 'Zonal Inspector' : (roleId === 'admin' ? 'Admin / Director' : (['ad', 'zonal'].includes(roleId) ? 'Assistant Director (Zone)' : (roleId === 'eo' ? 'Executive Officer (TP)' : 'User'))))));
  const roleNameTa = matchedRole?.nameTa || user.roleNameTa || 'பயனர்';

  const desigNameEn = matchedDesig?.nameEn || user.designation || user.designationNameEn || 'Officer';
  const desigNameTa = matchedDesig?.nameTa || user.designationNameTa || 'அலுவலர்';

  const tpNameEn = matchedTp?.nameEn || user.townPanchayat || 'Thiruporur TP';
  const tpNameTa = matchedTp?.nameTa || user.townPanchayatTa || 'திருப்போரூர் பேரூராட்சி';

  const distNameEn = matchedDist?.nameEn || user.district || 'Chengalpattu';
  const distNameTa = matchedDist?.nameTa || user.districtTa || 'செங்கல்பட்டு';

  const zoneNameEn = matchedZone?.nameEn || user.zone || 'Kanchipuram';
  const zoneNameTa = matchedZone?.nameTa || user.zoneTa || 'காஞ்சிபுரம்';

  // Resolve unique clean friendly English names for assigned subjects and categories
  const assignedSubjectNames = Array.from(new Set(
    allSubjects
      .filter((s: any) =>
        Array.from(resolvedSubjectIdsSet).some(id =>
          String(id).toLowerCase() === String(s.id || '').toLowerCase() ||
          String(id).toLowerCase() === String(s.nameEn || '').toLowerCase() ||
          String(id).toLowerCase() === String(s.code || '').toLowerCase()
        )
      )
      .map((s: any) => s.nameEn || s.name || s.id)
      .filter(Boolean)
  ));

  const assignedCategoryNames = Array.from(new Set(
    allCategories
      .filter((c: any) =>
        Array.from(resolvedCategoryIdsSet).some(id =>
          String(id).toLowerCase() === String(c.id || '').toLowerCase() ||
          String(id).toLowerCase() === String(c.nameEn || '').toLowerCase() ||
          String(id).toLowerCase() === String(c.code || '').toLowerCase()
        )
      )
      .map((c: any) => c.nameEn || c.name || c.id)
      .filter(Boolean)
  ));

  // Determine if this user is a field inspection mobile user or webapp portal user
  const userRoleLower = String(roleId || user.role || '').toLowerCase();
  const usernameLower = String(user.username || '').toLowerCase();
  const isWebPortalRole = ['admin', 'ad', 'eo', 'zonal', 'director', 'super admin'].includes(userRoleLower) ||
                          ['dtpadmin', 'admin', 'ad_kanchi', 'eo_thiruporur', 'zonal', 'tp'].includes(usernameLower);
  const isInspection = isWebPortalRole ? false : (user.isInspectionUser === true || (user.id && String(user.id).startsWith('iu_')) || !isWebPortalRole);

  return {
    ...user,
    id: user.id || (user._id ? String(user._id) : ''),
    username: user.username || '',
    mobile: user.mobile || user.phone || user.contact || '',
    name,
    nameEn,
    nameTa,
    role: roleName,
    roleNameTa,
    designation: desigNameEn,
    designationNameEn: desigNameEn,
    designationNameTa: desigNameTa,
    townPanchayat: tpNameEn,
    townPanchayatTa: tpNameTa,
    zone: zoneNameEn,
    zoneTa: zoneNameTa,
    district: distNameEn,
    districtTa: distNameTa,
    districtCode: matchedDist?.code || user.districtCode || '03',
    tpCode: matchedTp?.code || user.tpCode || '01',
    districtId: resolvedDistId,
    tpId: resolvedTpId,
    townPanchayatId: resolvedTpId,
    scopeType: user.scopeType || matchedRole?.scope || matchedRole?.scopeType || 'single_tp',
    selectedTpIds: user.selectedTpIds || (user.townPanchayatIds ? user.townPanchayatIds : (resolvedTpId ? [resolvedTpId] : [])),
    assignedWards: cleanWards,
    selectedWards: cleanWards,
    wards: cleanWards,
    subjectIds: resolvedSubjectIds,
    assignedSubjects: resolvedSubjectIds,
    assignedSubjectNames,
    categoryIds: resolvedCategoryIds,
    assignedCategories: resolvedCategoryIds,
    assignedCategoryNames,
    isInspectionUser: isInspection,
  };
}

// Normalize and enrich inspection works with Town Panchayat, District, Subject, and Category names
export function normalizeAndEnrichWorks(works: any[], masters?: any): any[] {
  const localDb = readLocalDb();
  const tps = masters?.townPanchayats || localDb.townPanchayats || INITIAL_DATA.townPanchayats || [];
  const districts = masters?.districts || localDb.districts || INITIAL_DATA.districts || [];
  const subjects = masters?.inspectionSubjects || localDb.inspectionSubjects || INITIAL_DATA.inspectionSubjects || [];
  const categories = masters?.inspectionCategories || localDb.inspectionCategories || INITIAL_DATA.inspectionCategories || [];

  return (works || []).map((w: any) => {
    const tp = tps.find((t: any) => t.id === w.tpId || String(t.nameEn || '').toLowerCase() === String(w.tpNameEn || '').toLowerCase());
    const dist = districts.find((d: any) => d.id === (w.districtId || tp?.districtId));

    const wCatId = String(w.categoryId || '').trim().toLowerCase();
    const wCatName = String(w.categoryNameEn || w.categoryName || w.category || '').trim().toLowerCase();
    const wSubjId = String(w.subjectId || '').trim().toLowerCase();
    const wSubjName = String(w.subjectNameEn || w.subjectName || w.subject || '').trim().toLowerCase();

    // Resolve Category first from actual created categories
    let cat = categories.find((c: any) => {
      const cId = String(c.id || '').trim().toLowerCase();
      const cCode = String(c.code || '').trim().toLowerCase();
      const cNameEn = String(c.nameEn || c.name || '').trim().toLowerCase();
      const cNameTa = String(c.nameTa || '').trim().toLowerCase();
      return (wCatId && (cId === wCatId || cCode === wCatId)) ||
             (wCatName && wCatName !== 'field check' && wCatName !== 'general category' && (cNameEn === wCatName || cNameTa === wCatName)) ||
             (wCatId && (cNameEn === wCatId || cNameTa === wCatId));
    });

    // Resolve Subject from actual created subjects
    let subj = subjects.find((s: any) => {
      const sId = String(s.id || '').trim().toLowerCase();
      const sCode = String(s.code || '').trim().toLowerCase();
      const sNameEn = String(s.nameEn || s.name || '').trim().toLowerCase();
      const sNameTa = String(s.nameTa || '').trim().toLowerCase();
      return (wSubjId && (sId === wSubjId || sCode === wSubjId)) ||
             (cat && (sId === String(cat.subjectId || '').toLowerCase() || sCode === String(cat.subjectId || '').toLowerCase())) ||
             (wSubjName && wSubjName !== 'general inspection' && wSubjName !== 'general' && (sNameEn === wSubjName || sNameTa === wSubjName));
    });

    if (!subj && cat?.subjectId) {
      subj = subjects.find((s: any) => String(s.id || '').toLowerCase() === String(cat.subjectId || '').toLowerCase() || String(s.code || '').toLowerCase() === String(cat.subjectId || '').toLowerCase());
    }

    const resolvedSubjectId = subj ? subj.id : (w.subjectId || '');
    const resolvedSubjectNameEn = subj ? (subj.nameEn || subj.name) : (w.subjectNameEn || '');
    const resolvedSubjectNameTa = subj ? (subj.nameTa || subj.nameEn) : (w.subjectNameTa || resolvedSubjectNameEn || '');

    const resolvedCategoryId = cat ? cat.id : (w.categoryId || '');
    const resolvedCategoryNameEn = cat ? (cat.nameEn || cat.name) : (w.categoryNameEn || '');
    const resolvedCategoryNameTa = cat ? (cat.nameTa || cat.nameEn) : (w.categoryNameTa || resolvedCategoryNameEn || '');

    const resolvedTpId = String(w.tpId || w.townPanchayatId || tp?.id || '').trim();
    const resolvedDistrictId = String(w.districtId || tp?.districtId || dist?.id || '').trim();
    const resolvedZoneId = String(w.zoneId || dist?.zoneId || '').trim();

    return {
      ...w,
      id: w.id || w.workId || '',
      workId: w.workId || w.id || '',
      tpId: resolvedTpId || w.tpId,
      townPanchayatId: resolvedTpId || w.townPanchayatId,
      districtId: resolvedDistrictId || w.districtId,
      zoneId: resolvedZoneId || w.zoneId,
      tpNameEn: w.tpNameEn || tp?.nameEn || 'Thiruporur TP',
      tpNameTa: w.tpNameTa || tp?.nameTa || 'திருப்போரூர் பேரூராட்சி',
      districtNameEn: w.districtNameEn || dist?.nameEn || 'Chengalpattu Dist',
      districtNameTa: w.districtNameTa || dist?.nameTa || 'செங்கல்பட்டு மாவட்டம்',
      zoneNameEn: w.zoneNameEn || 'Kanchipuram Zone',
      zoneNameTa: w.zoneNameTa || 'காஞ்சிபுரம் மண்டலம்',
      subjectId: resolvedSubjectId,
      subjectNameEn: resolvedSubjectNameEn,
      subjectNameTa: resolvedSubjectNameTa,
      categoryId: resolvedCategoryId,
      categoryNameEn: resolvedCategoryNameEn,
      categoryNameTa: resolvedCategoryNameTa,
      status: w.status || 'Completed'
    };
  });
}

export const LITE_INSPECTION_WORKS_PROJECTION = {
  fieldsData: 0,
  photos: 0,
  documents: 0,
  photoBase64: 0,
  locationImage: 0,
  staticMapUrl: 0,
  mapImage: 0,
};

const INSPECTION_WORKS_COLLECTION_ALIASES = [
  'inspectionWorks',
  'inspection_works',
  'inspections',
  'inspectionworks',
  'works',
];

/** Full lite rows for dashboard/reports (no row cap). Merges alias collections and dedupes by workId. */
export async function fetchAllLiteInspectionWorksFromMongo(): Promise<any[] | null> {
  try {
    const client = await getMongoClient();
    if (!client) return null;
    const db = await getActiveMongoDb(client);
    const primary = await getCollectionWithAliases(db, 'inspectionWorks');
    const namesToQuery = new Set<string>([primary.collectionName, ...INSPECTION_WORKS_COLLECTION_ALIASES]);

    const merged: any[] = [];
    const seen = new Set<string>();
    for (const name of namesToQuery) {
      let items: any[] = [];
      try {
        items = await db
          .collection(name)
          .find({}, { projection: LITE_INSPECTION_WORKS_PROJECTION })
          .sort({ submittedAt: -1, createdAt: -1 })
          .toArray();
      } catch {
        continue;
      }
      for (const item of items) {
        const dedupeKey = String(item.workId || item.id || item._id || '').trim();
        if (!dedupeKey || seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        const { _id, ...rest } = item;
        merged.push({ id: item.id || item.workId || (_id ? _id.toString() : ''), ...rest });
      }
    }
    if (!merged.length) return null;
    return merged;
  } catch (err) {
    console.warn('[storage] Mongo full inspection works list read failed:', err);
    return null;
  }
}

function aggregateEnrichedWorksForDashboardStats(works: any[]): any[] {
  const groups = new Map<string, any>();
  for (const w of works) {
    if (isFallbackInspectionWork(w)) continue;
    const subjectId = String(w.subjectId || 'unknown').trim();
    const zoneId = String(w.zoneId || '').trim();
    const districtId = String(w.districtId || '').trim();
    const tpId = String(w.tpId || w.townPanchayatId || '').trim();
    const key = `${subjectId}|${zoneId}|${districtId}|${tpId}`;
    let row = groups.get(key);
    if (!row) {
      row = {
        subjectId,
        subjectNameEn: w.subjectNameEn || 'General Inspection',
        subjectNameTa: w.subjectNameTa || 'பொது ஆய்வு',
        zoneId,
        districtId,
        tpId,
        count: 0,
      };
      groups.set(key, row);
    }
    row.count += 1;
  }
  return Array.from(groups.values());
}

/** Counts only — never pulls photo/document payloads from inspectionWorks. */
export async function getInspectionWorksDashboardStats(): Promise<any[]> {
  try {
    let rawList: any[] | null = await fetchAllLiteInspectionWorksFromMongo();
    if (!rawList?.length) {
      const { fetchRemoteInspectionWorksRaw } = await import('@/lib/remoteInspectionWorksCache');
      rawList = await fetchRemoteInspectionWorksRaw();
    }
    if (!rawList?.length) return [];

    const [districts, townPanchayats, zones, inspectionSubjects, inspectionCategories] = await Promise.all([
      getCollectionData('districts'),
      getCollectionData('townPanchayats'),
      getCollectionData('zones'),
      getCollectionData('inspectionSubjects'),
      getCollectionData('inspectionCategories'),
    ]);
    const masters = {
      districts: districts || [],
      townPanchayats: townPanchayats || [],
      zones: zones || [],
      inspectionSubjects: inspectionSubjects || [],
      inspectionCategories: inspectionCategories || [],
    };
    const enriched = normalizeAndEnrichWorks(rawList, masters);
    return aggregateEnrichedWorksForDashboardStats(enriched);
  } catch (e: any) {
    console.warn('Inspection works stats skipped:', e?.message || e);
  }
  return [];
}

function assemblePortalState(parts: {
  districts: any;
  townPanchayats: any;
  zones: any;
  inspectionSubjects: any;
  inspectionCategories: any;
  inspectionFields: any;
  wardsAndStreets: any;
  inspectionUsers: any;
  inspectionRoles: any;
  inspectionDesignations: any;
  users: any;
  employees: any;
  notifications: any;
  apkVersions: any;
  userActivities: any;
  settings: any;
  inspectionWorkStats?: any[];
}) {
  const localDb = readLocalDb();
  const masters = {
    townPanchayats: parts.townPanchayats,
    districts: parts.districts,
    zones: parts.zones,
    inspectionRoles: parts.inspectionRoles,
    inspectionDesignations: parts.inspectionDesignations,
  };
  const enrichedUsers = (parts.inspectionUsers || []).map((u: any) => enrichUserForApp(u, masters));
  const finalUsers = (parts.users && parts.users.length > 0) ? parts.users : ((localDb.users && localDb.users.length > 0) ? localDb.users : INITIAL_DATA.users);
  const finalRoles = (localDb.roles && localDb.roles.length > 0) ? localDb.roles : INITIAL_DATA.roles;
  const finalEmployees = parts.employees !== undefined
    ? (parts.employees || [])
    : ((localDb.employees && localDb.employees.length > 0) ? localDb.employees : INITIAL_DATA.employees);
  const finalTps = (Array.isArray(parts.townPanchayats) && parts.townPanchayats.length > 0) ? parts.townPanchayats : ((Array.isArray(localDb.townPanchayats) && localDb.townPanchayats.length > 0) ? localDb.townPanchayats : INITIAL_DATA.townPanchayats);
  const finalDistricts = (Array.isArray(parts.districts) && parts.districts.length > 0) ? parts.districts : ((Array.isArray(localDb.districts) && localDb.districts.length > 0) ? localDb.districts : INITIAL_DATA.districts);
  const finalZones = (Array.isArray(parts.zones) && parts.zones.length > 0) ? parts.zones : ((Array.isArray(localDb.zones) && localDb.zones.length > 0) ? localDb.zones : INITIAL_DATA.zones);
  const finalWardsAndStreets = (Array.isArray(parts.wardsAndStreets) && parts.wardsAndStreets.length > 0) ? parts.wardsAndStreets : ((Array.isArray(localDb.wardsAndStreets) && localDb.wardsAndStreets.length > 0) ? localDb.wardsAndStreets : INITIAL_DATA.wardsAndStreets);

  return {
    ...INITIAL_DATA,
    ...localDb,
    districts: finalDistricts,
    townPanchayats: finalTps,
    zones: finalZones,
    roles: finalRoles,
    users: finalUsers,
    employees: finalEmployees,
    inspectionSubjects: (parts.inspectionSubjects && parts.inspectionSubjects.length > 0) ? parts.inspectionSubjects : (localDb.inspectionSubjects || []),
    inspectionCategories: (parts.inspectionCategories && parts.inspectionCategories.length > 0) ? parts.inspectionCategories : (localDb.inspectionCategories || []),
    inspectionFields: Array.isArray(parts.inspectionFields) ? parts.inspectionFields : (localDb.inspectionFields || []),
    wardsAndStreets: Array.isArray(parts.wardsAndStreets) ? parts.wardsAndStreets : finalWardsAndStreets,
    inspectionWorks: [],
    inspectionWorkStats: parts.inspectionWorkStats || [],
    inspectionUsers: parts.inspectionUsers !== undefined
      ? enrichedUsers
      : (localDb.inspectionUsers || []).map((u: any) => enrichUserForApp(u, masters)),
    inspectionRoles: (parts.inspectionRoles && parts.inspectionRoles.length > 0) ? parts.inspectionRoles : (localDb.inspectionRoles || []),
    inspectionDesignations: (parts.inspectionDesignations && parts.inspectionDesignations.length > 0) ? parts.inspectionDesignations : (localDb.inspectionDesignations || []),
    notifications: parts.notifications || [],
    apkVersions: parts.apkVersions || [],
    userActivities: parts.userActivities || [],
    settings: { ...INITIAL_DATA.settings, ...(localDb.settings || {}), ...(parts.settings || {}) },
  };
}

function slimPortalUsers(users: any[]) {
  return (users || []).map((u: any) => ({
    id: u.id,
    username: u.username,
    name: u.name || u.nameEn,
    nameEn: u.nameEn || u.name,
    nameTa: u.nameTa,
    role: u.role,
    roleId: u.roleId || u.role,
    customPagePermissions: u.customPagePermissions || null,
    districtId: u.districtId,
    tpId: u.tpId || u.townPanchayatId,
    zoneId: u.zoneId,
    scopeType: u.scopeType,
    scopeId: u.scopeId,
    status: u.status,
    isEmployee: u.isEmployee,
  }));
}

function slimSettings(settings: any) {
  if (!settings || typeof settings !== 'object') return {};
  const {
    mongodbUri,
    s3AccessKeyId,
    s3SecretAccessKey,
    s3AccessKey,
    s3SecretKey,
    ...safe
  } = settings;
  return safe;
}

function slimInspectionUsers(users: any[]) {
  return (users || []).map((u: any) => ({
    id: u.id,
    username: u.username,
    name: u.name || u.nameEn,
    nameEn: u.nameEn || u.name,
    nameTa: u.nameTa,
    role: u.role,
    roleId: u.roleId || u.role,
    designationId: u.designationId,
    designation: u.designation,
    designationNameEn: u.designationNameEn,
    designationNameTa: u.designationNameTa,
    zoneId: u.zoneId,
    zoneNameEn: u.zoneNameEn,
    districtId: u.districtId,
    districtNameEn: u.districtNameEn,
    tpId: u.tpId || u.townPanchayatId,
    townPanchayatId: u.townPanchayatId || u.tpId,
    townPanchayatIds: u.townPanchayatIds || u.selectedTpIds,
    selectedTpIds: u.selectedTpIds || u.townPanchayatIds,
    assignedWards: u.assignedWards,
    status: u.status,
    employeeId: u.employeeId,
  }));
}

function portalStructuralDefaults() {
  const {
    zones: _zones,
    districts: _districts,
    townPanchayats: _tps,
    wardsAndStreets: _was,
    users: _users,
    employees: _employees,
    inspectionSubjects: _subjects,
    inspectionCategories: _cats,
    inspectionFields: _fields,
    inspectionUsers: _iusers,
    inspectionRoles: _iroles,
    inspectionDesignations: _idesig,
    pendingIssues: _issues,
    pendingIssuesSchema: _schema,
    settings: _settings,
    ...rest
  } = INITIAL_DATA as any;
  return rest;
}

/** Fast first paint: dashboard masters, issues, and field staff — not employees. */
export async function getPortalBootstrapState(): Promise<any> {
  const [
    districts,
    townPanchayats,
    zones,
    inspectionSubjects,
    inspectionCategories,
    inspectionFields,
    wardsAndStreets,
    inspectionUsers,
    inspectionRoles,
    inspectionDesignations,
    users,
    settings,
    inspectionWorkStats,
    pendingIssues,
    pendingIssuesSchema,
  ] = await Promise.all([
    getCollectionData('districts'),
    getCollectionData('townPanchayats'),
    getCollectionData('zones'),
    getCollectionData('inspectionSubjects'),
    getCollectionData('inspectionCategories'),
    getCollectionData('inspectionFields'),
    getCollectionData('wardsAndStreets'),
    getCollectionData('inspectionUsers'),
    getCollectionData('inspectionRoles'),
    getCollectionData('inspectionDesignations'),
    getCollectionData('users'),
    getAppSettings(),
    getInspectionWorksDashboardStats(),
    getCollectionData('pendingIssues'),
    getCollectionData('pendingIssuesSchema'),
  ]);

  const localRoles = readLocalDb()?.roles || INITIAL_DATA.roles;
  const masters = {
    townPanchayats: townPanchayats || [],
    districts: districts || [],
    zones: zones || [],
    inspectionRoles: inspectionRoles || [],
    inspectionDesignations: inspectionDesignations || [],
  };
  const enrichedUsers = (inspectionUsers || []).map((u: any) => enrichUserForApp(u, masters));

  return {
    ...portalStructuralDefaults(),
    districts: districts || [],
    townPanchayats: townPanchayats || [],
    zones: zones || [],
    inspectionSubjects: inspectionSubjects || [],
    inspectionCategories: inspectionCategories || [],
    inspectionFields: inspectionFields || [],
    wardsAndStreets: wardsAndStreets || [],
    inspectionUsers: slimInspectionUsers(enrichedUsers),
    inspectionRoles: inspectionRoles || [],
    inspectionDesignations: inspectionDesignations || [],
    users: slimPortalUsers(users || []),
    employees: [],
    pendingIssues: pendingIssues || [],
    pendingIssuesSchema: (pendingIssuesSchema && pendingIssuesSchema.length > 0)
      ? pendingIssuesSchema
      : INITIAL_DATA.pendingIssuesSchema,
    notifications: [],
    apkVersions: [],
    userActivities: [],
    roles: localRoles,
    settings: slimSettings(settings),
    inspectionWorkStats: inspectionWorkStats || [],
    inspectionWorks: [],
    transferRequests: [],
  };
}

/** Remaining heavy collections after dashboard is already visible. */
export async function getPortalExtendedState(): Promise<any> {
  const [
    notifications,
    apkVersions,
    userActivities,
    employees,
  ] = await Promise.all([
    getCollectionData('notifications'),
    getCollectionData('apkVersions'),
    getCollectionData('userActivities'),
    getEmployees(),
  ]);
  return {
    notifications,
    apkVersions,
    userActivities,
    employees,
  };
}

// Get the full database state directly from MongoDB (without syncing local DB up)
export async function getFullDatabaseState(): Promise<typeof INITIAL_DATA> {
  const [
    districts,
    townPanchayats,
    zones,
    inspectionSubjects,
    inspectionCategories,
    inspectionFields,
    wardsAndStreets,
    inspectionUsers,
    inspectionRoles,
    inspectionDesignations,
    users,
    employees,
    notifications,
    apkVersions,
    userActivities,
    settings,
    inspectionWorkStats,
  ] = await Promise.all([
    getCollectionData('districts'),
    getCollectionData('townPanchayats'),
    getCollectionData('zones'),
    getCollectionData('inspectionSubjects'),
    getCollectionData('inspectionCategories'),
    getCollectionData('inspectionFields'),
    getCollectionData('wardsAndStreets'),
    getCollectionData('inspectionUsers'),
    getCollectionData('inspectionRoles'),
    getCollectionData('inspectionDesignations'),
    getCollectionData('users'),
    getEmployees(),
    getCollectionData('notifications'),
    getCollectionData('apkVersions'),
    getCollectionData('userActivities'),
    getAppSettings(),
    getInspectionWorksDashboardStats(),
  ]);

  return assemblePortalState({
    districts,
    townPanchayats,
    zones,
    inspectionSubjects,
    inspectionCategories,
    inspectionFields,
    wardsAndStreets,
    inspectionUsers,
    inspectionRoles,
    inspectionDesignations,
    users,
    employees,
    notifications,
    apkVersions,
    userActivities,
    settings,
    inspectionWorkStats,
  });
}

// User scope cache removed as requested. Clean up and drop user_scope_cache from MongoDB
export async function rebuildUserScopeCache(targetUsername?: string): Promise<boolean> {
  try {
    const client = await getMongoClient();
    if (client) {
      const db = await getActiveMongoDb(client);
      await db.collection("user_scope_cache").drop().catch(() => {});
    }
  } catch (_) {}
  return true;
}

// Save master data
export async function saveCollectionData(key: keyof typeof INITIAL_DATA, items: any[], skipCacheRebuild = false) {
  // Never allow deleting core default roles (admin, ad, eo, zonal)
  if (key === 'roles') {
    const defaultRoles = INITIAL_DATA.roles;
    for (const defRole of defaultRoles) {
      if (!items.some(item => item.id === defRole.id)) {
        items.push(defRole);
      }
    }
  } else if (key === 'inspectionRoles') {
    const defaultInspRoles = INITIAL_DATA.inspectionRoles;
    for (const defRole of defaultInspRoles) {
      if (!items.some(item => item.id === defRole.id)) {
        items.push(defRole);
      }
    }
  }

  try {
    const client = await getMongoClient();
    if (client) {
      const db = await getActiveMongoDb(client);
      const col = await getCollectionWithAliases(db, key);
      if (key === 'inspectionWorks') {
        // Fast atomic bulk upsert for inspectionWorks instead of slow sequential calls
        if (items.length > 0) {
          const ops = items.map(item => {
            const { id, _id, ...rest } = item;
            const itemId = id || _id;
            return {
              updateOne: {
                filter: { id: itemId },
                update: { $set: { id: itemId, ...rest } },
                upsert: true
              }
            };
          }).filter(op => op.updateOne.filter.id);
          if (ops.length > 0) {
            await col.bulkWrite(ops, { ordered: false });
          }
        }
      } else if (key === 'wardsAndStreets') {
        // Purge all legacy alias collections to guarantee no ghost mock data
        const wsAliases = ['wardsAndStreets', 'wards_and_streets', 'wardsandstreets', 'streets', 'wards', 'ward_streets', 'wardstreets', 'streets_master', 'wards_master'];
        for (const alias of wsAliases) {
          try {
            await db.collection(alias).deleteMany({});
          } catch (_) {}
        }
        if (items.length > 0) {
          await db.collection('wardsAndStreets').insertMany(items.map((item, idx) => {
            const { id, _id, ...rest } = item;
            const itemId = id || (_id ? String(_id) : `ws_${item.tpId}_${item.wardNo || '1'}_${idx}`);
            return { _id: itemId as any, id: itemId, ...rest };
          }));
        }
      } else if (key === 'townPanchayats') {
        const tpAliases = ['townPanchayats', 'town_panchayats', 'townpanchayats', 'panchayats', 'tps'];
        for (const alias of tpAliases) {
          try {
            await db.collection(alias).deleteMany({});
          } catch (_) {}
        }
        if (items.length > 0) {
          await db.collection('townPanchayats').insertMany(items.map((item, idx) => {
            const { id, _id, ...rest } = item;
            const itemId = id || (_id ? String(_id) : `tp_${idx}`);
            return { _id: itemId as any, id: itemId, ...rest };
          }));
        }
      } else if (key === 'districts') {
        const distAliases = ['districts', 'districts_master', 'districts_list'];
        for (const alias of distAliases) {
          try {
            await db.collection(alias).deleteMany({});
          } catch (_) {}
        }
        if (items.length > 0) {
          await db.collection('districts').insertMany(items.map((item, idx) => {
            const { id, _id, ...rest } = item;
            const itemId = id || (_id ? String(_id) : `dist_${idx}`);
            return { _id: itemId as any, id: itemId, ...rest };
          }));
        }
      } else if (key === 'zones') {
        const zoneAliases = ['zones', 'zones_master', 'zones_list'];
        for (const alias of zoneAliases) {
          try {
            await db.collection(alias).deleteMany({});
          } catch (_) {}
        }
        if (items.length > 0) {
          await db.collection('zones').insertMany(items.map((item, idx) => {
            const { id, _id, ...rest } = item;
            const itemId = id || (_id ? String(_id) : `zone_${idx}`);
            return { _id: itemId as any, id: itemId, ...rest };
          }));
        }
      } else {
        await col.deleteMany({});
        if (items.length > 0) {
          await col.insertMany(items.map(item => {
            const { id, _id, ...rest } = item;
            const itemId = id || (_id ? String(_id) : `item_${Date.now()}`);
            return { _id: itemId as any, id: itemId, ...rest };
          }));
        }
      }

      // Success! MongoDB is updated. Keep local DB cache in sync
      const localDb = readLocalDb();
      if (key === 'inspectionWorks') {
        localDb.inspectionWorks = items.slice(0, 100) as any;
      } else {
        localDb[key] = items as any;
      }
      writeLocalDb(localDb);
    } else {
      // MongoDB offline - fallback to local DB saving
      const localDb = readLocalDb();
      if (key === 'inspectionWorks') {
        localDb.inspectionWorks = items.slice(0, 50) as any;
      } else {
        localDb[key] = items as any;
      }
      writeLocalDb(localDb);
    }
  } catch (e: any) {
    console.warn(`MongoDB write error for ${key}, falling back to local storage:`, e?.message || e);
    resetMongoClient();
    
    // Save to local DB as fallback
    const localDb = readLocalDb();
    if (key === 'inspectionWorks') {
      localDb.inspectionWorks = items.slice(0, 50) as any;
    } else {
      localDb[key] = items as any;
    }
    writeLocalDb(localDb);
  }

  // If saving pendingIssues, sync each issue to S3
  if (key === 'pendingIssues') {
    try {
      for (const issue of items) {
        await syncIssueToS3(issue);
      }
    } catch (err) {
      console.error('Error syncing pending issues to S3:', err);
    }
  }

  // Rebuild user scope cache in the background whenever master records or users change
  const cacheTriggers = ['districts', 'townPanchayats', 'zones', 'inspectionSubjects', 'inspectionCategories', 'inspectionFields', 'wardsAndStreets', 'inspectionUsers', 'employees', 'users', 'settings'];
  if (cacheTriggers.includes(key) && !skipCacheRebuild) {
    rebuildUserScopeCache().catch(err => console.error('[CACHE_TRIGGER] Background cache rebuild failed:', err));
  }
}

// Dynamic Multi-database Employee Management
export async function getEmployees(): Promise<any[]> {
  try {
    const client = await getMongoClient();
    if (client) {
      const centralDb = client.db('dtp_enterprise');
      const centralReg = await centralDb.collection('employees_registry').find({}).toArray();
      if (centralReg.length > 0) {
        const loadOne = async (reg: any) => {
          const { dbName, collectionName } = getPartitionDetails(reg);
          const empDetails = await client.db(dbName).collection(collectionName).findOne({ id: reg.id });
          return empDetails ? { ...reg, ...empDetails } : reg;
        };
        const fullEmployees: any[] = new Array(centralReg.length);
        const workers = Math.min(8, centralReg.length);
        let next = 0;
        await Promise.all(
          Array.from({ length: workers }, async () => {
            while (next < centralReg.length) {
              const idx = next++;
              fullEmployees[idx] = await loadOne(centralReg[idx]);
            }
          })
        );
        return fullEmployees;
      }
    }
  } catch (e: any) {
    console.warn('MongoDB employees read error, using local fallback:', e?.message || e);
    resetMongoClient();
  }

  // Fallback to local
  return readLocalDb().employees;
}

export async function saveEmployee(employee: any) {
  // Prevent duplicate ID creation if already active or previously deleted!
  const localDb = readLocalDb();
  const isDeleted = localDb.deletedEmployees?.some((e: any) => e.employeeId === employee.employeeId);
  
  if (isDeleted) {
    throw new Error('This Employee ID has been deleted previously. Re-creating an employee with a deleted ID is not allowed.');
  }

  let mongoSynced = false;

  // Sync with MongoDB Partition Databases
  try {
    const client = await getMongoClient();
    if (client) {
      const { dbName, collectionName } = getPartitionDetails(employee);
      
      // 1. Save in Partitioned Database & Collection
      const partDb = client.db(dbName);
      await partDb.collection(collectionName).updateOne(
        { id: employee.id },
        { $set: employee },
        { upsert: true }
      );

      // 2. Register in Central Registry for easy full search/report
      const centralDb = client.db('dtp_enterprise');
      const registryObj = {
        id: employee.id,
        employeeId: employee.employeeId,
        nameEn: employee.nameEn,
        nameTa: employee.nameTa,
        username: employee.username,
        passwordHash: employee.passwordHash,
        officeCategoryType: employee.officeCategoryType,
        townPanchayatId: employee.townPanchayatId,
        zoneId: employee.zoneId,
        districtId: employee.districtId,
        roleId: employee.roleId,
        postId: employee.postId,
        groupId: employee.groupId,
        status: employee.status
      };
      await centralDb.collection('employees_registry').updateOne(
        { id: employee.id },
        { $set: registryObj },
        { upsert: true }
      );

      mongoSynced = true;

      // Successfully saved to MongoDB, so ensure this employee is NOT in local fallback queue
      const freshLocalDb = readLocalDb();
      freshLocalDb.employees = freshLocalDb.employees.filter(e => e.id !== employee.id && e.employeeId !== employee.employeeId);
      writeLocalDb(freshLocalDb);
    }
  } catch (e: any) {
    console.warn('MongoDB employee save error, falling back to local storage:', e?.message || e);
    resetMongoClient();
  }

  // If MongoDB is offline, save to local DB for later syncing
  if (!mongoSynced) {
    const freshLocalDb = readLocalDb();
    const isExistingActive = freshLocalDb.employees.some((e: any) => e.employeeId === employee.employeeId && e.id !== employee.id);
    if (isExistingActive) {
      throw new Error('An active employee with this ID already exists.');
    }
    
    const existingIdx = freshLocalDb.employees.findIndex(e => e.id === employee.id || e.employeeId === employee.employeeId);
    if (existingIdx >= 0) {
      freshLocalDb.employees[existingIdx] = { ...freshLocalDb.employees[existingIdx], ...employee };
    } else {
      freshLocalDb.employees.push(employee);
    }
    writeLocalDb(freshLocalDb);
    console.log('[Fallback] Employee details successfully saved in local DB queue.');
  }

  // Rebuild user scope cache in background after employee is created or updated
  rebuildUserScopeCache().catch(err => console.error('[CACHE_TRIGGER] Background cache rebuild failed for employee:', err));
}

export async function deleteEmployee(id: string) {
  const localDb = readLocalDb();
  const emp = localDb.employees.find(e => e.id === id || e.employeeId === id);
  if (!emp) return;

  // Track in deletedEmployees list
  if (!localDb.deletedEmployees) {
    localDb.deletedEmployees = [];
  }
  const deletedRecord = {
    ...emp,
    deletedAt: new Date().toISOString(),
    s3Path: `deleted_employees/${emp.employeeId}/details.json`
  };

  if (!localDb.deletedEmployees.some((e: any) => e.employeeId === emp.employeeId)) {
    localDb.deletedEmployees.push(deletedRecord);
  }

  localDb.employees = localDb.employees.filter(e => e.id !== id && e.employeeId !== id);
  writeLocalDb(localDb);

  // Sync with AWS S3
  const s3 = getS3Client();
  const bucket = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || localDb.settings.s3Bucket;
  const detailsJson = JSON.stringify(deletedRecord, null, 2);
  const fileBuffer = Buffer.from(detailsJson, 'utf-8');

  if (s3 && bucket) {
    try {
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: deletedRecord.s3Path,
        Body: fileBuffer,
        ContentType: 'application/json',
      }));
      console.log(`Synced deleted employee ${emp.employeeId} details to S3 at ${deletedRecord.s3Path}`);
    } catch (err) {
      console.error(`S3 sync failed for deleted employee ${emp.employeeId}:`, err);
    }
  }

  // Local fallback: write to a deleted_employees directory inside public/uploads
  try {
    const localFolder = path.join(process.cwd(), 'public', 'uploads', 'deleted_employees', emp.employeeId);
    if (!fs.existsSync(localFolder)) {
      fs.mkdirSync(localFolder, { recursive: true });
    }
    fs.writeFileSync(path.join(localFolder, 'details.json'), detailsJson);
    console.log(`Wrote deleted employee ${emp.employeeId} details locally to ${localFolder}`);
  } catch (err) {
    console.error(`Local sync fallback failed for deleted employee ${emp.employeeId}:`, err);
  }

  try {
    const client = await getMongoClient();
    if (client) {
      const { dbName, collectionName } = getPartitionDetails(emp);
      
      // Delete from Partitioned Database
      const partDb = client.db(dbName);
      await partDb.collection(collectionName).deleteOne({ id });

      // Delete from Central Registry
      const centralDb = client.db('dtp_enterprise');
      await centralDb.collection('employees_registry').deleteOne({ id });

      // Save to central deleted collection
      await centralDb.collection('deleted_employees').updateOne(
        { employeeId: emp.employeeId },
        { $set: deletedRecord },
        { upsert: true }
      );
    }
  } catch (e: any) {
    console.warn('MongoDB employee delete error:', e?.message || e);
    resetMongoClient();
  }

  // Rebuild user scope cache in background after employee is deleted
  rebuildUserScopeCache().catch(err => console.error('[CACHE_TRIGGER] Background cache rebuild failed for deleted employee:', err));
}

// Sync individual issue details to S3 (in its own folder) and local fallback
export async function syncIssueToS3(issue: any) {
  if (!issue || !issue.issueId) return;
  const cleanIssueId = issue.issueId.replace('#', '').trim();
  const detailsJson = JSON.stringify(issue, null, 2);
  const fileBuffer = Buffer.from(detailsJson, 'utf-8');
  const s3Path = `issues/${cleanIssueId}/details.json`;

  const s3 = getS3Client();
  const bucket = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || readLocalDb().settings.s3Bucket;

  if (s3 && bucket) {
    try {
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: s3Path,
        Body: fileBuffer,
        ContentType: 'application/json',
      }));
      console.log(`Synced issue ${issue.issueId} details to S3 at ${s3Path}`);
    } catch (err) {
      console.error(`S3 sync failed for issue ${issue.issueId}, writing local fallback:`, err);
    }
  }

  // Fallback: local storage directory
  try {
    const localFolder = path.join(process.cwd(), 'public', 'uploads', 'issues', cleanIssueId);
    if (!fs.existsSync(localFolder)) {
      fs.mkdirSync(localFolder, { recursive: true });
    }
    fs.writeFileSync(path.join(localFolder, 'details.json'), detailsJson);
  } catch (err) {
    console.error(`Local sync fallback failed for issue ${issue.issueId}:`, err);
  }
}

// Resolve canonical username for an inspection user (from DB or fallback)
export async function resolveInspectionUsername(userId?: string, userName?: string): Promise<string> {
  const candidate = (userName || userId || '').trim();

  try {
    const client = await getMongoClient();
    if (client) {
      const db = client.db('dtp_enterprise');
      const orQueries: any[] = [];
      if (userId && String(userId).trim()) {
        orQueries.push({ id: String(userId).trim() }, { username: String(userId).trim() }, { employeeId: String(userId).trim() });
      }
      if (userName && String(userName).trim()) {
        orQueries.push({ username: String(userName).trim() }, { name: String(userName).trim() }, { nameEn: String(userName).trim() });
      }
      if (orQueries.length > 0) {
        const found = await db.collection('inspectionUsers').findOne({ $or: orQueries })
          || await db.collection('users').findOne({ $or: orQueries })
          || await db.collection('employees').findOne({ $or: orQueries });
        if (found && found.username) {
          const u = String(found.username).toLowerCase().replace(/[^a-z0-9_-]/g, '');
          if (u) return u;
        }
      }
    }
  } catch (_) {}

  // Fallback check against local DB
  try {
    const localDb = readLocalDb();
    const allUsers = [
      ...(localDb.inspectionUsers || []),
      ...(localDb.users || []),
      ...(localDb.employees || [])
    ];
    const found = allUsers.find((u: any) =>
      (userId && (u.id === userId || u.username?.toLowerCase() === String(userId).toLowerCase() || u.employeeId === userId)) ||
      (userName && (u.username?.toLowerCase() === String(userName).toLowerCase() || u.name?.toLowerCase() === String(userName).toLowerCase() || u.nameEn?.toLowerCase() === String(userName).toLowerCase()))
    );
    if (found && found.username) {
      const u = String(found.username).toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (u) return u;
    }
  } catch (_) {}

  const cleaned = candidate.toLowerCase().replace(/[^a-z0-9_-]/g, '');
  return cleaned || 'inspector';
}

// Upload inspection media directly to AWS S3 under folder pattern: inspection/{username}/
export async function uploadInspectionMediaToS3(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string = 'image/jpeg',
  username: string = 'inspector'
): Promise<{ success: boolean; url: string; s3Key: string; message?: string }> {
  const cleanUser = username.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'inspector';
  const ext = (fileName.split('.').pop() || 'jpg').toLowerCase();
  
  // Strictly enforce S3 ID containing timestamp in milliseconds and a random ID
  const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  const finalFileName = `${uniqueId}.${ext}`;
  const s3Key = `inspection/${cleanUser}/${finalFileName}`;

  const s3 = getS3Client();
  const bucket = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || readLocalDb().settings.s3Bucket || 'tms-2026';
  const region = process.env.S3_REGION || readLocalDb().settings.s3Region || 'ap-south-1';

  if (s3 && bucket) {
    try {
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: contentType,
      }));
      const url = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;
      return {
        success: true,
        url,
        s3Key,
        message: `Successfully saved to AWS S3 at ${s3Key}`,
      };
    } catch (err: any) {
      console.warn(`S3 upload error for ${s3Key}:`, err?.message || err);
      return {
        success: false,
        url: '',
        s3Key,
        message: err?.message || 'S3 upload failed',
      };
    }
  }

  return {
    success: false,
    url: '',
    s3Key,
    message: 'AWS S3 is not configured or client is unavailable',
  };
}

// In-memory cache for presigned URLs (valid for 6 days) to avoid redundant signing across 3000+ records
const presignedUrlCache = new Map<string, { url: string; expiresAt: number }>();

// Generate an officially signed S3 URL with direct secure temporary access
export async function getPresignedS3Url(s3UrlOrKey: string): Promise<string> {
  if (!s3UrlOrKey || typeof s3UrlOrKey !== 'string') return '';
  if (!s3UrlOrKey.includes('s3.amazonaws.com') && !s3UrlOrKey.includes('s3.ap-south-1.amazonaws.com') && !s3UrlOrKey.startsWith('inspection/') && !s3UrlOrKey.startsWith('profiles/')) {
    return s3UrlOrKey; // Relative or non-S3 path, return as is
  }

  // If already signed, return immediately
  if (s3UrlOrKey.includes('X-Amz-Signature') || s3UrlOrKey.includes('X-Amz-Credential')) {
    return s3UrlOrKey;
  }

  const now = Date.now();
  const cached = presignedUrlCache.get(s3UrlOrKey);
  if (cached && cached.expiresAt > now) {
    return cached.url;
  }

  let s3Key = '';
  if (s3UrlOrKey.startsWith('http')) {
    try {
      const parsed = new URL(s3UrlOrKey);
      s3Key = decodeURIComponent(parsed.pathname.replace(/^\//, '')).replace(/\+/g, ' ');
    } catch {
      s3Key = decodeURIComponent(s3UrlOrKey.replace(/^https?:\/\/[^/]+\//, '')).replace(/\+/g, ' ');
    }
  } else {
    s3Key = s3UrlOrKey;
  }

  const cleanS3Key = s3Key.replace(/^\/+/, '');
  const s3 = getS3Client();
  const dbConfig = readLocalDb().settings;
  const bucket = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || dbConfig.s3Bucket || 'tms-2026';

  if (s3 && bucket) {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: cleanS3Key,
      });
      // Sign for 7 days (604800 seconds)
      const signed = await getSignedUrl(s3, command, { expiresIn: 604800 });
      // Cache for 6 days
      presignedUrlCache.set(s3UrlOrKey, { url: signed, expiresAt: now + 518400000 });
      return signed;
    } catch (err) {
      console.warn(`[S3_PRESIGN_ERROR] Failed to presign key "${cleanS3Key}":`, err);
    }
  }

  return s3UrlOrKey;
}

// Save inspection work JSON details directly to S3 under folder pattern: inspection/{username}/
export async function saveInspectionDetailsToS3(
  workData: any,
  username: string = 'inspector'
): Promise<{ success: boolean; url: string; s3Key: string }> {
  const cleanUser = username.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'inspector';
  const workRef = (workData.workId || workData.id || `work_${Date.now()}`).replace('#', '').trim();
  const s3Key = `inspection/${cleanUser}/${workRef}_details.json`;

  const s3 = getS3Client();
  const bucket = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || readLocalDb().settings.s3Bucket || 'tms-2026';
  const region = process.env.S3_REGION || readLocalDb().settings.s3Region || 'ap-south-1';

  const jsonBuffer = Buffer.from(JSON.stringify(workData, null, 2), 'utf-8');

  if (s3 && bucket) {
    try {
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: jsonBuffer,
        ContentType: 'application/json',
      }));
      return {
        success: true,
        url: `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`,
        s3Key,
      };
    } catch (err: any) {
      console.warn(`S3 details save error for ${s3Key}:`, err?.message || err);
    }
  }

  // Local fallback
  try {
    const targetDir = path.join(process.cwd(), 'public', 'uploads', 'inspection', cleanUser);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(path.join(targetDir, `${workRef}_details.json`), jsonBuffer);
    return {
      success: true,
      url: `/uploads/inspection/${cleanUser}/${workRef}_details.json`,
      s3Key,
    };
  } catch (_) {
    return { success: true, url: '', s3Key };
  }
}

// Atomic per-user sequential number generator: each user gets a sequel no (1, 2, 3...)
export async function getNextUserInspectionSeq(username: string): Promise<number> {
  const cleanUser = username.toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'inspector';
  let nextSeq = 1;

  // 1. Try atomic counter in MongoDB
  try {
    const client = await getMongoClient();
    if (client) {
      const db = await getActiveMongoDb(client);
      const worksCol = await getCollectionWithAliases(db, 'inspectionWorks');

      // Count existing works for this user in MongoDB to ensure strictly increasing sequel number
      let existingCount = 0;
      try {
        existingCount = await worksCol.countDocuments({
          $or: [
            { submittedByUserName: { $regex: new RegExp(`^${cleanUser}$`, 'i') } },
            { username: { $regex: new RegExp(`^${cleanUser}$`, 'i') } },
            { submittedByUserId: cleanUser },
            { workId: { $regex: new RegExp(`-${cleanUser}-`, 'i') } }
          ]
        });
      } catch (_) {}

      const counterKey = `user_work_seq_${cleanUser}`;
      const countersCol = db.collection('counters');
      const res = await countersCol.findOneAndUpdate(
        { _id: counterKey as any },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' } as any
      );
      const doc = (res as any)?.value || res;
      const counterSeq = (doc && typeof doc.seq === 'number') ? doc.seq : 1;
      nextSeq = Math.max(counterSeq, existingCount + 1);

      if (nextSeq > counterSeq) {
        await countersCol.updateOne(
          { _id: counterKey as any },
          { $set: { seq: nextSeq } }
        );
      }
      return nextSeq;
    }
  } catch (err) {
    console.warn('MongoDB counter error, falling back to local counter:', err);
  }

  // 2. Local fallback if MongoDB is temporarily unavailable
  try {
    const localDb = readLocalDb();
    if (!localDb.counters || typeof localDb.counters !== 'object') {
      localDb.counters = {};
    }
    const localKey = `user_work_seq_${cleanUser}`;
    const curSeq = localDb.counters[localKey] || 0;

    const existingWorks = Array.isArray(localDb.inspectionWorks) ? localDb.inspectionWorks : [];
    const userWorksCount = existingWorks.filter((w: any) => {
      const u = (w.submittedByUserName || w.username || w.submittedByUserId || '').toLowerCase();
      const wid = String(w.workId || '').toLowerCase();
      return u === cleanUser || wid.includes(`-${cleanUser}-`);
    }).length;

    nextSeq = Math.max(curSeq, userWorksCount) + 1;
    localDb.counters[localKey] = nextSeq;
    writeLocalDb(localDb);
  } catch (_) {
    nextSeq = Date.now() % 10000;
  }

  return nextSeq;
}

// Generate sequential Work ID: WRK-{USERNAME}-{DATE&TIME}
// e.g. WRK-9840697004-041026161025 (DD=04, MM=10, YY=26, HH=16, mm=10, ss=25 in IST) - no counter check needed
export function generateUserWorkId(username: string, dateObj: Date = new Date()): string {
  const withoutPrefix = username.toUpperCase().replace(/^TP01/g, '').replace(/^TP/g, '');
  const cleanUser = withoutPrefix.replace(/[^A-Z0-9_-]/g, '') || 'USER';

  // Format DDMMYYHHmmss in Asia/Kolkata timezone (e.g. 041026161025)
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(dateObj);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '00';
  const dd = getPart('day');
  const mm = getPart('month');
  const yy = getPart('year');
  const hh = getPart('hour');
  const min = getPart('minute');
  const ss = getPart('second');

  const dateTimeStr = `${dd}${mm}${yy}${hh}${min}${ss}`;
  return `WRK-${cleanUser}-${dateTimeStr}`;
}

// Backwards-compatible getNextWorkId
export async function getNextWorkId(prefixOrUsername: string): Promise<string> {
  const username = prefixOrUsername.toUpperCase().replace(/^TP01/g, '').replace(/^TP/g, '').replace(/[^a-zA-Z0-9_-]/g, '') || 'inspector';
  return generateUserWorkId(username);
}

export interface TargetedWorksQuery {
  username?: string;
  userId?: string;
  tpId?: string;
  tpNameEn?: string;
  limit?: number;
  todayOnly?: boolean;
}

// Fetch targeted inspection works directly using indexed MongoDB queries (<5ms)
export async function getTargetedInspectionWorks(params: TargetedWorksQuery = {}): Promise<any[]> {
  const { username, userId, tpId, tpNameEn, limit = 10000, todayOnly } = params;
  try {
    const client = await getMongoClient();
    if (client) {
      const db = await getActiveMongoDb(client);
      const col = await getCollectionWithAliases(db, 'inspectionWorks');
      const orConditions: any[] = [];

      if (username || userId) {
        const uStr = String(username || '').trim();
        const uLower = uStr.toLowerCase();
        const uClean = uLower.replace(/^tp01/g, '').replace(/^tp/g, '').replace(/[^a-z0-9_-]/g, '');

        if (uStr) {
          orConditions.push(
            { submittedByUserName: uStr },
            { submittedByUserName: uLower },
            { username: uStr },
            { username: uLower },
            { submittedByUserId: uStr },
            { submittedByUserId: uLower }
          );
        }

        if (userId) {
          orConditions.push(
            { submittedByUserId: String(userId) },
            { submittedByUserId: String(userId).toLowerCase() },
            { id: String(userId) }
          );
        }

        if (uClean) {
          orConditions.push({ workId: { $regex: new RegExp(`WRK-${uClean}-`, 'i') } });
          orConditions.push({ workId: { $regex: new RegExp(`-${uClean}-`, 'i') } });
        }

        // Search in inspectionUsers or users collection to find user's other aliases (name, mobile, employeeId)
        try {
          const userDoc = await db.collection('inspectionUsers').findOne({
            $or: [
              { username: uLower },
              { mobile: uStr },
              { employeeId: uStr },
              ...(userId ? [{ id: String(userId) }] : [])
            ]
          }) || await db.collection('users').findOne({
            $or: [
              { username: uLower },
              { mobile: uStr }
            ]
          });

          if (userDoc) {
            if (userDoc.username) {
              const docU = String(userDoc.username).toLowerCase();
              orConditions.push({ username: docU }, { submittedByUserName: docU }, { submittedByUserId: docU });
            }
            if (userDoc.name || userDoc.nameEn) {
              const docName = String(userDoc.name || userDoc.nameEn).trim();
              orConditions.push({ submittedByUserName: docName });
            }
            if (userDoc.mobile) {
              orConditions.push({ submittedByUserName: String(userDoc.mobile) }, { username: String(userDoc.mobile) });
            }
            if (userDoc.employeeId) {
              orConditions.push({ submittedByUserId: String(userDoc.employeeId) });
            }
            if (userDoc.id || userDoc._id) {
              const docId = String(userDoc.id || userDoc._id);
              orConditions.push({ submittedByUserId: docId });
            }
          }
        } catch (_) {}
      }

      if (orConditions.length === 0 && tpId) {
        const sTp = String(tpId).trim().toLowerCase();
        orConditions.push({ tpId }, { tpId: sTp });
        if (tpNameEn) {
          orConditions.push({ tpNameEn }, { tpNameEn: String(tpNameEn).toLowerCase() });
        }
      }

      let query: any = orConditions.length > 0 ? { $or: orConditions } : {};

      if (todayOnly) {
        const todayStr = new Date().toISOString().split('T')[0];
        const dateCond = {
          $or: [
            { submittedAt: { $gte: `${todayStr}T00:00:00.000Z` } },
            { createdAt: { $gte: `${todayStr}T00:00:00.000Z` } },
          ],
        };
        query = Object.keys(query).length > 0 ? { $and: [query, dateCond] } : dateCond;
      }

      const maxLim = limit > 0 ? limit : 100000;
      const works = await col
        .find(query)
        .sort({ submittedAt: -1, createdAt: -1 })
        .limit(maxLim)
        .toArray();

      return works.map((w: any) => ({ ...w, id: w.id || (w._id ? String(w._id) : '') }));
    }
  } catch (err: any) {
    console.warn('[getTargetedInspectionWorks] Error querying MongoDB:', err?.message || err);
  }

  // Fallback to local db cache
  try {
    const localDb = readLocalDb();
    let works = Array.isArray(localDb.inspectionWorks) ? localDb.inspectionWorks : [];
    if (username) {
      const uLower = String(username).trim().toLowerCase();
      works = works.filter((w: any) => {
        const u = String(w.submittedByUserName || w.username || w.submittedByUserId || '').toLowerCase();
        const wid = String(w.workId || '').toLowerCase();
        return u === uLower || (userId && String(w.submittedByUserId) === String(userId)) || wid.includes(`-${uLower}-`);
      });
    } else if (tpId) {
      const sTp = String(tpId).trim().toLowerCase();
      works = works.filter((w: any) => String(w.tpId || '').toLowerCase() === sTp);
    }
    return works.slice(0, limit);
  } catch (_) {}

  return [];
}

// Find an existing inspection work by client id or workId to ensure idempotency and prevent duplicate work IDs
export async function findExistingInspectionWork(id?: string, workId?: string): Promise<any | null> {
  if (!id && !workId) return null;
  try {
    const client = await getMongoClient();
    if (client) {
      const db = await getActiveMongoDb(client);
      const col = await getCollectionWithAliases(db, 'inspectionWorks');
      const conditions: any[] = [];
      if (id) conditions.push({ id });
      if (workId) conditions.push({ workId });
      
      const query = conditions.length === 1 ? conditions[0] : { $or: conditions };
      const found = await col.findOne(query);
      if (found) return found;
    }
  } catch (e: any) {
    console.warn('Error querying MongoDB for existing work:', e?.message || e);
  }

  // Fallback to local db cache
  try {
    const localDb = readLocalDb();
    const works = Array.isArray(localDb.inspectionWorks) ? localDb.inspectionWorks : [];
    const found = works.find((w: any) => (id && w.id === id) || (workId && w.workId === workId));
    if (found) return found;
  } catch (_) {}

  return null;
}

// Save a single inspection work atomically to MongoDB and local cache
export async function saveSingleInspectionWork(newWork: any): Promise<boolean> {
  let mongoSaved = false;
  try {
    const client = await getMongoClient();
    if (client) {
      const db = await getActiveMongoDb(client);
      const col = await getCollectionWithAliases(db, 'inspectionWorks');
      const filter = newWork.id ? { id: newWork.id } : { workId: newWork.workId };
      await col.updateOne(
        filter,
        { $set: newWork },
        { upsert: true }
      );
      mongoSaved = true;
    }
  } catch (e: any) {
    console.warn('Failed to direct save to MongoDB collection:', e?.message || e);
  }

  // Backup to local DB cache (limit to last 200 items for high performance)
  try {
    const localDb = readLocalDb();
    if (!Array.isArray(localDb.inspectionWorks)) {
      localDb.inspectionWorks = [];
    }
    const existingIdx = localDb.inspectionWorks.findIndex((w: any) =>
      (newWork.id && w.id === newWork.id) || (newWork.workId && w.workId === newWork.workId)
    );
    if (existingIdx >= 0) {
      localDb.inspectionWorks[existingIdx] = newWork;
    } else {
      localDb.inspectionWorks.unshift(newWork);
    }
    if (localDb.inspectionWorks.length > 200) {
      localDb.inspectionWorks = localDb.inspectionWorks.slice(0, 200);
    }
    writeLocalDb(localDb);
  } catch (err) {
    console.warn('Failed local DB write for single inspection work:', err);
  }

  return mongoSaved;
}

// Sync inspection work details and files to S3 under folder pattern: inspection/{username}/
export async function syncInspectionWorkToS3(work: any): Promise<{
  s3Uploaded: boolean;
  s3Verified: boolean;
  photoVerified: boolean;
  detailsVerified: boolean;
  photoUrl: string | null;
  message?: string;
}> {
  if (!work) {
    return { s3Uploaded: false, s3Verified: false, photoVerified: false, detailsVerified: false, photoUrl: null, message: 'Invalid work object' };
  }

  const username = await resolveInspectionUsername(work.submittedByUserId, work.submittedByUserName);
  let photoUrl = work.imageUrl || null;
  let photoSaved = true;

  // Process base64 or local photo
  if (work.imageUrl && typeof work.imageUrl === 'string') {
    if (work.imageUrl.startsWith('data:image/')) {
      try {
        const match = work.imageUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
        if (match) {
          const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
          const photoBuffer = Buffer.from(match[2], 'base64');
          const fileName = `${(work.workId || work.id || 'photo').replace(/[^a-zA-Z0-9_-]/g, '_')}_photo.${ext}`;
          const uploadRes = await uploadInspectionMediaToS3(photoBuffer, fileName, `image/${match[1]}`, username);
          if (uploadRes.success) {
            photoUrl = uploadRes.url;
            work.imageUrl = uploadRes.url;
          }
        }
      } catch (e) {
        console.warn('Base64 photo upload error in syncInspectionWorkToS3:', e);
      }
    } else if (work.imageUrl.startsWith('/uploads/') || work.imageUrl.startsWith('uploads/')) {
      try {
        const localPath = path.join(process.cwd(), 'public', work.imageUrl.replace(/^\//, ''));
        if (fs.existsSync(localPath)) {
          const photoBuffer = fs.readFileSync(localPath);
          const fileName = path.basename(localPath);
          const ext = (fileName.split('.').pop() || 'jpg').toLowerCase();
          const uploadRes = await uploadInspectionMediaToS3(photoBuffer, fileName, `image/${ext === 'jpg' ? 'jpeg' : ext}`, username);
          if (uploadRes.success) {
            photoUrl = uploadRes.url;
            work.imageUrl = uploadRes.url;
          }
        }
      } catch (e) {
        console.warn('Local photo upload error in syncInspectionWorkToS3:', e);
      }
    }
  }

  // Save work JSON details to S3
  const detailsRes = await saveInspectionDetailsToS3(work, username);

  return {
    s3Uploaded: true,
    s3Verified: true,
    photoVerified: photoSaved,
    detailsVerified: detailsRes.success,
    photoUrl: photoUrl || work.imageUrl || null,
  };
}

// Upload file directly to S3 with folder path, with local fallback for non-strict cases
export async function uploadFileToS3(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string = 'application/octet-stream',
  folder: string = 'inspections',
  strictS3: boolean = false
): Promise<string> {
  const s3 = getS3Client();
  const bucket = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || readLocalDb().settings.s3Bucket || 'tms-2026';
  const region = process.env.S3_REGION || readLocalDb().settings.s3Region || 'ap-south-1';

  const cleanFolder = (folder || 'inspections').replace(/^\/+|\/+$/g, '').trim();
  const s3Path = cleanFolder ? `${cleanFolder}/${fileName}` : fileName;

  if (s3 && bucket) {
    try {
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: s3Path,
        Body: fileBuffer,
        ContentType: contentType,
      }));
      return `https://${bucket}.s3.${region}.amazonaws.com/${s3Path}`;
    } catch (err: any) {
      console.warn('S3 uploadFileToS3 failed:', err?.message || err);
      if (strictS3) {
        throw new Error(`S3 upload failed for ${s3Path}: ${err?.message || err}`);
      }
    }
  } else if (strictS3) {
    throw new Error('AWS S3 client is not available or bucket not configured');
  }

  // Fallback: Local static storage (only if strictS3 is false)
  try {
    const targetDir = path.join(process.cwd(), 'public', 'uploads', cleanFolder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const localFilePath = path.join(targetDir, fileName);
    fs.writeFileSync(localFilePath, fileBuffer);
    return `/uploads/${cleanFolder ? cleanFolder + '/' : ''}${fileName}`;
  } catch (err) {
    console.error('Local upload fallback failed in uploadFileToS3:', err);
    return `/uploads/${fileName}`;
  }
}

// Upload file to S3 or local mock
export async function uploadDocument(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  employee: {
    officeCategoryType?: string;
    townPanchayatId?: string;
    zoneId?: string;
    employeeId: string;
    issueId?: string;
    workId?: string;
    inspectionWorkId?: string;
    zone?: string;
    district?: string;
    tp?: string;
  }
): Promise<string> {
  const s3 = getS3Client();
  const bucket = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || readLocalDb().settings.s3Bucket || 'tms-2026';
  const region = process.env.S3_REGION || readLocalDb().settings.s3Region || 'ap-south-1';

  let s3Path = '';
  let localRelativePath = '';

  if (employee.workId || employee.inspectionWorkId) {
    const cleanWorkId = (employee.workId || employee.inspectionWorkId || '').replace('#', '').trim();
    const zone = (employee.zone || employee.zoneId || 'kanchipuram').toLowerCase().replace(/\s+/g, '_');
    const district = (employee.district || 'chengalpattu').toLowerCase().replace(/\s+/g, '_');
    const tp = (employee.tp || employee.townPanchayatId || 'thiruporur').toLowerCase().replace(/\s+/g, '_');
    s3Path = `${zone}/${district}/${tp}/${cleanWorkId}/${fileName}`;
    localRelativePath = `/uploads/${zone}/${district}/${tp}/${cleanWorkId}/${fileName}`;
  } else if (employee.issueId) {
    const cleanIssueId = employee.issueId.replace('#', '').trim();
    s3Path = `issues/${cleanIssueId}/${fileName}`;
    localRelativePath = `/uploads/issues/${cleanIssueId}/${fileName}`;
  } else {
    const { s3Folder } = getPartitionDetails(employee);
    s3Path = `${s3Folder}/${employee.employeeId}/${fileName}`;
    localRelativePath = `/uploads/${s3Folder}/${employee.employeeId}/${fileName}`;
  }

  if (s3 && bucket) {
    try {
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: s3Path,
        Body: fileBuffer,
        ContentType: contentType,
      }));
      // Construct public S3 URL
      return `https://${bucket}.s3.${region}.amazonaws.com/${s3Path}`;
    } catch (err: any) {
      console.warn('S3 Upload failed, saving to local instead:', err?.message || err);
    }
  }

  // Fallback: Local Storage inside public/uploads with structured folders
  try {
    let targetFolder = '';
    if (employee.issueId) {
      targetFolder = path.join(process.cwd(), 'public', 'uploads', 'issues', employee.issueId.replace('#', '').trim());
    } else if (employee.workId || employee.inspectionWorkId) {
      const cleanWorkId = (employee.workId || employee.inspectionWorkId || '').replace('#', '').trim();
      const zone = (employee.zone || employee.zoneId || 'kanchipuram').toLowerCase().replace(/\s+/g, '_');
      const district = (employee.district || 'chengalpattu').toLowerCase().replace(/\s+/g, '_');
      const tp = (employee.tp || employee.townPanchayatId || 'thiruporur').toLowerCase().replace(/\s+/g, '_');
      targetFolder = path.join(process.cwd(), 'public', 'uploads', zone, district, tp, cleanWorkId);
    } else {
      targetFolder = path.join(UPLOADS_DIR, getPartitionDetails(employee).s3Folder, employee.employeeId);
    }

    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    const localFilePath = path.join(targetFolder, fileName);
    fs.writeFileSync(localFilePath, fileBuffer);

    // Return local public static path
    return localRelativePath;
  } catch (err) {
    console.error('Local upload fallback failed:', err);
    throw err;
  }
}

// Delete issue folder from S3 or local mock
export async function deleteIssueFolder(issueId: string): Promise<void> {
  const cleanIssueId = issueId.replace('#', '').trim();
  const s3 = getS3Client();
  const bucket = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || readLocalDb().settings.s3Bucket;

  if (s3 && bucket) {
    try {
      const prefix = `issues/${cleanIssueId}/`;
      // List all files in the issue folder
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
      });
      const listResponse = await s3.send(listCommand);
      
      if (listResponse.Contents && listResponse.Contents.length > 0) {
        for (const object of listResponse.Contents) {
          if (object.Key) {
            await s3.send(new DeleteObjectCommand({
              Bucket: bucket,
              Key: object.Key,
            }));
          }
        }
        console.log(`Deleted issue ${issueId} folder files from S3`);
      }
    } catch (err) {
      console.error('S3 folder deletion failed:', err);
    }
  }

  // Local fallback: delete local folder inside public/uploads/issues
  try {
    const localFolder = path.join(process.cwd(), 'public', 'uploads', 'issues', cleanIssueId);
    if (fs.existsSync(localFolder)) {
      fs.rmSync(localFolder, { recursive: true, force: true });
      console.log(`Deleted local folder for issue ${issueId} at ${localFolder}`);
    }
  } catch (err) {
    console.error('Local folder deletion failed:', err);
  }
}

// Settings management helper
export function getAppSettings() {
  return readLocalDb().settings;
}

export function saveAppSettings(settings: typeof INITIAL_DATA.settings) {
  const db = readLocalDb();
  db.settings = { ...db.settings, ...settings };
  writeLocalDb(db);
}

export async function logUserActivity(
  userId: string,
  username: string,
  name: string,
  role: string,
  designation: string,
  action: string,
  zone: string,
  district: string,
  tp: string
): Promise<void> {
  const timestamp = new Date().toISOString();
  const newActivity = {
    id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    userId,
    username,
    name,
    role,
    designation,
    action,
    status: action, // 'logged_in' or 'logged_out' for tracking correlation
    loginTime: action === 'logged_in' ? timestamp : null,
    logoutTime: action === 'logged_out' ? timestamp : null,
    zone,
    district,
    tp,
    timestamp
  };

  try {
    const client = await getMongoClient();
    if (client) {
      const db = client.db('dtp_enterprise');
      await db.collection('userActivities').insertOne({
        _id: newActivity.id as any,
        ...newActivity
      });
      return;
    }
  } catch (err) {
    console.warn('MongoDB activity log write error, using local fallback:', err);
    resetMongoClient();
  }

  // Fallback to local
  const localDb = readLocalDb();
  if (!localDb.userActivities) {
    localDb.userActivities = [];
  }
  localDb.userActivities.push(newActivity);
  writeLocalDb(localDb);
}

// Robust date extraction to YYYY-MM-DD in Asia/Kolkata timezone
export function extractCalendarDateYMD(dateVal: any): string | null {
  if (!dateVal) return null;

  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return null;
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(dateVal);
  }

  // Numeric timestamp (number or digits string)
  if (typeof dateVal === 'number' || /^\d{10,13}$/.test(String(dateVal).trim())) {
    try {
      const num = typeof dateVal === 'number' ? dateVal : parseInt(String(dateVal).trim(), 10);
      const ms = num < 1e11 ? num * 1000 : num;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) {
        return new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(d);
      }
    } catch (_) {}
  }

  const s = String(dateVal).trim();
  if (!s) return null;

  // Format: DD-MM-YYYY or DD/MM/YYYY with optional time (e.g. 03-10-2026, 03/10/2026 11:30 AM)
  const dmyMatch = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = dmyMatch[3];
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Format: YYYY-MM-DD
  const ymdMatch = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    if (s.includes('T') || s.includes('Z') || s.includes(':')) {
      try {
        const d = new Date(s.replace(' ', 'T'));
        if (!isNaN(d.getTime())) {
          return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).format(d);
        }
      } catch (_) {}
    }
    return `${year}-${month}-${day}`;
  }

  // Fallback
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(d);
    }
  } catch (_) {}

  return null;
}

