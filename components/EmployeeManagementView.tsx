'use client';
import ThemeSelect from './ThemeSelect';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  User,
  UserPlus, 
  Database, 
  Upload, 
  Trash2, 
  Edit3, 
  Lock, 
  FileText, 
  XCircle,
  Eye,
  EyeOff,
  Printer,
  Building2,
  Briefcase,
  ShieldCheck,
  Check,
  Copy,
  ChevronRight
} from 'lucide-react';
import { Language, translations } from './translations';

interface EmployeeManagementViewProps {
  state: any;
  lang: Language;
  currentUser: any;
  onSaveEmployee: (employee: any) => Promise<void>;
  onDeleteEmployee: (id: string) => Promise<void>;
  onSaveTransferRequest: (request: any) => Promise<void>;
  onLogActivity: (log: any) => Promise<void>;
}

export default function EmployeeManagementView({
  state,
  lang,
  currentUser,
  onSaveEmployee,
  onDeleteEmployee,
  onSaveTransferRequest,
  onLogActivity
}: EmployeeManagementViewProps) {
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'transfers' | 'activityLogs' | 'deletedEmployees'>('list');
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [viewDeletedEmployee, setViewDeletedEmployee] = useState<any | null>(null);

  const {
    zones = [],
    districts = [],
    townPanchayats = [],
    employeeGroups = [],
    employeeCategories = [],
    postNatures = [],
    payLevels = [],
    posts = [],
    modules = [],
    fields = [],
    employees = [],
    transferRequests = [],
    activityLogs = [],
    officeCategories = [],
    deletedEmployees = []
  } = state || {};

  // Form states for Employee
  const [empId, setEmpId] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedTP, setSelectedTP] = useState(
    (currentUser?.scopeType !== 'HOD' && currentUser?.scopeType !== 'Zone') 
      ? currentUser?.scopeId || '' 
      : ''
  );
  const [selectedPost, setSelectedPost] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedNature, setSelectedNature] = useState('');
  const [selectedPayLevel, setSelectedPayLevel] = useState('');
  const [empStatus, setEmpStatus] = useState<'Active' | 'Inactive'>('Active');
  const [profileImage, setProfileImage] = useState('');
  const [documents, setDocuments] = useState<any[]>([]);
  const [dynamicData, setDynamicData] = useState<{ [fieldId: string]: any }>({});
  const [community, setCommunity] = useState('oc');
  const [showCredentialsModal, setShowCredentialsModal] = useState<any | null>(null);

  // User Scope Classification
  const isDtpUser = currentUser?.scopeType === 'HOD' || currentUser?.roleId === 'dtp' || currentUser?.username === 'dtpadmin';
  const isZoneUser = !isDtpUser && (currentUser?.scopeType === 'Zone' || currentUser?.roleId === 'zone' || currentUser?.roleId === 'ad');
  const isTPUser = !isDtpUser && !isZoneUser;
  const isAdmin = currentUser?.roleId === 'admin' || currentUser?.username === 'dtpadmin' || currentUser?.scopeType === 'HOD';

  // Filter states for hierarchical view
  const [filterZoneId, setFilterZoneId] = useState('');
  const [filterDistrictId, setFilterDistrictId] = useState('');
  const [filterTPId, setFilterTPId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState<{ [id: string]: boolean }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Basic Personnel details
  const [dob, setDob] = useState('');
  const [retirementDate, setRetirementDate] = useState('');
  const [gender, setGender] = useState('Male');
  const [aadharNo, setAadharNo] = useState('');

  // File Upload local states
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docName, setDocName] = useState('');
  const [docCategory, setDocCategory] = useState('Appointment');
  const [showUploadBlock, setShowUploadBlock] = useState(false);

  // Dynamic Field file upload states
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null);
  const [fieldUploadErrors, setFieldUploadErrors] = useState<{ [fieldId: string]: string }>({});

  // Transfer lodge states
  const [transferTP, setTransferTP] = useState('');
  const [reasonEn, setReasonEn] = useState('');
  const [reasonTa, setReasonTa] = useState('');

  // Activity Log search query state
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [openEmpFormSections, setOpenEmpFormSections] = useState<Record<string, boolean>>({});
  const EMP_MODULE_TONES = ['#1d4ed8', '#0f766e', '#c2410c', '#7c3aed', '#be185d', '#0369a1', '#b45309', '#4f46e5'];

  // Sorted and filtered activity logs
  const filteredLogs = [...activityLogs]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .filter((log: any) => {
      const q = logSearchQuery.toLowerCase();
      return (
        log.employeeId?.toLowerCase().includes(q) ||
        log.employeeName?.toLowerCase().includes(q) ||
        log.action?.toLowerCase().includes(q) ||
        log.changedBy?.toLowerCase().includes(q) ||
        log.details?.toLowerCase().includes(q)
      );
    });

  const t = (key: keyof typeof translations['en']) => {
    return translations[lang][key] || translations['en'][key] || key;
  };

  const tObj = (obj: any) => {
    if (!obj) return '';
    return lang === 'ta' ? (obj.nameTa || obj.nameEn) : (obj.nameEn || obj.nameTa);
  };

  // Scoped views based on user role and hierarchical selections:
  // - DTP: can view/filter Zone, District, Town Panchayat wise across TN
  // - Zone: can select District and TP within their zone
  // - TP: only shows their TP
  const getScopedEmployees = () => {
    if (currentUser?.isEmployee) {
      const empId = currentUser?.employeeId || currentUser?.username || currentUser?.id;
      return employees.filter((e: any) => e.employeeId === empId || e.id === empId);
    }

    let list = [...employees];

    if (isTPUser) {
      // For TP user role: only show their TP
      const myTpId = currentUser?.scopeId;
      if (myTpId) {
        list = list.filter((e: any) => e.townPanchayatId === myTpId);
      }
    } else if (isZoneUser) {
      // For Zone user: show zone's districts and TPs
      const zoneDistricts = districts.filter((d: any) => d.zoneId === currentUser?.scopeId);
      const zoneDistrictIds = zoneDistricts.map((d: any) => d.id);
      const zoneTPs = townPanchayats.filter((tp: any) => zoneDistrictIds.includes(tp.districtId));
      const zoneTPIds = zoneTPs.map((tp: any) => tp.id);

      list = list.filter((e: any) => 
        zoneTPIds.includes(e.townPanchayatId) || 
        (e.districtId && zoneDistrictIds.includes(e.districtId)) || 
        e.zoneId === currentUser?.scopeId
      );

      if (filterDistrictId) {
        const distTPs = townPanchayats.filter((tp: any) => tp.districtId === filterDistrictId).map((tp: any) => tp.id);
        list = list.filter((e: any) => distTPs.includes(e.townPanchayatId) || e.districtId === filterDistrictId);
      }

      if (filterTPId) {
        list = list.filter((e: any) => e.townPanchayatId === filterTPId);
      }
    } else if (isDtpUser) {
      // For DTP: zone, district, town panchayat wise
      if (filterZoneId) {
        const zDistricts = districts.filter((d: any) => d.zoneId === filterZoneId).map((d: any) => d.id);
        const zDistIds = zDistricts.map((d: any) => d.id);
        const zTPs = townPanchayats.filter((tp: any) => zDistIds.includes(tp.districtId)).map((tp: any) => tp.id);
        list = list.filter((e: any) => 
          zTPs.includes(e.townPanchayatId) || 
          (e.districtId && zDistIds.includes(e.districtId)) || 
          e.zoneId === filterZoneId
        );
      }

      if (filterDistrictId) {
        const distTPs = townPanchayats.filter((tp: any) => tp.districtId === filterDistrictId).map((tp: any) => tp.id);
        list = list.filter((e: any) => distTPs.includes(e.townPanchayatId) || e.districtId === filterDistrictId);
      }

      if (filterTPId) {
        list = list.filter((e: any) => e.townPanchayatId === filterTPId);
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((e: any) => {
        const postObj = posts.find((p: any) => p.id === e.postId);
        const tpObj = townPanchayats.find((t: any) => t.id === e.townPanchayatId);
        return (
          e.employeeId?.toLowerCase().includes(q) ||
          e.username?.toLowerCase().includes(q) ||
          e.nameEn?.toLowerCase().includes(q) ||
          e.nameTa?.toLowerCase().includes(q) ||
          postObj?.nameEn?.toLowerCase().includes(q) ||
          postObj?.nameTa?.toLowerCase().includes(q) ||
          tpObj?.nameEn?.toLowerCase().includes(q) ||
          tpObj?.nameTa?.toLowerCase().includes(q)
        );
      });
    }

    return list;
  };

  const visibleEmployees = getScopedEmployees();

  // Filter transfers
  const getScopedTransfers = () => {
    if (currentUser.isEmployee) {
      return transferRequests.filter((r: any) => r.employeeId === currentUser.employeeId);
    }
    if (currentUser.scopeType === 'HOD') {
      return transferRequests;
    } else if (currentUser.scopeType === 'Zone') {
      // Find all TPs in this Zone's districts
      const zoneDistricts = districts.filter((d: any) => d.zoneId === currentUser.scopeId).map((d: any) => d.id);
      const zoneTPs = townPanchayats.filter((tp: any) => zoneDistricts.includes(tp.districtId)).map((tp: any) => tp.id);
      return transferRequests.filter((r: any) => zoneTPs.includes(r.currentTPId) || zoneTPs.includes(r.requestedTPId));
    } else {
      return transferRequests.filter((r: any) => r.currentTPId === currentUser.scopeId || r.requestedTPId === currentUser.scopeId);
    }
  };

  const visibleTransfers = getScopedTransfers();

  // Load applicable modules based on post
  const getApplicableFields = (postId: string) => {
    if (!postId) return [];
    // Find modules applicable to this post
    const appModules = modules.filter((m: any) => m.applicablePosts?.includes(postId));
    const appModuleIds = appModules.map((m: any) => m.id);
    return fields.filter((f: any) => appModuleIds.includes(f.moduleId));
  };

  // Group applicable custom fields by their module
  const getApplicableModulesWithFields = () => {
    const currentPostId = selectedPost || (isEditing ? employees.find((e: any) => e.id === isEditing)?.postId : '');
    
    // Find modules applicable to this post (or general if applicablePosts empty/undefined)
    const applicableMods = currentPostId 
      ? modules.filter((m: any) => !m.applicablePosts || m.applicablePosts.length === 0 || m.applicablePosts.includes(currentPostId))
      : modules;

    return applicableMods.map((mod: any) => {
      const modFields = fields.filter((f: any) => f.moduleId === mod.id);
      return {
        ...mod,
        fields: modFields
      };
    }).filter((m: any) => m.fields.length > 0);
  };

  const activeFields = getApplicableFields(selectedPost || (isEditing ? employees.find((e: any) => e.id === isEditing)?.postId : ''));

  // Handle dynamic field data change
  const handleDynamicChange = (fieldId: string, val: any) => {
    setDynamicData(prev => ({ ...prev, [fieldId]: val }));
  };

  // Async dynamic field file upload handler
  const handleUploadDynamicFile = async (e: React.ChangeEvent<HTMLInputElement>, field: any) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!empId) {
      alert(lang === 'ta' ? "கோப்புகளைப் பதிவேற்றுவதற்கு முன் ஊழியர் உள்நுழைவுத் தகவல்களை உருவாக்கவும்." : "Please generate credentials first to allocate space for files.");
      return;
    }

    setFieldUploadErrors(prev => ({ ...prev, [field.id]: '' }));
    setUploadingFieldId(field.id);

    const maxMb = field.validations?.maxSizeMb || 5;
    const allowed = field.validations?.allowedTypes || 'both';
    const isMultiple = field.validations?.multiple || false;

    // Retrieve current files list or initialize as array
    let currentFiles = Array.isArray(dynamicData[field.id]) ? [...dynamicData[field.id]] : [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate File Size in MB
      const fileSizeMb = file.size / (1024 * 1024);
      if (fileSizeMb > maxMb) {
        setFieldUploadErrors(prev => ({
          ...prev,
          [field.id]: lang === 'ta' 
            ? `கோப்பு "${file.name}" அதிகபட்ச அளவான ${maxMb} MB ஐ விட அதிகமாக உள்ளது (தற்போதைய அளவு: ${fileSizeMb.toFixed(2)} MB).`
            : `File "${file.name}" exceeds the size limit of ${maxMb} MB (Actual size: ${fileSizeMb.toFixed(2)} MB).`
        }));
        setUploadingFieldId(null);
        return;
      }

      // Validate File Type
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);

      if (allowed === 'pdf' && !isPdf) {
        setFieldUploadErrors(prev => ({
          ...prev,
          [field.id]: lang === 'ta'
            ? `வகை "PDF" மட்டுமே "${field.nameTa || field.nameEn}" புலத்திற்கு அனுமதிக்கப்படுகிறது.`
            : `Only PDF files are allowed for field "${field.nameEn}".`
        }));
        setUploadingFieldId(null);
        return;
      }

      if (allowed === 'image' && !isImage) {
        setFieldUploadErrors(prev => ({
          ...prev,
          [field.id]: lang === 'ta'
            ? `வகை "படம் (Image)" மட்டுமே "${field.nameTa || field.nameEn}" புலத்திற்கு அனுமதிக்கப்படுகிறது.`
            : `Only image files are allowed for field "${field.nameEn}".`
        }));
        setUploadingFieldId(null);
        return;
      }

      if (allowed === 'both' && !isPdf && !isImage) {
        setFieldUploadErrors(prev => ({
          ...prev,
          [field.id]: lang === 'ta'
            ? `PDF அல்லது படங்கள் மட்டுமே "${field.nameTa || field.nameEn}" புலத்திற்கு அனுமதிக்கப்படுகிறது.`
            : `Only PDF or Image files are allowed for field "${field.nameEn}".`
        }));
        setUploadingFieldId(null);
        return;
      }

      // Perform S3 / fallback upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('employeeId', empId);
      formData.append('officeCategoryType', 'TP');
      formData.append('townPanchayatId', selectedTP);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.success) {
          const uploadedItem = {
            name: file.name,
            url: data.url,
            size: file.size,
            type: file.type
          };
          if (isMultiple) {
            currentFiles.push(uploadedItem);
          } else {
            currentFiles = [uploadedItem];
          }
        } else {
          setFieldUploadErrors(prev => ({
            ...prev,
            [field.id]: `Upload failed: ${data.message || 'Server error'}`
          }));
          setUploadingFieldId(null);
          return;
        }
      } catch (err: any) {
        console.error('Dynamic field file upload fail:', err);
        setFieldUploadErrors(prev => ({
          ...prev,
          [field.id]: `Upload error: ${err.message || 'Check connection'}`
        }));
        setUploadingFieldId(null);
        return;
      }
    }

    handleDynamicChange(field.id, currentFiles);
    setUploadingFieldId(null);
  };

  // Generate Auto-prefixed Employee ID based on logged in user's scope
  const generateEmployeeId = () => {
    let prefix = 'TP';
    let padding = 5;

    if (currentUser?.scopeType === 'HOD') {
      prefix = 'DTP';
      padding = 4;
    } else if (currentUser?.scopeType === 'Zone') {
      prefix = 'ADTP';
      padding = 3;
    } else {
      prefix = 'TP';
      padding = 5;
    }

    const matching = employees.filter((e: any) => e.employeeId && e.employeeId.startsWith(prefix));
    let maxSeq = 0;
    matching.forEach((e: any) => {
      const numPart = e.employeeId.slice(prefix.length);
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    });

    const nextSeq = maxSeq + 1;
    return `${prefix}${String(nextSeq).padStart(padding, '0')}`;
  };

  // Government Fundamental Rules (FR 56): Superannuation / Retirement on attaining 60 years.
  // Rule:
  // - If DOB is 1st of the month: Retires on the last day of the PREVIOUS month (e.g., 01.10.1991 -> 30.09.2051)
  // - If DOB is 2nd onwards: Retires on the last day of the SAME month (e.g., 20.05.1991 -> 31.05.2051)
  const calculateGovernmentRetirementDate = (dobValue: string): string => {
    if (!dobValue) return '';
    const parts = dobValue.split('-');
    if (parts.length !== 3) return '';
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10); // 1-12
    const d = parseInt(parts[2], 10); // 1-31
    if (isNaN(y) || isNaN(m) || isNaN(d)) return '';

    let retDate: Date;
    if (d === 1) {
      // Last day of previous month in the 60th year
      // Day 0 of month (m - 1) gives the last day of the previous month
      retDate = new Date(y + 60, m - 1, 0);
    } else {
      // Last day of the same month in the 60th year
      // Day 0 of month m gives the last day of month m
      retDate = new Date(y + 60, m, 0);
    }

    const retYear = retDate.getFullYear();
    const retMonth = String(retDate.getMonth() + 1).padStart(2, '0');
    const retDay = String(retDate.getDate()).padStart(2, '0');
    return `${retYear}-${retMonth}-${retDay}`;
  };

  const handleDobChange = (value: string) => {
    setDob(value);
    if (value) {
      const calculatedRetirement = calculateGovernmentRetirementDate(value);
      setRetirementDate(calculatedRetirement);
    } else {
      setRetirementDate('');
    }
  };

  // Save/Create Employee
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameEn || !nameTa || !selectedTP || !selectedPost) {
      alert(lang === 'ta' ? 'அனைத்து தேவையான புலங்களையும் நிரப்பவும்!' : 'Please fill all required fields!');
      return;
    }

    // 1. DOB 18+ validation from today
    if (dob) {
      const selectedDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - selectedDate.getFullYear();
      const m = today.getMonth() - selectedDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < selectedDate.getDate())) {
        age--;
      }
      if (age < 18) {
        alert(lang === 'ta' ? 'ஊழியர் குறைந்தபட்சம் 18 வயது பூர்த்தி அடைந்திருக்க வேண்டும்!' : 'Employee must be at least 18 years of age!');
        return;
      }
    } else {
      alert(lang === 'ta' ? 'பிறந்த தேதியை தேர்ந்தெடுக்கவும்!' : 'Please select Date of Birth!');
      return;
    }

    // 2. Aadhar No validation (must be exactly 12 digits, numbers only)
    const rawAadhar = aadharNo.replace(/\D/g, '');
    if (rawAadhar.length !== 12 || aadharNo !== rawAadhar) {
      alert(lang === 'ta' ? 'ஆதார் எண் சரியாக 12 இலக்க எண்களை மட்டுமே கொண்டிருக்க வேண்டும்!' : 'Aadhar number must be exactly 12 numeric digits!');
      return;
    }

    const matchedPost = posts.find((p: any) => p.id === selectedPost);
    const tp = townPanchayats.find((t: any) => t.id === selectedTP);

    // 3. Sanctioned post limit check
    const targetOfficeForSanctions = officeCategories.find((oc: any) => oc.targetId === selectedTP)
      || officeCategories.find((oc: any) => oc.id === 'tp' || oc.type === 'TP');

    const maxSanctions = targetOfficeForSanctions?.sanctions?.[selectedPost] !== undefined
      ? Number(targetOfficeForSanctions.sanctions[selectedPost])
      : 0;

    const currentEmployeesInPost = employees.filter((emp: any) => 
      emp.townPanchayatId === selectedTP && 
      emp.postId === selectedPost && 
      emp.status !== 'Retired' &&
      emp.id !== isEditing
    );

    if (currentEmployeesInPost.length >= maxSanctions) {
      const postName = matchedPost ? (lang === 'ta' ? matchedPost.nameTa : matchedPost.nameEn) : selectedPost;
      const tpName = tp ? (lang === 'ta' ? tp.nameTa : tp.nameEn) : selectedTP;
      alert(
        lang === 'ta' 
          ? `மன்னிக்கவும்! ${tpName}-ல் "${postName}" பணியிடங்களுக்கான அனுமதிக்கப்பட்ட எண்ணிக்கை (${maxSanctions}) ஏற்கனவே பூர்த்தியாகிவிட்டது!` 
          : `Sorry! The sanctioned limit of ${maxSanctions} for "${postName}" in "${tpName}" has already been reached!`
      );
      return;
    }

    const isNew = !isEditing;
    const finalEmpId = isNew ? generateEmployeeId() : empId;

    const dist = districts.find((d: any) => d.id === tp?.districtId);
    const zone = zones.find((z: any) => z.id === dist?.zoneId);

    const userIdentifier = currentUser?.username || currentUser?.id || currentUser?.employeeId || 'dtpadmin';
    const oldEmp = isNew ? null : employees.find((x: any) => x.id === isEditing);
    const createdBy = isNew ? userIdentifier : (oldEmp?.createdBy || userIdentifier);

    const empObj = {
      id: isEditing || 'emp_' + Math.random().toString(36).substr(2, 4),
      employeeId: finalEmpId,
      createdBy,
      nameEn,
      nameTa,
      username: finalEmpId,
      passwordHash: 'pass_' + finalEmpId.toLowerCase(), // Default password based on Employee ID
      zoneId: zone?.id || '',
      districtId: dist?.id || '',
      townPanchayatId: selectedTP,
      officeCategoryType: 'TP', // Town Panchayat standard
      roleId: 'eo', // Employees map to local officers standard
      postId: selectedPost,
      groupId: matchedPost?.groupId || selectedGroup || 'C',
      categoryId: matchedPost?.categoryId || selectedCategory || 'general',
      postNatureId: matchedPost?.postNatureId || selectedNature || 'temporary',
      payLevelId: matchedPost?.payLevelId || selectedPayLevel || 'level-1',
      status: empStatus,
      profileImage,
      documents,
      dynamicData,
      dob,
      retirementDate: retirementDate || (dob ? calculateGovernmentRetirementDate(dob) : ''),
      gender,
      aadharNo,
      community
    };

    const actionLabel = isNew ? 'Profile Created' : 'Profile Updated';
    const operatorName = currentUser ? `${currentUser.nameEn || currentUser.username} (${currentUser.roleNameEn || 'User'})` : 'System';

    let detailsText = isNew 
      ? `Created new employee profile: ${nameEn} (${finalEmpId})` 
      : `Updated employee profile for ${nameEn} (${finalEmpId})`;

    if (!isNew) {
      const oldEmp = employees.find((x: any) => x.id === isEditing);
      if (oldEmp) {
        const changes: string[] = [];
        if (oldEmp.nameEn !== nameEn) changes.push(`Name changed from "${oldEmp.nameEn}" to "${nameEn}"`);
        if (oldEmp.postId !== selectedPost) {
          const oldPostObj = posts.find((p: any) => p.id === oldEmp.postId);
          const newPostObj = posts.find((p: any) => p.id === selectedPost);
          changes.push(`Designation changed from "${oldPostObj?.nameEn || oldEmp.postId}" to "${newPostObj?.nameEn || selectedPost}"`);
        }
        if (oldEmp.status !== empStatus) changes.push(`Status changed from "${oldEmp.status}" to "${empStatus}"`);
        if (oldEmp.townPanchayatId !== selectedTP) {
          const oldTpObj = townPanchayats.find((t: any) => t.id === oldEmp.townPanchayatId);
          const newTpObj = townPanchayats.find((t: any) => t.id === selectedTP);
          changes.push(`Town Panchayat changed from "${oldTpObj?.nameEn || oldEmp.townPanchayatId}" to "${newTpObj?.nameEn || selectedTP}"`);
        }
        if (oldEmp.documents?.length !== documents.length) {
          changes.push(`Documents count updated to ${documents.length}`);
        }
        if (changes.length > 0) {
          detailsText = `Updated employee profile for ${nameEn} (${finalEmpId}): ` + changes.join(', ');
        }
      }
    }

    await onSaveEmployee(empObj);

    await onLogActivity({
      employeeId: finalEmpId,
      employeeName: nameEn,
      changedBy: operatorName,
      action: actionLabel,
      details: detailsText
    });

    if (isNew) {
      setShowCredentialsModal({
        employeeId: finalEmpId,
        nameEn,
        nameTa,
        username: finalEmpId,
        password: 'pass_' + finalEmpId.toLowerCase()
      });
    }

    setIsEditing(null);
    setActiveTab('list');
    resetForm();
  };

  const resetForm = () => {
    setEmpId('');
    setNameEn('');
    setNameTa('');
    setSelectedTP((currentUser?.scopeType !== 'HOD' && currentUser?.scopeType !== 'Zone') ? currentUser?.scopeId || '' : '');
    setSelectedPost('');
    setSelectedGroup('');
    setSelectedCategory('');
    setSelectedNature('');
    setSelectedPayLevel('');
    setEmpStatus('Active');
    setProfileImage('');
    setDocuments([]);
    setDynamicData({});
    setDob('');
    setRetirementDate('');
    setGender('Male');
    setAadharNo('');
    setCommunity('oc');
    setShowUploadBlock(false);
  };

  const handleEditClick = (emp: any) => {
    setIsEditing(emp.id);
    setEmpId(emp.employeeId);
    setNameEn(emp.nameEn);
    setNameTa(emp.nameTa);
    setSelectedTP(emp.townPanchayatId);
    setSelectedPost(emp.postId);
    setSelectedGroup(emp.groupId);
    setSelectedCategory(emp.categoryId);
    setSelectedNature(emp.postNatureId);
    setSelectedPayLevel(emp.payLevelId);
    setEmpStatus(emp.status);
    setProfileImage(emp.profileImage || '');
    setDocuments(emp.documents || []);
    setDynamicData(emp.dynamicData || {});
    setDob(emp.dob || '');
    setRetirementDate(emp.retirementDate || (emp.dob ? calculateGovernmentRetirementDate(emp.dob) : ''));
    setGender(emp.gender || 'Male');
    setAadharNo(emp.aadharNo || '');
    setCommunity(emp.community || 'oc');
    setShowUploadBlock(false);
    setActiveTab('create');
  };

  // File uploading integration
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !empId) return;

    setUploadingDoc(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('employeeId', empId);
    formData.append('officeCategoryType', 'TP');
    formData.append('townPanchayatId', selectedTP);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        const newDoc = {
          name: docName || data.fileName,
          url: data.url,
          category: docCategory
        };
        setDocuments(prev => [...prev, newDoc]);
        setDocName('');
      }
    } catch (err) {
      console.error('Upload fail:', err);
    } finally {
      setUploadingDoc(false);
    }
  };

  // Lodge Transfer Request
  const handleLodgeTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTP || !reasonEn || !reasonTa) return;

    const reqObj = {
      id: 'tr_' + Math.random().toString(36).substr(2, 4),
      employeeId: currentUser.username, // Employee ID is their username
      currentTPId: currentUser.scopeId, // current Town Panchayat they are logged into
      requestedTPId: transferTP,
      reasonEn,
      reasonTa,
      status: 'Pending' as 'Pending' | 'Approved' | 'Rejected',
      createdAt: new Date().toISOString()
    };

    await onSaveTransferRequest(reqObj);

    // Log transfer request lodge
    const empObj = employees.find((x: any) => x.employeeId === currentUser.username);
    const destTP = townPanchayats.find((t: any) => t.id === transferTP);
    const srcTP = townPanchayats.find((t: any) => t.id === currentUser.scopeId);
    const operatorName = currentUser ? `${currentUser.nameEn || currentUser.username} (Employee)` : 'System';

    await onLogActivity({
      employeeId: currentUser.username,
      employeeName: empObj?.nameEn || currentUser.nameEn || 'Employee',
      changedBy: operatorName,
      action: 'Transfer Lodged',
      details: `Submitted a transfer request from ${srcTP?.nameEn || currentUser.scopeId} to ${destTP?.nameEn || transferTP}`
    });

    setTransferTP('');
    setReasonEn('');
    setReasonTa('');
  };

  // Review transfer request
  const handleReviewTransfer = async (req: any, newStatus: 'Approved' | 'Rejected') => {
    const updatedReq = { ...req, status: newStatus };
    await onSaveTransferRequest(updatedReq);

    const empObj = employees.find((x: any) => x.employeeId === req.employeeId);
    const destTP = townPanchayats.find((t: any) => t.id === req.requestedTPId);
    const srcTP = townPanchayats.find((t: any) => t.id === req.currentTPId);
    const operatorName = currentUser ? `${currentUser.nameEn || currentUser.username} (${currentUser.roleNameEn || 'User'})` : 'System';

    // If approved, dynamically update the employee's Town Panchayat mapping!
    if (newStatus === 'Approved') {
      if (empObj) {
        const destDist = districts.find((d: any) => d.id === destTP?.districtId);
        const destZone = zones.find((z: any) => z.id === destDist?.zoneId);

        const updatedEmp = {
          ...empObj,
          townPanchayatId: req.requestedTPId,
          districtId: destDist?.id || empObj.districtId,
          zoneId: destZone?.id || empObj.zoneId
        };
        await onSaveEmployee(updatedEmp);
      }
    }

    // Log the review action
    await onLogActivity({
      employeeId: req.employeeId,
      employeeName: empObj?.nameEn || 'Employee',
      changedBy: operatorName,
      action: `Transfer ${newStatus}`,
      details: `${newStatus} transfer request from ${srcTP?.nameEn || req.currentTPId} to ${destTP?.nameEn || req.requestedTPId}`
    });
  };

  // Dedicated Read-Only View for Employee Users
  // Requirement: Employee users can ONLY view their own logged-in employee details in Employee Management tab.
  // View only enough. No need to edit, no need to view other employee details.
  if (currentUser?.isEmployee) {
    const loggedInEmpId = currentUser?.employeeId || currentUser?.username || currentUser?.id;
    const emp = employees.find((e: any) => 
      e.employeeId === loggedInEmpId || 
      e.id === loggedInEmpId || 
      e.id === currentUser?.id || 
      e.employeeId === currentUser?.username
    );

    const pst = emp ? posts.find((p: any) => p.id === emp.postId) : null;
    const tp = emp ? townPanchayats.find((t: any) => t.id === emp.townPanchayatId) : null;
    const dist = tp ? districts.find((d: any) => d.id === tp.districtId) : (emp?.districtId ? districts.find((d: any) => d.id === emp.districtId) : null);
    const zn = dist ? zones.find((z: any) => z.id === dist.zoneId) : (emp?.zoneId ? zones.find((z: any) => z.id === emp.zoneId) : null);
    const cat = emp ? employeeCategories.find((c: any) => c.id === emp.categoryId) : null;
    const nature = emp ? postNatures.find((n: any) => n.id === emp.postNatureId) : null;
    const pay = emp ? payLevels.find((l: any) => l.id === emp.payLevelId) : null;
    const applicableFields = emp ? getApplicableFields(emp.postId) : [];

    return (
      <div id="employee-management-container" className="portal-studio">
        <div className="portal-fis-hero">
          <div className="relative z-[1] flex min-w-0 items-center gap-2.5">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/20 overflow-hidden">
              {emp?.profileImage ? (
                <img src={emp.profileImage} alt={emp.nameEn} className="h-full w-full object-cover" />
              ) : (
                <User className="h-3.5 w-3.5" />
              )}
            </span>
            <div className="min-w-0 leading-tight">
              <h3 className="text-[14px] font-semibold tracking-tight text-white">
                {emp ? (lang === 'ta' ? (emp.nameTa || emp.nameEn) : emp.nameEn) : (currentUser.nameEn || currentUser.username)}
              </h3>
              <p className="text-[10px] text-white/70">
                {emp?.employeeId || currentUser.employeeId || currentUser.username}
                {' • '}
                {tp ? tObj(tp) : (lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat')}
                {' • '}
                {pst ? tObj(pst) : (lang === 'ta' ? 'ஊழியர்' : 'Employee')}
                {' • '}
                {emp?.status === 'Active' ? (lang === 'ta' ? 'செயலில்' : 'Active') : (lang === 'ta' ? 'செயலற்றவர்' : 'Inactive')}
              </p>
            </div>
          </div>
          <div className="relative z-[1] flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white">
              <ShieldCheck className="h-3 w-3" />
              {lang === 'ta' ? 'பார்வையாளர் முறை' : 'Personal View Only'}
            </span>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/15 cursor-pointer"
            >
              <Printer className="h-3 w-3" />
              {lang === 'ta' ? 'அச்சிடு' : 'Print'}
            </button>
          </div>
        </div>

        <div className="portal-fis-body portal-page">
        {emp ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="space-y-3">
              <div className="portal-dashboard-panel">
                <div className="portal-dash-head">
                  <div>
                    <h3>
                      <span className="portal-dash-icon">
                        <User className="h-3 w-3" />
                      </span>
                      {lang === 'ta' ? '1. பணியாளர் தனிப்பட்ட விவரங்கள்' : '1. Personal Identification Details'}
                    </h3>
                  </div>
                </div>
                <div className="portal-dash-body portal-wt-form">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label>{lang === 'ta' ? 'ஊழியர் பெயர் (ஆங்கிலம்)' : 'Full Name (English)'}</label>
                      <p>{emp.nameEn || '--'}</p>
                    </div>
                    <div>
                      <label>{lang === 'ta' ? 'ஊழியர் பெயர் (தமிழ்)' : 'Full Name (Tamil)'}</label>
                      <p>{emp.nameTa || '--'}</p>
                    </div>
                    <div>
                      <label>{lang === 'ta' ? 'ஊழியர் அடையாள எண்' : 'Employee ID'}</label>
                      <p className="font-mono">{emp.employeeId}</p>
                    </div>
                    <div>
                      <label>{lang === 'ta' ? 'பாலினம்' : 'Gender'}</label>
                      <p>{emp.gender || 'Not Specified'}</p>
                    </div>
                    <div>
                      <label>{lang === 'ta' ? 'பிறந்த தேதி' : 'Date of Birth (DOB)'}</label>
                      <p>{emp.dob || 'Not Recorded'}</p>
                    </div>
                    <div>
                      <label>{lang === 'ta' ? 'பணி ஓய்வு பெறும் நாள்' : 'Superannuation / Retirement Date'}</label>
                      <p>{emp.retirementDate || 'Not Recorded'}</p>
                    </div>
                    <div>
                      <label>{lang === 'ta' ? 'ஆதார் எண்' : 'Aadhaar Number'}</label>
                      <p className="font-mono">{emp.aadharNo ? `•••• •••• ${emp.aadharNo.slice(-4)}` : 'Not Linked'}</p>
                    </div>
                    <div>
                      <label>{lang === 'ta' ? 'சமூகம் / வகுப்பு' : 'Community'}</label>
                      <p className="uppercase">{emp.community || 'OC'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="portal-dashboard-panel">
                <div className="portal-dash-head">
                  <div>
                    <h3>
                      <span className="portal-dash-icon">
                        <Building2 className="h-3 w-3" />
                      </span>
                      {lang === 'ta' ? '2. அலுவலகம் மற்றும் நிர்வாக வரம்பு' : '2. Office & Jurisdiction'}
                    </h3>
                  </div>
                </div>
                <div className="portal-dash-body portal-wt-form">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label>{lang === 'ta' ? 'தற்போதைய பேரூராட்சி' : 'Town Panchayat'}</label>
                      <p>{tp ? tObj(tp) : emp.townPanchayatId}</p>
                    </div>
                    <div>
                      <label>{lang === 'ta' ? 'மாவட்டம்' : 'District'}</label>
                      <p>{dist ? tObj(dist) : '--'}</p>
                    </div>
                    <div>
                      <label>{lang === 'ta' ? 'மண்டலம்' : 'Zone'}</label>
                      <p>{zn ? tObj(zn) : '--'}</p>
                    </div>
                    <div>
                      <label>{lang === 'ta' ? 'அலுவலக வகை' : 'Office Category'}</label>
                      <p>Town Panchayat (பேரூராட்சி)</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="portal-dashboard-panel">
                <div className="portal-dash-head">
                  <div>
                    <h3>
                      <span className="portal-dash-icon">
                        <Briefcase className="h-3 w-3" />
                      </span>
                      {lang === 'ta' ? '3. பதவி மற்றும் ஊதியக் குழு விவரங்கள்' : '3. Cadre & Compensation Details'}
                    </h3>
                  </div>
                </div>
                <div className="portal-dash-body portal-wt-form">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label>{lang === 'ta' ? 'பதவி / பதவிப் பெயர்' : 'Designation / Post'}</label>
                      <p>{pst ? tObj(pst) : emp.postId}</p>
                    </div>
                    <div>
                      <label>{lang === 'ta' ? 'பணியாளர் பிரிவு (Group)' : 'Cadre Group'}</label>
                      <p>{emp.groupId || 'Group C'}</p>
                    </div>
                    <div>
                      <label>{lang === 'ta' ? 'பிரிவு வகை' : 'Category'}</label>
                      <p>{cat ? tObj(cat) : emp.categoryId || '--'}</p>
                    </div>
                    <div>
                      <label>{lang === 'ta' ? 'பதவியின் தன்மை' : 'Nature of Post'}</label>
                      <p>{nature ? tObj(nature) : emp.postNatureId || 'Permanent'}</p>
                    </div>
                    <div>
                      <label>{lang === 'ta' ? 'ஊதிய நிலை (Pay Level)' : 'Pay Level / Scale'}</label>
                      <p>{pay ? tObj(pay) : emp.payLevelId || '--'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {emp.documents && emp.documents.length > 0 && (
                <div className="portal-dashboard-panel">
                  <div className="portal-dash-head">
                    <div>
                      <h3>
                        <span className="portal-dash-icon">
                          <FileText className="h-3 w-3" />
                        </span>
                        {lang === 'ta' ? '4. சேவை ஆவணங்கள் மற்றும் சான்றிதழ்கள்' : '4. Official Documents on Record'}
                      </h3>
                    </div>
                  </div>
                  <div className="portal-dash-body portal-wt-form">
                    <div className="space-y-2">
                      {emp.documents.map((doc: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{doc.name || `Document ${idx + 1}`}</p>
                            <p className="text-[10px] text-slate-500">{doc.category || 'Service Record'}</p>
                          </div>
                          {doc.url && (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="portal-wt-link inline-flex items-center gap-1 shrink-0"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              {lang === 'ta' ? 'காண்க' : 'View'}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {applicableFields.length > 0 && emp.dynamicData && Object.keys(emp.dynamicData).length > 0 && (
                <div className="portal-dashboard-panel">
                  <div className="portal-dash-head">
                    <div>
                      <h3>
                        <span className="portal-dash-icon">
                          <Database className="h-3 w-3" />
                        </span>
                        {lang === 'ta' ? '5. கூடுதல் சேவைப் பதிவுகள்' : '5. Additional Service Attributes'}
                      </h3>
                    </div>
                  </div>
                  <div className="portal-dash-body portal-wt-form">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {applicableFields.map((f: any) => {
                        const val = emp.dynamicData?.[f.id];
                        if (val === undefined || val === null || val === '') return null;
                        return (
                          <div key={f.id}>
                            <label>{lang === 'ta' ? (f.nameTa || f.nameEn) : f.nameEn}</label>
                            <p>
                              {Array.isArray(val) ? val.length + ' item(s)' : typeof val === 'object' ? JSON.stringify(val) : String(val)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="portal-dashboard-panel">
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <User className="h-3 w-3" />
                  </span>
                  {lang === 'ta' ? 'ஊழியர் விவரங்கள் பதிவு செய்யப்படவில்லை' : 'Employee Profile Not Found'}
                </h3>
                <p>
                  {lang === 'ta'
                    ? 'உங்கள் ஊழியர் அடையாள எண் அமைப்பில் உள்ளீடு செய்யப்பட்டுள்ளதா என்பதை செயல் அலுவலரிடம் உறுதி செய்யவும்.'
                    : `No employee record was found matching ID "${loggedInEmpId}". Please check with your Executive Officer.`}
                </p>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    );
  }

  return (
    <div id="employee-management-container" className="portal-studio">
      <div className="portal-fis-hero">
        <div className="relative z-[1] flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/20">
            <Users className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 leading-tight">
            <h3 className="text-[14px] font-semibold tracking-tight text-white">
              {t('employeeManagement')}
            </h3>
            <p className="text-[10px] text-white/70">
              {lang === 'ta'
                ? 'ஊழியர் பதிவுகள், பதவிகள் மற்றும் உள்நுழைவு விவரங்களை நிர்வகிக்கவும்.'
                : 'Manage personnel records, designations, and portal credentials.'}
            </p>
          </div>
        </div>
      </div>

      <div className="portal-fis-body portal-page">
      <div className="portal-dash-toolbar">
        <div className="portal-dash-pills">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`portal-dash-pill ${activeTab === 'list' ? 'is-active' : ''}`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>{t('employeeDetails')}</span>
            <span className="portal-fis-count">{visibleEmployees.length}</span>
          </button>
          {!currentUser.isEmployee && (
            <button
              type="button"
              onClick={() => { setActiveTab('create'); if (!isEditing) resetForm(); }}
              className={`portal-dash-pill ${activeTab === 'create' ? 'is-active' : ''}`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>{isEditing ? t('edit') : t('createEmployeeAccount')}</span>
            </button>
          )}
          {!isTPUser && !isZoneUser && (
            <button
              type="button"
              onClick={() => setActiveTab('activityLogs')}
              className={`portal-dash-pill ${activeTab === 'activityLogs' ? 'is-active' : ''}`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>{t('activityLogsTab')}</span>
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('deletedEmployees')}
              className={`portal-dash-pill ${activeTab === 'deletedEmployees' ? 'is-active' : ''}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{lang === 'ta' ? 'நீக்கப்பட்ட ஊழியர்கள்' : 'Deleted Employees'}</span>
            </button>
          )}
        </div>
      </div>

      {activeTab === 'list' && (
        <div className="portal-dashboard-panel">
          <div className="portal-dash-head">
            <div>
              <h3>
                <span className="portal-dash-icon">
                  <Users className="h-3 w-3" />
                </span>
                {t('employeeDetails')}
              </h3>
              <p>
                {lang === 'ta' ? 'ஊழியர் உள்நுழைவுத் தகவல்கள் மற்றும் பணி விவரங்கள்' : 'Employee credentials & jurisdictional personnel roster'}
              </p>
            </div>
            {(filterZoneId || filterDistrictId || filterTPId || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setFilterZoneId('');
                  setFilterDistrictId('');
                  setFilterTPId('');
                  setSearchQuery('');
                }}
                className="portal-dash-head-action"
              >
                {lang === 'ta' ? 'வடிப்பானை நீக்கு' : 'Reset'}
              </button>
            )}
          </div>
          <div className="portal-dash-body">
            <div
              className="portal-dash-fields"
              style={{
                gridTemplateColumns: isDtpUser || isZoneUser
                  ? 'repeat(4, minmax(0, 1fr))'
                  : 'minmax(0, 1.1fr) minmax(0, 1.6fr)'
              }}
            >
              {isDtpUser && (
                <>
                  <div>
                    <label>{t('zone')}</label>
                    <ThemeSelect
                      value={filterZoneId}
                      onChange={(e) => {
                        setFilterZoneId(e.target.value);
                        setFilterDistrictId('');
                        setFilterTPId('');
                      }}
                    >
                      <option value="">-- {lang === 'ta' ? 'அனைத்து மண்டலங்கள்' : 'All Zones'} --</option>
                      {zones.map((z: any) => (
                        <option key={z.id} value={z.id}>{tObj(z)}</option>
                      ))}
                    </ThemeSelect>
                  </div>
                  <div>
                    <label>{t('district')}</label>
                    <ThemeSelect
                      value={filterDistrictId}
                      onChange={(e) => {
                        setFilterDistrictId(e.target.value);
                        setFilterTPId('');
                      }}
                    >
                      <option value="">-- {lang === 'ta' ? 'அனைத்து மாவட்டங்கள்' : 'All Districts'} --</option>
                      {(filterZoneId
                        ? districts.filter((d: any) => d.zoneId === filterZoneId)
                        : districts
                      ).map((d: any) => (
                        <option key={d.id} value={d.id}>{tObj(d)}</option>
                      ))}
                    </ThemeSelect>
                  </div>
                  <div>
                    <label>{t('townPanchayat')}</label>
                    <ThemeSelect
                      value={filterTPId}
                      onChange={(e) => setFilterTPId(e.target.value)}
                    >
                      <option value="">-- {lang === 'ta' ? 'அனைத்து பேரூராட்சிகள்' : 'All Town Panchayats'} --</option>
                      {(() => {
                        if (filterDistrictId) {
                          return townPanchayats.filter((tp: any) => tp.districtId === filterDistrictId);
                        }
                        if (filterZoneId) {
                          const zDistIds = districts.filter((d: any) => d.zoneId === filterZoneId).map((d: any) => d.id);
                          return townPanchayats.filter((tp: any) => zDistIds.includes(tp.districtId));
                        }
                        return townPanchayats;
                      })().map((tp: any) => (
                        <option key={tp.id} value={tp.id}>{tObj(tp)}</option>
                      ))}
                    </ThemeSelect>
                  </div>
                </>
              )}

              {isZoneUser && (
                <>
                  <div>
                    <label>{t('zone')}</label>
                    <ThemeSelect value={currentUser.scopeId} disabled>
                      <option value={currentUser.scopeId}>
                        {(() => {
                          const myZone = zones.find((z: any) => z.id === currentUser.scopeId);
                          return myZone ? tObj(myZone) : currentUser.scopeId;
                        })()}
                      </option>
                    </ThemeSelect>
                  </div>
                  <div>
                    <label>{t('district')}</label>
                    <ThemeSelect
                      value={filterDistrictId}
                      onChange={(e) => {
                        setFilterDistrictId(e.target.value);
                        setFilterTPId('');
                      }}
                    >
                      <option value="">-- {lang === 'ta' ? 'மண்டலத்தின் அனைத்து மாவட்டங்கள்' : 'All Districts in Zone'} --</option>
                      {districts.filter((d: any) => d.zoneId === currentUser.scopeId).map((d: any) => (
                        <option key={d.id} value={d.id}>{tObj(d)}</option>
                      ))}
                    </ThemeSelect>
                  </div>
                  <div>
                    <label>{t('townPanchayat')}</label>
                    <ThemeSelect
                      value={filterTPId}
                      onChange={(e) => setFilterTPId(e.target.value)}
                    >
                      <option value="">-- {lang === 'ta' ? 'அனைத்து பேரூராட்சிகள்' : 'All Town Panchayats'} --</option>
                      {(() => {
                        const zDistIds = districts.filter((d: any) => d.zoneId === currentUser.scopeId).map((d: any) => d.id);
                        if (filterDistrictId) {
                          return townPanchayats.filter((tp: any) => tp.districtId === filterDistrictId);
                        }
                        return townPanchayats.filter((tp: any) => zDistIds.includes(tp.districtId));
                      })().map((tp: any) => (
                        <option key={tp.id} value={tp.id}>{tObj(tp)}</option>
                      ))}
                    </ThemeSelect>
                  </div>
                </>
              )}

              {isTPUser && (
                <div>
                  <label>{lang === 'ta' ? 'பேரூராட்சி அலுவலகம்' : 'Town Panchayat'}</label>
                  <ThemeSelect value={currentUser?.scopeId || selectedTP} disabled>
                    <option value={currentUser?.scopeId || selectedTP}>
                      {(() => {
                        const myTp = townPanchayats.find((tp: any) => tp.id === (currentUser?.scopeId || selectedTP));
                        return myTp ? tObj(myTp) : (currentUser?.scopeId || selectedTP);
                      })()}
                    </option>
                  </ThemeSelect>
                </div>
              )}
              <div>
                <label>{lang === 'ta' ? 'தேடல்' : 'Search'}</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={lang === 'ta' ? 'பெயர் / பதவி / ஐடி தேட...' : 'Search name, post, ID...'}
                />
              </div>
            </div>

            <div className="portal-dash-table is-center overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>{lang === 'ta' ? 'ஊழியர் பெயர்' : 'Employee Name'}</th>
                    <th>{lang === 'ta' ? 'பதவி' : 'Designation'}</th>
                    <th>{lang === 'ta' ? 'பயனர் ஐடி (User ID)' : 'User ID'}</th>
                    <th>{lang === 'ta' ? 'கடவுச்சொல் (Password)' : 'Password'}</th>
                    <th>{t('townPanchayat')}</th>
                    <th>{t('status')}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-400 italic">
                        {lang === 'ta' ? 'ஊழியர் பதிவுகள் எதுவும் காணப்படவில்லை.' : 'No employee records found matching criteria.'}
                      </td>
                    </tr>
                  ) : (
                    visibleEmployees.map((emp: any) => {
                      const pst = posts.find((p: any) => p.id === emp.postId);
                      const tp = townPanchayats.find((t: any) => t.id === emp.townPanchayatId);
                      const cat = employeeCategories.find((c: any) => c.id === emp.categoryId);
                      const empPwd = emp.password || emp.passwordHash || ('pass_' + (emp.employeeId || '').toLowerCase());
                      const isPwdVisible = !!visiblePasswords[emp.id];

                      return (
                        <tr key={emp.id}>
                          <td>
                            <div className="portal-user-identity">
                              <strong>{tObj(emp)}</strong>
                              <span className="portal-dash-id">ID: {emp.employeeId}</span>
                              <div className="portal-wt-chips">
                                {emp.community && <span className="portal-wt-chip">{String(emp.community).toUpperCase()}</span>}
                                {emp.dob && <span className="portal-wt-chip">DOB {emp.dob}</span>}
                                {emp.retirementDate && <span className="portal-wt-chip">Retires {emp.retirementDate}</span>}
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="portal-user-identity">
                              <strong>{pst ? tObj(pst) : emp.postId}</strong>
                              <div className="portal-wt-chips">
                                <span className="portal-wt-chip">Grp {emp.groupId || 'C'}</span>
                                <span className="portal-wt-chip">{cat ? tObj(cat) : (emp.categoryId || 'General')}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="portal-dash-id select-all">{emp.username || emp.employeeId}</span>
                          </td>
                          <td>
                            <div className="flex items-center gap-1">
                              <span className="portal-dash-id select-all">{isPwdVisible ? empPwd : '••••••••'}</span>
                              <button
                                type="button"
                                onClick={() => setVisiblePasswords(prev => ({ ...prev, [emp.id]: !prev[emp.id] }))}
                                className="portal-fis-icon-btn"
                                title={isPwdVisible ? (lang === 'ta' ? 'கடவுச்சொல்லை மறை' : 'Hide password') : (lang === 'ta' ? 'கடவுச்சொல்லைக் காட்டு' : 'Show password')}
                              >
                                {isPwdVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    `Employee: ${emp.nameEn}\n` +
                                    `User ID: ${emp.username || emp.employeeId}\n` +
                                    `Password: ${empPwd}`
                                  );
                                  setCopiedId(emp.id);
                                  setTimeout(() => setCopiedId(null), 2000);
                                }}
                                className="portal-fis-icon-btn"
                                title={lang === 'ta' ? 'பயனர் ஐடி & கடவுச்சொல் நகலெடு' : 'Copy Username & Password'}
                              >
                                {copiedId === emp.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              </button>
                            </div>
                          </td>
                          <td>
                            <div className="portal-user-identity">
                              <strong>{tp ? tObj(tp) : emp.townPanchayatId}</strong>
                              <span className="portal-wt-meta">
                                {(() => {
                                  const d = districts.find((dist: any) => dist.id === tp?.districtId || dist.id === emp.districtId);
                                  return d ? tObj(d) : '';
                                })()}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={`portal-dash-status ${emp.status === 'Active' ? 'is-resolved' : 'is-pending'}`}>
                              {emp.status === 'Active' ? t('activeStatus') : t('inactiveStatus')}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setShowCredentialsModal({
                                  employeeId: emp.employeeId,
                                  nameEn: emp.nameEn,
                                  nameTa: emp.nameTa,
                                  username: emp.username || emp.employeeId,
                                  password: empPwd
                                })}
                                className="portal-fis-icon-btn"
                                title={lang === 'ta' ? 'அனைத்து உள்நுழைவுத் தகவல்கள் அட்டை' : 'View Full Credentials Card'}
                              >
                                <Lock className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditClick(emp)}
                                className="portal-fis-icon-btn"
                                title={t('edit')}
                              >
                                <Edit3 className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (currentUser.scopeType !== 'HOD') {
                                    alert(t('deletePermissionWarning'));
                                  } else {
                                    onDeleteEmployee(emp.id);
                                  }
                                }}
                                className={`portal-fis-icon-btn is-danger${currentUser.scopeType === 'HOD' ? '' : ''}`}
                                disabled={currentUser.scopeType !== 'HOD'}
                                title={currentUser.scopeType === 'HOD' ? t('delete') : t('deletePermissionWarning')}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'create' && (
        <div className="portal-dashboard-panel">
          <div className="portal-dash-head">
            <div>
              <h3>
                <span className="portal-dash-icon">
                  <UserPlus className="h-3 w-3" />
                </span>
                {isEditing ? (lang === 'ta' ? 'ஊழியர் கோப்பினை திருத்து' : 'Edit Personnel Profile') : (lang === 'ta' ? 'புதிய ஊழியர் சுயவிவரம் உருவாக்கு' : 'Create New Personnel Profile')}
              </h3>
            </div>
            {isEditing && (
              <button
                type="button"
                onClick={() => { setActiveTab('list'); setIsEditing(null); resetForm(); }}
                className="portal-dash-head-action"
              >
                {t('cancel')}
              </button>
            )}
          </div>
          <div className="portal-dash-body portal-wt-form">
          <form onSubmit={handleSaveEmployee} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {isEditing && (
                <div>
                  <label>{lang === 'ta' ? 'ஊழியர் அடையாள எண் (Employee ID)' : 'Employee ID'}</label>
                  <input type="text" value={empId} readOnly disabled />
                </div>
              )}
              <div>
                <label>{t('townPanchayat')}</label>
                {currentUser?.scopeType === 'TP' || (currentUser?.scopeType !== 'HOD' && currentUser?.scopeType !== 'Zone') ? (
                  <ThemeSelect value={currentUser?.scopeId || selectedTP} disabled>
                    <option value={currentUser?.scopeId || selectedTP}>
                      {(() => {
                        const myTp = townPanchayats.find((tp: any) => tp.id === (currentUser?.scopeId || selectedTP));
                        return myTp ? tObj(myTp) : (currentUser?.scopeId || selectedTP);
                      })()}
                    </option>
                  </ThemeSelect>
                ) : (
                  <ThemeSelect
                    value={selectedTP}
                    onChange={(e) => setSelectedTP(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Town Panchayat --</option>
                    {(() => {
                      if (currentUser?.scopeType === 'HOD') {
                        return townPanchayats;
                      } else if (currentUser?.scopeType === 'Zone') {
                        const zoneDistricts = districts.filter((d: any) => d.zoneId === currentUser?.scopeId).map((d: any) => d.id);
                        return townPanchayats.filter((tp: any) => zoneDistricts.includes(tp.districtId));
                      }
                      return townPanchayats;
                    })().map((tp: any) => (
                      <option key={tp.id} value={tp.id}>{tObj(tp)}</option>
                    ))}
                  </ThemeSelect>
                )}
              </div>
              <div>
                <label>{t('post')}</label>
                <ThemeSelect
                  value={selectedPost}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedPost(val);
                    const matchedPost = posts.find((p: any) => p.id === val);
                    if (matchedPost) {
                      if (matchedPost.categoryId) setSelectedCategory(matchedPost.categoryId);
                      if (matchedPost.postNatureId) setSelectedNature(matchedPost.postNatureId);
                      if (matchedPost.payLevelId) setSelectedPayLevel(matchedPost.payLevelId);
                      if (matchedPost.groupId) setSelectedGroup(matchedPost.groupId);
                    }
                  }}
                  required
                >
                  <option value="">-- Choose Post --</option>
                  {(() => {
                    const targetOfficeForSanctions = officeCategories.find((oc: any) => oc.targetId === selectedTP)
                      || officeCategories.find((oc: any) => oc.id === 'tp' || oc.type === 'TP');
                    const filteredPosts = targetOfficeForSanctions?.sanctions
                      ? posts.filter((p: any) => Number(targetOfficeForSanctions.sanctions[p.id]) > 0)
                      : posts;
                    return filteredPosts.map((p: any) => (
                      <option key={p.id} value={p.id}>{tObj(p)}</option>
                    ));
                  })()}
                </ThemeSelect>
              </div>
              <div>
                <label>{t('empFullNameEn')}</label>
                <input
                  type="text"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>{t('empFullNameTa')}</label>
                <input
                  type="text"
                  value={nameTa}
                  onChange={(e) => setNameTa(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>{lang === 'ta' ? 'பிறந்த தேதி' : 'Date of Birth (DOB)'}</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => handleDobChange(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>{lang === 'ta' ? 'ஓய்வு பெறும் தேதி' : 'Date of Retirement'}</label>
                <input
                  type="date"
                  value={retirementDate}
                  readOnly
                  disabled
                  required
                />
                <p className="portal-switch-hint">
                  {lang === 'ta'
                    ? 'அரசு விதிமுறை: 60 வயது. 1-ஆம் தேதி பிறந்தவர்களுக்கு முந்தைய மாத இறுதி நாள்; மற்றவர்களுக்கு அதே மாத இறுதி நாள்.'
                    : 'Govt Rule: 60 Yrs. 1st of month birth retires previous month-end; other dates retire month-end.'}
                </p>
              </div>
              <div>
                <label>{lang === 'ta' ? 'பாலினம்' : 'Gender'}</label>
                <ThemeSelect
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  required
                >
                  <option value="Male">{lang === 'ta' ? 'ஆண்' : 'Male'}</option>
                  <option value="Female">{lang === 'ta' ? 'பெண்' : 'Female'}</option>
                  <option value="Transgender">{lang === 'ta' ? 'திருநங்கை / திருநம்பி' : 'Transgender'}</option>
                </ThemeSelect>
              </div>
              <div>
                <label>{lang === 'ta' ? 'ஆதார் எண்' : 'Aadhar No'}</label>
                <input
                  type="text"
                  maxLength={12}
                  placeholder="12 digit Aadhar No"
                  value={aadharNo}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setAadharNo(val);
                  }}
                  required
                />
              </div>
              <div>
                <label>{lang === 'ta' ? 'சமூகம் / வகுப்பு (Community)' : 'Community'}</label>
                <ThemeSelect
                  value={community}
                  onChange={(e) => setCommunity(e.target.value)}
                  required
                >
                  <option value="oc">OC</option>
                  <option value="bc">BC</option>
                  <option value="mbc">MBC</option>
                  <option value="sc">SC</option>
                  <option value="st">ST</option>
                </ThemeSelect>
              </div>
            </div>

            {(() => {
              const activeModulesWithFields = getApplicableModulesWithFields();
              if (activeModulesWithFields.length === 0) {
                return (
                  <p className="portal-wt-note">
                    {selectedPost
                      ? (lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்ட பதவிக்கு கூடுதல் தொகுதிகள் வரையறுக்கப்படவில்லை.' : 'No additional custom module fields configured for this designation.')
                      : (lang === 'ta' ? 'கூடுதல் தொகுதி புலங்களைக் காண (எ.கா. தகுதிகாண் பருவம் விவரங்கள் / Probation Details) பதவியைத் தேர்ந்தெடுக்கவும்.' : 'Please choose a designation / post above to view applicable module fields (e.g. Probation Details).')}
                  </p>
                );
              }

              return (
                <div className="portal-wt-tree">
                  {activeModulesWithFields.map((mod: any, modIdx: number) => {
                    const moduleOpen = Boolean(openEmpFormSections[mod.id]);
                    return (
                    <div
                      key={mod.id}
                      className={`portal-wt-node${moduleOpen ? ' is-open' : ''}`}
                      style={{ ['--wt-tone' as string]: EMP_MODULE_TONES[modIdx % EMP_MODULE_TONES.length] }}
                    >
                      <div className="portal-wt-node-head">
                        <button
                          type="button"
                          className="portal-wt-toggle"
                          onClick={() => setOpenEmpFormSections((prev) => ({ ...prev, [mod.id]: !prev[mod.id] }))}
                          aria-expanded={moduleOpen}
                        >
                          <ChevronRight className={`portal-wt-caret${moduleOpen ? ' is-open' : ''}`} />
                          <div className="portal-wt-copy">
                            <div className="portal-wt-title">
                              <span>{tObj(mod)}</span>
                              <span className="portal-wt-count">{mod.fields.length} {lang === 'ta' ? 'புலங்கள்' : 'fields'}</span>
                            </div>
                          </div>
                        </button>
                      </div>
                      {moduleOpen && (
                      <div className="portal-wt-fields">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {mod.fields.map((field: any) => {
                          const currentVal = dynamicData[field.id] || '';
                          return (
                            <div key={field.id}>
                              <label>
                                {tObj(field)}
                                {field.validations?.required && <span> *</span>}
                              </label>

                              {field.type === 'text' && (
                                <input
                                  type="text"
                                  value={currentVal}
                                  placeholder={lang === 'ta' ? `${tObj(field)} உள்ளிடவும்` : `Enter ${field.nameEn}`}
                                  onChange={(e) => handleDynamicChange(field.id, e.target.value)}
                                  required={field.validations?.required}
                                />
                              )}

                              {field.type === 'number' && (
                                <input
                                  type="number"
                                  min={field.validations?.min}
                                  max={field.validations?.max}
                                  value={currentVal}
                                  placeholder="0"
                                  onChange={(e) => handleDynamicChange(field.id, parseInt(e.target.value) || '')}
                                  required={field.validations?.required}
                                />
                              )}

                              {field.type === 'date' && (
                                <input
                                  type="date"
                                  value={currentVal}
                                  onChange={(e) => handleDynamicChange(field.id, e.target.value)}
                                  required={field.validations?.required}
                                />
                              )}

                              {field.type === 'select' && (
                                <ThemeSelect
                                  value={currentVal}
                                  onChange={(e) => handleDynamicChange(field.id, e.target.value)}
                                  required={field.validations?.required}
                                >
                                  <option value="">-- {lang === 'ta' ? 'தேர்வு செய்யவும்' : 'Choose Option'} --</option>
                                  {field.validations?.options?.map((opt: string, oIdx: number) => (
                                    <option key={oIdx} value={opt}>{opt}</option>
                                  ))}
                                </ThemeSelect>
                              )}

                              {field.type === 'file' && (
                                <div className="space-y-2">
                                  <p className="portal-wt-note">
                                    Formats: {field.validations?.allowedTypes || 'both'} • Max Size: {field.validations?.maxSizeMb || 5}MB
                                  </p>
                                  {(!field.validations?.multiple && Array.isArray(currentVal) && currentVal.length >= 1) ? (
                                    <p className="portal-wt-note">File uploaded. Delete to replace.</p>
                                  ) : (
                                    <label className="portal-wt-link inline-flex items-center gap-1.5 cursor-pointer">
                                      <Upload className="h-3.5 w-3.5" />
                                      <span>{uploadingFieldId === field.id ? 'Uploading...' : (field.validations?.multiple ? 'Upload Files' : 'Upload File')}</span>
                                      <input
                                        type="file"
                                        multiple={field.validations?.multiple}
                                        accept={
                                          field.validations?.allowedTypes === 'pdf'
                                            ? 'application/pdf'
                                            : field.validations?.allowedTypes === 'image'
                                            ? 'image/*'
                                            : 'application/pdf,image/*'
                                        }
                                        onChange={(e) => handleUploadDynamicFile(e, field)}
                                        disabled={uploadingFieldId === field.id}
                                        className="hidden"
                                      />
                                    </label>
                                  )}
                                  {fieldUploadErrors[field.id] && (
                                    <p className="text-[10px] text-rose-600 font-semibold">{fieldUploadErrors[field.id]}</p>
                                  )}
                                  <div className="space-y-1">
                                    {Array.isArray(currentVal) && currentVal.map((fileItem: any, fIdx: number) => (
                                      <div key={fIdx} className="flex justify-between items-center gap-2 text-[11px]">
                                        <span className="truncate" title={fileItem.name}>{fileItem.name}</span>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <a
                                            href={fileItem.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="portal-wt-link"
                                          >
                                            View
                                          </a>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const nextVal = currentVal.filter((_, idx) => idx !== fIdx);
                                              handleDynamicChange(field.id, nextVal);
                                            }}
                                            className="portal-wt-link"
                                          >
                                            ×
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              );
            })()}

            {empId && (
              <div className="portal-wt-tree">
              <div
                className={`portal-wt-node${openEmpFormSections.documents ? ' is-open' : ''}`}
                style={{ ['--wt-tone' as string]: '#0369a1' }}
              >
                <div className="portal-wt-node-head">
                  <button
                    type="button"
                    className="portal-wt-toggle"
                    onClick={() => setOpenEmpFormSections((prev) => ({ ...prev, documents: !prev.documents }))}
                    aria-expanded={Boolean(openEmpFormSections.documents)}
                  >
                    <ChevronRight className={`portal-wt-caret${openEmpFormSections.documents ? ' is-open' : ''}`} />
                    <div className="portal-wt-copy">
                      <div className="portal-wt-title">
                        <span>{t('documentsUpload')}</span>
                        <span className="portal-wt-count">{documents.length}</span>
                      </div>
                    </div>
                  </button>
                </div>
                {openEmpFormSections.documents && (
                <div className="portal-wt-fields">
                <p className="portal-switch-hint">
                  {lang === 'ta' ? 'அதிகாரப்பூர்வ சேவை ஆவணங்களை விருப்பப்பட்டால் பதிவேற்றலாம்.' : 'Uploading official service documents is optional.'}
                </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label>{lang === 'ta' ? 'ஆவணப் பெயர்' : 'Document name'}</label>
                      <input
                        type="text"
                        placeholder="e.g. Appointment Order"
                        value={docName}
                        onChange={(e) => setDocName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label>{lang === 'ta' ? 'வகை' : 'Category'}</label>
                      <ThemeSelect
                        value={docCategory}
                        onChange={(e) => setDocCategory(e.target.value)}
                      >
                        <option value="Appointment">Appointment Order</option>
                        <option value="Probation">Probation Clearance</option>
                        <option value="Transfer">Transfer Certificate</option>
                      </ThemeSelect>
                    </div>
                    <div>
                      <label>{lang === 'ta' ? 'கோப்பு' : 'File'}</label>
                      <label className="portal-wt-link inline-flex items-center gap-1.5 cursor-pointer mt-1">
                        <Upload className="h-3.5 w-3.5" />
                        {uploadingDoc ? t('uploading') : 'Select File'}
                        <input
                          type="file"
                          onChange={handleUploadFile}
                          disabled={uploadingDoc}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                {documents.length > 0 && (
                  <div className="space-y-1.5">
                    {documents.map((doc, idx) => (
                      <div key={idx} className="flex justify-between items-center gap-2 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{doc.name}</p>
                          <p className="text-[10px] text-slate-500">{doc.category}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <a href={doc.url} download className="portal-wt-link" target="_blank" rel="noreferrer">
                            {t('download')}
                          </a>
                          <button
                            type="button"
                            onClick={() => setDocuments(prev => prev.filter((_, dIdx) => dIdx !== idx))}
                            className="portal-wt-link"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                </div>
                )}
              </div>
              </div>
            )}

            <button type="submit">
              {t('save')}
            </button>
          </form>
          </div>
        </div>
      )}

      {activeTab === 'activityLogs' && !isTPUser && !isZoneUser && (
        <div className="portal-dashboard-panel">
          <div className="portal-dash-head">
            <div>
              <h3>
                <span className="portal-dash-icon">
                  <FileText className="h-3 w-3" />
                </span>
                {t('activityLogsTab')}
              </h3>
              <p>{t('activityLogDescription')}</p>
            </div>
            <span className="portal-fis-count">{filteredLogs.length}</span>
          </div>
          <div className="portal-dash-body">
            <div className="portal-dash-fields" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
              <div>
                <input
                  type="text"
                  placeholder={lang === 'ta' ? "ஊழியர் ஐடி, பெயர் அல்லது செயல்பாட்டைத் தேடுக..." : "Search logs by ID, Name, Action, Actor..."}
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="portal-dash-table overflow-x-auto" style={{ marginTop: '0.75rem' }}>
              <table>
                <thead>
                  <tr>
                    <th>{t('timestamp')}</th>
                    <th>{t('employeeId')}</th>
                    <th>{lang === 'ta' ? 'ஊழியர் பெயர்' : 'Employee Name'}</th>
                    <th>{t('action')}</th>
                    <th>{t('details')}</th>
                    <th>{t('performedBy')}</th>
                  </tr>
                </thead>
                <tbody>
                {filteredLogs.map((log: any) => {
                  const statusClass = log.action?.includes("Created")
                    ? 'is-resolved'
                    : log.action?.includes("Deleted")
                    ? 'is-pending'
                    : log.action?.includes("Updated") || log.action?.includes("Transfer")
                    ? 'is-progress'
                    : '';

                  return (
                    <tr key={log.id}>
                      <td>
                        <span className="portal-dash-id">
                          {new Date(log.timestamp).toLocaleString(lang === 'ta' ? 'ta-IN' : 'en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </span>
                      </td>
                      <td><span className="portal-dash-id">{log.employeeId}</span></td>
                      <td>{log.employeeName}</td>
                      <td>
                        <span className={`portal-dash-status ${statusClass}`}>{log.action}</span>
                      </td>
                      <td>{log.details}</td>
                      <td>{log.changedBy}</td>
                    </tr>
                  );
                })}
                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      {lang === 'ta' ? "செயல்பாட்டு பதிவுகள் ஏதும் இல்லை" : "No activity logs match your search filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'deletedEmployees' && isAdmin && (
        <div className="portal-dashboard-panel">
          <div className="portal-dash-head">
            <div>
              <h3>
                <span className="portal-dash-icon">
                  <Trash2 className="h-3 w-3" />
                </span>
                {lang === 'ta' ? 'நீக்கப்பட்ட ஊழியர்கள் விவரங்கள் அறிக்கை' : 'Deleted User Details Archive & S3 Report'}
              </h3>
              <p>
                {lang === 'ta'
                  ? 'அமைப்பிலிருந்து நீக்கப்பட்ட ஊழியர்களின் முழு விவரங்கள், பாதுகாப்பு காரணங்களுக்காக S3 கிடங்கில் கோப்பாகப் பாதுகாக்கப்பட்டுள்ளது.'
                  : 'Auditable registry of all removed personnel profiles. Raw historical data is archived securely in S3 folder.'}
              </p>
            </div>
          </div>
          <div className="portal-dash-body">
            <div className="portal-dash-table overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>{lang === 'ta' ? 'நீக்கப்பட்ட தேதி' : 'Date Deleted'}</th>
                    <th>{lang === 'ta' ? 'ஊழியர் அடையாள எண்' : 'Employee ID'}</th>
                    <th>{lang === 'ta' ? 'பணியாளர் பெயர்' : 'Full Name'}</th>
                    <th>{lang === 'ta' ? 'பதவி' : 'Archived Designation'}</th>
                    <th>{lang === 'ta' ? 'S3 கிடங்கு பாதை' : 'S3 Archive Path'}</th>
                    <th>{lang === 'ta' ? 'செயல்கள்' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                {deletedEmployees.map((emp: any) => {
                  const matchedPost = posts.find((p: any) => p.id === emp.postId);
                  return (
                    <tr key={emp.id || emp.employeeId}>
                      <td className="font-mono">
                        {emp.deletedAt ? new Date(emp.deletedAt).toLocaleString(lang === 'ta' ? 'ta-IN' : 'en-US') : '--'}
                      </td>
                      <td className="font-mono">{emp.employeeId}</td>
                      <td>
                        {lang === 'ta' ? (emp.nameTa || emp.nameEn) : emp.nameEn}
                      </td>
                      <td>
                        {matchedPost ? tObj(matchedPost) : emp.postId || '--'}
                      </td>
                      <td className="font-mono text-[10px] break-all">
                        {emp.s3Path || `deleted_employees/${emp.employeeId}/details.json`}
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => setViewDeletedEmployee(emp)}
                          className="portal-wt-link inline-flex items-center gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {lang === 'ta' ? 'விவரங்களை காண்' : 'View Data'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {deletedEmployees.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      {lang === 'ta' ? "நீக்கப்பட்ட ஊழியர்கள் விவரங்கள் ஏதும் இல்லை" : "No deleted employees found in S3 archive database."}
                    </td>
                  </tr>
                )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* View Deleted Employee details modal */}
      {viewDeletedEmployee && (
        <div className="portal-modal-overlay is-top">
          <div className="portal-modal max-w-2xl w-full p-6 space-y-6 overflow-y-auto scrollbar-custom">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center border border-rose-100 text-rose-600">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base leading-tight">
                    {lang === 'ta' ? 'காப்பகப்படுத்தப்பட்ட ஊழியர் விவரம்' : 'Archived Personnel File'}
                  </h3>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mt-0.5">
                    {lang === 'ta' ? 'பாதுகாப்பான S3 காப்பகம்' : 'Secure S3 JSON Data'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewDeletedEmployee(null)}
                className="portal-modal-close"
                aria-label="Close"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 block mb-0.5">{lang === 'ta' ? 'ஊழியர் பெயர் (ஆங்கிலம்)' : 'Name (English)'}</span>
                  <span className="font-bold text-gray-900 text-sm">{viewDeletedEmployee.nameEn || '--'}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 block mb-0.5">{lang === 'ta' ? 'ஊழியர் பெயர் (தமிழ்)' : 'Name (Tamil)'}</span>
                  <span className="font-bold text-gray-900 text-sm">{viewDeletedEmployee.nameTa || '--'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 block mb-0.5">{lang === 'ta' ? 'ஊழியர் அடையாள எண்' : 'Employee ID'}</span>
                  <span className="font-mono font-bold text-indigo-700">{viewDeletedEmployee.employeeId || '--'}</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl">
                  <span className="text-gray-400 block mb-0.5">{lang === 'ta' ? 'நீக்கப்பட்ட தேதி' : 'Date Deleted'}</span>
                  <span className="font-bold text-gray-800">
                    {viewDeletedEmployee.deletedAt ? new Date(viewDeletedEmployee.deletedAt).toLocaleString(lang === 'ta' ? 'ta-IN' : 'en-US') : '--'}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-indigo-50/30 border border-indigo-100 rounded-xl">
                <span className="text-indigo-400 block mb-0.5">{lang === 'ta' ? 'S3 கோப்புப் பாதை' : 'S3 Storage Reference'}</span>
                <span className="font-mono font-semibold text-indigo-700">
                  {viewDeletedEmployee.s3Path || `deleted_employees/${viewDeletedEmployee.employeeId}/details.json`}
                </span>
              </div>

              <div>
                <span className="text-gray-400 block mb-1 font-semibold">{lang === 'ta' ? 'முழு காப்பகப் பதிவு (JSON):' : 'Full JSON Payload Summary:'}</span>
                <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-[11px] overflow-x-auto max-h-60 scrollbar-custom leading-relaxed select-all">
                  {JSON.stringify(viewDeletedEmployee, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(viewDeletedEmployee, null, 2));
                  alert(lang === 'ta' ? 'விவரங்கள் நகலெடுக்கப்பட்டன!' : 'JSON copied to clipboard!');
                }}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 rounded-xl text-xs font-semibold transition"
              >
                {lang === 'ta' ? 'JSON நகலெடு' : 'Copy JSON'}
              </button>
              <button
                type="button"
                onClick={() => setViewDeletedEmployee(null)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition"
              >
                {lang === 'ta' ? 'மூடு' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credentials Confirmation Modal */}
      {showCredentialsModal && (
        <div className="portal-modal-overlay is-top">
          <div className="portal-modal max-w-md w-full p-6 space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100 text-emerald-600">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base leading-tight">
                  {lang === 'ta' ? 'ஊழியர் கணக்கு உருவாக்கப்பட்டது' : 'Personnel Account Provisioned'}
                </h3>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mt-0.5">
                  {lang === 'ta' ? 'அணுகல் விபரங்கள் தயார்' : 'Portal credentials ready'}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-1">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
                  {lang === 'ta' ? 'ஊழியர் பெயர்' : 'Employee Name'}
                </span>
                <span className="font-bold text-gray-800 text-sm">
                  {lang === 'ta' ? showCredentialsModal.nameTa : showCredentialsModal.nameEn}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl space-y-1">
                  <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider block">
                    {lang === 'ta' ? 'பயனர் பெயர்' : 'Username'}
                  </span>
                  <span className="font-mono font-bold text-indigo-700 text-sm select-all">
                    {showCredentialsModal.username}
                  </span>
                </div>

                <div className="p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl space-y-1">
                  <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider block">
                    {lang === 'ta' ? 'கடவுச்சொல்' : 'Temporary Password'}
                  </span>
                  <span className="font-mono font-bold text-indigo-700 text-sm select-all">
                    {showCredentialsModal.password}
                  </span>
                </div>
              </div>

              <div className="text-xs text-gray-400 bg-gray-50 p-3.5 rounded-xl border border-gray-100 space-y-1 leading-relaxed">
                <p className="font-semibold text-gray-500">
                  {lang === 'ta' ? 'முக்கியமான குறிப்பு:' : 'Important Guidelines:'}
                </p>
                <p>
                  {lang === 'ta' 
                    ? 'இந்த பயனர் ஐடி மற்றும் கடவுச்சொல்லை ஊழியருடன் பாதுகாப்பாக பகிர்ந்து கொள்ளவும். அவர்கள் முதல் உள்நுழைவில் கடவுச்சொல்லை மாற்ற அறிவுறுத்தப்படுகிறார்கள்.' 
                    : 'Please copy and securely share these login details with the employee so they can access their dedicated portal dashboard.'}
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Employee Portal Account Created!\n` +
                    `Name: ${showCredentialsModal.nameEn}\n` +
                    `Employee ID / Username: ${showCredentialsModal.username}\n` +
                    `Password: ${showCredentialsModal.password}`
                  );
                  alert(lang === 'ta' ? 'விவரங்கள் நகலெடுக்கப்பட்டன!' : 'Credentials copied to clipboard!');
                }}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" />
                {lang === 'ta' ? 'விவரங்களை நகலெடு' : 'Copy Details'}
              </button>
              <button
                type="button"
                onClick={() => setShowCredentialsModal(null)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition"
              >
                {lang === 'ta' ? 'சரி / மூடு' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
