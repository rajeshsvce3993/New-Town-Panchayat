/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/purity */
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PlusCircle, 
  FileText, 
  Sliders, 
  LayoutDashboard, 
  Filter, 
  Trash2, 
  Edit, 
  Upload, 
  AlertTriangle, 
  CheckCircle, 
  Check,
  Clock, 
  X, 
  Eye, 
  Paperclip, 
  Settings, 
  File, 
  FileImage,
  RefreshCw,
  Search,
  Building,
  ArrowRight,
  Users,
  Globe,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  MonitorPlay,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { Language } from './translations';
import { ThemeType, themesConfig } from '@/lib/themeConfig';

function getImpureTimestamp() {
  return Date.now();
}

function getImpureISOString() {
  return new Date().toISOString();
}

interface PendingIssuesViewProps {
  state: any;
  lang: Language;
  currentUser: any;
  onSaveCollection: (key: string, data: any[]) => Promise<void>;
  theme: ThemeType;
}

const CATEGORIES_MAP: any = {
  works: { en: 'Works', ta: 'பணிகள்' },
  establishment: { en: 'Establishment', ta: 'பணியமைப்பு' },
  online_services: { en: 'Online Services', ta: 'ஆன்லைன் சேவைகள்' },
  other_issues: { en: 'Other Issues', ta: 'இதர பிரச்சனைகள்' }
};

const STATIC_CATEGORIES = [
  { 
    id: 'works', 
    nameEn: 'Works', 
    nameTa: 'பணிகள்',
    subcategories: [
      { id: 'FSTP', nameEn: 'FSTP', nameTa: 'கசடு கழிவு சுத்திகரிப்பு (FSTP)' },
      { id: 'Scheme Work', nameEn: 'Scheme Work', nameTa: 'திட்டப் பணிகள்' },
      { id: 'Land Issues', nameEn: 'Land Issues', nameTa: 'நிலப் பிரச்சினைகள்' },
      { id: 'Roads', nameEn: 'Roads', nameTa: 'சாலைகள்' },
      { id: 'Infrastructure Buildings', nameEn: 'Infrastructure Buildings', nameTa: 'கட்டட உள்கட்டமைப்பு' },
      { id: 'Street Light', nameEn: 'Street Light', nameTa: 'தெரு விளக்குகள்' },
      { id: 'Others', nameEn: 'Others', nameTa: 'இதர பணிகள்' }
    ]
  },
  { 
    id: 'establishment', 
    nameEn: 'Establishment', 
    nameTa: 'பணியமைப்பு',
    subcategories: [
      { id: 'Workers Shortfall', nameEn: 'Workers Shortfall', nameTa: 'பணியாளர்கள் பற்றாக்குறை' },
      { id: 'Employee Benefits', nameEn: 'Employee Benefits', nameTa: 'ஊழியர் நலன்கள் / சலுகைகள்' },
      { id: 'Others', nameEn: 'Others', nameTa: 'இதர பணியமைப்பு' }
    ]
  },
  { 
    id: 'online_services', 
    nameEn: 'Online Services', 
    nameTa: 'இணைய சேவைகள்',
    subcategories: [
      { id: 'Tax & Non tax', nameEn: 'Tax & Non tax', nameTa: 'வரி மற்றும் வரியல்லாதவை' },
      { id: 'Building & Layout Aproval', nameEn: 'Building & Layout Approval', nameTa: 'கட்டிடம் & வரைபட அனுமதி' },
      { id: 'Others', nameEn: 'Others', nameTa: 'இதர இணைய சேவைகள்' }
    ]
  },
  { 
    id: 'other_issues', 
    nameEn: 'Other Issues', 
    nameTa: 'இதர பிரச்சினைகள்',
    subcategories: [
      { id: 'ABC', nameEn: 'ABC', nameTa: 'விலங்குகள் கட்டுப்பாடு (ABC)' },
      { id: 'SWM', nameEn: 'SWM', nameTa: 'திடக்கழிவு மேலாண்மை (SWM)' },
      { id: 'Etc.', nameEn: 'Etc.', nameTa: 'இதர சிக்கல்கள்' }
    ]
  }
];

