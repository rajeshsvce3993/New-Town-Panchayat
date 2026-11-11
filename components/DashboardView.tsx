/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/purity */
'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Building, 
  Map as MapIcon, 
  MapPin, 
  Users, 
  UserCheck, 
  GitPullRequest, 
  PlusCircle, 
  FileText, 
  Settings, 
  TrendingUp,
  Activity,
  AlertTriangle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Paperclip,
  X,
  ChevronLeft,
  ChevronRight,
  Upload,
  Check,
  CheckCircle,
  CheckCircle2,
  Clock,
  Sliders,
  MonitorPlay,
  RefreshCw,
  Layers,
  Download,
  ClipboardCheck,
  RotateCcw,
  BarChart3,
  Recycle,
  Lock,
  Home
} from 'lucide-react';
import { Smartphone } from 'lucide-react';
import ThemeSelect from './ThemeSelect';
import dynamic from 'next/dynamic';
import { Language, translations } from './translations';
import { ThemeType, themesConfig } from '@/lib/themeConfig';
import { isHodLikeUser, isZonalScopedUser } from '@/lib/userScope';
import {
  isFallbackInspectionWork,
  workMatchesDistrict,
  workMatchesTp,
  workMatchesZone,
} from '@/lib/inspectionWorksQueryFilters';

const InspectionReportsView = dynamic(
  () => import('./InspectionReportsView'),
  { 
    ssr: false,
    loading: () => (
      <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--theme-accent)' }} />
        <span className="text-xs font-semibold">Loading Inspection Reports...</span>
      </div>
    )
  }
);

interface DashboardViewProps {
  state: any;
  lang: Language;
  currentUser: any;
  setActiveTab: (tab: string) => void;
  theme: ThemeType;
  onSaveCollection?: (key: string, data: any[]) => Promise<void>;
  /** Refresh KPI / bootstrap stats only (not inspection filter table). */
  onRefreshDashboardStats?: () => void | Promise<void>;
}