export default function PendingIssuesView({
  state,
  lang,
  currentUser,
  onSaveCollection,
  theme
}: PendingIssuesViewProps) {
  const currentTheme = themesConfig[theme] || themesConfig.light;
  
  const CATEGORIES = (state?.issueCategories && state.issueCategories.length > 0) ? state.issueCategories : STATIC_CATEGORIES;
  
  // Dynamic categories map that supports newly created categories
  const CATEGORIES_MAP = useMemo(() => {
    const map: any = {
      works: { en: 'Works', ta: 'பணிகள்' },
      establishment: { en: 'Establishment', ta: 'பணியமைப்பு' },
      online_services: { en: 'Online Services', ta: 'இணைய சேவைகள்' },
      other_issues: { en: 'Other Issues', ta: 'இதர பிரச்சினைகள்' }
    };
    CATEGORIES.forEach((c: any) => {
      map[c.id] = { en: c.nameEn || c.id, ta: c.nameTa || c.nameEn || c.id };
    });
    return map;
  }, [CATEGORIES]);

  // Data extraction
  const {
    pendingIssues = [],
    pendingIssuesSchema = [],
    townPanchayats = [],
    zones = [],
    districts = []
  } = state || {};

  // TP Zone helper
  const getTPZoneId = (tp: any) => {
    if (!tp) return '';
    if (tp.zoneId) return tp.zoneId;
    if (tp.districtId) {
      const dist = districts.find((d: any) => d.id === tp.districtId);
      return dist ? dist.zoneId : '';
    }
    return '';
  };

  // Check roles
  const isAdmin = currentUser.roleId === 'admin';
  const isZoneUser = currentUser.roleId === 'ad';
  const isTPUser = currentUser.roleId === 'eo';

  // Component Tab Management
  // Default tab based on role, with support for dashboard navigation
  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'create' | 'schema'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pendingIssuesSubTab');
      if (saved === 'create' || saved === 'directory' || saved === 'schema') {
        localStorage.removeItem('pendingIssuesSubTab');
        return saved as any;
      }
    }
    return isTPUser ? 'create' : 'directory';
  });

  // States
  const [issues, setIssues] = useState<any[]>(pendingIssues);
  const [schemaFields, setSchemaFields] = useState<any[]>(pendingIssuesSchema);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterSubcategory, setFilterSubcategory] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterTP, setFilterTP] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // New Issue Form States
  const [formCategory, setFormCategory] = useState<string>('works');
  const [formSubcategory, setFormSubcategory] = useState<string>('Roads');
  const [subject, setSubject] = useState<string>('');
  const [issueDetails, setIssueDetails] = useState<string>('');
  const [dynamicFormValues, setDynamicFormValues] = useState<any>({});
  const [formErrors, setFormErrors] = useState<any>({});
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null);
  const [submittingIssue, setSubmittingIssue] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [showSubmitPopup, setShowSubmitPopup] = useState<boolean>(false);
  const [submittedIssueId, setSubmittedIssueId] = useState<string>('');

  // Default Multiple File Upload States
  const [formFiles, setFormFiles] = useState<{ fileName: string; url: string }[]>([]);
  const [isUploadingFormFiles, setIsUploadingFormFiles] = useState<boolean>(false);

  const handleFormFilesUpload = async (filesList: FileList) => {
    setIsUploadingFormFiles(true);
    try {
      const uploaded = [...formFiles];
      for (let i = 0; i < filesList.length; i++) {
        const file = filesList[i];
        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB > 10) {
          alert(`${file.name}: ${lang === 'ta' ? 'கோப்பு அளவு 10MBக்கு மிகாமல் இருக்க வேண்டும்!' : 'File size must not exceed 10MB!'}`);
          continue;
        }
        
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const allowed = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'docx', 'xlsx', 'xls', 'csv'];
        if (!allowed.includes(ext)) {
          alert(`${file.name}: ${lang === 'ta' ? 'ஆதரிக்கப்படாத கோப்பு வடிவம்!' : 'Unsupported file type! Supported: PDF, Images, DOCX, Excel'}`);
          continue;
        }

        const nextId = generateNextIssueId();
        const formData = new FormData();
        formData.append('file', file);
        formData.append('employeeId', currentUser.id || 'system_user');
        formData.append('townPanchayatId', currentUser.scopeId || '');
        formData.append('officeCategoryType', 'TP');
        formData.append('issueId', nextId);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data.success) {
          uploaded.push({
            fileName: file.name,
            url: data.url
          });
        }
      }
      setFormFiles(uploaded);
    } catch (err) {
      console.error(err);
      alert('Error uploading files');
    } finally {
      setIsUploadingFormFiles(false);
    }
  };

  const removeFormFile = (index: number) => {
    setFormFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  // Admin Dynamic Field Creator States
  const [newFieldCategory, setNewFieldCategory] = useState<string>('works');
  const [newFieldSubcategory, setNewFieldSubcategory] = useState<string>('');
  const [newFieldNameEn, setNewFieldNameEn] = useState<string>('');
  const [newFieldNameTa, setNewFieldNameTa] = useState<string>('');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'date' | 'file'>('text');
  const [isRequired, setIsRequired] = useState<boolean>(true);
  const [textLimit, setTextLimit] = useState<number>(200);
  const [numMin, setNumMin] = useState<number>(0);
  const [numMax, setNumMax] = useState<number>(10000);
  const [fileMaxSize, setFileMaxSize] = useState<number>(5);
  const [fileTypeConstraint, setFileTypeConstraint] = useState<'pdf' | 'image' | 'both'>('both');

  // Issue view modal & Update form states
  const [selectedIssue, setSelectedIssue] = useState<any | null>(null);
  const [activePreviewFile, setActivePreviewFile] = useState<any | null>(null);
  const [updateStatus, setUpdateStatus] = useState<'Active' | 'Closed'>('Active');
  const [updateNotes, setUpdateNotes] = useState<string>('');
  const [updateAttachment, setUpdateAttachment] = useState<{ fileName: string; url: string } | null>(null);
  const [isUploadingUpdateFile, setIsUploadingUpdateFile] = useState<boolean>(false);
  const [submittingUpdate, setSubmittingUpdate] = useState<boolean>(false);

  // --- Reports & Slideshow Presentation States ---
  const [filterZoneId, setFilterZoneId] = useState<string>(() => {
    if (currentUser.scopeType === 'Zone') return currentUser.scopeId;
    if (currentUser.scopeType === 'TownPanchayat') {
      const tp = townPanchayats.find((t: any) => t.id === currentUser.scopeId);
      return tp ? getTPZoneId(tp) : '';
    }
    return '';
  });
  const [filterDistrictId, setFilterDistrictId] = useState<string>(() => {
    if (currentUser.scopeType === 'TownPanchayat') {
      const tp = townPanchayats.find((t: any) => t.id === currentUser.scopeId);
      return tp ? tp.districtId : '';
    }
    return '';
  });
  const [filterTPId, setFilterTPId] = useState<string>(() => {
    if (currentUser.scopeType === 'TownPanchayat') return currentUser.scopeId;
    return '';
  });
  const [filterStage, setFilterStage] = useState<string>('');
  const [selectedAbstractCategory, setSelectedAbstractCategory] = useState<string>('');
  const [selectedAbstractSubcategory, setSelectedAbstractSubcategory] = useState<string>('');
  const [selectedAbstractStatus, setSelectedAbstractStatus] = useState<string>('');
  const permissibleModes = currentUser.scopeType === 'HOD'
    ? ['category', 'zone', 'district']
    : currentUser.scopeType === 'Zone'
      ? ['category', 'district']
      : ['category'];

  const [abstractViewMode, setAbstractViewMode] = useState<'category' | 'zone' | 'district'>(
    permissibleModes.includes('category') ? 'category' : 'category'
  );
  const [sortField, setSortField] = useState<string>('issueId');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Slideshow States
  const [isSlideViewActive, setIsSlideViewActive] = useState<boolean>(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [slideActivePreviewFile, setSlideActivePreviewFile] = useState<any | null>(null);

  // Slide Update Form States
  const [slideUpdateStatus, setSlideUpdateStatus] = useState<'Pending' | 'In Progress' | 'Resolved'>('In Progress');
  const [slideUpdateNotes, setSlideUpdateNotes] = useState<string>('');
  const [slideUpdateAttachment, setSlideUpdateAttachment] = useState<{ fileName: string; url: string } | null>(null);
  const [isUploadingSlideFile, setIsUploadingSlideFile] = useState<boolean>(false);
  const [isSubmittingSlideUpdate, setIsSubmittingSlideUpdate] = useState<boolean>(false);
  const [slideSuccessMsg, setSlideSuccessMsg] = useState<string>('');

  // Synchronize state
  useEffect(() => {
    if (pendingIssues) setIssues(pendingIssues);
    if (pendingIssuesSchema) setSchemaFields(pendingIssuesSchema);
  }, [pendingIssues, pendingIssuesSchema]);

  // Keep form category aligned with available CATEGORIES
  useEffect(() => {
    if (CATEGORIES && CATEGORIES.length > 0) {
      const match = CATEGORIES.some((c: any) => c.id === formCategory);
      if (!match) {
        setFormCategory(CATEGORIES[0].id);
        if (CATEGORIES[0].subcategories && CATEGORIES[0].subcategories.length > 0) {
          setFormSubcategory(CATEGORIES[0].subcategories[0].id);
        } else {
          setFormSubcategory('');
        }
      }
    }
  }, [CATEGORIES, formCategory]);

  // Translations helper
  const t = (en: string, ta: string) => {
    return lang === 'ta' ? ta : en;
  };

  const getCategoryName = (catId: string, currentLang?: 'en' | 'ta') => {
    if (!catId) return '';
    const l = currentLang || lang;
    const cat = CATEGORIES.find((c: any) => c.id?.toLowerCase() === catId.toLowerCase());
    if (cat) return l === 'ta' ? (cat.nameTa || cat.nameEn) : (cat.nameEn || cat.nameTa);
    return CATEGORIES_MAP[catId]?.[l] || catId;
  };

  const getSubcategoryName = (catId: string, subcatId: string, currentLang?: 'en' | 'ta') => {
    if (!subcatId) return '';
    const l = currentLang || lang;
    const cat = CATEGORIES.find((c: any) => c.id?.toLowerCase() === (catId || '').toLowerCase());
    if (cat && cat.subcategories) {
      const sub = cat.subcategories.find((s: any) => s.id?.toLowerCase() === subcatId.toLowerCase());
      if (sub) {
        return l === 'ta' ? (sub.nameTa || sub.nameEn) : (sub.nameEn || sub.nameTa);
      }
    }
    return subcatId;
  };

  const getTPName = (tpId: string) => {
    const tp = townPanchayats.find((t: any) => t.id === tpId);
    if (!tp) return tpId;
    return lang === 'ta' ? tp.nameTa : tp.nameEn;
  };

  const getDistrictName = (dId: string) => {
    const d = districts.find((dist: any) => dist.id === dId);
    if (!d) return dId;
    return lang === 'ta' ? d.nameTa : d.nameEn;
  };

  const getZoneName = (zId: string) => {
    const z = zones.find((item: any) => item.id === zId);
    if (!z) return zId;
    return lang === 'ta' ? z.nameTa : z.nameEn;
  };

  const getZoneNameByTP = (tpId: string) => {
    const tp = townPanchayats.find((t: any) => t.id === tpId);
    if (!tp) return '-';
    const znId = getTPZoneId(tp);
    return znId ? getZoneName(znId) : '-';
  };

  const getDistrictNameByTP = (tpId: string) => {
    const tp = townPanchayats.find((t: any) => t.id === tpId);
    if (!tp) return '-';
    return getDistrictName(tp.districtId);
  };


  // --- Slideshow Attachment Upload Handler ---
  const handleSlideAttachmentUpload = async (file: File) => {
    const maxSize = fileMaxSize * 1024 * 1024;
    if (file.size > maxSize) {
      alert(lang === 'ta' 
        ? `கோப்பு அளவு ${fileMaxSize}MB மிகாமல் இருக்க வேண்டும்.` 
        : `File size exceeds the limit of ${fileMaxSize}MB.`);
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (fileTypeConstraint === 'pdf' && ext !== 'pdf') {
      alert(lang === 'ta' ? 'PDF கோப்புகள் மட்டுமே அனுமதிக்கப்படும்.' : 'Only PDF files are allowed.');
      return;
    }
    if (fileTypeConstraint === 'image' && !['jpg','jpeg','png'].includes(ext || '')) {
      alert(lang === 'ta' ? 'படங்கள் மட்டுமே அனுமதிக்கப்படும்.' : 'Only JPG, JPEG, PNG images are allowed.');
      return;
    }

    setIsUploadingSlideFile(true);
    try {
      const currentIssue = sortedIssues[activeSlideIndex];
      if (!currentIssue) {
        throw new Error("No current issue found");
      }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("employeeId", currentUser.id || "anonymous_tp");
      formData.append("townPanchayatId", currentUser.scopeId || "");
      formData.append("officeCategoryType", "TP");
      formData.append("issueId", currentIssue.issueId);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setSlideUpdateAttachment({
          fileName: file.name,
          url: data.url,
        });
      } else {
        throw new Error(data.message || "Upload failed");
      }
    } catch (err) {
      console.error("File upload error:", err);
      alert(lang === "ta" ? "கோப்பை ஏற்றுவதில் பிழை." : "Error uploading file.");
    } finally {
      setIsUploadingSlideFile(false);
    }
  };

  // --- Slideshow Progress Form Submission ---
  const handleSlideUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentIssue = sortedIssues[activeSlideIndex];
    if (!currentIssue) return;

    setIsSubmittingSlideUpdate(true);
    try {
      const updatedIssue = { ...currentIssue };
      const isTPOrZoneUser = currentUser.roleId === 'eo' || currentUser.roleId === 'ad';
      let finalStatus = currentIssue.status;
      if (slideUpdateStatus === 'Resolved' && isTPOrZoneUser) {
        finalStatus = 'In Progress';
      } else {
        finalStatus = slideUpdateStatus;
      }

      const newComment = {
        id: `c_${getImpureTimestamp()}`,
        status: finalStatus,
        notes: slideUpdateNotes,
        date: getImpureISOString(),
        userName: currentUser.name || 'User',
        userNameTa: currentUser.nameTa || currentUser.name || 'பயனர்',
        userDesignation: currentUser.designation || 'Staff',
        scopeType: currentUser.scopeType || 'TP',
        file: slideUpdateAttachment ? {
          url: slideUpdateAttachment.url,
          fileName: slideUpdateAttachment.fileName
        } : null
      };

      updatedIssue.status = finalStatus;
      updatedIssue.comments = [newComment, ...(updatedIssue.comments || [])];
      updatedIssue.updatedAt = getImpureISOString();

      // Save to database/props state
      const updatedList = issues.map((iss: any) => iss.id === currentIssue.id ? updatedIssue : iss);
      await onSaveCollection("pendingIssues", updatedList);

      setIssues(updatedList);
      setSlideUpdateNotes('');
      setSlideUpdateAttachment(null);
      setSlideSuccessMsg(lang === 'ta' ? 'புதுப்பிப்பு வெற்றிகரமாக சேமிக்கப்பட்டது!' : 'Progress update successfully posted!');
      setTimeout(() => setSlideSuccessMsg(''), 3000);
    } catch (err: any) {
      console.error(err);
      alert(lang === 'ta' ? 'பிழை ஏற்பட்டது.' : 'Error saving update.');
    } finally {
      setIsSubmittingSlideUpdate(false);
    }
  };

  // Generate unique Issue ID #TP0001
  const generateNextIssueId = () => {
    if (!issues || issues.length === 0) {
      return '#TP0001';
    }
    // Filter numerical parts of issue IDs that match `#TP\d+`
    const ids = issues
      .map((iss: any) => {
        const idStr = iss.issueId || '';
        const match = idStr.match(/#TP(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((num: number) => num > 0);

    const maxId = ids.length > 0 ? Math.max(...ids) : 0;
    const nextNum = maxId + 1;
    return `#TP${nextNum.toString().padStart(4, '0')}`;
  };

  // Handle Dynamic File Upload
  const handleFileUpload = async (fieldId: string, file: File, maxSizeMB: number, allowedTypes: string[]) => {
    setFormErrors((prev: any) => ({ ...prev, [fieldId]: '' }));
    
    // File validation
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      setFormErrors((prev: any) => ({
        ...prev,
        [fieldId]: t(`File size exceeds limit of ${maxSizeMB}MB!`, `கோப்பு அளவு வரம்பான ${maxSizeMB}MB ஐ விட அதிகமாக உள்ளது!`)
      }));
      return;
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    const isImage = ['png', 'jpg', 'jpeg', 'gif'].includes(fileExt);
    const isPdf = fileExt === 'pdf';

    if (allowedTypes.includes('pdf') && !allowedTypes.includes('image') && !isPdf) {
      setFormErrors((prev: any) => ({
        ...prev,
        [fieldId]: t('Only PDF files are allowed!', 'PDF கோப்புகள் மட்டுமே அனுமதிக்கப்படுகின்றன!')
      }));
      return;
    }

    if (allowedTypes.includes('image') && !allowedTypes.includes('pdf') && !isImage) {
      setFormErrors((prev: any) => ({
        ...prev,
        [fieldId]: t('Only Image files are allowed!', 'பட கோப்புகள் மட்டுமே அனுமதிக்கப்படுகின்றன!')
      }));
      return;
    }

    if (!isPdf && !isImage) {
      setFormErrors((prev: any) => ({
        ...prev,
        [fieldId]: t('Only PDF and Image files are allowed!', 'PDF மற்றும் பட கோப்புகள் மட்டுமே அனுமதிக்கப்படுகின்றன!')
      }));
      return;
    }

    // Call server API for file upload
    setUploadingFieldId(fieldId);
    try {
      const nextIssueId = generateNextIssueId();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("employeeId", currentUser.id || "anonymous_tp");
      formData.append("townPanchayatId", currentUser.scopeId || "");
      formData.append("officeCategoryType", "TP");
      formData.append("issueId", nextIssueId);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setDynamicFormValues((prev: any) => ({
          ...prev,
          [fieldId]: {
            fileName: file.name,
            url: data.url
          }
        }));
      } else {
        throw new Error(data.message || 'Upload failed');
      }
    } catch (err: any) {
      console.error('Upload failed', err);
      setFormErrors((prev: any) => ({
        ...prev,
        [fieldId]: t('Upload failed. Try again.', 'பதிவேற்றம் தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.')
      }));
    } finally {
      setUploadingFieldId(null);
    }
  };

  // Save Dynamic Field Configuration (Admin only)
  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldNameEn || !newFieldNameTa) {
      alert(t('Please provide both English and Tamil field names!', 'ஆங்கிலம் மற்றும் தமிழ் புலங்களின் பெயர்களை வழங்கவும்!'));
      return;
    }

    const newFieldId = `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    // Construct validation parameters
    const validations: any = { required: isRequired };
    if (newFieldType === 'text') {
      validations.maxLength = textLimit;
    } else if (newFieldType === 'number') {
      validations.min = numMin;
      validations.max = numMax;
    } else if (newFieldType === 'file') {
      validations.maxSizeMB = fileMaxSize;
      validations.fileTypes = fileTypeConstraint === 'pdf' ? ['pdf'] : fileTypeConstraint === 'image' ? ['image'] : ['pdf', 'image'];
    }

    const newFieldObj = {
      id: newFieldId,
      category: newFieldCategory,
      subcategory: newFieldSubcategory,
      nameEn: newFieldNameEn,
      nameTa: newFieldNameTa,
      type: newFieldType,
      validations
    };

    const updatedSchema = [...schemaFields, newFieldObj];
    setSchemaFields(updatedSchema);
    
    // Save to server
    await onSaveCollection('pendingIssuesSchema', updatedSchema);

    // Reset Form states
    setNewFieldNameEn('');
    setNewFieldNameTa('');
    setNewFieldSubcategory('');
    setIsRequired(true);
    setTextLimit(200);
    setNumMin(0);
    setNumMax(10000);
    setFileMaxSize(5);
    setFileTypeConstraint('both');
    
    setSuccessMsg(t('Dynamic field added successfully!', 'புதிய புலம் வெற்றிகரமாக சேர்க்கப்பட்டது!'));
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  // Delete dynamic field (Admin only)
  const handleDeleteField = async (fieldId: string) => {
    if (!confirm(t('Are you sure you want to delete this dynamic field? This won\'t delete data in already entered issues.', 'இந்த புலத்தை நிச்சயமாக நீக்க வேண்டுமா? இது ஏற்கனவே உள்ள சிக்கல்களில் உள்ள தரவை நீக்காது.'))) {
      return;
    }
    const updatedSchema = schemaFields.filter((f: any) => f.id !== fieldId);
    setSchemaFields(updatedSchema);
    await onSaveCollection('pendingIssuesSchema', updatedSchema);
  };

  // Submit Issue (Town Panchayat user)
  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});
    
    // Find active schema fields for the selected category & subcategory
    const activeFields = schemaFields.filter((f: any) => f.category === formCategory && (!f.subcategory || f.subcategory === formSubcategory));
    let errors: any = {};
    let isValid = true;

    // Validate fields
    activeFields.forEach((field: any) => {
      const val = dynamicFormValues[field.id];
      const isReq = field.validations?.required;

      if (isReq && (val === undefined || val === '' || (field.type === 'file' && !val.url))) {
        errors[field.id] = t('This field is required!', 'இந்த புலம் கட்டாயமாகும்!');
        isValid = false;
      }

      if (val !== undefined && val !== '') {
        if (field.type === 'text' && field.validations?.maxLength && String(val).length > field.validations.maxLength) {
          errors[field.id] = t(`Maximum limit is ${field.validations.maxLength} characters!`, `அதிகபட்ச வரம்பு ${field.validations.maxLength} எழுத்துக்கள்!`);
          isValid = false;
        }
        if (field.type === 'number') {
          const numVal = Number(val);
          if (field.validations?.min !== undefined && numVal < field.validations.min) {
            errors[field.id] = t(`Minimum value is ${field.validations.min}!`, `குறைந்தபட்ச மதிப்பு ${field.validations.min}!`);
            isValid = false;
          }
          if (field.validations?.max !== undefined && numVal > field.validations.max) {
            errors[field.id] = t(`Maximum value is ${field.validations.max}!`, `அதிகபட்ச மதிப்பு ${field.validations.max}!`);
            isValid = false;
          }
        }
      }
    });

    if (!isValid) {
      setFormErrors(errors);
      alert(t('Please check for validation errors in the form.', 'படிவத்தில் உள்ள சரிபார்ப்பு பிழைகளை சரிபார்க்கவும்.'));
      return;
    }

    if (!subject.trim() || !issueDetails.trim()) {
      alert(t('Please fill out Subject and Issue Details default fields!', 'பொருள் மற்றும் பிரச்சினையின் விவரங்கள் இயல்புநிலை புலங்களை நிரப்பவும்!'));
      return;
    }

    setSubmittingIssue(true);
    try {
      // Find current user's TP, Zone, District details
      const userTP = townPanchayats.find((t: any) => t.id === currentUser.scopeId);
      const districtId = userTP?.districtId || '';
      const districtObj = districts.find((d: any) => d.id === districtId);
      const zoneId = districtObj?.zoneId || '';

      const generatedId = generateNextIssueId();
      const tpTitle = getTPName(currentUser.scopeId || 'tp1');
      const designationStr = `${lang === 'ta' ? 'செயல் அலுவலர்' : 'Executive Officer'} (${tpTitle})`;

      const newIssue = {
        id: `pi_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        issueId: generatedId,
        townPanchayatId: currentUser.scopeId || 'tp1',
        zoneId: zoneId || 'z1',
        districtId: districtId || 'd1',
        category: formCategory,
        subcategory: formSubcategory,
        subject: subject.trim(),
        issueDetails: issueDetails.trim(),
        attachments: formFiles,
        files: formFiles,
        status: 'Active',
        createdAt: new Date().toISOString(),
        createdBy: currentUser.nameEn || currentUser.username,
        createdByUserRole: currentUser.roleId || 'eo',
        fieldsData: dynamicFormValues,
        comments: [
          {
            id: `upd_init_${Date.now()}`,
            status: 'Active',
            notes: t('Issue registered in portal by Town Panchayat.', 'பேரூராட்சியால் பிரச்சனை தளத்தில் பதிவு செய்யப்பட்டது.'),
            userName: currentUser.nameEn || currentUser.username,
            userNameTa: currentUser.nameTa || currentUser.nameEn || currentUser.username,
            userRole: currentUser.roleId || 'eo',
            scopeType: currentUser.scopeType || 'TownPanchayat',
            userDesignation: designationStr,
            date: new Date().toISOString()
          }
        ]
      };

      const updatedIssues = [newIssue, ...issues];
      setIssues(updatedIssues);
      await onSaveCollection('pendingIssues', updatedIssues);

      setSubmittedIssueId(generatedId);
      setShowSubmitPopup(true);
      setDynamicFormValues({});
      setSubject('');
      setIssueDetails('');
      setFormFiles([]);
    } catch (err) {
      console.error(err);
      alert(t('Failed to create issue. Please try again.', 'பிரச்சனையை உருவாக்க முடியவில்லை. மீண்டும் முயற்சிக்கவும்.'));
    } finally {
      setSubmittingIssue(false);
    }
  };

  // Delete Issue
  const handleDeleteIssue = async (issueId: string) => {
    if (!confirm(t('Are you sure you want to delete this issue permanently?', 'இந்த பிரச்சனையை நிரந்தரமாக நீக்க விரும்புகிறீர்களா?'))) {
      return;
    }
    const targetIssue = issues.find((iss: any) => iss.id === issueId);
    const readableId = targetIssue?.issueId || issueId;

    const updated = issues.filter((iss: any) => iss.id !== issueId);
    setIssues(updated);

    try {
      await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation: 'deleteIssue',
          data: { issueId: readableId }
        })
      });
    } catch (err) {
      console.error('Failed to delete issue folder on server:', err);
    }

    await onSaveCollection('pendingIssues', updated);
  };

  // Handle Update Attachment Upload
  const handleUpdateFileUpload = async (file: File) => {
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 5) {
      alert(t('Attachment size must not exceed 5MB!', 'இணைப்பு கோப்பு அளவு 5MBக்கு மிகாமல் இருக்க வேண்டும்!'));
      return;
    }
    setIsUploadingUpdateFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('employeeId', currentUser.id || 'system_user');
      formData.append('townPanchayatId', currentUser.scopeId || '');
      formData.append('officeCategoryType', currentUser.roleId === 'eo' ? 'TP' : currentUser.roleId === 'ad' ? 'ADTP' : 'DTP');
      if (selectedIssue?.issueId) {
        formData.append('issueId', selectedIssue.issueId);
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setUpdateAttachment({
          fileName: file.name,
          url: data.url
        });
      } else {
        throw new Error(data.message || 'Upload failed');
      }
    } catch (err) {
      console.error(err);
      alert(t('Attachment upload failed. Please try again.', 'இணைப்பு பதிவேற்றம் தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.'));
    } finally {
      setIsUploadingUpdateFile(false);
    }
  };

  // Add Progress Update & Status Transition (Available for TP, Zonal, and DTP Users)
  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssue) return;
    if (!updateNotes.trim()) {
      alert(t('Please enter update remarks or action taken description!', 'நடவடிக்கை குறிப்பு அல்லது விவரங்களை உள்ளிடவும்!'));
      return;
    }

    setSubmittingUpdate(true);
    try {
      const userDesignation = isTPUser 
        ? `${lang === 'ta' ? 'செயல் அலுவலர்' : 'Executive Officer'} (${getTPName(currentUser.scopeId)})` 
        : isZoneUser 
        ? `${lang === 'ta' ? 'உதவி இயக்குநர்' : 'Assistant Director'} (${getZoneName(currentUser.scopeId)})` 
        : `${lang === 'ta' ? 'இயக்குநரகம் (தலைமையகம்)' : 'Directorate (Head Office)'}`;

      const finalStatus = isAdmin ? updateStatus : (selectedIssue.status === 'Closed' ? 'Closed' : 'Active');

      const updateEntry = {
        id: `upd_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        status: finalStatus,
        notes: updateNotes.trim(),
        userName: currentUser.nameEn || currentUser.username,
        userNameTa: currentUser.nameTa || currentUser.nameEn || currentUser.username,
        userRole: currentUser.roleId || 'eo',
        scopeType: currentUser.scopeType || 'TownPanchayat',
        userDesignation,
        file: updateAttachment || null,
        date: new Date().toISOString()
      };

      const updatedIssues = issues.map((iss: any) => {
        if (iss.id === selectedIssue.id) {
          const updatedComments = [...(iss.comments || []), updateEntry];
          const updatedObj = {
            ...iss,
            status: finalStatus,
            updatedAt: new Date().toISOString(),
            lastUpdatedBy: currentUser.nameEn || currentUser.username,
            comments: updatedComments
          };
          setSelectedIssue(updatedObj);
          return updatedObj;
        }
        return iss;
      });

      setIssues(updatedIssues);
      await onSaveCollection('pendingIssues', updatedIssues);
      setUpdateNotes('');
      setUpdateAttachment(null);
      setSuccessMsg(t('Update & activity log posted successfully!', 'நடவடிக்கை பதிவு வெற்றிகரமாக சேர்க்கப்பட்டது!'));
      setTimeout(() => setSuccessMsg(''), 3500);
    } catch (err) {
      console.error(err);
      alert(t('Failed to post update.', 'புதுப்பிப்பைச் சமர்ப்பிக்க முடியவில்லை.'));
    } finally {
      setSubmittingUpdate(false);
    }
  };

  // Scoped views logic
  const getScopedIssues = () => {
    let filtered = [...issues];

    // Filter by User Role limits
    if (isTPUser) {
      filtered = filtered.filter((iss: any) => iss.townPanchayatId === currentUser.scopeId);
    } else if (isZoneUser) {
      filtered = filtered.filter((iss: any) => iss.zoneId === currentUser.scopeId);
    }

    // Search and filters
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (iss: any) =>
          iss.issueId?.toLowerCase().includes(term) ||
          getTPName(iss.townPanchayatId).toLowerCase().includes(term) ||
          iss.subcategory?.toLowerCase().includes(term)
      );
    }

    if (filterCategory) {
      filtered = filtered.filter((iss: any) => iss.category === filterCategory);
    }
    if (filterSubcategory) {
      filtered = filtered.filter((iss: any) => iss.subcategory === filterSubcategory);
    }
    if (filterStatus) {
      if (filterStatus === 'Pending') {
        filtered = filtered.filter((iss: any) => iss.status === 'Active' && (!iss.comments || iss.comments.length <= 1));
      } else if (filterStatus === 'In Progress') {
        filtered = filtered.filter((iss: any) => iss.status === 'Active' && iss.comments && iss.comments.length > 1);
      } else if (filterStatus === 'Closed') {
        filtered = filtered.filter((iss: any) => iss.status === 'Closed');
      } else {
        filtered = filtered.filter((iss: any) => iss.status === filterStatus);
      }
    }
    if (filterTP) {
      filtered = filtered.filter((iss: any) => iss.townPanchayatId === filterTP);
    }

    return filtered;
  };

  const visibleIssues = getScopedIssues();

  // --- REPORT TAB LOGIC (Abstract Register and Detailed Issues Ledger) ---
  const allowedZones = currentUser.roleId === 'admin' || currentUser.roleId === 'dtp_admin' || currentUser.roleId === 'dtp_user'
    ? zones 
    : currentUser.roleId === 'ad' 
      ? zones.filter((z: any) => z.id === currentUser.scopeId)
      : zones.filter((z: any) => z.id === getTPZoneId(townPanchayats.find((tp: any) => tp.id === currentUser.scopeId)));

  const allowedDistricts = currentUser.roleId === 'admin' || currentUser.roleId === 'dtp_admin' || currentUser.roleId === 'dtp_user'
    ? districts
    : currentUser.roleId === 'ad'
      ? districts.filter((d: any) => d.zoneId === currentUser.scopeId)
      : districts.filter((d: any) => d.id === (townPanchayats.find((tp: any) => tp.id === currentUser.scopeId)?.districtId));

  const allowedTPs = currentUser.roleId === 'admin' || currentUser.roleId === 'dtp_admin' || currentUser.roleId === 'dtp_user'
    ? townPanchayats
    : currentUser.roleId === 'ad'
      ? townPanchayats.filter((tp: any) => {
          return getTPZoneId(tp) === currentUser.scopeId;
        })
      : townPanchayats.filter((tp: any) => tp.id === currentUser.scopeId);

  // Helper lists for dropdown filters with hierarchical rules
  const availableDistricts = allowedDistricts.filter((d: any) => {
    if ((currentUser.roleId === 'admin' || currentUser.roleId === 'dtp_admin' || currentUser.roleId === 'dtp_user') && !filterZoneId) return false;
    if (filterZoneId && d.zoneId !== filterZoneId) return false;
    return true;
  });

  const availableTPs = allowedTPs.filter((tp: any) => {
    if (currentUser.roleId !== 'eo' && !filterDistrictId) return false;
    if (filterZoneId && getTPZoneId(tp) !== filterZoneId) return false;
    if (filterDistrictId && tp.districtId !== filterDistrictId) return false;
    return true;
  });

  const getReportBaseIssues = () => {
    let base = [...issues];
    
    // User role scoping
    if (isTPUser) {
      base = base.filter((iss: any) => iss.townPanchayatId === currentUser.scopeId);
    } else if (isZoneUser) {
      base = base.filter((iss: any) => {
        const tp = townPanchayats.find((t: any) => t.id === iss.townPanchayatId);
        return tp && getTPZoneId(tp) === currentUser.scopeId;
      });
    }

    // Dropdown filters
    return base.filter((issue: any) => {
      const tp = townPanchayats.find((t: any) => t.id === issue.townPanchayatId);
      
      // Zone Filter
      if (filterZoneId && (!tp || getTPZoneId(tp) !== filterZoneId)) {
        return false;
      }
      // District Filter
      if (filterDistrictId && (!tp || tp.districtId !== filterDistrictId)) {
        return false;
      }
      // Town Panchayat Filter
      if (filterTPId && issue.townPanchayatId !== filterTPId) {
        return false;
      }
      // Category Filter
      if (filterCategory && issue.category !== filterCategory) {
        return false;
      }
      return true;
    });
  };

  const reportBaseIssues = getReportBaseIssues();

  // Final filtered report issues (including abstract register interactive clicks & Stage/Status dropdown)
  const reportFilteredIssues = reportBaseIssues.filter((issue: any) => {
    // Stage / status filter from dropdown OR abstract table click
    const stage = filterStage || selectedAbstractStatus;
    if (stage) {
      if (stage === 'Pending') {
        if (issue.status !== 'Pending' && (issue.status !== 'Active' || (issue.comments && issue.comments.length > 1))) {
          return false;
        }
      } else if (stage === 'In Progress') {
        if (issue.status !== 'In Progress' && (issue.status !== 'Active' || !issue.comments || issue.comments.length <= 1)) {
          return false;
        }
      } else if (stage === 'Resolved' || stage === 'Closed') {
        if (issue.status !== 'Resolved' && issue.status !== 'Closed') {
          return false;
        }
      } else if (issue.status !== stage) {
        return false;
      }
    }
    
    // Category filter from abstract table click
    if (selectedAbstractCategory && issue.category !== selectedAbstractCategory) {
      return false;
    }

    // Subcategory filter from abstract table click
    if (selectedAbstractSubcategory && issue.subcategory !== selectedAbstractSubcategory) {
      return false;
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchId = issue.issueId?.toLowerCase().includes(term);
      const matchSub = issue.subcategory?.toLowerCase().includes(term);
      const matchSubj = issue.subject?.toLowerCase().includes(term);
      const matchDet = issue.issueDetails?.toLowerCase().includes(term);
      if (!matchId && !matchSub && !matchSubj && !matchDet) {
        return false;
      }
    }
    return true;
  });

  // Sorted report issues
  const sortedIssues = [...reportFilteredIssues].sort((a: any, b: any) => {
    let valA = '';
    let valB = '';

    if (sortField === 'issueId') {
      valA = a.issueId || '';
      valB = b.issueId || '';
    } else if (sortField === 'zone') {
      valA = getZoneNameByTP(a.townPanchayatId);
      valB = getZoneNameByTP(b.townPanchayatId);
    } else if (sortField === 'district') {
      valA = getDistrictNameByTP(a.townPanchayatId);
      valB = getDistrictNameByTP(b.townPanchayatId);
    } else if (sortField === 'townPanchayatId') {
      valA = getTPName(a.townPanchayatId);
      valB = getTPName(b.townPanchayatId);
    } else if (sortField === 'category') {
      const catA = CATEGORIES_MAP[a.category]?.[lang] || a.category;
      const catB = CATEGORIES_MAP[b.category]?.[lang] || b.category;
      valA = `${catA} ${getSubcategoryName(a.category, a.subcategory, lang) || ''}`;
      valB = `${catB} ${getSubcategoryName(b.category, b.subcategory, lang) || ''}`;
    } else if (sortField === 'lastUpdated') {
      valA = a.updatedAt || a.createdAt || '';
      valB = b.updatedAt || b.createdAt || '';
    } else if (sortField === 'status') {
      valA = a.status || '';
      valB = b.status || '';
    } else if (sortField === 'subject') {
      valA = a.subject || '';
      valB = b.subject || '';
    } else if (sortField === 'issueDetails') {
      valA = a.issueDetails || '';
      valB = b.issueDetails || '';
    } else {
      valA = a.createdAt || '';
      valB = b.createdAt || '';
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // --- Keyboard & Navigation Handlers for Slideshow ---
  const handlePrevSlide = () => {
    if (activeSlideIndex > 0) {
      setActiveSlideIndex(prev => prev - 1);
      setSlideActivePreviewFile(null);
    }
  };

  const handleNextSlide = () => {
    if (activeSlideIndex < sortedIssues.length - 1) {
      setActiveSlideIndex(prev => prev + 1);
      setSlideActivePreviewFile(null);
    }
  };

  // Track previous active slide index to reset only when slide index actually changes
  const prevSlideIndexRef = useRef<number>(-1);
  const prevSlideViewActiveRef = useRef<boolean>(false);

  // Auto-reset slide preview file and remarks when active index or open state changes
  useEffect(() => {
    if (isSlideViewActive) {
      const indexChanged = prevSlideIndexRef.current !== activeSlideIndex;
      const opened = !prevSlideViewActiveRef.current;
      
      if (indexChanged || opened) {
        prevSlideIndexRef.current = activeSlideIndex;
        prevSlideViewActiveRef.current = true;

        if (sortedIssues && sortedIssues[activeSlideIndex]) {
          const currentIssue = sortedIssues[activeSlideIndex];
          const initFiles = (currentIssue.attachments || currentIssue.files || []).map((file: any) => ({
            url: file.url,
            name: file.name || file.fileName || 'Initial Doc'
          }));
          const commentFiles = (currentIssue.comments || [])
            .filter((c: any) => c.file && c.file.url)
            .map((c: any) => ({
              url: c.file.url,
              name: c.file.fileName || 'Followup Doc'
            }));
          const docs = [...initFiles, ...commentFiles];
          const firstDoc = docs[0] || null;

          setSlideActivePreviewFile(firstDoc);
          
          let targetStatus = 'In Progress';
          if (currentIssue.status === 'Closed' || currentIssue.status === 'Resolved') {
            const isTPOrZoneUser = currentUser.roleId === 'eo' || currentUser.roleId === 'ad';
            if (!isTPOrZoneUser) {
              targetStatus = 'Resolved';
            }
          }
          setSlideUpdateStatus(targetStatus as any);
          setSlideUpdateNotes('');
          setSlideUpdateAttachment(null);
        }
      }
    } else {
      prevSlideViewActiveRef.current = false;
      prevSlideIndexRef.current = -1;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlideIndex, isSlideViewActive, sortedIssues]);

  useEffect(() => {
    if (!isSlideViewActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrevSlide();
      if (e.key === 'ArrowRight') handleNextSlide();
      if (e.key === 'Escape') setIsSlideViewActive(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSlideViewActive, activeSlideIndex, sortedIssues]);

  useEffect(() => {
    if (isSlideViewActive) {
      const enterFS = () => {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          docEl.requestFullscreen().catch((err) => console.warn("Fullscreen request failed", err));
        } else if ((docEl as any).webkitRequestFullscreen) {
          (docEl as any).webkitRequestFullscreen();
        } else if ((docEl as any).msRequestFullscreen) {
          (docEl as any).msRequestFullscreen();
        }
      };
      enterFS();
    } else {
      const exitFS = () => {
        if (document.fullscreenElement) {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch((err) => console.warn("Exit fullscreen failed", err));
          } else if ((document as any).webkitExitFullscreen) {
            (document as any).webkitExitFullscreen();
          } else if ((document as any).msExitFullscreen) {
            (document as any).msExitFullscreen();
          }
        }
      };
      exitFS();
    }
  }, [isSlideViewActive]);


  const tObj = (obj: any) => lang === 'ta' ? (obj.nameTa || obj.nameEn) : obj.nameEn;

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) return <span className="ml-1 text-gray-300">↕</span>;
    return sortOrder === 'asc' ? <span className="ml-1 text-indigo-600">↑</span> : <span className="ml-1 text-indigo-600">↓</span>;
  };

  const downloadExcel = (tableType: 'abstract' | 'detailed') => {
    let title = '';
    let filename = '';
    let contentHtml = '';

    if (tableType === 'abstract') {
      title = lang === 'ta' 
        ? `பிரச்சினைகள் கண்காணிப்பு அட்டவணை சுருக்கம் (${abstractViewMode === 'category' ? 'வகை வாரியாக' : abstractViewMode === 'zone' ? 'மண்டல வாரியாக' : 'மாவட்ட வாரியாக'})`
        : `Issues Monitoring Abstract Summary (${abstractViewMode === 'category' ? 'Category-wise' : abstractViewMode === 'zone' ? 'Zone-wise' : 'District-wise'})`;
      filename = `Abstract_Summary_${abstractViewMode}_${new Date().toISOString().split('T')[0]}.xls`;

      // Headers
      let headerRow = '';
      if (abstractViewMode === 'category') {
        headerRow = `
          <tr>
            <th style="background-color: #4f46e5; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 12px; text-align: left;">${lang === 'ta' ? 'பிரிவு' : 'Category'}</th>
            <th style="background-color: #4f46e5; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 12px; text-align: left;">${lang === 'ta' ? 'துணைப் பிரிவு' : 'Subcategory'}</th>
            <th style="background-color: #4f46e5; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 12px; text-align: center;">${lang === 'ta' ? 'மொத்தப் பிரச்சினைகள்' : 'Total Issues'}</th>
            <th style="background-color: #d97706; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 12px; text-align: center;">${lang === 'ta' ? 'நிலுவை (Pending)' : 'Pending'}</th>
            <th style="background-color: #2563eb; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 12px; text-align: center;">${lang === 'ta' ? 'செயல்பாட்டில் (In Progress)' : 'In Progress'}</th>
            <th style="background-color: #16a34a; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 12px; text-align: center;">${lang === 'ta' ? 'தீர்க்கப்பட்டவை (Resolved)' : 'Resolved'}</th>
          </tr>
        `;
      } else if (abstractViewMode === 'zone') {
        headerRow = `
          <tr>
            <th style="background-color: #4f46e5; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 12px; text-align: left;">${lang === 'ta' ? 'மண்டலம்' : 'Zone'}</th>
            <th style="background-color: #4f46e5; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 12px; text-align: center;">${lang === 'ta' ? 'மொத்தப் பிரச்சினைகள்' : 'Total Issues'}</th>
            <th style="background-color: #d97706; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 12px; text-align: center;">${lang === 'ta' ? 'நிலுவை (Pending)' : 'Pending'}</th>
            <th style="background-color: #2563eb; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 12px; text-align: center;">${lang === 'ta' ? 'செயல்பாட்டில் (In Progress)' : 'In Progress'}</th>
            <th style="background-color: #16a34a; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 12px; text-align: center;">${lang === 'ta' ? 'தீர்க்கப்பட்டவை (Resolved)' : 'Resolved'}</th>
          </tr>
        `;
      } else {
        headerRow = `
          <tr>
            <th style="background-color: #4f46e5; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 12px; text-align: left;">${lang === 'ta' ? 'மண்டலம்' : 'Zone'}</th>
            <th style="background-color: #4f46e5; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 12px; text-align: left;">${lang === 'ta' ? 'மாவட்டம்' : 'District'}</th>
            <th style="background-color: #4f46e5; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 12px; text-align: center;">${lang === 'ta' ? 'மொத்தப் பிரச்சினைகள்' : 'Total Issues'}</th>
            <th style="background-color: #d97706; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 12px; text-align: center;">${lang === 'ta' ? 'நிலுவை (Pending)' : 'Pending'}</th>
            <th style="background-color: #2563eb; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 12px; text-align: center;">${lang === 'ta' ? 'செயல்பாட்டில் (In Progress)' : 'In Progress'}</th>
            <th style="background-color: #16a34a; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 12px; text-align: center;">${lang === 'ta' ? 'தீர்க்கப்பட்டவை (Resolved)' : 'Resolved'}</th>
          </tr>
        `;
      }

      // Rows calculation
      let rowsHtml = '';
      let totalIssuesSum = 0;
      let pendingIssuesSum = 0;
      let inProgressIssuesSum = 0;
      let resolvedIssuesSum = 0;

      if (abstractViewMode === 'category') {
        CATEGORIES.forEach((cat: any) => {
          cat.subcategories.forEach((sub: any) => {
            const subcatIssues = reportBaseIssues.filter((i: any) => i.category === cat.id && i.subcategory === sub.id);
            const total = subcatIssues.length;
            const pending = subcatIssues.filter((i: any) => i.status === 'Pending').length;
            const inProgress = subcatIssues.filter((i: any) => i.status === 'In Progress' || i.status === 'Active').length;
            const resolved = subcatIssues.filter((i: any) => i.status === 'Resolved' || i.status === 'Closed').length;

            totalIssuesSum += total;
            pendingIssuesSum += pending;
            inProgressIssuesSum += inProgress;
            resolvedIssuesSum += resolved;

            rowsHtml += `
              <tr style="background-color: #ffffff;">
                <td style="border: 1px solid #cbd5e1; padding: 10px; font-weight: bold; text-align: left; white-space: normal;">${lang === 'ta' ? cat.nameTa : cat.nameEn}</td>
                <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: left; white-space: normal;">${lang === 'ta' ? sub.nameTa : sub.nameEn}</td>
                <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: bold;">${total}</td>
                <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #d97706; font-weight: bold;">${pending}</td>
                <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #2563eb; font-weight: bold;">${inProgress}</td>
                <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #16a34a; font-weight: bold;">${resolved}</td>
              </tr>
            `;
          });
        });
      } else if (abstractViewMode === 'zone') {
        zones.forEach((zone: any) => {
          const zoneTPs = townPanchayats.filter((tp: any) => getTPZoneId(tp) === zone.id);
          const tpIds = zoneTPs.map((tp: any) => tp.id);
          const zoneIssues = reportBaseIssues.filter((i: any) => tpIds.includes(i.townPanchayatId));
          const total = zoneIssues.length;
          const pending = zoneIssues.filter((i: any) => i.status === 'Pending').length;
          const inProgress = zoneIssues.filter((i: any) => i.status === 'In Progress' || i.status === 'Active').length;
          const resolved = zoneIssues.filter((i: any) => i.status === 'Resolved' || i.status === 'Closed').length;

          totalIssuesSum += total;
          pendingIssuesSum += pending;
          inProgressIssuesSum += inProgress;
          resolvedIssuesSum += resolved;

          rowsHtml += `
            <tr style="background-color: #ffffff;">
              <td style="border: 1px solid #cbd5e1; padding: 10px; font-weight: bold; text-align: left; white-space: normal;">${tObj(zone)}</td>
              <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: bold;">${total}</td>
              <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #d97706; font-weight: bold;">${pending}</td>
              <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #2563eb; font-weight: bold;">${inProgress}</td>
              <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #16a34a; font-weight: bold;">${resolved}</td>
            </tr>
          `;
        });
      } else {
        const userDistricts = currentUser.scopeType === 'Zone' 
          ? districts.filter((d: any) => d.zoneId === currentUser.scopeId) 
          : districts;

        userDistricts.forEach((district: any) => {
          const distTPs = townPanchayats.filter((tp: any) => tp.districtId === district.id);
          const tpIds = distTPs.map((tp: any) => tp.id);
          const distIssues = reportBaseIssues.filter((i: any) => tpIds.includes(i.townPanchayatId));
          const total = distIssues.length;
          const pending = distIssues.filter((i: any) => i.status === 'Pending').length;
          const inProgress = distIssues.filter((i: any) => i.status === 'In Progress' || i.status === 'Active').length;
          const resolved = distIssues.filter((i: any) => i.status === 'Resolved' || i.status === 'Closed').length;
          const zone = zones.find((z: any) => z.id === district.zoneId);

          totalIssuesSum += total;
          pendingIssuesSum += pending;
          inProgressIssuesSum += inProgress;
          resolvedIssuesSum += resolved;

          rowsHtml += `
            <tr style="background-color: #ffffff;">
              <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: left; white-space: normal;">${zone ? tObj(zone) : ''}</td>
              <td style="border: 1px solid #cbd5e1; padding: 10px; font-weight: bold; text-align: left; white-space: normal;">${tObj(district)}</td>
              <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; font-weight: bold;">${total}</td>
              <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #d97706; font-weight: bold;">${pending}</td>
              <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #2563eb; font-weight: bold;">${inProgress}</td>
              <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: center; color: #16a34a; font-weight: bold;">${resolved}</td>
            </tr>
          `;
        });
      }

      // Grand total row
      const colSpanAbstract = abstractViewMode === 'category' ? 2 : abstractViewMode === 'district' ? 2 : 1;
      rowsHtml += `
        <tr style="background-color: #f1f5f9; font-weight: bold;">
          <td colspan="${colSpanAbstract}" style="border: 1.5px solid #94a3b8; padding: 12px; text-align: left; font-weight: bold;">${lang === 'ta' ? 'மொத்தம்' : 'TOTAL'}</td>
          <td style="border: 1.5px solid #94a3b8; padding: 12px; text-align: center; font-weight: bold; font-size: 11pt;">${totalIssuesSum}</td>
          <td style="border: 1.5px solid #94a3b8; padding: 12px; text-align: center; color: #d97706; font-weight: bold; font-size: 11pt;">${pendingIssuesSum}</td>
          <td style="border: 1.5px solid #94a3b8; padding: 12px; text-align: center; color: #2563eb; font-weight: bold; font-size: 11pt;">${inProgressIssuesSum}</td>
          <td style="border: 1.5px solid #94a3b8; padding: 12px; text-align: center; color: #16a34a; font-weight: bold; font-size: 11pt;">${resolvedIssuesSum}</td>
        </tr>
      `;

      contentHtml = `
        <table>
          <thead>
            ${headerRow}
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;

    } else {
      // Detailed ledger
      title = lang === 'ta' ? 'விவரமானப் பிரச்சினைகள் பட்டியல்' : 'Detailed Issues Ledger';
      filename = `Detailed_Issues_${new Date().toISOString().split('T')[0]}.xls`;

      const headers = [
        lang === 'ta' ? 'விண்ணப்ப எண்' : 'Issue ID',
        lang === 'ta' ? 'மண்டலம்' : 'Zone',
        lang === 'ta' ? 'மாவட்டம்' : 'District',
        lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat',
        lang === 'ta' ? 'பொருள்' : 'Subject',
        lang === 'ta' ? 'விவரங்கள்' : 'Issue Details',
        lang === 'ta' ? 'வகை' : 'Category',
        lang === 'ta' ? 'உட்பிரிவு' : 'Subcategory',
        lang === 'ta' ? 'தேதி' : 'Created Date',
        lang === 'ta' ? 'கடைசியாக புதுப்பிக்கப்பட்டது' : 'Last Updated Date',
        lang === 'ta' ? 'கடைசி புதுப்பிப்பு விவரம் / கருத்து' : 'Last Update Remarks',
        lang === 'ta' ? 'கடைசியாக புதுப்பித்தவர்' : 'Last Updated By',
        lang === 'ta' ? 'நிலை' : 'Stage Status'
      ];

      let headerRow = '<tr>';
      headers.forEach(h => {
        headerRow += `<th style="background-color: #1e1b4b; color: #ffffff; font-weight: bold; border: 1px solid #cbd5e1; padding: 12px; text-align: left;">${h}</th>`;
      });
      headerRow += '</tr>';

      let rowsHtml = '';
      sortedIssues.forEach((issue: any) => {
        const catName = CATEGORIES_MAP[issue.category]?.[lang] || issue.category;
        const subcatName = getSubcategoryName(issue.category, issue.subcategory, lang);
        const zoneName = getZoneNameByTP(issue.townPanchayatId);
        const districtName = getDistrictNameByTP(issue.townPanchayatId);
        const tpName = getTPName(issue.townPanchayatId);
        const createdDate = new Date(issue.createdAt).toLocaleDateString();
        const updatedDate = issue.updatedAt ? new Date(issue.updatedAt).toLocaleDateString() : createdDate;
        const displayStatus = issue.status === 'Closed' ? 'Resolved' : issue.status;
        const statusLabel = lang === 'ta' 
          ? (displayStatus === 'Pending' ? 'நிலுவை' : displayStatus === 'In Progress' ? 'நடவடிக்கை' : 'தீர்க்கப்பட்டது')
          : displayStatus;

        const lastComment = issue.comments && issue.comments.length > 0 ? issue.comments[issue.comments.length - 1] : null;
        const lastUpdateNotes = lastComment ? lastComment.notes : '';
        const lastUpdateUser = lastComment ? (lang === 'ta' ? (lastComment.userNameTa || lastComment.userName) : lastComment.userName) : '';
        const lastUpdateDesignation = lastComment ? lastComment.userDesignation : '';
        const lastUpdateStaff = lastUpdateUser ? `${lastUpdateUser} (${lastUpdateDesignation || ''})` : '';

        let statusColor = '#000000';
        if (issue.status === 'Active') {
          statusColor = (issue.comments && issue.comments.length > 1) ? '#6b21a8' : '#b45309';
        } else if (issue.status === 'Closed' || issue.status === 'Resolved') {
          statusColor = '#16a34a';
        }

        rowsHtml += `
          <tr style="background-color: #ffffff;">
            <td style="border: 1px solid #cbd5e1; padding: 10px; font-weight: bold; mso-number-format: '\\@';">${issue.issueId}</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px;">${zoneName}</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px;">${districtName}</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; font-weight: bold;">${tpName}</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; font-weight: normal;">${issue.subject || '-'}</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; font-weight: normal;">${issue.issueDetails || '-'}</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; font-weight: bold;">${catName}</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px;">${subcatName}</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px;">${createdDate}</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px;">${updatedDate}</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px;">${lastUpdateNotes || '-'}</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px;">${lastUpdateStaff || '-'}</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; font-weight: bold; color: ${statusColor};">${statusLabel}</td>
          </tr>
        `;
      });

      contentHtml = `
        <table>
          <thead>
            ${headerRow}
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      `;
    }

    const template = `
      <` + `html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Sheet1</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
          table { border-collapse: collapse; width: 100%; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 10pt; }
          th { font-weight: bold; background-color: #f1f5f9; }
        </style>
      </head>
      <body>
        <h2 style="color: #1e1b4b; font-family: sans-serif; margin-bottom: 20px;">${title}</h2>
        ${contentHtml}
      </body>
      </` + `html>
    `;

    const blob = new Blob([template], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculations for 3-stage KPI cards (Active vs Resolved)
  const statsActive = visibleIssues.filter((i: any) => i.status !== 'Closed' && i.status !== 'Resolved').length;
  const statsClosed = visibleIssues.filter((i: any) => i.status === 'Closed' || i.status === 'Resolved').length;
  const statsTotal = visibleIssues.length;
  const resolutionRate = statsTotal > 0 ? Math.round((statsClosed / statsTotal) * 100) : 0;

  // Chart aggregation: Issues by Category
  const categoryChartData = CATEGORIES.map((cat: any) => {
    const count = visibleIssues.filter((iss: any) => iss.category === cat.id).length;
    return {
      name: t(cat.nameEn, cat.nameTa),
      id: cat.id,
      count
    };
  });

  return (
    <div id="pending-issues-monitoring-module" className="space-y-6">
      
      {/* Title block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <AlertTriangle className="w-6 h-6 animate-pulse" style={{ color: currentTheme.accentColor }} />
            {t('Pending Issues Monitoring & Resolution', 'பிரச்சனைகள் கண்காணிப்பு தளம்')}
          </h2>
          <p className="text-gray-500 text-xs mt-1.5 font-medium">
            {t('Monitor, configure dynamic fields, submit, and resolve Town Panchayat category issues.', 'மண்டல மற்றும் இயக்கக அலுவலர்கள் கண்காணித்து தீர்வு காணும் தளம்.')}
          </p>
        </div>
        
        {/* Toggle tabs */}
        <div className="flex gap-1.5 p-1 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveSubTab('directory')}
            style={activeSubTab === 'directory' ? { color: currentTheme.accentColor } : {}}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all ${activeSubTab === 'directory' ? 'bg-white shadow-xs' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <FileText className="w-4 h-4" />
            <span>{t('Issues Report', 'பிரச்சனைகள் அறிக்கை')}</span>
          </button>
          {isTPUser && (
            <button
              onClick={() => setActiveSubTab('create')}
              style={activeSubTab === 'create' ? { color: currentTheme.accentColor } : {}}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all ${activeSubTab === 'create' ? 'bg-white shadow-xs' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t('New Issues', 'புதிய பிரச்சனைகள்')}</span>
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setActiveSubTab('schema')}
              style={activeSubTab === 'schema' ? { color: currentTheme.accentColor } : {}}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition-all ${activeSubTab === 'schema' ? 'bg-white shadow-xs' : 'text-gray-500 hover:text-gray-900'}`}
            >
              <Sliders className="w-4 h-4" />
              <span>{t('Configure Fields', 'புலங்கள் கட்டமைப்பு')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2"
          >
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span>{successMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SUB-TAB 2: ISSUES DIRECTORY / REPORT */}
      {activeSubTab === 'directory' && (
        <div className="space-y-6">
          
          {/* Issues Monitoring Abstract Register Section */}
          <div id="abstract-register-section" className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-6">
            <div>
              <h3 className="text-md font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-indigo-600" />
                {lang === 'ta' ? 'பிரச்சினைகள் கண்காணிப்பு அட்டவணை' : 'Issues Monitoring Abstract Register'}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {lang === 'ta' 
                  ? 'மண்டலம், மாவட்டம், பேரூராட்சி மற்றும் நிலைகளின் அடிப்படையில் வடிகட்டக்கூடிய சுருக்க அறிக்கை' 
                  : 'Interactive abstract ledger with real-time dynamic charts updating according to active filter subsets.'}
              </p>
            </div>

            {/* Dynamic Filters Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 p-4 bg-gray-50/50 rounded-2xl border border-gray-100">
              {/* Zone Filter */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  {lang === 'ta' ? 'மண்டலம்' : 'Zone'}
                </label>
                <select
                  value={filterZoneId}
                  onChange={(e) => {
                    setFilterZoneId(e.target.value);
                    setFilterDistrictId('');
                    setFilterTPId('');
                  }}
                  disabled={isZoneUser || isTPUser}
                  className="w-full text-xs p-2.5 rounded-xl border border-gray-200 outline-none bg-white font-medium disabled:opacity-60"
                >
                  <option value="">{lang === 'ta' ? 'அனைத்து மண்டலங்கள்' : 'All Zones'}</option>
                  {allowedZones.map((z: any) => (
                    <option key={z.id} value={z.id}>{tObj(z)}</option>
                  ))}
                </select>
              </div>

              {/* District Filter */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  {lang === 'ta' ? 'மாவட்டம்' : 'District'}
                </label>
                <select
                  value={filterDistrictId}
                  onChange={(e) => {
                    setFilterDistrictId(e.target.value);
                    setFilterTPId('');
                  }}
                  disabled={isTPUser}
                  className="w-full text-xs p-2.5 rounded-xl border border-gray-200 outline-none bg-white font-medium disabled:opacity-60"
                >
                  <option value="">{lang === 'ta' ? 'அனைத்து மாவட்டங்கள்' : 'All Districts'}</option>
                  {availableDistricts.map((d: any) => (
                    <option key={d.id} value={d.id}>{tObj(d)}</option>
                  ))}
                </select>
              </div>

              {/* Town Panchayat Filter */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  {lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat'}
                </label>
                <select
                  value={filterTPId}
                  onChange={(e) => setFilterTPId(e.target.value)}
                  disabled={isTPUser}
                  className="w-full text-xs p-2.5 rounded-xl border border-gray-200 outline-none bg-white font-medium disabled:opacity-60"
                >
                  <option value="">{lang === 'ta' ? 'அனைத்து பேரூராட்சிகள்' : 'All Town Panchayats'}</option>
                  {availableTPs.map((tp: any) => (
                    <option key={tp.id} value={tp.id}>{tObj(tp)}</option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  {lang === 'ta' ? 'பிரிவு (Category)' : 'Category'}
                </label>
                <select
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setFilterSubcategory('');
                  }}
                  className="w-full text-xs p-2.5 rounded-xl border border-gray-200 outline-none bg-white font-medium"
                >
                  <option value="">{lang === 'ta' ? 'அனைத்து பிரிவுகள்' : 'All Categories'}</option>
                  {Object.keys(CATEGORIES_MAP).map((catId) => (
                    <option key={catId} value={catId}>
                      {lang === 'ta' ? CATEGORIES_MAP[catId].ta : CATEGORIES_MAP[catId].en}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stage / Status Filter */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                  {lang === 'ta' ? 'நிலை (Stage)' : 'Stage / Status'}
                </label>
                <select
                  value={filterStage}
                  onChange={(e) => setFilterStage(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-gray-200 outline-none bg-white font-medium"
                >
                  <option value="">{lang === 'ta' ? 'அனைத்து நிலைகள்' : 'All Stages'}</option>
                  <option value="Pending">{lang === 'ta' ? 'நிலுவை (Pending)' : 'Pending'}</option>
                  <option value="In Progress">{lang === 'ta' ? 'நடவடிக்கை (In Progress)' : 'In Progress'}</option>
                  <option value="Resolved">{lang === 'ta' ? 'தீர்க்கப்பட்டது (Resolved)' : 'Resolved'}</option>
                </select>
              </div>
            </div>

            {/* Abstract Table */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-2 rounded-2xl border border-gray-100">
                {/* View Mode Toggles */}
                <div className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-100 shrink-0">
                  {permissibleModes.includes('category') && (
                    <button
                      type="button"
                      onClick={() => {
                        setAbstractViewMode('category');
                        setSelectedAbstractCategory('');
                        setSelectedAbstractSubcategory('');
                        setSelectedAbstractStatus('');
                      }}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        abstractViewMode === 'category'
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {lang === 'ta' ? 'வகை வாரியாக' : 'Category Wise'}
                    </button>
                  )}
                  {permissibleModes.includes('zone') && (
                    <button
                      type="button"
                      onClick={() => {
                        setAbstractViewMode('zone');
                        setSelectedAbstractCategory('');
                        setSelectedAbstractSubcategory('');
                        setSelectedAbstractStatus('');
                      }}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        abstractViewMode === 'zone'
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {lang === 'ta' ? 'மண்டல வாரியாக' : 'Zone Wise'}
                    </button>
                  )}
                  {permissibleModes.includes('district') && (
                    <button
                      type="button"
                      onClick={() => {
                        setAbstractViewMode('district');
                        setSelectedAbstractCategory('');
                        setSelectedAbstractSubcategory('');
                        setSelectedAbstractStatus('');
                      }}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        abstractViewMode === 'district'
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {lang === 'ta' ? 'மாவட்ட வாரியாக' : 'District Wise'}
                    </button>
                  )}
                </div>

                {/* Abstract download button */}
                <button
                  type="button"
                  onClick={() => downloadExcel('abstract')}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gray-50 border border-gray-100 hover:bg-gray-100 text-slate-700 text-xs font-extrabold transition cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>{lang === 'ta' ? 'சுருக்கப் பட்டியல் பதிவிறக்கம் (Excel)' : 'Download Abstract Excel'}</span>
                </button>
              </div>

              {/* Table rendering based on abstract mode */}
              <div className="overflow-x-auto rounded-2xl border border-gray-150">
                <table className="w-full text-center text-xs border-collapse">
                  {abstractViewMode === 'category' && (
                    <>
                      <thead>
                        <tr className="bg-slate-50 font-bold text-slate-600 border-b border-gray-150 text-[10px] uppercase tracking-wider">
                          <th className="p-3 text-left border-r border-gray-150">{lang === 'ta' ? 'பிரிவு' : 'Category'}</th>
                          <th className="p-3 text-left border-r border-gray-150">{lang === 'ta' ? 'துணைப் பிரிவு' : 'Subcategory'}</th>
                          <th className="p-3 border-r border-gray-150">{lang === 'ta' ? 'மொத்தப் பிரச்சினைகள்' : 'Total Issues'}</th>
                          <th className="p-3 border-r border-gray-150 text-amber-700">{lang === 'ta' ? 'நிலுவை (Pending)' : 'Pending'}</th>
                          <th className="p-3 border-r border-gray-150 text-indigo-700">{lang === 'ta' ? 'செயல்பாட்டில் (In Progress)' : 'In Progress'}</th>
                          <th className="p-3 border-r border-gray-150 text-emerald-700">{lang === 'ta' ? 'தீர்க்கப்பட்டவை (Resolved)' : 'Resolved'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-150 font-medium text-slate-700">
                        {(() => {
                          const abstractCategories = filterCategory
                            ? CATEGORIES.filter((cat: any) => cat.id === filterCategory)
                            : CATEGORIES;

                          let catTotal = 0;
                          let catPending = 0;
                          let catInProgress = 0;
                          let catResolved = 0;

                          const rows = abstractCategories.flatMap((cat: any) => {
                            return (cat.subcategories || []).map((sub: any) => {
                              const matches = reportBaseIssues.filter((i: any) => i.category === cat.id && i.subcategory === sub.id);
                              const total = matches.length;
                              const pending = matches.filter((i: any) => i.status === 'Pending').length;
                              const inProgress = matches.filter((i: any) => i.status === 'In Progress' || i.status === 'Active').length;
                              const resolved = matches.filter((i: any) => i.status === 'Resolved' || i.status === 'Closed').length;

                              catTotal += total;
                              catPending += pending;
                              catInProgress += inProgress;
                              catResolved += resolved;

                              const isSelected = selectedAbstractCategory === cat.id && selectedAbstractSubcategory === sub.id;

                              return (
                                <tr 
                                  key={`${cat.id}-${sub.id}`} 
                                  className={`hover:bg-slate-50/40 transition cursor-pointer ${isSelected ? 'bg-indigo-50/70 font-bold' : ''}`}
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedAbstractCategory('');
                                      setSelectedAbstractSubcategory('');
                                    } else {
                                      setSelectedAbstractCategory(cat.id);
                                      setSelectedAbstractSubcategory(sub.id);
                                    }
                                  }}
                                >
                                  <td className="p-3 text-left font-bold border-r border-gray-150 bg-slate-50/20">{t(cat.nameEn, cat.nameTa)}</td>
                                  <td className="p-3 text-left border-r border-gray-150">{t(sub.nameEn, sub.nameTa)}</td>
                                  <td className="p-3 border-r border-gray-150 font-bold">{total}</td>
                                  <td className="p-3 border-r border-gray-150 font-bold text-amber-600">{pending}</td>
                                  <td className="p-3 border-r border-gray-150 font-bold text-indigo-600">{inProgress}</td>
                                  <td className="p-3 border-r border-gray-150 font-bold text-emerald-600">{resolved}</td>
                                </tr>
                              );
                            });
                          });

                          return (
                            <>
                              {rows}
                              <tr className="bg-slate-100 font-extrabold text-slate-950 border-t-2 border-gray-300">
                                <td className="p-3 text-left font-black border-r border-gray-150" colSpan={2}>
                                  {lang === 'ta' ? 'மொத்தம்' : 'Total'}
                                </td>
                                <td className="p-3 border-r border-gray-150 font-black">{catTotal}</td>
                                <td className="p-3 border-r border-gray-150 font-black text-amber-800">{catPending}</td>
                                <td className="p-3 border-r border-gray-150 font-black text-indigo-800">{catInProgress}</td>
                                <td className="p-3 border-r border-gray-150 font-black text-emerald-800">{catResolved}</td>
                              </tr>
                            </>
                          );
                        })()}
                      </tbody>
                    </>
                  )}

                  {abstractViewMode === 'zone' && (
                    <>
                      <thead>
                        <tr className="bg-slate-50 font-bold text-slate-600 border-b border-gray-150 text-[10px] uppercase tracking-wider">
                          <th className="p-3 text-left border-r border-gray-150">{lang === 'ta' ? 'மண்டலம்' : 'Zone'}</th>
                          <th className="p-3 border-r border-gray-150">{lang === 'ta' ? 'மொத்தப் பிரச்சினைகள்' : 'Total Issues'}</th>
                          <th className="p-3 border-r border-gray-150 text-amber-700">{lang === 'ta' ? 'நிலுவை (Pending)' : 'Pending'}</th>
                          <th className="p-3 border-r border-gray-150 text-indigo-700">{lang === 'ta' ? 'செயல்பாட்டில் (In Progress)' : 'In Progress'}</th>
                          <th className="p-3 border-r border-gray-150 text-emerald-700">{lang === 'ta' ? 'தீர்க்கப்பட்டவை (Resolved)' : 'Resolved'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-150 font-medium text-slate-700">
                        {(() => {
                          let zoneTotal = 0;
                          let zonePending = 0;
                          let zoneInProgress = 0;
                          let zoneResolved = 0;

                          const rows = zones.map((zone: any) => {
                            const zoneTPs = townPanchayats.filter((tp: any) => getTPZoneId(tp) === zone.id);
                            const tpIds = zoneTPs.map((tp: any) => tp.id);
                            const zoneIssues = reportBaseIssues.filter((i: any) => tpIds.includes(i.townPanchayatId));
                            const total = zoneIssues.length;
                            const pending = zoneIssues.filter((i: any) => i.status === 'Pending').length;
                            const inProgress = zoneIssues.filter((i: any) => i.status === 'In Progress' || i.status === 'Active').length;
                            const resolved = zoneIssues.filter((i: any) => i.status === 'Resolved' || i.status === 'Closed').length;

                            zoneTotal += total;
                            zonePending += pending;
                            zoneInProgress += inProgress;
                            zoneResolved += resolved;

                            const isSelected = filterZoneId === zone.id;

                            return (
                              <tr 
                                key={zone.id} 
                                className={`hover:bg-slate-50/40 transition cursor-pointer ${isSelected ? 'bg-indigo-50/70 font-bold' : ''}`}
                                onClick={() => {
                                  if (isSelected) {
                                    setFilterZoneId('');
                                  } else {
                                    setFilterZoneId(zone.id);
                                    setFilterDistrictId('');
                                    setFilterTPId('');
                                  }
                                }}
                              >
                                <td className="p-3 text-left font-bold border-r border-gray-150 bg-slate-50/20">{tObj(zone)}</td>
                                <td className="p-3 font-bold border-r border-gray-150">{total}</td>
                                <td className="p-3 border-r border-gray-150 font-bold text-amber-600">{pending}</td>
                                <td className="p-3 border-r border-gray-150 font-bold text-indigo-600">{inProgress}</td>
                                <td className="p-3 border-r border-gray-150 font-bold text-emerald-600">{resolved}</td>
                              </tr>
                            );
                          });

                          return (
                            <>
                              {rows}
                              <tr className="bg-slate-100 font-extrabold text-slate-950 border-t-2 border-gray-300">
                                <td className="p-3 text-left font-black border-r border-gray-150">
                                  {lang === 'ta' ? 'மொத்தம்' : 'Total'}
                                </td>
                                <td className="p-3 font-black border-r border-gray-150">{zoneTotal}</td>
                                <td className="p-3 border-r border-gray-150 font-black text-amber-800">{zonePending}</td>
                                <td className="p-3 border-r border-gray-150 font-black text-indigo-800">{zoneInProgress}</td>
                                <td className="p-3 border-r border-gray-150 font-black text-emerald-800">{zoneResolved}</td>
                              </tr>
                            </>
                          );
                        })()}
                      </tbody>
                    </>
                  )}

                  {abstractViewMode === 'district' && (
                    <>
                      <thead>
                        <tr className="bg-slate-50 font-bold text-slate-600 border-b border-gray-150 text-[10px] uppercase tracking-wider">
                          <th className="p-3 text-left border-r border-gray-150">{lang === 'ta' ? 'மண்டலம்' : 'Zone'}</th>
                          <th className="p-3 text-left border-r border-gray-150">{lang === 'ta' ? 'மாவட்டம்' : 'District'}</th>
                          <th className="p-3 border-r border-gray-150">{lang === 'ta' ? 'மொத்தப் பிரச்சினைகள்' : 'Total Issues'}</th>
                          <th className="p-3 border-r border-gray-150 text-amber-700">{lang === 'ta' ? 'நிலுவை (Pending)' : 'Pending'}</th>
                          <th className="p-3 border-r border-gray-150 text-indigo-700">{lang === 'ta' ? 'செயல்பாட்டில் (In Progress)' : 'In Progress'}</th>
                          <th className="p-3 border-r border-gray-150 text-emerald-700">{lang === 'ta' ? 'தீர்க்கப்பட்டவை (Resolved)' : 'Resolved'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-150 font-medium text-slate-700">
                        {(() => {
                          let distTotal = 0;
                          let distPending = 0;
                          let distInProgress = 0;
                          let distResolved = 0;

                          const rows = districts.map((district: any) => {
                            const distTPs = townPanchayats.filter((tp: any) => tp.districtId === district.id);
                            const tpIds = distTPs.map((tp: any) => tp.id);
                            const districtIssues = reportBaseIssues.filter((i: any) => tpIds.includes(i.townPanchayatId));
                            const total = districtIssues.length;
                            const pending = districtIssues.filter((i: any) => i.status === 'Pending').length;
                            const inProgress = districtIssues.filter((i: any) => i.status === 'In Progress' || i.status === 'Active').length;
                            const resolved = districtIssues.filter((i: any) => i.status === 'Resolved' || i.status === 'Closed').length;

                            distTotal += total;
                            distPending += pending;
                            distInProgress += inProgress;
                            distResolved += resolved;

                            const isSelected = filterDistrictId === district.id;

                            return (
                              <tr 
                                key={district.id} 
                                className={`hover:bg-slate-50/40 transition cursor-pointer ${isSelected ? 'bg-indigo-50/70 font-bold' : ''}`}
                                onClick={() => {
                                  if (isSelected) {
                                    setFilterDistrictId('');
                                  } else {
                                    setFilterDistrictId(district.id);
                                    setFilterTPId('');
                                  }
                                }}
                              >
                                <td className="p-3 text-left border-r border-gray-150 bg-slate-50/20">{getZoneName(district.zoneId)}</td>
                                <td className="p-3 text-left font-bold border-r border-gray-150">{tObj(district)}</td>
                                <td className="p-3 font-bold border-r border-gray-150">{total}</td>
                                <td className="p-3 border-r border-gray-150 font-bold text-amber-600">{pending}</td>
                                <td className="p-3 border-r border-gray-150 font-bold text-indigo-600">{inProgress}</td>
                                <td className="p-3 border-r border-gray-150 font-bold text-emerald-600">{resolved}</td>
                              </tr>
                            );
                          });

                          return (
                            <>
                              {rows}
                              <tr className="bg-slate-100 font-extrabold text-slate-950 border-t-2 border-gray-300">
                                <td className="p-3 text-left font-black border-r border-gray-150 bg-slate-100" colSpan={2}>
                                  {lang === 'ta' ? 'மொத்தம்' : 'Total'}
                                </td>
                                <td className="p-3 font-black border-r border-gray-150">{distTotal}</td>
                                <td className="p-3 border-r border-gray-150 font-black text-amber-800">{distPending}</td>
                                <td className="p-3 border-r border-gray-150 font-black text-indigo-800">{distInProgress}</td>
                                <td className="p-3 border-r border-gray-150 font-black text-emerald-800">{distResolved}</td>
                              </tr>
                            </>
                          );
                        })()}
                      </tbody>
                    </>
                  )}
                </table>
              </div>
            </div>
          </div>

          {/* Abstract Selection Reset Feedback Bar */}
          {(selectedAbstractCategory || selectedAbstractSubcategory || selectedAbstractStatus) && (
            <div className="flex flex-wrap justify-between items-center gap-3 bg-fuchsia-50 p-4 rounded-xl border border-fuchsia-100 text-xs animate-in slide-in-from-top-2 duration-150">
              <span className="font-semibold text-fuchsia-800 flex flex-wrap items-center gap-2">
                <span>{lang === 'ta' ? 'அட்டவணை வடிகட்டப்பட்டது: ' : 'Detailed View Filtered By: '}</span>
                {selectedAbstractCategory && (
                  <span className="bg-white px-2 py-1 rounded-md border border-fuchsia-200">
                    {lang === 'ta' ? 'வகை' : 'Category'}: <strong className="text-fuchsia-900 font-extrabold">{CATEGORIES_MAP[selectedAbstractCategory]?.[lang] || selectedAbstractCategory}</strong>
                  </span>
                )}
                {selectedAbstractSubcategory && (
                  <span className="bg-white px-2 py-1 rounded-md border border-fuchsia-200">
                    {lang === 'ta' ? 'துணைப் பிரிவு' : 'Subcategory'}: <strong className="text-fuchsia-900 font-extrabold">{selectedAbstractSubcategory}</strong>
                  </span>
                )}
                {selectedAbstractStatus && (
                  <span className="bg-white px-2 py-1 rounded-md border border-fuchsia-200">
                    {lang === 'ta' ? 'நிலை' : 'Stage'}: <strong className="text-fuchsia-900 font-extrabold">{selectedAbstractStatus}</strong>
                  </span>
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedAbstractCategory('');
                  setSelectedAbstractSubcategory('');
                  setSelectedAbstractStatus('');
                }}
                className="text-[11px] font-bold text-fuchsia-700 bg-white hover:bg-fuchsia-100 px-3 py-1.5 rounded-lg border border-fuchsia-200 transition cursor-pointer"
              >
                {lang === 'ta' ? 'அனைத்தையும் காட்டு' : 'Clear Cell Selection'}
              </button>
            </div>
          )}

          {/* Search Bar / Fast filter */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col sm:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={lang === 'ta' ? 'மனு எண், துணை வகை அல்லது பொருள் கொண்டு தேடுக...' : 'Search by Issue ID, subcategory, or subject keywords...'}
                className="w-full text-xs font-medium p-3.5 pl-11 border border-gray-200 bg-gray-50/50 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-4" />
            </div>
          </div>

          {/* Detailed Issues Ledger Section */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <span>{lang === 'ta' ? 'விவரமானப் பிரச்சினைகள் பட்டியல்' : 'Detailed Issues Ledger'}</span>
                  <span className="text-xs text-gray-400 font-normal">({lang === 'ta' ? 'காண்பிக்கப்படும் வரிசைகள்' : 'Showing rows'}: {sortedIssues.length})</span>
                </h4>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (sortedIssues.length > 0) {
                      setActiveSlideIndex(0);
                      setIsSlideViewActive(true);
                      if (typeof document !== 'undefined' && document.documentElement.requestFullscreen) {
                        document.documentElement.requestFullscreen().catch((err) => console.log("Fullscreen request failed:", err));
                      }
                    } else {
                      alert(lang === 'ta' ? 'காண்பிக்க பிரச்சினைகள் எதுவும் இல்லை!' : 'No issues to display in slide view!');
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer select-none"
                >
                  <MonitorPlay className="w-4 h-4 text-indigo-200" />
                  <span>{lang === 'ta' ? 'விளக்க காட்சி' : 'Slide View'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadExcel('detailed')}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer select-none"
                >
                  <FileText className="w-4 h-4" />
                  <span>{lang === 'ta' ? 'விவரமானப் பட்டியல் பதிவிறக்கம் (Excel)' : 'Download Detailed Excel'}</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-gray-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 font-bold text-slate-600 border-b border-gray-150 text-[10px] uppercase tracking-wider select-none">
                    <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('issueId')}>
                      <div className="flex items-center">
                        {lang === 'ta' ? 'விண்ணப்ப எண்' : 'Issue ID'}
                        {renderSortIcon('issueId')}
                      </div>
                    </th>
                    <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('zone')}>
                      <div className="flex items-center">
                        {lang === 'ta' ? 'மண்டலம்' : 'Zone'}
                        {renderSortIcon('zone')}
                      </div>
                    </th>
                    <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('district')}>
                      <div className="flex items-center">
                        {lang === 'ta' ? 'மாவட்டம்' : 'District'}
                        {renderSortIcon('district')}
                      </div>
                    </th>
                    <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('townPanchayatId')}>
                      <div className="flex items-center">
                        {lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat'}
                        {renderSortIcon('townPanchayatId')}
                      </div>
                    </th>
                    <th className="p-3 cursor-pointer hover:bg-slate-100 transition min-w-[320px] max-w-[450px]" onClick={() => handleSort('subject')}>
                      <div className="flex items-center">
                        {lang === 'ta' ? 'பொருள் (Subject)' : 'Subject'}
                        {renderSortIcon('subject')}
                      </div>
                    </th>
                    <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('category')}>
                      <div className="flex items-center">
                        {lang === 'ta' ? 'வகை / உட்பிரிவு' : 'Category / Subcategory'}
                        {renderSortIcon('category')}
                      </div>
                    </th>
                    <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('lastUpdated')}>
                      <div className="flex items-center">
                        {lang === 'ta' ? 'கடைசியாக புதுப்பிக்கப்பட்டது' : 'Last Updated'}
                        {renderSortIcon('lastUpdated')}
                      </div>
                    </th>
                    <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('status')}>
                      <div className="flex items-center">
                        {lang === 'ta' ? 'நிலை (Stage)' : 'Stage / Status'}
                        {renderSortIcon('status')}
                      </div>
                    </th>
                    <th className="p-3 text-right">{lang === 'ta' ? 'செயல்கள்' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-medium text-slate-700">
                  {sortedIssues.map((issue: any) => {
                    const catName = CATEGORIES_MAP[issue.category]?.[lang] || issue.category;
                    const lastUpdateDateStr = issue.updatedAt || issue.createdAt;
                    
                    const commentsLength = (issue.comments || []).length;
                    const isClosed = issue.status === 'Closed';
                    const displayStatus = isClosed 
                      ? 'Closed' 
                      : commentsLength > 1 
                        ? 'In Progress' 
                        : 'Pending';

                    return (
                      <tr 
                        key={issue.id} 
                        className="hover:bg-indigo-50/20 transition-colors"
                      >
                        <td className="p-3 font-mono font-bold text-indigo-700">{issue.issueId}</td>
                        <td className="p-3">{getZoneNameByTP(issue.townPanchayatId)}</td>
                        <td className="p-3">{getDistrictNameByTP(issue.townPanchayatId)}</td>
                        <td className="p-3 font-bold text-slate-800">{getTPName(issue.townPanchayatId)}</td>
                        <td className="p-3 min-w-[320px] max-w-[450px] text-slate-800 font-extrabold whitespace-normal break-words leading-relaxed" title={issue.subject || '-'}>
                          {issue.subject || '-'}
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-slate-800">{catName}</span>
                          <span className="text-gray-400 font-semibold"> / {getSubcategoryName(issue.category, issue.subcategory, lang)}</span>
                        </td>
                        <td className="p-3 font-mono text-gray-500">
                          {lastUpdateDateStr ? new Date(lastUpdateDateStr).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          }) : '-'}
                        </td>
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                            displayStatus === 'Pending' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                            displayStatus === 'In Progress' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                            'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}>
                            {lang === 'ta'
                              ? (displayStatus === 'Pending' ? 'நிலுவை' : displayStatus === 'In Progress' ? 'நடவடிக்கை' : 'முடிக்கப்பட்டது')
                              : displayStatus
                            }
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setSelectedIssue(issue);
                                setUpdateStatus(issue.status === 'Closed' ? 'Closed' : 'Active');
                                setUpdateNotes('');
                                setUpdateAttachment(null);
                              }}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition font-bold text-xs flex items-center gap-1 cursor-pointer"
                              title={t('View Details & Updates', 'விவரங்கள் மற்றும் நடவடிக்கை பதிவு')}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{t('Details & Updates', 'விவரம் & பதிவு')}</span>
                            </button>
                            {(isAdmin || (isTPUser && issue.status !== 'Closed')) && (
                              <button
                                onClick={() => handleDeleteIssue(issue.id)}
                                className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition cursor-pointer"
                                title={t('Delete Issue', 'நீக்குக')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {sortedIssues.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-gray-400 font-semibold italic bg-white">
                        {lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்ட வடிகட்டிகளில் பிரச்சினைகள் எதுவும் இல்லை.' : 'No issues match the selected filter criteria.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: CREATE NEW ISSUE (TP Users only) */}
      {activeSubTab === 'create' && isTPUser && (
        <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-xs space-y-8 w-full">
          <div className="border-b border-gray-100 pb-5">
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">{t('Submit New Issue', 'புதிய பிரச்சனை சமர்ப்பிப்பு')}</h3>
            <p className="text-gray-400 text-xs mt-1">
              {t('Select category, choose subcategory, fill out the dynamic fields, and upload supporting documents.', 'சரியான வகை மற்றும் உட்பிரிவை தேர்ந்தெடுத்து, கேட்கப்பட்ட விவரங்களை உள்ளிடவும்.')}
            </p>
          </div>

          <form onSubmit={handleIssueSubmit} className="space-y-8">
            
            {/* Category selection - Tab Design */}
            <div className="space-y-3">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">{t('Select Category', 'பிரச்சினை வகை')}</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {CATEGORIES.map((cat: any) => {
                  const isActive = formCategory === cat.id;
                  
                  let IconComponent = HelpCircle;
                  if (cat.id === 'works') IconComponent = Building;
                  else if (cat.id === 'establishment') IconComponent = Users;
                  else if (cat.id === 'online_services') IconComponent = Globe;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setFormCategory(cat.id);
                        // Automatically set first subcategory
                        const subcat = cat.subcategories[0]?.id || '';
                        setFormSubcategory(subcat);
                        setDynamicFormValues({});
                      }}
                      style={isActive ? {
                        borderColor: currentTheme.accentColor,
                        backgroundColor: `${currentTheme.accentColor}0e`,
                        color: currentTheme.accentColor,
                        boxShadow: `0 0 0 1px ${currentTheme.accentColor}`
                      } : {}}
                      className={`flex items-center gap-3 p-3.5 px-4 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                        isActive 
                          ? 'shadow-2xs font-bold' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50 bg-white text-slate-700'
                      }`}
                    >
                      <IconComponent className="w-4 h-4 shrink-0" style={{ color: isActive ? currentTheme.accentColor : '#9ca3af' }} />
                      <span className="font-extrabold text-xs tracking-tight truncate">{t(cat.nameEn, cat.nameTa)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subcategory selection - Card Selection Design (No dropdowns) */}
            <div className="space-y-3 border-t border-gray-100 pt-6">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">{t('Select Subcategory', 'உட்பிரிவு (துணை வகை)')}</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {CATEGORIES.find((c: any) => c.id === formCategory)?.subcategories.map((sub: any) => {
                  const isSelected = formSubcategory === sub.id;
                  const countForSub = schemaFields.filter((f: any) => f.category === formCategory && f.subcategory === sub.id).length;
                  
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setFormSubcategory(sub.id)}
                      style={isSelected ? {
                        borderColor: currentTheme.accentColor,
                        backgroundColor: `${currentTheme.accentColor}0b`,
                        boxShadow: `0 0 0 1px ${currentTheme.accentColor}`
                      } : {}}
                      className={`p-4 rounded-xl border text-left transition-all duration-150 flex items-center justify-between cursor-pointer group ${
                        isSelected
                          ? 'shadow-xs'
                          : 'border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50/30'
                      }`}
                    >
                      <div className="pr-2 space-y-1">
                        <p className="text-xs font-bold text-slate-800">{t(sub.nameEn, sub.nameTa)}</p>
                        {countForSub > 0 && (
                          <span className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: currentTheme.accentColor, backgroundColor: `${currentTheme.accentColor}0e` }}>
                            {countForSub} {t('extra fields', 'கூடுதல் புலங்கள்')}
                          </span>
                        )}
                      </div>
                      <div className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all" style={isSelected ? {
                        borderColor: currentTheme.accentColor,
                        backgroundColor: currentTheme.accentColor,
                        color: '#ffffff'
                      } : {
                        borderColor: '#d1d5db',
                        backgroundColor: '#ffffff'
                      }}>
                        {isSelected && <span className="text-[9px] font-black">✓</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Default Fields: Subject and Issue Details */}
            <div className="space-y-4 border-t border-gray-100 pt-6">
              <h4 className="text-xs font-extrabold text-indigo-700 uppercase tracking-wider">
                {t('Issue Overview (Default Fields)', 'பிரச்சினையின் சுருக்கம் (இயல்புநிலை புலங்கள்)')}
              </h4>
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1.5 bg-slate-50/30 p-4 rounded-xl border border-slate-100/50">
                  <label className="text-xs font-bold text-slate-700 block">
                    {t('Subject', 'பொருள்')} <span className="text-rose-500 font-extrabold">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={t('Enter short subject of the issue', 'பிரச்சினையின் குறுகிய பொருளை உள்ளிடவும்')}
                    className="w-full text-xs font-semibold p-3.5 border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1.5 bg-slate-50/30 p-4 rounded-xl border border-slate-100/50">
                  <label className="text-xs font-bold text-slate-700 block">
                    {t('Issue Details', 'பிரச்சினையின் விவரங்கள்')} <span className="text-rose-500 font-extrabold">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={issueDetails}
                    onChange={(e) => setIssueDetails(e.target.value)}
                    placeholder={t('Provide detailed description of the issue', 'பிரச்சினையின் முழுமையான விவரங்களை வழங்கவும்')}
                    className="w-full text-xs font-semibold p-3.5 border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1.5 bg-slate-50/30 p-4 rounded-xl border border-slate-100/50">
                  <label className="text-xs font-bold text-slate-700 block flex items-center justify-between">
                    <span>
                      {t('Supporting Documents / Files', 'ஆவணங்கள் / கோப்புகளைப் பதிவேற்றவும்')} <span className="text-gray-400 font-normal">({t('PDF, Images, DOCX, Excel', 'PDF, படங்கள், DOCX, எக்செல்')})</span>
                    </span>
                    {isUploadingFormFiles && (
                      <span className="text-[10px] text-indigo-600 font-extrabold animate-pulse">{t('Uploading...', 'பதிவேற்றுகிறது...')}</span>
                    )}
                  </label>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100 transition">
                        <Upload className="w-4 h-4 text-indigo-600" />
                        <span>{t('Upload Files', 'கோப்புகளைப் பதிவேற்று')}</span>
                        <input
                          type="file"
                          multiple
                          accept=".pdf,image/*,.docx,.xlsx,.xls,.csv"
                          disabled={isUploadingFormFiles}
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              handleFormFilesUpload(e.target.files);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                      <span className="text-[10px] font-semibold text-slate-400">{t('Multiple files allowed. Max size 10MB per file.', 'ஒன்றுக்கும் மேற்பட்ட கோப்புகளைப் பதிவேற்றலாம். ஒரு கோப்பின் அதிகபட்ச அளவு 10MB.')}</span>
                    </div>

                    {formFiles.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {formFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-xl shadow-xs text-xs">
                            <span className="font-medium text-slate-700 truncate max-w-[200px]">{file.fileName}</span>
                            <button
                              type="button"
                              onClick={() => removeFormFile(idx)}
                              className="p-1 text-slate-400 hover:text-rose-500 rounded-lg transition"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Dynamic Fields Section */}
            <div className="space-y-6 border-t border-dashed border-gray-100 pt-6">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-indigo-700 uppercase tracking-wider">
                  {t('Category Specific Details', 'வகை மற்றும் துணை வகை சார்ந்த விவரங்கள்')}
                </h4>
                <span className="text-[10px] text-gray-400 font-bold">
                  {t(CATEGORIES.find((c: any) => c.id === formCategory)?.nameEn || '', CATEGORIES.find((c: any) => c.id === formCategory)?.nameTa || '')} ➔ {getSubcategoryName(formCategory, formSubcategory, lang)}
                </span>
              </div>
              
              {schemaFields.filter((f: any) => f.category === formCategory && (!f.subcategory || f.subcategory === formSubcategory)).length === 0 ? (
                <div className="p-8 bg-slate-50 rounded-2xl border border-slate-100 text-center text-xs font-semibold text-gray-400">
                  {t('No dynamic fields configured for this selection yet. Admin can define fields under Configure Fields tab.', 'இந்த உட்பிரிவுக்கு இதுவரை புலங்கள் எதுவும் கட்டமைக்கப்படவில்லை. நிர்வாகி புலங்கள் கட்டமைப்பு பிரிவில் புதிய புலங்களை உருவாக்கலாம்.')}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {schemaFields.filter((f: any) => f.category === formCategory && (!f.subcategory || f.subcategory === formSubcategory)).map((field: any) => {
                    const isReq = field.validations?.required;
                    return (
                      <div key={field.id} className="space-y-1.5 bg-slate-50/30 p-4 rounded-xl border border-slate-100/50">
                        <label className="text-xs font-bold text-slate-700 block">
                          {t(field.nameEn, field.nameTa)} {isReq && <span className="text-rose-500 font-extrabold">*</span>}
                        </label>

                        {/* TEXT INPUT */}
                        {field.type === 'text' && (
                          <input
                            type="text"
                            maxLength={field.validations?.maxLength}
                            placeholder={field.validations?.maxLength ? t(`Max ${field.validations.maxLength} characters`, `அதிகபட்சம் ${field.validations.maxLength} எழுத்துக்கள்`) : ''}
                            value={dynamicFormValues[field.id] || ''}
                            onChange={(e) => setDynamicFormValues((prev: any) => ({ ...prev, [field.id]: e.target.value }))}
                            className="w-full text-xs font-semibold p-3.5 border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                          />
                        )}

                        {/* NUMBER INPUT */}
                        {field.type === 'number' && (
                          <input
                            type="number"
                            min={field.validations?.min}
                            max={field.validations?.max}
                            value={dynamicFormValues[field.id] || ''}
                            onChange={(e) => setDynamicFormValues((prev: any) => ({ ...prev, [field.id]: e.target.value }))}
                            className="w-full text-xs font-semibold p-3.5 border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                          />
                        )}

                        {/* DATE INPUT */}
                        {field.type === 'date' && (
                          <input
                            type="date"
                            value={dynamicFormValues[field.id] || ''}
                            onChange={(e) => setDynamicFormValues((prev: any) => ({ ...prev, [field.id]: e.target.value }))}
                            className="w-full text-xs font-semibold p-3.5 border border-slate-200 bg-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 font-mono"
                          />
                        )}

                        {/* FILE UPLOAD */}
                        {field.type === 'file' && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <input
                                type="file"
                                id={`file_input_${field.id}`}
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    handleFileUpload(
                                      field.id, 
                                      file, 
                                      field.validations?.maxSizeMB || 5, 
                                      field.validations?.fileTypes || ['pdf', 'image']
                                    );
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => document.getElementById(`file_input_${field.id}`)?.click()}
                                disabled={uploadingFieldId === field.id}
                                className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold uppercase rounded-xl transition cursor-pointer"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                {uploadingFieldId === field.id ? t('Uploading...', 'பதிவேற்றுகிறது...') : t('Select File', 'கோப்பைத் தேர்ந்தெடு')}
                              </button>

                              {dynamicFormValues[field.id]?.url && (
                                <div className="flex items-center gap-1 text-emerald-700 text-xs font-bold">
                                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                                  <span className="truncate max-w-[150px]">{dynamicFormValues[field.id].fileName}</span>
                                </div>
                              )}
                            </div>
                            <p className="text-[10px] font-semibold text-gray-400">
                              {t('Allowed files:', 'அனுமதிக்கப்பட்ட கோப்புகள்:')} {field.validations?.fileTypes?.join(', ')} | {t('Max Size:', 'அதிகபட்ச அளவு:')} {field.validations?.maxSizeMB || 5}MB
                            </p>
                          </div>
                        )}

                        {formErrors[field.id] && (
                          <p className="text-[10px] font-bold text-rose-600 flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="w-3 h-3" />
                            {formErrors[field.id]}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Form actions */}
            <div className="flex justify-end pt-5 border-t border-dashed border-gray-100">
              <button
                type="submit"
                disabled={submittingIssue}
                className="px-8 py-4 bg-gradient-to-r from-indigo-700 via-fuchsia-600 to-pink-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:shadow-lg hover:shadow-fuchsia-500/20 hover:scale-[1.01] transition-all duration-200 flex items-center gap-2 cursor-pointer"
              >
                {submittingIssue ? t('Submitting...', 'சமர்ப்பிக்கிறது...') : t('Submit Issue', 'பிரச்சனையைச் சமர்ப்பி')}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </form>
        </div>
      )}

      {/* SUB-TAB 4: CONFIGURE FIELDS (Admins only) */}
      {activeSubTab === 'schema' && isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left panel: Add Field Form */}
          <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-5">
            <div>
              <h3 className="text-md font-bold text-slate-900 tracking-tight">{t('Create Dynamic Field', 'புதிய புலம் உருவாக்குதல்')}</h3>
              <p className="text-gray-400 text-[11px] mt-1">
                {t('Define custom parameters, validations, and constraints per issue category.', 'சிக்கல் வகைகளின் அடிப்படையில் புலங்களையும் அதன் விதிகளையும் உருவாக்கலாம்.')}
              </p>
            </div>

            <form onSubmit={handleAddField} className="space-y-4">
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('Applies to Category', 'வகையைத் தேர்ந்தெடு')}</label>
                <select
                  value={newFieldCategory}
                  onChange={(e) => {
                    setNewFieldCategory(e.target.value);
                    setNewFieldSubcategory('');
                  }}
                  className="w-full text-xs font-semibold p-3 border border-purple-100 bg-slate-50/50 rounded-xl outline-none focus:ring-1 focus:ring-fuchsia-500"
                >
                  {CATEGORIES.map((cat: any) => (
                    <option key={cat.id} value={cat.id}>{t(cat.nameEn, cat.nameTa)}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('Applies to Subcategory', 'துணை வகையைத் தேர்ந்தெடு')}</label>
                <select
                  value={newFieldSubcategory}
                  onChange={(e) => setNewFieldSubcategory(e.target.value)}
                  className="w-full text-xs font-semibold p-3 border border-purple-100 bg-slate-50/50 rounded-xl outline-none focus:ring-1 focus:ring-fuchsia-500"
                >
                  <option value="">{t('All Subcategories (Category-wide)', 'அனைத்து துணை பிரிவுகளும் (பொதுவானது)')}</option>
                  {CATEGORIES.find((c: any) => c.id === newFieldCategory)?.subcategories.map((sub: any) => (
                    <option key={sub.id} value={sub.id}>{t(sub.nameEn, sub.nameTa)}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('Field Name (English)', 'புலம் பெயர் (ஆங்கிலம்)')}</label>
                <input
                  type="text"
                  required
                  value={newFieldNameEn}
                  onChange={(e) => setNewFieldNameEn(e.target.value)}
                  placeholder="e.g. Estimated Cost (Lakhs)"
                  className="w-full text-xs font-semibold p-3 border border-purple-100 rounded-xl outline-none focus:ring-1 focus:ring-fuchsia-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('Field Name (Tamil)', 'புலம் பெயர் (தமிழ்)')}</label>
                <input
                  type="text"
                  required
                  value={newFieldNameTa}
                  onChange={(e) => setNewFieldNameTa(e.target.value)}
                  placeholder="எ.கா. மதிப்பீட்டு தொகை"
                  className="w-full text-xs font-semibold p-3 border border-purple-100 rounded-xl outline-none focus:ring-1 focus:ring-fuchsia-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('Field Type', 'புலத்தின் வகை')}</label>
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value as any)}
                  className="w-full text-xs font-semibold p-3 border border-purple-100 bg-slate-50/50 rounded-xl outline-none focus:ring-1 focus:ring-fuchsia-500"
                >
                  <option value="text">{t('Text', 'உரை (Text)')}</option>
                  <option value="number">{t('Number', 'எண் (Number)')}</option>
                  <option value="date">{t('Date', 'தேதி (Date)')}</option>
                  <option value="file">{t('File Upload', 'கோப்பு பதிவேற்றம்')}</option>
                </select>
              </div>

              {/* Required validator */}
              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="isRequired"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="w-4 h-4 text-fuchsia-600 border-gray-300 rounded focus:ring-fuchsia-500"
                />
                <label htmlFor="isRequired" className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  {t('Mark as Required Field', 'கட்டாய புலம் என குறிக்கவும்')}
                </label>
              </div>

              {/* Conditional validation parameters based on type */}
              {newFieldType === 'text' && (
                <div className="space-y-1 p-3 bg-fuchsia-50/30 border border-fuchsia-100/50 rounded-xl">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('Text Character Limit', 'எழுத்து வரம்பு')}</label>
                  <input
                    type="number"
                    value={textLimit}
                    onChange={(e) => setTextLimit(Number(e.target.value))}
                    className="w-full text-xs font-semibold p-2.5 border border-purple-100 rounded-lg outline-none bg-white"
                  />
                </div>
              )}

              {newFieldType === 'number' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-fuchsia-50/30 border border-fuchsia-100/50 rounded-xl">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('Min Value', 'குறைந்தபட்சம்')}</label>
                    <input
                      type="number"
                      value={numMin}
                      onChange={(e) => setNumMin(Number(e.target.value))}
                      className="w-full text-xs font-semibold p-2.5 border border-purple-100 rounded-lg outline-none bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('Max Value', 'அதிகபட்சம்')}</label>
                    <input
                      type="number"
                      value={numMax}
                      onChange={(e) => setNumMax(Number(e.target.value))}
                      className="w-full text-xs font-semibold p-2.5 border border-purple-100 rounded-lg outline-none bg-white"
                    />
                  </div>
                </div>
              )}

              {newFieldType === 'file' && (
                <div className="space-y-3.5 p-3.5 bg-fuchsia-50/30 border border-fuchsia-100/50 rounded-xl">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('Max File Size (MB)', 'அதிகபட்ச கோப்பு அளவு (MB)')}</label>
                    <input
                      type="number"
                      value={fileMaxSize}
                      onChange={(e) => setFileMaxSize(Number(e.target.value))}
                      className="w-full text-xs font-semibold p-2.5 border border-purple-100 rounded-lg outline-none bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('Allowed Extension Group', 'கோப்பு வகை அனுமதி')}</label>
                    <select
                      value={fileTypeConstraint}
                      onChange={(e) => setFileTypeConstraint(e.target.value as any)}
                      className="w-full text-xs font-semibold p-2.5 border border-purple-100 rounded-lg outline-none bg-white"
                    >
                      <option value="both">{t('PDF and Images', 'PDF மற்றும் படங்கள்')}</option>
                      <option value="pdf">{t('PDF Only', 'PDF மட்டும்')}</option>
                      <option value="image">{t('Images Only', 'படங்கள் மட்டும்')}</option>
                    </select>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-indigo-700 via-fuchsia-600 to-pink-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:shadow-lg hover:shadow-fuchsia-500/20 transition-all duration-200"
              >
                {t('Add Dynamic Field', 'புலம் சேர்')}
              </button>

            </form>
          </div>

          {/* Right panel: Active Fields Table */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
            <h3 className="text-md font-bold text-slate-900 tracking-tight">{t('Configured Dynamic Fields', 'அமைக்கப்பட்ட புலங்களின் பட்டியல்')}</h3>
            
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {CATEGORIES.map((cat: any) => {
                const fieldsForCat = schemaFields.filter((f: any) => f.category === cat.id);
                return (
                  <div key={cat.id} className="border border-slate-100 rounded-xl p-4 space-y-2.5">
                    <h4 className="text-xs font-extrabold text-fuchsia-700 uppercase tracking-wide border-b border-gray-50 pb-2 flex items-center justify-between">
                      <span>{t(cat.nameEn, cat.nameTa)}</span>
                      <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">{fieldsForCat.length} {t('Fields', 'புலங்கள்')}</span>
                    </h4>

                    {fieldsForCat.length === 0 ? (
                      <p className="text-[10px] text-gray-400 font-semibold italic text-center py-2">
                        {t('No dynamic fields created yet.', 'உருவாக்கப்பட்ட புலங்கள் ஏதுமில்லை.')}
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-50">
                        {fieldsForCat.map((field: any) => (
                          <div key={field.id} className="py-2.5 flex items-center justify-between text-xs">
                            <div>
                              <p className="font-bold text-slate-800">{t(field.nameEn, field.nameTa)}</p>
                              <div className="flex flex-wrap gap-1.5 text-[10px] text-gray-400 font-semibold mt-1">
                                <span className="bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded uppercase text-slate-600">{field.type}</span>
                                {field.subcategory && (
                                  <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded uppercase font-bold">
                                    {t(
                                      CATEGORIES.find((c: any) => c.id === field.category)?.subcategories.find((s: any) => s.id === field.subcategory)?.nameEn || field.subcategory,
                                      CATEGORIES.find((c: any) => c.id === field.category)?.subcategories.find((s: any) => s.id === field.subcategory)?.nameTa || field.subcategory
                                    )}
                                  </span>
                                )}
                                {field.validations?.required && <span className="text-rose-500 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded font-bold">{t('Required', 'கட்டாயம்')}</span>}
                                {field.type === 'text' && field.validations?.maxLength && <span>Limit: {field.validations.maxLength}</span>}
                                {field.type === 'number' && <span>Range: {field.validations.min} - {field.validations.max}</span>}
                                {field.type === 'file' && <span>Limit: {field.validations.maxSizeMB}MB ({field.validations.fileTypes?.join(', ')})</span>}
                              </div>
                            </div>
                            <button
                              onClick={() => handleDeleteField(field.id)}
                              className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg transition"
                              title={t('Delete Field', 'நீக்கு')}
                            >
                              <Trash2 className="w-4.5 h-4.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* DETAIL VIEW / AUDIT LOG & STATUS UPDATE MODAL */}
      {selectedIssue && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`w-full ${activePreviewFile ? 'max-w-6xl' : 'max-w-3xl'} bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 max-h-[92vh] flex flex-col transition-all duration-300`}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 p-6 text-white flex justify-between items-start">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold bg-white/20 px-3 py-1 rounded-full text-white">
                    {selectedIssue.issueId}
                  </span>
                  {selectedIssue.status === 'Closed' ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/30 text-emerald-300 border border-emerald-400/40">
                      <CheckCircle className="w-3.5 h-3.5" />
                      {t('Closed', 'முடிக்கப்பட்டது')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/30 text-amber-300 border border-amber-400/40">
                      <Clock className="w-3.5 h-3.5" />
                      {t('Active (In Progress)', 'செயலில் (நடவடிக்கையில்)')}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold">
                  {t(CATEGORIES.find((c: any) => c.id === selectedIssue.category)?.nameEn || selectedIssue.category, CATEGORIES.find((c: any) => c.id === selectedIssue.category)?.nameTa || selectedIssue.category)}
                  <span className="text-white/70 font-semibold"> / {getSubcategoryName(selectedIssue.category, selectedIssue.subcategory, lang)}</span>
                </h3>
              </div>
              <button 
                onClick={() => {
                  setSelectedIssue(null);
                  setActivePreviewFile(null);
                  setUpdateNotes('');
                  setUpdateAttachment(null);
                }} 
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0 bg-slate-50">
              {/* Left Column (Details) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-custom">
              
              {/* Creator details card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                <div>
                  <span className="text-gray-400 font-bold uppercase text-[9px] block mb-0.5">{t('Town Panchayat', 'பேரூராட்சி')}</span>
                  <p className="font-bold text-slate-900">{getTPName(selectedIssue.townPanchayatId)}</p>
                  <p className="text-[10px] text-gray-500">{getDistrictName(selectedIssue.districtId)}</p>
                </div>
                <div>
                  <span className="text-gray-400 font-bold uppercase text-[9px] block mb-0.5">{t('Registered On', 'பதிவு செய்யப்பட்ட தேதி')}</span>
                  <p className="font-bold text-slate-900">
                    {new Date(selectedIssue.createdAt).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {new Date(selectedIssue.createdAt).toLocaleTimeString(lang === 'ta' ? 'ta-IN' : 'en-US', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400 font-bold uppercase text-[9px] block mb-0.5">{t('Created By', 'பதிவு செய்தவர்')}</span>
                  <p className="font-bold text-slate-900">{selectedIssue.createdBy || t('Town Panchayat EO', 'செயல் அலுவலர்')}</p>
                  <span className="inline-block mt-0.5 px-2 py-0.5 text-[9px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {t('Town Panchayat User', 'பேரூராட்சி பயனர்')}
                  </span>
                </div>
              </div>

              {/* Dynamic filled fields */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  {t('Submitted Issue Information', 'சமர்ப்பிக்கப்பட்ட பிரச்சினை விவரங்கள்')}
                </h4>
                
                <div className="space-y-4 border border-gray-100 p-5 rounded-2xl bg-white shadow-2xs">
                  {/* Default Fields */}
                  <div className="grid grid-cols-1 gap-3.5 pb-4 border-b border-dashed border-slate-100">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider">{t('Subject', 'பொருள்')}</span>
                      <p className="text-xs font-black text-slate-800">{selectedIssue.subject || t('N/A', 'தகவல் இல்லை')}</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-wider">{t('Issue Details', 'பிரச்சினையின் விவரங்கள்')}</span>
                      <p className="text-xs text-slate-700 font-medium leading-relaxed whitespace-pre-wrap">{selectedIssue.issueDetails || t('N/A', 'தகவல் இல்லை')}</p>
                    </div>
                  </div>

                  {/* Schema Dynamic Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                    {schemaFields.filter((f: any) => f.category === selectedIssue.category).map((field: any) => {
                      const val = selectedIssue.fieldsData ? selectedIssue.fieldsData[field.id] : undefined;
                      if (val === undefined || val === '') return null;

                      return (
                        <div key={field.id} className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 block">{t(field.nameEn, field.nameTa)}</span>
                          {field.type === 'file' ? (
                            <div className="mt-1">
                              {val.url ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  <a
                                    href={val.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition"
                                  >
                                    <Paperclip className="w-3.5 h-3.5" />
                                    <span className="truncate max-w-[130px]">{val.fileName}</span>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => setActivePreviewFile({ url: val.url, fileName: val.fileName })}
                                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold uppercase rounded-xl cursor-pointer transition"
                                  >
                                    {t('Preview', 'முன்னோட்டம்')}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs italic text-gray-400">{t('No file uploaded', 'கோப்பு ஏதுமில்லை')}</span>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs font-bold text-slate-800">{String(val)}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Progress & Action Updates Audit Timeline (TP, Zonal AD, DTP) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    {t('Updates & Activity Log', 'நடவடிக்கைகள் மற்றும் புதுப்பித்தல் வரலாறு')}
                  </h4>
                  <span className="text-[10px] font-bold text-gray-400">
                    {(selectedIssue.comments || []).length} {t('Entries', 'பதிவுகள்')}
                  </span>
                </div>

                {(!selectedIssue.comments || selectedIssue.comments.length === 0) ? (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-center text-xs text-gray-400 font-medium">
                    {t('No updates posted yet.', 'இதுவரை நடவடிக்கைகள் ஏதும் பதிவு செய்யப்படவில்லை.')}
                  </div>
                ) : (
                  <div className="space-y-3 relative pl-4 border-l-2 border-indigo-100">
                    {selectedIssue.comments.map((comment: any, idx: number) => {
                      const isClosedStatus = comment.status === 'Closed';
                      const roleBadgeColor = comment.userRole === 'admin' || comment.scopeType === 'State' 
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : comment.userRole === 'ad' || comment.scopeType === 'Zone'
                        ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-200';

                      const roleLabel = comment.userRole === 'admin' || comment.scopeType === 'State'
                        ? t('👑 DTP Directorate', '👑 நகராட்சி நிர்வாக இயக்ககம்')
                        : comment.userRole === 'ad' || comment.scopeType === 'Zone'
                        ? t('🏛️ Zonal AD Office', '🏛️ மண்டல உதவி இயக்குநர்')
                        : t('🏢 Town Panchayat', '🏢 பேரூராட்சி');

                      return (
                        <div key={comment.id || idx} className="relative bg-slate-50/80 p-4 rounded-2xl border border-slate-100 text-xs space-y-2">
                          {/* Dot indicator */}
                          <div className={`absolute -left-[23px] top-4 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs ${isClosedStatus ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          
                          {/* Header row: User + Designation + Role + Timestamp */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${roleBadgeColor}`}>
                                {roleLabel}
                              </span>
                              <span className="font-bold text-slate-900">
                                {lang === 'ta' ? (comment.userNameTa || comment.userName) : comment.userName}
                              </span>
                              {comment.userDesignation && (
                                <span className="text-[10px] text-gray-500 font-medium">
                                  • {comment.userDesignation}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-semibold text-gray-400">
                              {new Date(comment.date).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>

                          {/* Stage Transition info */}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500">{t('Stage changed / confirmed to:', 'நிலை:')}</span>
                            {isClosedStatus ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle className="w-3 h-3" />
                                {t('Closed', 'முடிக்கப்பட்டது')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3" />
                                {t('Active', 'செயலில்')}
                              </span>
                            )}
                          </div>

                          {/* Notes */}
                          {comment.notes && (
                            <p className="text-slate-700 bg-white p-3 rounded-xl border border-slate-100 font-medium leading-relaxed">
                              {comment.notes}
                            </p>
                          )}

                          {/* Attachment (if uploaded) */}
                          {comment.file?.url && (
                            <div className="pt-1 flex flex-wrap items-center gap-2">
                              <a
                                href={comment.file.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition"
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                                <span>{t('Attached Proof / Document', 'இணைக்கப்பட்ட ஆவணம்')}: {comment.file.fileName}</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => setActivePreviewFile({ url: comment.file.url, fileName: comment.file.fileName })}
                                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold uppercase rounded-xl cursor-pointer transition"
                              >
                                {t('Preview', 'முன்னோட்டம்')}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* POST UPDATE FORM (Available for ALL: TP Users, Zonal Officers, DTP Directorate) */}
              <div className="border-t border-gray-100 pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <PlusCircle className="w-4 h-4 text-indigo-600" />
                      {t('Post Progress Update / Action Taken', 'நடவடிக்கை அல்லது முன்னேற்றத்தை பதிவு செய்க')}
                    </h4>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {t('TP, Zonal AD, and DTP officers can log actions, upload proof, and update stage status.', 'பேரூராட்சி, மண்டலம் மற்றும் இயக்கக அலுவலர்கள் உரிய முன்னேற்றங்களை இங்கு பதிவு செய்யலாம்.')}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleAddUpdate} className="space-y-4 bg-gradient-to-br from-slate-50 to-indigo-50/30 p-5 rounded-2xl border border-indigo-100/60 shadow-2xs">
                  
                  {/* 2 STAGES ONLY: Active or Closed */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                      {t('Stage Status Transition', 'பிரச்சனையின் நிலை (Stage)')}
                    </label>
                    {isAdmin ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label 
                        className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                          updateStatus === 'Active' 
                            ? 'bg-amber-50/80 border-amber-500 shadow-xs' 
                            : 'bg-white border-gray-200 hover:border-amber-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="updateStage"
                          value="Active"
                          checked={updateStatus === 'Active'}
                          onChange={() => setUpdateStatus('Active')}
                          className="mt-0.5 text-amber-600 focus:ring-amber-500"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-amber-600" />
                            <span className="text-xs font-extrabold text-slate-900">{t('Active', 'செயலில் (Active)')}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {t('Issue is under active review, site work in progress, or processing.', 'நடவடிக்கை தொடர்ந்து நடைபெற்று வருகிறது.')}
                          </p>
                        </div>
                      </label>

                      <label 
                        className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                          updateStatus === 'Closed' 
                            ? 'bg-emerald-50/80 border-emerald-500 shadow-xs' 
                            : 'bg-white border-gray-200 hover:border-emerald-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name="updateStage"
                          value="Closed"
                          checked={updateStatus === 'Closed'}
                          onChange={() => setUpdateStatus('Closed')}
                          className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <CheckCircle className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs font-extrabold text-slate-900">{t('Closed', 'முடிக்கப்பட்டது (Closed)')}</span>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-0.5">
                            {t('Issue has been resolved, rectified, or work completed.', 'பிரச்சனைக்கு முழுமையான தீர்வு காணப்பட்டு முடிக்கப்பட்டது.')}
                          </p>
                        </div>
                      </label>
                    </div>
                  ) : (
                    <div className="p-4 bg-amber-50/40 border border-amber-200/50 rounded-xl flex items-start gap-3">
                      <Clock className="w-4.5 h-4.5 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {t('Post Update under Active Stage', 'செயலில் உள்ள நிலையின் கீழ் நடவடிக்கை பதிவு')}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {t('Only Directorate of Town Panchayats (DTP) admin users are authorized to close issues.', 'நகராட்சி நிர்வாக இயக்கக (DTP) தலைமை அலுவலர்கள் மட்டுமே பிரச்சனைகளை முடிக்க முடியும்.')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Remarks / Action Taken Textarea */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                      {t('Action Details & Remarks *', 'நடவடிக்கை விவரங்கள் & குறிப்புகள் *')}
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={updateNotes}
                      onChange={(e) => setUpdateNotes(e.target.value)}
                      placeholder={t('Enter details of inspection done, sanction order, progress made, or resolution explanation...', 'மேற்கொள்ளப்பட்ட ஆய்வு, பிறப்பிக்கப்பட்ட ஆணை, அல்லது தீர்வு விபரங்களை உள்ளிடவும்...')}
                      className="w-full text-xs font-medium p-3.5 border border-indigo-100 bg-white rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Optional File Attachment */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                      {t('Supporting Document / Action Proof (Optional, Max 5MB)', 'ஆவண இணைப்பு / புகைப்பட ஆதாரம் (விருப்பத்திற்குரியது)')}
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-gray-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition shadow-2xs">
                        <Upload className="w-4 h-4 text-indigo-600" />
                        <span>{isUploadingUpdateFile ? t('Uploading...', 'பதிவேற்றப்படுகிறது...') : t('Choose File', 'கோப்பைத் தேர்ந்தெடு')}</span>
                        <input
                          type="file"
                          className="hidden"
                          disabled={isUploadingUpdateFile}
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleUpdateFileUpload(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                      {updateAttachment && (
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[200px]">{updateAttachment.fileName}</span>
                          <button
                            type="button"
                            onClick={() => setUpdateAttachment(null)}
                            className="text-gray-400 hover:text-rose-500 p-0.5"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submission Button */}
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={submittingUpdate || isUploadingUpdateFile}
                      className="px-6 py-2.5 bg-gradient-to-r from-indigo-700 to-fuchsia-600 hover:from-indigo-600 hover:to-fuchsia-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
                    >
                      {submittingUpdate ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>{t('Posting Update...', 'பதிவு செய்யப்படுகிறது...')}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>{t('Post Update', 'பதிவு செய்')}</span>
                        </>
                      )}
                    </button>
                  </div>

                </form>
              </div>

              {/* End of Left Column */}
              </div>

              {/* Right Column: Dynamic Preview Frame */}
              {activePreviewFile && (
                <div className="w-full md:w-[450px] lg:w-[550px] border-t md:border-t-0 md:border-l border-slate-200 p-6 flex flex-col bg-slate-100 shrink-0">
                  <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-4 flex flex-col overflow-hidden shadow-xs">
                    <div className="flex justify-between items-center pb-2 text-[11px] text-slate-500 border-b border-slate-100 shrink-0">
                      <span className="font-extrabold truncate max-w-[220px] text-slate-700">
                        {activePreviewFile.fileName || 'Attachment'}
                      </span>
                      <div className="flex items-center gap-3">
                        <a
                          href={activePreviewFile.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 font-extrabold hover:underline"
                        >
                          {lang === 'ta' ? 'புதிய தாவலில் திற' : 'Open'}
                        </a>
                        <span className="text-gray-300">|</span>
                        <button
                          type="button"
                          onClick={() => setActivePreviewFile(null)}
                          className="text-rose-600 hover:text-rose-800 font-extrabold transition cursor-pointer"
                        >
                          {lang === 'ta' ? 'மூடு' : 'Close'}
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 min-h-0 mt-4 relative">
                      {activePreviewFile.url ? (
                        activePreviewFile.url.toLowerCase().includes('.pdf') ? (
                          <iframe
                            src={`${activePreviewFile.url}#toolbar=0`}
                            className="w-full h-full rounded-xl border border-slate-150 bg-white"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center overflow-hidden">
                            <img
                              src={activePreviewFile.url}
                              alt="Preview"
                              referrerPolicy="no-referrer"
                              className="max-w-full max-h-full object-contain rounded-xl"
                            />
                          </div>
                        )
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                          <FileText className="w-8 h-8 text-slate-300" />
                          <span className="text-xs font-bold">{lang === 'ta' ? 'முன்னோட்டம் இல்லை' : 'Select a document to preview'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        </div>
      )}

      {/* SUCCESS SUBMISSION POPUP MODAL */}
      {showSubmitPopup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 p-8 text-center space-y-6"
          >
            <div className="mx-auto w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100 shadow-sm">
              <CheckCircle className="w-9 h-9 text-emerald-600" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-900">
                {t('Issue Submitted Successfully!', 'பிரச்சனை வெற்றிகரமாக பதிவு செய்யப்பட்டது!')}
              </h3>
              <p className="text-gray-500 text-xs leading-relaxed px-2">
                {t(
                  'Your pending issue has been registered on the platform and sent to Zonal/DTP officers for monitoring and resolution.',
                  'உங்களது நிலுவை பிரச்சனை தளத்தில் வெற்றிகரமாக பதிவு செய்யப்பட்டுள்ளது. இது மண்டல மற்றும் இயக்கக அலுவலர்களின் பார்வைக்கு அனுப்பப்பட்டுள்ளது.'
                )}
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 font-mono text-center space-y-1">
              <span className="text-[10px] font-bold text-gray-400 block uppercase tracking-wider">{t('Issue Reference ID', 'விண்ணப்ப எண்')}</span>
              <span className="text-lg font-black text-slate-800">{submittedIssueId}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowSubmitPopup(false);
                }}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded-xl transition cursor-pointer"
              >
                {t('Submit Another', 'மற்றொரு பிரச்சனை')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSubmitPopup(false);
                  setActiveSubTab('directory');
                }}
                className="w-full py-3 bg-gradient-to-r from-indigo-700 to-fuchsia-600 hover:from-indigo-600 hover:to-fuchsia-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md shadow-indigo-100 transition cursor-pointer"
              >
                {t('View Report', 'அறிக்கையைக் காண்க')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* --- Interactive Slideshow Viewer Modal --- */}
      {isSlideViewActive && (() => {
        const currentIssue = sortedIssues[activeSlideIndex];
        if (!currentIssue) return null;

        const schemaFields = state.pendingIssuesSchema || [];
        const catFields = schemaFields.filter((f: any) => f.category === currentIssue.category);
        const hasFields = catFields.some((f: any) => currentIssue.fieldsData && currentIssue.fieldsData[f.id] !== undefined && currentIssue.fieldsData[f.id] !== '');

        const dynamicFiles: any[] = [];
        catFields.forEach((field: any) => {
          if (field.type === 'file') {
            const val = currentIssue.fieldsData ? currentIssue.fieldsData[field.id] : undefined;
            if (val && val.url) {
              dynamicFiles.push({
                url: val.url,
                name: val.fileName || (lang === 'ta' ? field.nameTa : field.nameEn)
              });
            }
          }
        });

        const initFiles = (currentIssue.attachments || currentIssue.files || [])
          .map((file: any) => ({
            url: file.url,
            name: file.name || file.fileName || (lang === 'ta' ? 'துவக்க ஆவணம்' : 'Initial Doc')
          }));
        const commentFiles = (currentIssue.comments || [])
          .filter((c: any) => c.file && c.file.url)
          .map((c: any) => ({
            url: c.file.url,
            name: c.file.fileName || (lang === 'ta' ? 'புதுப்பிப்பு ஆவணம்' : 'Update Doc')
          }));
        const docs = [...dynamicFiles, ...initFiles, ...commentFiles];
        const activeDoc = slideActivePreviewFile || (docs.length > 0 ? docs[0] : null);

        const isAdmin = currentUser.roleId === 'admin' || currentUser.roleId === 'ad' || currentUser.roleId === 'dtp_admin' || currentUser.roleId === 'dtp_user';
        const isDTPUser = currentUser.roleId === 'dtp_user';

        return (
          <div className="fixed inset-0 z-50 bg-slate-100 text-slate-800 flex flex-col overflow-hidden select-none animate-in fade-in duration-200">
            {/* Header with Theme Color Background and Single Line Details */}
            <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 border-b border-indigo-800 px-6 py-3.5 flex flex-row justify-between items-center gap-4 shrink-0 shadow-md text-white overflow-hidden">
              <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-2 whitespace-nowrap text-xs md:text-sm text-slate-100 font-medium">
                  {/* Zone */}
                  <span className="text-fuchsia-300 font-bold">{getZoneNameByTP(currentIssue.townPanchayatId)}</span>
                  <span className="text-indigo-700 font-light">/</span>
                  {/* District */}
                  <span className="text-slate-100 font-bold">{getDistrictNameByTP(currentIssue.townPanchayatId)}</span>
                  <span className="text-indigo-700 font-light">/</span>
                  {/* TP */}
                  <span className="text-white font-bold">{getTPName(currentIssue.townPanchayatId)}</span>
                  <span className="text-indigo-700 font-light">/</span>
                  {/* Cat */}
                  <span className="text-indigo-100 font-bold">
                    {lang === 'ta' 
                      ? (CATEGORIES.find((c: any) => c.id === currentIssue.category)?.nameTa || currentIssue.category) 
                      : (CATEGORIES.find((c: any) => c.id === currentIssue.category)?.nameEn || currentIssue.category)}
                  </span>
                  <span className="text-indigo-700 font-light">/</span>
                  {/* Sub */}
                  <span className="text-fuchsia-200 font-bold">{getSubcategoryName(currentIssue.category, currentIssue.subcategory, lang)}</span>
                  <span className="text-indigo-700 font-light">/</span>
                  {/* ID */}
                  <span className="font-mono text-fuchsia-300 bg-indigo-900/50 px-2.5 py-0.5 rounded-lg border border-indigo-700/60 shadow-inner font-black text-xs md:text-sm">
                    {currentIssue.issueId}
                  </span>
                </div>
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center gap-4 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrevSlide}
                    disabled={activeSlideIndex === 0}
                    className="p-2 bg-indigo-900/40 hover:bg-indigo-800 disabled:opacity-30 rounded-xl transition cursor-pointer text-indigo-100 border border-indigo-800/40"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-xs font-bold font-mono px-2 text-indigo-200">
                    {activeSlideIndex + 1} / {sortedIssues.length}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextSlide}
                    disabled={activeSlideIndex === sortedIssues.length - 1}
                    className="p-2 bg-indigo-900/40 hover:bg-indigo-800 disabled:opacity-30 rounded-xl transition cursor-pointer text-indigo-100 border border-indigo-800/40"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsSlideViewActive(false);
                    if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
                      document.exitFullscreen().catch((err) => console.log("Exit fullscreen failed:", err));
                    }
                  }}
                  className="p-2 bg-indigo-900/40 hover:bg-rose-900/80 hover:text-rose-100 rounded-xl transition cursor-pointer text-indigo-200 border border-indigo-800/40"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Body Section (split: 70% Left, 30% Right) */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-10 overflow-hidden min-h-0 bg-slate-50">
              {/* Left Column (70% Width) - Details and Timeline */}
              <div className="lg:col-span-7 flex flex-col overflow-y-auto p-6 space-y-6 border-r border-slate-200 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                {/* Subject & Main Details */}
                <div className="space-y-3 bg-white border border-slate-200/60 p-5 rounded-2xl shadow-xs">
                  <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">
                    {lang === 'ta' ? 'விண்ணப்பத் தலைப்பு (பொருள்)' : 'Subject'}
                  </span>
                  <h2 className="text-md font-black text-slate-900 leading-snug">
                    {currentIssue.subject || (lang === 'ta' ? 'விவரம் ஏதுமில்லை' : 'No subject specified')}
                  </h2>
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">
                      {lang === 'ta' ? 'பிரச்சினையின் விவரங்கள்' : 'Issue Details'}
                    </span>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed whitespace-pre-wrap">
                      {currentIssue.issueDetails || (lang === 'ta' ? 'விவரம் ஏதுமில்லை' : 'No details specified')}
                    </p>
                  </div>
                </div>

                {/* Dynamic Schema Fields (Other Fields) */}
                {hasFields && (
                  <div className="space-y-3 bg-white border border-slate-200/60 p-5 rounded-2xl text-xs shadow-xs">
                    <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-wider flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-indigo-600" />
                      {lang === 'ta' ? 'பிற விவரப் புலங்கள்' : 'Dynamic Fields / Other Information'}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      {catFields.map((field: any) => {
                        const val = currentIssue.fieldsData ? currentIssue.fieldsData[field.id] : undefined;
                        if (val === undefined || val === '') return null;

                        return (
                          <div key={field.id} className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                            <span className="text-[10px] font-extrabold text-slate-500 block">
                              {lang === 'ta' ? field.nameTa : field.nameEn}
                            </span>
                            {field.type === 'file' ? (
                              val.url ? (
                                <div className="flex items-center gap-1.5 pt-1">
                                  <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                                  <span className="text-xs font-mono text-slate-600 truncate max-w-[120px]">{val.fileName}</span>
                                  <button
                                    type="button"
                                    onClick={() => setSlideActivePreviewFile({ url: val.url, name: val.fileName })}
                                    className="ml-auto px-2 py-0.5 bg-indigo-100 text-[9px] uppercase tracking-wider font-extrabold text-indigo-700 rounded-md hover:bg-indigo-200 transition"
                                  >
                                    {lang === 'ta' ? 'முன்னோட்டம்' : 'Preview'}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs italic text-slate-400">No file</span>
                              )
                            ) : (
                              <p className="text-xs text-slate-900 font-bold">{val}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Updations & History Timeline */}
                <div className="space-y-4 bg-white border border-slate-200/60 p-5 rounded-2xl shadow-xs">
                  <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {lang === 'ta' ? 'நடவடிக்கை குறிப்பேடு & புதுப்பிப்புகள்' : 'Action Logs & Comments Timeline'}
                  </h4>
                  <div className="space-y-4 pl-3 border-l border-slate-200">
                    {currentIssue.comments && currentIssue.comments.length > 0 ? (
                      currentIssue.comments.map((comment: any, idx: number) => {
                        const isClosed = comment.status === 'Resolved' || comment.status === 'Closed';
                        return (
                          <div key={comment.id || idx} className="relative pl-4 text-xs space-y-1">
                            <div className={`absolute -left-[17px] top-1.5 w-2 h-2 rounded-full border border-white ${isClosed ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                            <div className="flex justify-between items-center font-bold text-slate-800">
                              <span className="flex items-center gap-2">
                                {comment.status}
                                <span className="text-[9px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-sm font-bold uppercase tracking-wider">
                                  {comment.scopeType || 'TP'}
                                </span>
                              </span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                {new Date(comment.date).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            {comment.notes && (
                              <p className="text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200/60 leading-relaxed whitespace-pre-wrap font-medium">
                                {comment.notes}
                              </p>
                            )}
                            <div className="text-[9px] text-slate-400">
                              By: {lang === 'ta' ? (comment.userNameTa || comment.userName) : comment.userName} {comment.userDesignation ? `• ${comment.userDesignation}` : ''}
                            </div>
                            {comment.file?.url && (
                              <div className="pt-1">
                                <button
                                  type="button"
                                  onClick={() => setSlideActivePreviewFile({ url: comment.file.url, name: comment.file.fileName })}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] rounded-lg transition font-bold"
                                >
                                  <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>{lang === 'ta' ? 'இணைப்பு கோப்பு' : 'Attachment'}: {comment.file.fileName}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs text-slate-400 italic py-2">
                        {lang === 'ta' ? 'நடவடிக்கை பதிவுகள் ஏதுமில்லை.' : 'No follow-up action logs yet.'}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column (30% Width) - Attached Documents List & Preview */}
              <div className="lg:col-span-3 flex flex-col overflow-hidden p-6 bg-slate-100 border-t lg:border-t-0 border-slate-200">
                <div className="flex-1 flex flex-col min-h-0 space-y-4">
                  <div className="space-y-2 flex-1 flex flex-col min-h-0">
                    <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">
                      {lang === 'ta' ? 'இணைக்கப்பட்ட ஆவணங்கள்' : 'Attached Documents'}
                    </h4>
                    
                    {docs.length === 0 ? (
                      <div className="text-xs text-slate-400 bg-white border border-dashed border-slate-300 p-4 rounded-xl text-center font-bold shadow-2xs">
                        {lang === 'ta' ? 'இணைப்பு கோப்புகள் எதுவும் இல்லை' : 'No files attached to this issue'}
                      </div>
                    ) : (
                      <div className="space-y-3 flex-1 flex flex-col min-h-0">
                        <div className="flex flex-wrap gap-2 max-h-[85px] overflow-y-auto p-1 scrollbar-none shrink-0">
                          {docs.map((file: any, i: number) => {
                            const isActive = activeDoc && activeDoc.url === file.url;
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => setSlideActivePreviewFile(file)}
                                className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                                  isActive 
                                    ? 'bg-indigo-600 border-indigo-700 text-white' 
                                    : 'bg-white border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                                }`}
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                                <span className="truncate max-w-[120px]">{file.name}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Previewer element */}
                        <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-3 flex flex-col overflow-hidden min-h-[160px] shadow-xs">
                          <div className="flex justify-between items-center pb-2 text-[10px] text-slate-400 border-b border-slate-100 shrink-0">
                            <span className="font-extrabold truncate max-w-[200px] text-slate-600">{activeDoc?.name}</span>
                            <a
                              href={activeDoc?.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 font-extrabold hover:underline"
                            >
                              {lang === 'ta' ? 'புதிய தாவலில் திற' : 'Open in New Tab'}
                            </a>
                          </div>
                          <div className="flex-1 min-h-0 mt-3 relative">
                            {activeDoc?.url ? (
                              activeDoc.url.toLowerCase().includes('.pdf') ? (
                                <iframe
                                  src={`${activeDoc.url}#toolbar=0`}
                                  className="w-full h-full rounded-xl border border-slate-100 bg-white"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center overflow-hidden">
                                  <img
                                    src={activeDoc.url}
                                    alt="Attachment preview"
                                    referrerPolicy="no-referrer"
                                    className="max-w-full max-h-full object-contain rounded-xl"
                                  />
                                </div>
                              )
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                                <FileText className="w-8 h-8 text-slate-300" />
                                <span className="text-xs font-bold">{lang === 'ta' ? 'முன்னோட்டம் இல்லை' : 'Select a document to preview'}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Update Bar (20% Height) */}
            <div className="bg-white border-t border-slate-200 px-6 py-4 flex flex-col justify-center min-h-[120px] shrink-0">
              <form onSubmit={handleSlideUpdateSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                {/* Status selection */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">
                    {lang === 'ta' ? 'அடுத்த கட்ட நிலை' : 'Next Stage'}
                  </label>
                  <select
                    value={slideUpdateStatus}
                    onChange={(e: any) => setSlideUpdateStatus(e.target.value)}
                    className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:ring-1 focus:ring-indigo-500 text-gray-800"
                  >
                    {(() => {
                      const isTPOrZoneUser = currentUser.roleId === 'eo' || currentUser.roleId === 'ad';
                      if (isTPOrZoneUser) {
                        return (
                          <option value="In Progress">{lang === 'ta' ? 'செயல்பாட்டில் (In Progress)' : 'In Progress'}</option>
                        );
                      } else {
                        return (
                          <>
                            <option value="In Progress">{lang === 'ta' ? 'செயல்பாட்டில் (In Progress)' : 'In Progress'}</option>
                            <option value="Resolved">{lang === 'ta' ? 'மூடப்பட்டது (Closed / Resolved)' : 'Closed / Resolved'}</option>
                          </>
                        );
                      }
                    })()}
                  </select>
                </div>

                {/* Notes/Remarks */}
                <div className="md:col-span-6 space-y-1">
                  <label className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">
                    {lang === 'ta' ? 'நடவடிக்கை விபரம் & கருத்துரை *' : 'Action Taken Remarks *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={slideUpdateNotes}
                    onChange={(e) => setSlideUpdateNotes(e.target.value)}
                    placeholder={lang === 'ta' ? 'ஆய்வு செய்யப்பட்டது, திட்ட நிதி ஒதுக்கீடு செய்யப்பட்டது, முதலிய கருத்துரைகள்...' : 'Enter remarks or action details...'}
                    className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:ring-1 focus:ring-indigo-500 text-gray-800"
                  />
                </div>

                {/* File upload */}
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-black uppercase text-indigo-600 tracking-wider block">
                    {lang === 'ta' ? 'ஆதாரக் கோப்பு' : 'Supporting File'}
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="flex-1 flex justify-center items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl cursor-pointer transition">
                      <Upload className="w-3.5 h-3.5 text-indigo-600" />
                      <span className="truncate">{isUploadingSlideFile ? '...' : lang === 'ta' ? 'கோப்பு' : 'Upload'}</span>
                      <input
                        type="file"
                        className="hidden"
                        disabled={isUploadingSlideFile}
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            handleSlideAttachmentUpload(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                    {slideUpdateAttachment && (
                      <div className="flex items-center gap-1 p-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg text-[9px] font-extrabold max-w-[80px] truncate">
                        <Check className="w-3 h-3 shrink-0" />
                        <span className="truncate">{slideUpdateAttachment.fileName}</span>
                        <button type="button" onClick={() => setSlideUpdateAttachment(null)} className="hover:text-rose-500">
                          <X className="w-2.5 h-2.5 shrink-0" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit */}
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={isSubmittingSlideUpdate || isUploadingSlideFile}
                    className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-extrabold uppercase rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {isSubmittingSlideUpdate ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3.5 h-3.5" />
                    )}
                    <span>{lang === 'ta' ? 'பதிவுசெய்' : 'Post Update'}</span>
                  </button>
                </div>
              </form>
              {slideSuccessMsg && (
                <div className="text-center text-xs font-extrabold text-emerald-600 mt-2 animate-pulse">
                  {slideSuccessMsg}
                </div>
              )}
            </div>
          </div>
        );
      })()}

    </div>
  );
}