export default function DashboardView({ state, lang, currentUser, setActiveTab, theme, onSaveCollection, onRefreshDashboardStats }: DashboardViewProps) {
  const currentTheme = themesConfig[theme] || themesConfig.light;

  const t = (key: keyof typeof translations['en']) => {
    return translations[lang][key] || translations['en'][key] || key;
  };

  const tObj = (obj: any) => {
    if (!obj) return '';
    return lang === 'ta' ? (obj.nameTa || obj.nameEn) : (obj.nameEn || obj.nameTa);
  };

  const {
    zones = [],
    districts = [],
    townPanchayats = [],
    employees = [],
    users = [],
    transferRequests = [],
    moduleSchemas = []
  } = state || {};

  const hodLike = isHodLikeUser(currentUser);

  const getTPZoneId = (tp: any) => {
    if (!tp) return '';
    if (tp.zoneId) return tp.zoneId;
    if (tp.districtId) {
      const dist = districts.find((d: any) => d.id === tp.districtId);
      return dist ? dist.zoneId : '';
    }
    return '';
  };

  const allIssues = state?.pendingIssues || [];
  const scopedIssues = hodLike
    ? allIssues
    : currentUser?.scopeType === 'Zone'
      ? allIssues.filter((i: any) => {
          const tp = townPanchayats.find((t: any) => t.id === i.townPanchayatId);
          return tp && getTPZoneId(tp) === currentUser?.scopeId;
        })
      : allIssues.filter((i: any) => i.townPanchayatId === currentUser?.scopeId);

  const DEFAULT_ISSUE_CATEGORIES = [
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

  const CATEGORIES_LIST = useMemo(() => {
    const rawList = (state?.issueCategories && state.issueCategories.length > 0) ? state.issueCategories : DEFAULT_ISSUE_CATEGORIES;
    const colorStyles = [
      { color: 'bg-indigo-500', text: 'text-indigo-600', border: 'border-indigo-200', bg: 'bg-indigo-50/50' },
      { color: 'bg-fuchsia-500', text: 'text-fuchsia-600', border: 'border-fuchsia-200', bg: 'bg-fuchsia-50/50' },
      { color: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-200', bg: 'bg-emerald-50/50' },
      { color: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-200', bg: 'bg-amber-50/50' },
      { color: 'bg-sky-500', text: 'text-sky-600', border: 'border-sky-200', bg: 'bg-sky-50/50' },
      { color: 'bg-rose-500', text: 'text-rose-600', border: 'border-rose-200', bg: 'bg-rose-50/50' },
      { color: 'bg-teal-500', text: 'text-teal-600', border: 'border-teal-200', bg: 'bg-teal-50/50' },
      { color: 'bg-purple-500', text: 'text-purple-600', border: 'border-purple-200', bg: 'bg-purple-50/50' },
    ];
    return rawList.map((cat: any, idx: number) => {
      const style = colorStyles[idx % colorStyles.length];
      return {
        ...cat,
        color: cat.color || style.color,
        text: cat.text || style.text,
        border: cat.border || style.border,
        bg: cat.bg || style.bg,
        subcategories: cat.subcategories || []
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.issueCategories]);

  const CATEGORIES_MAP = useMemo(() => {
    const map: any = {
      works: { en: 'Works', ta: 'பணிகள்' },
      establishment: { en: 'Establishment', ta: 'பணியமைப்பு' },
      online_services: { en: 'Online Services', ta: 'இணைய சேவைகள்' },
      other_issues: { en: 'Other Issues', ta: 'இதர பிரச்சினைகள்' }
    };
    CATEGORIES_LIST.forEach((c: any) => {
      map[c.id] = { en: c.nameEn || c.id, ta: c.nameTa || c.nameEn || c.id };
    });
    return map;
  }, [CATEGORIES_LIST]);

  const getCategoryName = (catId: string, currentLang: 'en' | 'ta') => {
    if (!catId) return '';
    const cat = CATEGORIES_LIST.find((c: any) => c.id?.toLowerCase() === catId.toLowerCase());
    if (cat) return currentLang === 'ta' ? (cat.nameTa || cat.nameEn) : (cat.nameEn || cat.nameTa);
    return CATEGORIES_MAP[catId]?.[currentLang] || catId;
  };

  const getSubcategoryName = (catId: string, subcatId: string, currentLang: 'en' | 'ta') => {
    if (!subcatId) return '';
    const cat = CATEGORIES_LIST.find((c: any) => c.id?.toLowerCase() === (catId || '').toLowerCase());
    if (cat && cat.subcategories) {
      const sub = cat.subcategories.find((s: any) => s.id?.toLowerCase() === subcatId.toLowerCase());
      if (sub) {
        return currentLang === 'ta' ? (sub.nameTa || sub.nameEn) : (sub.nameEn || sub.nameTa);
      }
    }
    return subcatId;
  };

  const getCategoryThemeColor = (catId: string) => {
    const idx = CATEGORIES_LIST.findIndex((c: any) => c.id === catId);
    if (idx >= 0 && currentTheme.chartColors[idx % currentTheme.chartColors.length]) {
      return currentTheme.chartColors[idx % currentTheme.chartColors.length];
    }
    const mapping: Record<string, string> = {
      works: currentTheme.chartColors[0] || '#6366f1',
      establishment: currentTheme.chartColors[1] || '#d946ef',
      online_services: currentTheme.chartColors[2] || '#10b981',
      other_issues: currentTheme.chartColors[3] || '#f59e0b',
    };
    return mapping[catId] || currentTheme.accentColor;
  };

  const getTPName = (id: string) => {
    const tp = townPanchayats.find((t: any) => t.id === id);
    return tp ? tObj(tp) : id;
  };

  const getZoneNameByTP = (tpId: string) => {
    const tp = townPanchayats.find((t: any) => t.id === tpId);
    if (!tp) return '-';
    const znId = getTPZoneId(tp);
    const zone = zones.find((z: any) => z.id === znId);
    return zone ? tObj(zone) : '-';
  };

  const getZoneName = (zId: string) => {
    const zone = zones.find((z: any) => z.id === zId);
    return zone ? tObj(zone) : zId;
  };

  const getDistrictNameByTP = (tpId: string) => {
    const tp = townPanchayats.find((t: any) => t.id === tpId);
    if (!tp) return '-';
    const dist = districts.find((d: any) => d.id === tp.districtId);
    return dist ? tObj(dist) : '-';
  };

  // --- Slideshow Presentation Mode States ---
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

  const handlePrevSlide = () => {
    if (activeSlideIndex > 0) {
      setActiveSlideIndex(prev => prev - 1);
    }
  };

  const handleNextSlide = () => {
    if (activeSlideIndex < sortedIssues.length - 1) {
      setActiveSlideIndex(prev => prev + 1);
    }
  };

  const handleSlideAttachmentUpload = async (file: File) => {
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 5) {
      alert(lang === 'ta' ? 'இணைப்பு கோப்பு அளவு 5MBக்கு மிகாமல் இருக்க வேண்டும்!' : 'Attachment size must not exceed 5MB!');
      return;
    }
    setIsUploadingSlideFile(true);
    try {
      const currentIssue = sortedIssues[activeSlideIndex];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('employeeId', currentUser.id || 'system_user');
      formData.append('townPanchayatId', currentUser.scopeId || '');
      formData.append('officeCategoryType', currentUser.roleId === 'eo' ? 'TP' : currentUser.roleId === 'ad' ? 'ADTP' : 'DTP');
      if (currentIssue?.issueId) {
        formData.append('issueId', currentIssue.issueId);
      }

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setSlideUpdateAttachment({
          fileName: file.name,
          url: data.url
        });
      } else {
        throw new Error(data.message || 'Upload failed');
      }
    } catch (err) {
      console.error(err);
      alert(lang === 'ta' ? 'இணைப்பு பதிவேற்றம் தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.' : 'Attachment upload failed. Please try again.');
    } finally {
      setIsUploadingSlideFile(false);
    }
  };

  const handleSlideUpdateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveCollection) {
      alert(lang === 'ta' ? 'புதுப்பிப்புகளைச் சேமிக்க அனுமதி இல்லை' : 'Saving updates is not permitted from this page.');
      return;
    }
    const currentIssue = sortedIssues[activeSlideIndex];
    if (!currentIssue) return;
    if (!slideUpdateNotes.trim()) {
      alert(lang === 'ta' ? 'நடவடிக்கை குறிப்பு அல்லது விவரங்களை உள்ளிடவும்!' : 'Please enter update remarks!');
      return;
    }

    setIsSubmittingSlideUpdate(true);
    try {
      const isTPUser = currentUser.scopeType === 'TownPanchayat';
      const isZoneUser = currentUser.scopeType === 'Zone';
      const userDesignation = isTPUser 
        ? `${lang === 'ta' ? 'செயல் அலுவலர்' : 'Executive Officer'} (${getTPName(currentUser.scopeId)})` 
        : isZoneUser 
        ? `${lang === 'ta' ? 'உதவி இயக்குநர்' : 'Assistant Director'} (${getZoneName(currentUser.scopeId)})` 
        : `${lang === 'ta' ? 'இயக்குநரகம் (தலைமையகம்)' : 'Directorate (Head Office)'}`;

      const isTPOrZoneUser = currentUser.scopeType === 'TownPanchayat' || currentUser.scopeType === 'Zone';
      let finalStatus = currentIssue.status;
      if (slideUpdateStatus === 'Resolved' && isTPOrZoneUser) {
        finalStatus = 'In Progress';
      } else {
        finalStatus = slideUpdateStatus;
      }

      const updateEntry = {
        id: `upd_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        status: finalStatus,
        notes: slideUpdateNotes.trim(),
        userName: currentUser.nameEn || currentUser.username,
        userNameTa: currentUser.nameTa || currentUser.nameEn || currentUser.username,
        userRole: currentUser.roleId || 'eo',
        scopeType: currentUser.scopeType || 'TownPanchayat',
        userDesignation,
        file: slideUpdateAttachment || null,
        date: new Date().toISOString()
      };

      const updatedIssues = (state.pendingIssues || []).map((iss: any) => {
        if (iss.id === currentIssue.id) {
          const updatedComments = [...(iss.comments || []), updateEntry];
          return {
            ...iss,
            status: finalStatus,
            updatedAt: new Date().toISOString(),
            lastUpdatedBy: currentUser.nameEn || currentUser.username,
            comments: updatedComments
          };
        }
        return iss;
      });

      await onSaveCollection('pendingIssues', updatedIssues);
      
      setSlideUpdateNotes('');
      setSlideUpdateAttachment(null);
      setSlideSuccessMsg(lang === 'ta' ? 'புதுப்பிப்பு வெற்றிகரமாக சேர்க்கப்பட்டது!' : 'Update posted successfully!');
      setTimeout(() => setSlideSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
      alert(lang === 'ta' ? 'புதுப்பிப்பைச் சமர்ப்பிக்க முடியவில்லை.' : 'Failed to post update.');
    } finally {
      setIsSubmittingSlideUpdate(false);
    }
  };

  // Filter states for the Abstract Table
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
  const [filterCategory, setFilterCategory] = useState<string>('');
  const visibleCategories = filterCategory
    ? CATEGORIES_LIST.filter((cat: any) => cat.id === filterCategory)
    : CATEGORIES_LIST;
  const [selectedLedgerIssue, setSelectedLedgerIssue] = useState<any | null>(null);
  const [activePreviewFile, setActivePreviewFile] = useState<any | null>(null);

  // Define permissible abstract table view modes based on user scope role
  const permissibleModes = hodLike
    ? ['category', 'zone', 'district']
    : currentUser.scopeType === 'Zone'
      ? ['category', 'district']
      : ['category'];

  const [abstractViewMode, setAbstractViewMode] = useState<'category' | 'zone' | 'district'>(
    permissibleModes.includes('category') ? 'category' : 'category'
  );

  // Click-to-filter state for charts and abstract cells
  const [selectedChartCategory, setSelectedChartCategory] = useState<string>('');
  const [selectedAbstractCategory, setSelectedAbstractCategory] = useState<string>('');
  const [selectedAbstractSubcategory, setSelectedAbstractSubcategory] = useState<string>('');
  const [selectedAbstractStatus, setSelectedAbstractStatus] = useState<string>('');
  const [isRefreshingAbstract, setIsRefreshingAbstract] = useState<boolean>(false);
  const [embedFilterActions, setEmbedFilterActions] = useState<{
    apply: () => void;
    reset: () => void;
    isRefreshing: boolean;
    fetchError: string | null;
  } | null>(null);
  const [swmEmbedFilterActions, setSwmEmbedFilterActions] = useState<{
    apply: () => void;
    reset: () => void;
    isRefreshing: boolean;
    fetchError: string | null;
  } | null>(null);
  const [swmTileTotals, setSwmTileTotals] = useState({
    totalWards: 0,
    totalStreets: 0,
    householdsSurveyed: 0,
    segregating: 0,
    notSegregating: 0,
    doorLocked: 0,
    homeComposting: 0,
  });
  const [dashReportTab, setDashReportTab] = useState<'inspection' | 'swm'>('inspection');
  const [abstractRefreshTime, setAbstractRefreshTime] = useState<string>('');

  const handleRefreshAbstract = async () => {
    setIsRefreshingAbstract(true);
    try {
      await onRefreshDashboardStats?.();
      setAbstractRefreshTime(new Date().toLocaleTimeString());
    } finally {
      setIsRefreshingAbstract(false);
    }
  };

  // Sorting state for the table
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Excel spreadsheet exporter helper
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
        visibleCategories.forEach((cat: any) => {
          (cat.subcategories || []).forEach((sub: any) => {
            const subcatIssues = baseFilteredIssues.filter((i: any) => i.category === cat.id && i.subcategory === sub.id);
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
          const zoneIssues = baseFilteredIssues.filter((i: any) => tpIds.includes(i.townPanchayatId));
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
          const distIssues = baseFilteredIssues.filter((i: any) => tpIds.includes(i.townPanchayatId));
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
        const statusLabel = lang === 'ta' 
          ? (issue.status === 'Pending' ? 'நிலுவை' : issue.status === 'In Progress' ? 'நடவடிக்கை' : issue.status === 'Resolved' ? 'தீர்க்கப்பட்டது' : 'மூடப்பட்டது')
          : issue.status;

        const lastComment = issue.comments && issue.comments.length > 0 ? issue.comments[issue.comments.length - 1] : null;
        const lastUpdateNotes = lastComment ? lastComment.notes : '';
        const lastUpdateUser = lastComment ? (lang === 'ta' ? (lastComment.userNameTa || lastComment.userName) : lastComment.userName) : '';
        const lastUpdateDesignation = lastComment ? lastComment.userDesignation : '';
        const lastUpdateStaff = lastUpdateUser ? `${lastUpdateUser} (${lastUpdateDesignation || ''})` : '';

        let statusColor = '#000000';
        if (issue.status === 'Pending') statusColor = '#b45309';
        if (issue.status === 'In Progress') statusColor = '#6b21a8';
        if (issue.status === 'Resolved') statusColor = '#047857';
        if (issue.status === 'Closed') statusColor = '#334155';

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

    // Generate the full template wrapper
    const excelTemplate = `
      <` + `html xmlns:o="urn:schemas-microsoft-excel:office:office" xmlns:x="urn:schemas-microsoft-excel:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
      <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
      <!--[if gte mso 9]>
      <xml>
       <x:ExcelWorkbook>
        <x:ExcelWorksheets>
         <x:ExcelWorksheet>
          <x:Name>${tableType === 'abstract' ? 'Abstract summary' : 'Detailed Ledger'}</x:Name>
          <x:WorksheetOptions>
           <x:DisplayGridlines/>
           <x:Print>
             <x:FitWidth>1</x:FitWidth>
             <x:FitHeight>99</x:FitHeight>
             <x:LeftToRight/>
           </x:Print>
          </x:WorksheetOptions>
         </x:ExcelWorksheet>
        </x:ExcelWorksheets>
       </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        td, th { border: 1px solid #cbd5e1; padding: 10px; font-size: 10pt; white-space: normal; mso-number-format: "\\@"; word-wrap: break-word; }
        th { font-weight: bold; text-align: center; font-size: 11pt; }
        .header-title { font-size: 16pt; font-weight: bold; color: #1e1b4b; text-align: left; font-family: 'Segoe UI', sans-serif; }
        .header-subtitle { font-size: 11pt; color: #4f46e5; font-weight: bold; text-align: left; padding-bottom: 5px; }
        .header-meta { font-size: 9pt; color: #64748b; padding-bottom: 15px; text-align: left; }
      </style>
      </head>
      <body>
        <div class="header-title">TAMIL NADU TOWN PANCHAYATS DIRECTORY</div>
        <div class="header-subtitle">${title}</div>
        <div class="header-meta">
          Export Date: ${new Date().toLocaleString()} | User: ${currentUser?.nameEn || currentUser?.email || 'System'} | Role: ${currentUser?.roleId?.toUpperCase()}
        </div>
        ${contentHtml}
      </body>
      </` + `html>
    `;

    const blob = new Blob([excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Step 1: Base filtered issues matching dropdown selections (Zone, District, TP)
  const baseFilteredIssues = scopedIssues.filter((issue: any) => {
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

  const categoryIssueRows = useMemo(() => {
    const total = baseFilteredIssues.length;
    const rows = CATEGORIES_LIST.map((cat: any) => {
      const count = baseFilteredIssues.filter((i: any) => i.category === cat.id).length;
      return {
        id: cat.id,
        nameEn: cat.nameEn,
        nameTa: cat.nameTa,
        count,
        share: total > 0 ? Math.round((count / total) * 100) : 0,
        color: getCategoryThemeColor(cat.id),
        subCount: (cat.subcategories || []).length,
      };
    });
    const maxCount = Math.max(...rows.map((row: any) => row.count), 1);
    const ringR = 42;
    const ringC = 2 * Math.PI * ringR;
    const counted = rows.filter((row: any) => row.count > 0);
    const gap = counted.length > 1 ? 3.2 : 0;
    let offset = 0;
    const segments = counted.map((row: any) => {
      const raw = (row.count / Math.max(total, 1)) * ringC;
      const length = Math.max(raw - gap, 0);
      const segment = { ...row, dash: `${length} ${ringC}`, offset: -offset };
      offset += raw;
      return segment;
    });
    return { rows, maxCount, total, ringR, ringC, segments };
  }, [CATEGORIES_LIST, baseFilteredIssues, currentTheme]);

  const subcategoryIssueRows = useMemo(() => {
    let displayed: any[] = [];
    if (selectedChartCategory) {
      const parentCat = CATEGORIES_LIST.find((c: any) => c.id === selectedChartCategory);
      if (parentCat) {
        displayed = (parentCat.subcategories || []).map((sub: any) => ({
          ...sub,
          categoryEn: parentCat.nameEn,
          categoryTa: parentCat.nameTa,
          categoryId: parentCat.id,
        }));
      }
    } else {
      CATEGORIES_LIST.forEach((cat: any) => {
        (cat.subcategories || []).forEach((sub: any) => {
          displayed.push({
            ...sub,
            categoryEn: cat.nameEn,
            categoryTa: cat.nameTa,
            categoryId: cat.id,
          });
        });
      });
    }

    const rows = displayed
      .map((sub: any) => {
        const count = baseFilteredIssues.filter((i: any) => i.subcategory === sub.id).length;
        return {
          ...sub,
          count,
          parentColor: getCategoryThemeColor(sub.categoryId),
        };
      })
      .sort((a: any, b: any) => b.count - a.count || String(a.nameEn || '').localeCompare(String(b.nameEn || '')));

    const maxCount = Math.max(...rows.map((row: any) => row.count), 1);
    const total = rows.reduce((sum: number, row: any) => sum + row.count, 0);
    return { rows, maxCount, total };
  }, [CATEGORIES_LIST, baseFilteredIssues, selectedChartCategory, currentTheme]);

  // Step 2: Final filtered issues matching dropdown stage and abstract table clicked cells
  const filteredIssues = baseFilteredIssues.filter((issue: any) => {
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
    return true;
  });

  // Handle column sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedIssues = [...filteredIssues].sort((a: any, b: any) => {
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

    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // Keyboard navigation for Slide View
  React.useEffect(() => {
    if (!isSlideViewActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        if (activeSlideIndex < sortedIssues.length - 1) {
          setActiveSlideIndex(prev => prev + 1);
        }
      } else if (e.key === 'ArrowLeft') {
        if (activeSlideIndex > 0) {
          setActiveSlideIndex(prev => prev - 1);
        }
      } else if (e.key === 'Escape') {
        setIsSlideViewActive(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSlideViewActive, activeSlideIndex, sortedIssues]);

  // Track previous active slide index to reset only when slide index actually changes
  const prevSlideIndexRef = React.useRef<number>(-1);
  const prevSlideViewActiveRef = React.useRef<boolean>(false);

  // Auto-reset slide preview file and remarks when active index or open state changes
  React.useEffect(() => {
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
            const isTPOrZoneUser = currentUser.scopeType === 'TownPanchayat' || currentUser.scopeType === 'Zone';
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

  // Scoped inspection calculations for dashboard card
  const userZoneId = useMemo(() => {
    if (!currentUser || hodLike) return null;
    if (currentUser.scopeType === 'Zone') {
      return currentUser.scopeId;
    }
    if (currentUser.scopeType === 'TownPanchayat' || currentUser.isEmployee) {
      const tpId = currentUser.tpId || currentUser.scopeId;
      const tpObj = (townPanchayats || []).find((t: any) => t.id === tpId);
      if (tpObj) {
        const distObj = (districts || []).find((d: any) => d.id === tpObj.districtId);
        return distObj?.zoneId || null;
      }
    }
    return null;
  }, [currentUser, hodLike, townPanchayats, districts]);

  const userDistrictId = useMemo(() => {
    if (!currentUser || hodLike) return null;
    if (currentUser.scopeType === 'TownPanchayat' || currentUser.isEmployee) {
      const tpId = currentUser.tpId || currentUser.scopeId;
      const tpObj = (townPanchayats || []).find((t: any) => t.id === tpId);
      return tpObj?.districtId || null;
    }
    return null;
  }, [currentUser, hodLike, townPanchayats]);

  const userTpId = useMemo(() => {
    if (!currentUser || hodLike) return null;
    if (currentUser.scopeType === 'TownPanchayat' || currentUser.isEmployee) {
      return currentUser.tpId || currentUser.scopeId;
    }
    return null;
  }, [currentUser, hodLike]);

  const dashboardAbstractData = useMemo(() => {
    const subjectsMap: Record<string, {
      subjectId: string;
      subjectNameEn: string;
      subjectNameTa: string;
      totalInspections: number;
    }> = {};

    const stats = Array.isArray(state.inspectionWorkStats) ? state.inspectionWorkStats : [];
    const works = Array.isArray(state.inspectionWorks) ? state.inspectionWorks : [];
    const rows = stats.length > 0 ? stats : works;
    const filterMasters = { districts, zones, townPanchayats };

    const rowMatchesScope = (row: any) => {
      if (hodLike) return true;
      if (userTpId) return workMatchesTp(row, userTpId, filterMasters);
      if (userDistrictId) return workMatchesDistrict(row, userDistrictId, filterMasters);
      if (userZoneId) return workMatchesZone(row, userZoneId, filterMasters);
      return true;
    };

    rows.forEach((row: any) => {
      if (isFallbackInspectionWork(row)) return;
      if (!rowMatchesScope(row)) return;
      const sId = row.subjectId || 'unknown';
      if (!subjectsMap[sId]) {
        subjectsMap[sId] = {
          subjectId: sId,
          subjectNameEn: row.subjectNameEn || 'General Inspection',
          subjectNameTa: row.subjectNameTa || 'பொது ஆய்வு',
          totalInspections: 0
        };
      }
      subjectsMap[sId].totalInspections += Number(row.count || 1);
    });

    return Object.values(subjectsMap);
  }, [state.inspectionWorkStats, state.inspectionWorks, userZoneId, userDistrictId, userTpId, hodLike, districts, zones, townPanchayats]);

  const handleDownloadInspectionExcel = () => {
    let rowsHtml = '';
    dashboardAbstractData.forEach((row) => {
      rowsHtml += `
        <tr>
          <td style="border: 1px solid #cbd5e1; padding: 10px;">${lang === 'ta' ? row.subjectNameTa : row.subjectNameEn}</td>
          <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-weight: bold;">${row.totalInspections}</td>
        </tr>
      `;
    });

    const totalCount = dashboardAbstractData.reduce((acc, cur) => acc + cur.totalInspections, 0);
    rowsHtml += `
      <tr style="font-weight: bold; background-color: #f1f5f9;">
        <td style="border: 1.5px solid #94a3b8; padding: 12px; font-weight: bold;">${lang === 'ta' ? 'மொத்தம்' : 'Total'}</td>
        <td style="border: 1.5px solid #94a3b8; padding: 12px; text-align: right; font-weight: bold; font-size: 11pt;">${totalCount}</td>
      </tr>
    `;

    const template = `
      <` + `html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Inspection Abstract</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <style>
          table { border-collapse: collapse; width: 100%; font-family: sans-serif; }
          td, th { border: 1px solid #cbd5e1; padding: 10px; font-size: 10pt; }
          th { font-weight: bold; background-color: #4f46e5; color: #ffffff; padding: 12px; }
        </style>
      </head>
      <body>
        <h3 style="font-family: sans-serif; color: #4f46e5; margin-bottom: 5px;">Town Panchayat - Inspection Abstract Summary</h3>
        <p style="font-family: sans-serif; font-size: 11px; color: #475569; margin-top: 0; margin-bottom: 15px;">Generated on: ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              <th>${lang === 'ta' ? 'ஆய்வுப் பிரிவு' : 'Subject'}</th>
              <th style="text-align: right;">${lang === 'ta' ? 'ஆய்வுகள் எண்ணிக்கை' : 'Inspection Count'}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </` + `html>
    `;

    const blob = new Blob([template], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Inspection_Abstract_Summary_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadInspectionPDF = async () => {
    const [{ default: jsPDF }, autoTableMod, exportMod] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
      import('@/lib/inspectionReportExport'),
    ]);
    const autoTable = autoTableMod.default;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(79, 70, 229);
    doc.text('Town Panchayat - Inspection Abstract Summary', 14, 15);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 21);

    const headers = [
      'Subject Name',
      'Inspection Count'
    ];

    const body = dashboardAbstractData.map(row => [
      lang === 'ta' ? row.subjectNameTa : row.subjectNameEn,
      String(row.totalInspections)
    ]);

    const totalCount = dashboardAbstractData.reduce((acc, cur) => acc + cur.totalInspections, 0);
    body.push(['Total', String(totalCount)]);

    autoTable(doc, {
      ...exportMod.repeatingAutotableHeader(doc, 'Town Panchayat - Inspection Abstract Summary', lang === 'ta' ? 'ta' : 'en', true),
      startY: 28,
      head: [headers],
      body: body,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 4,
        overflow: 'linebreak',
        lineColor: [100, 116, 139],
        lineWidth: 0.15
      },
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      columnStyles: {
        1: { halign: 'right' }
      }
    });

    doc.save(`Inspection_Abstract_Summary_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // Filter employees based on current user scope for counters
  const getScopedData = () => {
    if (hodLike) {
      return employees;
    } else if (currentUser.scopeType === 'Zone') {
      return employees.filter((e: any) => e.zoneId === currentUser.scopeId);
    } else {
      return employees.filter((e: any) => e.townPanchayatId === currentUser.scopeId);
    }
  };

  const scopedEmployees = getScopedData();
  const pendingTransfers = transferRequests.filter((r: any) => r.status === 'Pending');

  // Distribution counters
  const groupCounts: { [key: string]: number } = { A: 0, B: 0, C: 0, D: 0 };
  const catCounts: { [key: string]: number } = { admin: 0, eng: 0, health: 0 };

  scopedEmployees.forEach((emp: any) => {
    if (groupCounts[emp.groupId] !== undefined) {
      groupCounts[emp.groupId]++;
    }
    if (catCounts[emp.categoryId] !== undefined) {
      catCounts[emp.categoryId]++;
    }
  });

  const isEmployeeMgmtEnabled = state?.settings?.enableEmployeeManagement !== false;
  const isTransferPostingEnabled = state?.settings?.enableTransferPosting !== false;

  const isAdminRole = currentUser.roleId === 'admin' || currentUser.roleId === 'dtp_admin';
  const isZonalUser = isZonalScopedUser(currentUser);
  const isTPUser = currentUser.scopeType === 'TownPanchayat' || currentUser.roleId === 'eo';

  // Standard Issue Counts for all user roles
  const totalIssuesCount = scopedIssues.length;
  const pendingIssuesCount = scopedIssues.filter((i: any) => i.status === 'Pending' || (i.status === 'Active' && (!i.comments || i.comments.length <= 1))).length;
  const inProgressIssuesCount = scopedIssues.filter((i: any) => i.status === 'In Progress' || (i.status === 'Active' && i.comments && i.comments.length > 1)).length;
  const resolvedIssuesCount = scopedIssues.filter((i: any) => i.status === 'Resolved' || i.status === 'Closed').length;

  const scrollToAbstract = (stageFilter: string) => {
    setFilterStage(stageFilter);
    setSelectedAbstractStatus('');
    setSelectedAbstractCategory('');
    setSelectedAbstractSubcategory('');
    setTimeout(() => {
      document.getElementById('abstract-register-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const scrollToInspectionReports = () => {
    setDashReportTab('inspection');
    requestAnimationFrame(() => {
      document.getElementById('dashboard-reports-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const scrollToSwmReports = () => {
    setDashReportTab('swm');
    requestAnimationFrame(() => {
      document.getElementById('dashboard-reports-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const scopedDashboardTps = hodLike
    ? townPanchayats
    : currentUser?.scopeType === 'Zone'
      ? townPanchayats.filter((tp: any) => getTPZoneId(tp) === currentUser.scopeId)
      : townPanchayats.filter((tp: any) => tp.id === currentUser?.scopeId);

  const masterGeoCounts = useMemo(() => {
    const tpIds = new Set(
      scopedDashboardTps.map((tp: any) => String(tp.id || '').trim().toLowerCase()).filter(Boolean)
    );
    const tpNames = new Set(
      scopedDashboardTps.flatMap((tp: any) => [
        String(tp.nameEn || '').trim().toLowerCase(),
        String(tp.nameTa || '').trim().toLowerCase(),
      ]).filter(Boolean)
    );
    const restrictTp = !hodLike && tpIds.size > 0;
    const wardKeys = new Set<string>();
    let streetCount = 0;
    (state?.wardsAndStreets || []).forEach((ws: any) => {
      const tpId = String(ws.tpId || ws.townPanchayatId || ws.tp_id || '').trim().toLowerCase();
      const tpName = String(ws.tpNameEn || ws.tpName || ws.tpNameTa || '').trim().toLowerCase();
      if (restrictTp) {
        const matchTp = (tpId && tpIds.has(tpId)) || (tpName && tpNames.has(tpName));
        if (!matchTp) return;
      }
      streetCount += 1;
      const wardRaw = String(ws.wardNo || ws.wardNumber || ws.ward_no || ws.ward || '').trim();
      const wardDigits = wardRaw.replace(/[^0-9]/g, '');
      const ward = (wardDigits.replace(/^0+/, '') || wardDigits || wardRaw);
      if (ward) wardKeys.add(`${tpId || tpName}|${ward}`);
    });
    return { totalWards: wardKeys.size, totalStreets: streetCount };
  }, [hodLike, scopedDashboardTps, state?.wardsAndStreets]);

  const totalInspections = dashboardAbstractData.reduce((sum, row) => sum + (Number(row.totalInspections) || 0), 0);
  const inspectionCards = [
    {
      id: 'total_inspections',
      title: lang === 'ta' ? 'மொத்த ஆய்வுகள்' : 'Total Inspections',
      count: totalInspections,
      icon: ClipboardCheck,
      action: scrollToInspectionReports
    },
    {
      id: 'total_subjects',
      title: lang === 'ta' ? 'ஆய்வுப் பிரிவுகள்' : 'Subjects',
      count: (state.inspectionSubjects || []).length || dashboardAbstractData.length,
      icon: Layers,
      action: scrollToInspectionReports
    },
    {
      id: 'total_categories',
      title: lang === 'ta' ? 'ஆய்வு வகைகள்' : 'Categories',
      count: (state.inspectionCategories || []).length,
      icon: BarChart3,
      action: scrollToInspectionReports
    },
    {
      id: 'total_tps',
      title: lang === 'ta' ? 'பேரூராட்சிகள்' : 'Town Panchayats',
      count: scopedDashboardTps.length,
      icon: Building,
      action: scrollToInspectionReports
    },
    {
      id: 'total_wards',
      title: lang === 'ta' ? 'மொத்த வார்டுகள்' : 'Total Wards',
      count: masterGeoCounts.totalWards,
      icon: MapPin,
      action: scrollToInspectionReports
    },
    {
      id: 'total_streets',
      title: lang === 'ta' ? 'மொத்த தெருக்கள்' : 'Total Streets',
      count: masterGeoCounts.totalStreets,
      icon: GitPullRequest,
      action: scrollToInspectionReports
    },
    {
      id: 'total_inspectors',
      title: lang === 'ta' ? 'கள ஆய்வாளர்கள்' : 'Field Inspectors',
      count: (state.inspectionUsers || []).length || (employees || []).length,
      icon: UserCheck,
      action: scrollToInspectionReports
    }
  ];
  const swmCards = [
    {
      id: 'total_wards',
      title: lang === 'ta' ? 'மொத்த வார்டுகள்' : 'Total Wards',
      count: masterGeoCounts.totalWards || swmTileTotals.totalWards,
      icon: Layers,
      action: scrollToSwmReports
    },
    {
      id: 'total_streets',
      title: lang === 'ta' ? 'மொத்த தெருக்கள்' : 'Total Streets',
      count: masterGeoCounts.totalStreets || swmTileTotals.totalStreets,
      icon: MapPin,
      action: scrollToSwmReports
    },
    {
      id: 'total_surveyed',
      title: lang === 'ta' ? 'கணக்கெடுக்கப்பட்ட வீடுகள்' : 'Total Surveyed',
      count: swmTileTotals.householdsSurveyed,
      icon: Users,
      action: scrollToSwmReports
    },
    {
      id: 'segregating',
      title: lang === 'ta' ? 'தரம் பிரித்து வழங்கும் வீடுகள்' : 'Segregating Waste at Source',
      count: swmTileTotals.segregating,
      icon: Recycle,
      action: scrollToSwmReports
    },
    {
      id: 'not_segregating',
      title: lang === 'ta' ? 'தரம் பிரிக்காமல் வழங்கும் வீடுகள்' : 'Not Segregating Waste at Source',
      count: swmTileTotals.notSegregating,
      icon: AlertTriangle,
      action: scrollToSwmReports
    },
    {
      id: 'door_locked',
      title: lang === 'ta' ? 'பூட்டிய வீடுகள்' : 'Door Locked',
      count: swmTileTotals.doorLocked,
      icon: Lock,
      action: scrollToSwmReports
    },
    {
      id: 'home_composting',
      title: lang === 'ta' ? 'வீட்டு உரமாக்கம்' : 'Home Composting',
      count: swmTileTotals.homeComposting,
      icon: Home,
      action: scrollToSwmReports
    }
  ];
  const cards = dashReportTab === 'swm' ? swmCards : inspectionCards;

  // Helper for sorting arrows
  const renderSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 text-gray-400 shrink-0" />;
    return sortDir === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1 portal-dash-sort shrink-0" />
      : <ArrowDown className="w-3 h-3 ml-1 portal-dash-sort shrink-0" />;
  };

  // Allowed scopes based on user role
  const allowedZones = hodLike
    ? zones
    : currentUser.scopeType === 'Zone'
      ? zones.filter((z: any) => z.id === currentUser.scopeId)
      : zones.filter((z: any) => z.id === getTPZoneId(townPanchayats.find((tp: any) => tp.id === currentUser.scopeId)));

  const allowedDistricts = hodLike
    ? districts
    : currentUser.scopeType === 'Zone'
      ? districts.filter((d: any) => d.zoneId === currentUser.scopeId)
      : districts.filter((d: any) => d.id === (townPanchayats.find((tp: any) => tp.id === currentUser.scopeId)?.districtId));

  const allowedTPs = hodLike
    ? townPanchayats
    : currentUser.scopeType === 'Zone'
      ? townPanchayats.filter((tp: any) => getTPZoneId(tp) === currentUser.scopeId)
      : townPanchayats.filter((tp: any) => tp.id === currentUser.scopeId);

  // Helper lists for dropdown filters
  const availableDistricts = allowedDistricts.filter((d: any) => {
    if (filterZoneId && d.zoneId !== filterZoneId) return false;
    return true;
  });

  const availableTPs = allowedTPs.filter((tp: any) => {
    if (currentUser.scopeType !== 'TownPanchayat' && !filterDistrictId) return false;
    if (filterZoneId && getTPZoneId(tp) !== filterZoneId) return false;
    if (filterDistrictId && tp.districtId !== filterDistrictId) return false;
    return true;
  });

  const kpiAccents: Record<string, string> = {
    total_inspections: '#1d4ed8',
    total_subjects: '#7c3aed',
    total_categories: '#0f766e',
    total_tps: '#c2410c',
    total_inspectors: '#0284c7',
    total_wards: '#1d4ed8',
    total_streets: '#0f766e',
    total_surveyed: '#0284c7',
    segregating: '#059669',
    not_segregating: '#d97706',
    door_locked: '#be123c',
    home_composting: '#7c3aed',
  };
  const kpiFallback = ['#1d4ed8', '#7c3aed', '#0f766e', '#c2410c', '#d97706', '#0284c7', '#059669', '#c026d3'];

  const shadeHex = (hex: string, amount: number) => {
    const raw = hex.replace('#', '');
    if (raw.length !== 6) return hex;
    const n = Number.parseInt(raw, 16);
    const to = (shift: number) => Math.max(0, Math.min(255, ((n >> shift) & 255) + amount));
    return `#${[to(16), to(8), to(0)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  };

  const getKpiStyle = (cardId: string, index: number): React.CSSProperties => {
    const accent = kpiAccents[cardId] || kpiFallback[index % kpiFallback.length] || currentTheme.accentColor;
    const deep = shadeHex(accent, -38);
    return {
      ['--kpi-accent' as string]: accent,
      backgroundImage: `linear-gradient(145deg, ${accent} 0%, ${deep} 100%)`,
      boxShadow: `0 14px 28px -12px ${accent}cc`,
    };
  };

  const kpiGridCols =
    cards.length >= 7
      ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7'
      : cards.length >= 5
        ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
        : cards.length === 4
          ? 'grid-cols-2 lg:grid-cols-4'
          : 'grid-cols-2 sm:grid-cols-3';

  return (
    <div id="dashboard-view-container" className="min-w-0 space-y-5 overflow-x-hidden">
      <section className={`grid min-w-0 gap-2 md:gap-2.5 ${kpiGridCols}`}>
        {cards.map((card, cardIndex) => (
          <button
            key={card.id}
            id={`kpi-card-${card.id}`}
            type="button"
            onClick={card.action}
            style={getKpiStyle(card.id, cardIndex)}
            className="portal-dashboard-kpi-card relative flex h-full min-h-[7.25rem] min-w-0 flex-col justify-between overflow-hidden rounded-2xl p-2.5 text-left text-white transition duration-200 hover:-translate-y-0.5 sm:min-h-[7.75rem] sm:p-3"
          >
            <card.icon
              className="pointer-events-none absolute -right-1 -top-1 h-11 w-11 text-white/20"
              strokeWidth={1.25}
            />
            <span className="relative z-[1] inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/25 text-white ring-1 ring-white/30">
              <card.icon className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
            <div className="relative z-[1] mt-2 flex min-w-0 flex-1 flex-col justify-end gap-1">
              <p className="kpi-label">
                {card.title}
              </p>
              <p className="kpi-value">
                {card.count}
              </p>
            </div>
          </button>
        ))}
      </section>

      <section id="dashboard-reports-section" className="portal-studio">
        <div className="portal-fis-hero">
          <div className="relative z-[1] min-w-0">
            <div className="portal-fis-hero-tabs">
              <button
                type="button"
                onClick={() => setDashReportTab('inspection')}
                className={`portal-fis-hero-tab ${dashReportTab === 'inspection' ? 'is-active' : ''}`}
              >
                <ClipboardCheck />
                <span>{lang === 'ta' ? 'கள ஆய்வு சுருக்கம்' : 'Field Inspection Summary'}</span>
              </button>
              <button
                type="button"
                onClick={() => setDashReportTab('swm')}
                className={`portal-fis-hero-tab ${dashReportTab === 'swm' ? 'is-active' : ''}`}
              >
                <Recycle />
                <span>{lang === 'ta' ? 'SWM அறிக்கைகள்' : 'SWM Reports'}</span>
              </button>
            </div>
          </div>
          <div className="relative z-[1] flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {(dashReportTab === 'swm' ? swmEmbedFilterActions : embedFilterActions)?.fetchError && (
              <span className="max-w-[14rem] truncate text-right text-[11px] font-semibold text-rose-100">
                {(dashReportTab === 'swm' ? swmEmbedFilterActions : embedFilterActions)?.fetchError}
              </span>
            )}
            <button
              type="button"
              onClick={() => (dashReportTab === 'swm' ? swmEmbedFilterActions : embedFilterActions)?.apply()}
              disabled={
                dashReportTab === 'swm'
                  ? !swmEmbedFilterActions || swmEmbedFilterActions.isRefreshing
                  : !embedFilterActions || embedFilterActions.isRefreshing
              }
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white shadow-md hover:brightness-110 disabled:opacity-60 cursor-pointer"
              style={{ backgroundImage: `linear-gradient(90deg, ${currentTheme.chartGradient?.[0] || currentTheme.accentColor}, ${currentTheme.accentColor})` }}
            >
              <RefreshCw className={`h-3 w-3 ${(dashReportTab === 'swm' ? swmEmbedFilterActions : embedFilterActions)?.isRefreshing ? 'animate-spin' : ''}`} />
              {lang === 'ta' ? 'வடிகட்டி பயன்படுத்து' : 'Apply Filters'}
            </button>
            <button
              type="button"
              onClick={() => (dashReportTab === 'swm' ? swmEmbedFilterActions : embedFilterActions)?.reset()}
              disabled={dashReportTab === 'swm' ? !swmEmbedFilterActions : !embedFilterActions}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/15 disabled:opacity-60 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              {lang === 'ta' ? 'அனைத்தையும் மீட்டமை' : 'Reset Filters'}
            </button>
          </div>
        </div>
        <div className="portal-fis-body">
          <div className={dashReportTab === 'inspection' ? '' : 'portal-dash-tab-off'}>
            <InspectionReportsView
              state={state}
              lang={lang}
              theme={theme}
              currentUser={currentUser}
              defaultActiveTab="abstract"
              hideTabsHeader={false}
              hideTopTitle={true}
              embedMode={true}
              hideFilterActions={true}
              onFilterActionsReady={setEmbedFilterActions}
            />
          </div>
          <div className={dashReportTab === 'swm' ? '' : 'portal-dash-tab-off'}>
            <InspectionReportsView
              state={state}
              lang={lang}
              theme={theme}
              currentUser={currentUser}
              defaultActiveTab="abstract"
              defaultReportModule="swm"
              hideTabsHeader={false}
              hideTopTitle={true}
              embedMode={true}
              hideFilterActions={true}
              onFilterActionsReady={setSwmEmbedFilterActions}
              onSwmTotalsReady={(next) => {
                setSwmTileTotals((prev) => (
                  prev.totalWards === next.totalWards
                  && prev.totalStreets === next.totalStreets
                  && prev.householdsSurveyed === next.householdsSurveyed
                  && prev.segregating === next.segregating
                  && prev.notSegregating === next.notSegregating
                  && prev.doorLocked === next.doorLocked
                  && prev.homeComposting === next.homeComposting
                    ? prev
                    : next
                ));
              }}
            />
          </div>
        </div>
      </section>

    </div>
  );
}
