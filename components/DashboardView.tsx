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
  BarChart3
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

  const standardIssueCards = [
    {
      id: 'all_issues',
      title: lang === 'ta' ? 'அனைத்துப் பிரச்சினைகள்' : 'All Issues',
      count: totalIssuesCount,
      icon: GitPullRequest,
      tone: 'bg-slate-100 text-slate-700',
      action: () => scrollToAbstract('')
    },
    {
      id: 'pending_issues',
      title: lang === 'ta' ? 'நிலுவையில் உள்ளவை' : 'Pending Issues',
      count: pendingIssuesCount,
      icon: AlertTriangle,
      tone: 'bg-amber-50 text-amber-700',
      action: () => scrollToAbstract('Pending')
    },
    {
      id: 'in_progress_issues',
      title: lang === 'ta' ? 'செயல்பாட்டில் உள்ளவை' : 'In Progress',
      count: inProgressIssuesCount,
      icon: Activity,
      tone: 'bg-sky-50 text-sky-700',
      action: () => scrollToAbstract('In Progress')
    },
    {
      id: 'resolved_issues',
      title: lang === 'ta' ? 'தீர்க்கப்பட்டவை' : 'Resolved Issues',
      count: resolvedIssuesCount,
      icon: CheckCircle2,
      tone: 'bg-emerald-50 text-emerald-700',
      action: () => scrollToAbstract('Resolved')
    }
  ];

  let cards = [];
  if (isTPUser) {
    cards = [
      ...standardIssueCards,
      {
        id: 'add_new_issue',
        title: lang === 'ta' ? 'புதிய பிரச்சினை சேர்க்கவும்' : 'Add New Issue',
        count: '+',
        icon: PlusCircle,
        tone: 'bg-[#E8EEF6] text-[#1E4B8E]',
        action: () => {
          if (typeof window !== 'undefined') {
            localStorage.setItem('pendingIssuesSubTab', 'create');
          }
          setActiveTab('pendingIssues');
        }
      }
    ];
  } else if (isZonalUser) {
    const zoneTPs = townPanchayats.filter((tp: any) => getTPZoneId(tp) === currentUser.scopeId);
    cards = [
      {
        id: 'tps',
        title: t('totalTPs'),
        count: zoneTPs.length,
        icon: Building,
        tone: 'bg-teal-50 text-teal-700',
        action: () => {}
      },
      ...standardIssueCards
    ];
  } else if (isAdminRole || hodLike) {
    cards = [
      {
        id: 'zones',
        title: t('totalZones'),
        count: zones.length,
        icon: MapIcon,
        tone: 'bg-blue-50 text-blue-700',
        action: () => setActiveTab('masters')
      },
      {
        id: 'districts',
        title: t('totalDistricts'),
        count: districts.length,
        icon: MapPin,
        tone: 'bg-indigo-50 text-indigo-700',
        action: () => setActiveTab('masters')
      },
      {
        id: 'tps',
        title: t('totalTPs'),
        count: townPanchayats.length,
        icon: Building,
        tone: 'bg-teal-50 text-teal-700',
        action: () => setActiveTab('masters')
      },
      ...standardIssueCards
    ];
  } else {
    cards = [
      ...standardIssueCards
    ];
  }

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
    zones: '#1d4ed8',
    districts: '#7c3aed',
    tps: '#0f766e',
    all_issues: currentTheme.accentColor || '#334155',
    pending_issues: '#d97706',
    in_progress_issues: '#0284c7',
    resolved_issues: '#059669',
    add_new_issue: '#c026d3',
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
            className="portal-dashboard-kpi-card relative flex min-w-0 flex-col overflow-hidden rounded-2xl p-2.5 text-left text-white transition duration-200 hover:-translate-y-0.5 sm:p-3"
          >
            <card.icon
              className="pointer-events-none absolute -right-1 -top-1 h-11 w-11 text-white/20"
              strokeWidth={1.25}
            />
            <span className="relative z-[1] inline-flex h-6 w-6 items-center justify-center rounded-md bg-white/25 text-white ring-1 ring-white/30">
              <card.icon className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
            <div className="relative z-[1] mt-1.5 min-w-0">
              <p className="kpi-label truncate">
                {card.title}
              </p>
              <p className="kpi-value">
                {card.count}
              </p>
            </div>
          </button>
        ))}
      </section>

      <section className="portal-studio">
        <div className="portal-fis-hero">
          <div className="relative z-[1] flex min-w-0 items-center gap-2.5">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/20">
              <ClipboardCheck className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 leading-tight">
              <h3 className="text-[14px] font-semibold tracking-tight text-white">
                {lang === 'ta' ? 'கள ஆய்வு சுருக்கம்' : 'Field Inspection Summary'}
              </h3>
              <p className="text-[10px] text-white/70">
                {lang === 'ta'
                  ? 'வடிகட்டி பயன்படுத்தி, குழுவைத் தேர்ந்தெடுத்து முடிவைப் பார்க்கவும்'
                  : 'Apply filters, choose a grouping, then review the result'}
              </p>
            </div>
          </div>
          <div className="relative z-[1] flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {embedFilterActions?.fetchError && (
              <span className="max-w-[14rem] truncate text-right text-[11px] font-semibold text-rose-100">
                {embedFilterActions.fetchError}
              </span>
            )}
            <button
              type="button"
              onClick={() => embedFilterActions?.apply()}
              disabled={!embedFilterActions || embedFilterActions.isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white shadow-md hover:brightness-110 disabled:opacity-60 cursor-pointer"
              style={{ backgroundImage: `linear-gradient(90deg, ${currentTheme.chartGradient?.[0] || currentTheme.accentColor}, ${currentTheme.accentColor})` }}
            >
              <RefreshCw className={`h-3 w-3 ${embedFilterActions?.isRefreshing ? 'animate-spin' : ''}`} />
              {lang === 'ta' ? 'வடிகட்டி பயன்படுத்து' : 'Apply Filters'}
            </button>
            <button
              type="button"
              onClick={() => embedFilterActions?.reset()}
              disabled={!embedFilterActions}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/15 disabled:opacity-60 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              {lang === 'ta' ? 'அனைத்தையும் மீட்டமை' : 'Reset Filters'}
            </button>
          </div>
        </div>
        <div className="portal-fis-body">
          <InspectionReportsView
            state={state}
            lang={lang}
            theme={theme}
            currentUser={currentUser}
            defaultActiveTab="abstract"
            hideTabsHeader={true}
            hideTopTitle={true}
            embedMode={true}
            hideFilterActions={true}
            onFilterActionsReady={setEmbedFilterActions}
          />
        </div>
      </section>

      {/* Visual Charts / Diagrams */}
      <div className="portal-issue-split">
        <div className="portal-dashboard-panel is-issue-cat">
          <div className="portal-dash-head">
            <div>
              <h3>
                <span className="portal-dash-icon">
                  <Layers className="h-3 w-3" />
                </span>
                {lang === 'ta' ? 'வகை வாரியான வரைபடம்' : 'Issues by category'}
              </h3>
              <p>
                {lang === 'ta' ? 'வகையைத் தேர்ந்தெடுத்து உட்பிரிவுகளை வடிகட்டவும்' : 'Select a category to filter subcategories'}
              </p>
            </div>
            <div className="portal-issue-head-actions">
              <span className="portal-issue-badge">{categoryIssueRows.total}</span>
              {selectedChartCategory && (
                <button
                  type="button"
                  onClick={() => setSelectedChartCategory('')}
                  className="portal-dash-head-action"
                >
                  {lang === 'ta' ? 'அனைத்தும் காட்டு' : 'Clear Filter'}
                </button>
              )}
            </div>
          </div>

          <div className="portal-dash-body">
            <div className="portal-cat-compose">
              <div className="portal-cat-ring">
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <circle
                    cx="60"
                    cy="60"
                    r={categoryIssueRows.ringR}
                    fill="none"
                    stroke="#e8eef6"
                    strokeWidth="14"
                  />
                  {categoryIssueRows.segments.map((seg: any) => {
                    const isSelected = selectedChartCategory === seg.id;
                    const dimmed = Boolean(selectedChartCategory) && !isSelected;
                    return (
                      <circle
                        key={seg.id}
                        cx="60"
                        cy="60"
                        r={categoryIssueRows.ringR}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth={isSelected ? 16 : 14}
                        strokeDasharray={seg.dash}
                        strokeDashoffset={seg.offset}
                        transform="rotate(-90 60 60)"
                        className={`portal-cat-slice ${dimmed ? 'is-dim' : ''}`}
                        onClick={() => setSelectedChartCategory(isSelected ? '' : seg.id)}
                      />
                    );
                  })}
                </svg>
                <div className="portal-cat-ring-label">
                  <strong>
                    {selectedChartCategory
                      ? (categoryIssueRows.rows.find((row: any) => row.id === selectedChartCategory)?.count ?? 0)
                      : categoryIssueRows.total}
                  </strong>
                  <span>{lang === 'ta' ? 'பிரச்சினைகள்' : 'Issues'}</span>
                </div>
              </div>
              <div className="portal-cat-legend">
                {categoryIssueRows.rows.map((cat: any) => {
                  const isSelected = selectedChartCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedChartCategory(isSelected ? '' : cat.id)}
                      className={`portal-cat-legend-row ${isSelected ? 'is-active' : ''}`}
                      style={{ ['--cat-tone' as string]: cat.color }}
                    >
                      <span className="portal-cat-swatch" />
                      <span className="portal-cat-legend-name">
                        {lang === 'ta' ? cat.nameTa : cat.nameEn}
                      </span>
                      <span className="portal-cat-legend-bar">
                        <span style={{ width: `${(cat.count / categoryIssueRows.maxCount) * 100}%` }} />
                      </span>
                      <span className="portal-cat-legend-count">{cat.count}</span>
                      <span className="portal-cat-legend-share">{cat.share}%</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="portal-dashboard-panel is-issue-sub">
          <div className="portal-dash-head">
            <div>
              <h3>
                <span className="portal-dash-icon">
                  <BarChart3 className="h-3 w-3" />
                </span>
                {lang === 'ta' ? 'துணை வகை வாரியான வரைபடம்' : 'Issues by subcategory'}
              </h3>
              <p>
                {(() => {
                  if (selectedChartCategory) {
                    const matched = CATEGORIES_LIST.find((c: any) => c.id === selectedChartCategory);
                    const name = matched ? (lang === 'ta' ? matched.nameTa : matched.nameEn) : '';
                    return lang === 'ta' ? `வகைக்கான துணை வகைகள்: ${name}` : `Subcategories for ${name}`;
                  }
                  return lang === 'ta' ? 'துணை வகை வாரியான எண்ணிக்கை' : 'Issue count by subcategory';
                })()}
              </p>
            </div>
            <span className="portal-issue-badge">{subcategoryIssueRows.total}</span>
          </div>

          <div className="portal-dash-body">
            {subcategoryIssueRows.rows.length === 0 ? (
              <div className="portal-sub-empty">
                {lang === 'ta' ? 'துணை வகைகள் இல்லை' : 'No subcategories to display'}
              </div>
            ) : (
              <div className="portal-cat-legend">
                {subcategoryIssueRows.rows.map((sub: any) => {
                  const share = subcategoryIssueRows.total > 0 ? Math.round((sub.count / subcategoryIssueRows.total) * 100) : 0;
                  return (
                    <div
                      key={`${sub.categoryId}_${sub.id}`}
                      className="portal-cat-legend-row"
                      style={{ ['--cat-tone' as string]: sub.parentColor }}
                    >
                      <span className="portal-cat-swatch" />
                      <span className="portal-cat-legend-name">
                        {lang === 'ta' ? sub.nameTa : sub.nameEn}
                      </span>
                      <span className="portal-cat-legend-bar">
                        <span style={{ width: `${(sub.count / subcategoryIssueRows.maxCount) * 100}%` }} />
                      </span>
                      <span className="portal-cat-legend-count">{sub.count}</span>
                      <span className="portal-cat-legend-share">{share}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Abstract Table with Filters Section */}
      <div id="abstract-register-section" className="portal-dashboard-panel">
        <div className="portal-dash-head">
          <div>
            <h3>
              <span className="portal-dash-icon">
                <AlertTriangle className="h-3 w-3" />
              </span>
              {lang === 'ta' ? 'பிரச்சினைகள் கண்காணிப்பு அட்டவணை' : 'Issues monitoring register'}
            </h3>
            <p>
              {lang === 'ta'
                ? 'மண்டலம், மாவட்டம், பேரூராட்சி மற்றும் நிலை வாரியாக வடிகட்டி பார்க்கவும்.'
                : 'Filter by zone, district, town panchayat, and status for a live summary.'}
            </p>
          </div>
        </div>

        <div className="portal-dash-body portal-dash-register">
        {/* Dynamic Filters Bar */}
        <div className="portal-dash-fields">
          {/* Zone Filter */}
          <div>
            <label>
              {lang === 'ta' ? 'மண்டலம்' : 'Zone'}
            </label>
            <ThemeSelect
              value={filterZoneId}
              onChange={(e) => {
                setFilterZoneId(e.target.value);
                setFilterDistrictId('');
                setFilterTPId('');
              }}
            >
              {hodLike && (
                <option value="">{lang === 'ta' ? 'அனைத்து மண்டலங்கள்' : 'All Zones'}</option>
              )}
              {allowedZones.map((z: any) => (
                <option key={z.id} value={z.id}>{tObj(z)}</option>
              ))}
            </ThemeSelect>
          </div>

          {/* District Filter */}
          <div>
            <label>
              {lang === 'ta' ? 'மாவட்டம்' : 'District'}
            </label>
            <ThemeSelect
              value={filterDistrictId}
              onChange={(e) => {
                setFilterDistrictId(e.target.value);
                setFilterTPId('');
              }}
            >
              {currentUser.scopeType !== 'TownPanchayat' && (
                <option value="">{lang === 'ta' ? 'அனைத்து மாவட்டங்கள்' : 'All Districts'}</option>
              )}
              {availableDistricts.map((d: any) => (
                <option key={d.id} value={d.id}>{tObj(d)}</option>
              ))}
            </ThemeSelect>
          </div>

          {/* Town Panchayat Filter */}
          <div>
            <label>
              {lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat'}
            </label>
            <ThemeSelect
              value={filterTPId}
              onChange={(e) => setFilterTPId(e.target.value)}
            >
              {currentUser.scopeType !== 'TownPanchayat' && (
                <option value="">{lang === 'ta' ? 'அனைத்து பேரூராட்சிகள்' : 'All Town Panchayats'}</option>
              )}
              {availableTPs.map((tp: any) => (
                <option key={tp.id} value={tp.id}>{tObj(tp)}</option>
              ))}
            </ThemeSelect>
          </div>

          {/* Category Filter */}
          <div>
            <label>
              {lang === 'ta' ? 'பிரிவு (Category)' : 'Category'}
            </label>
            <ThemeSelect
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">{lang === 'ta' ? 'அனைத்து பிரிவுகள்' : 'All Categories'}</option>
              {Object.keys(CATEGORIES_MAP).map((catId) => (
                <option key={catId} value={catId}>
                  {lang === 'ta' ? CATEGORIES_MAP[catId].ta : CATEGORIES_MAP[catId].en}
                </option>
              ))}
            </ThemeSelect>
          </div>

          {/* Stage / Status Filter */}
          <div>
            <label>
              {lang === 'ta' ? 'நிலை (Stage)' : 'Stage / Status'}
            </label>
            <ThemeSelect
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
            >
              <option value="">{lang === 'ta' ? 'அனைத்து நிலைகள்' : 'All Stages'}</option>
              <option value="Pending">{lang === 'ta' ? 'நிலுவை (Pending)' : 'Pending'}</option>
              <option value="In Progress">{lang === 'ta' ? 'நடவடிக்கை (In Progress)' : 'In Progress'}</option>
              <option value="Resolved">{lang === 'ta' ? 'தீர்க்கப்பட்டது (Resolved)' : 'Resolved'}</option>
            </ThemeSelect>
          </div>
        </div>

        {/* Abstract Table (Summary Matrix of Issue Counts based on active filters) */}
        <div className="flex flex-col gap-2">
          <div className="portal-dash-toolbar">
            <div className="portal-dash-pills">
              {permissibleModes.includes('category') && (
                <button
                  type="button"
                  onClick={() => {
                    setAbstractViewMode('category');
                    setSelectedAbstractCategory('');
                    setSelectedAbstractSubcategory('');
                    setSelectedAbstractStatus('');
                  }}
                  className={`portal-dash-pill ${abstractViewMode === 'category' ? 'is-active' : ''}`}
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
                  className={`portal-dash-pill ${abstractViewMode === 'zone' ? 'is-active' : ''}`}
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
                  className={`portal-dash-pill ${abstractViewMode === 'district' ? 'is-active' : ''}`}
                >
                  {lang === 'ta' ? 'மாவட்ட வாரியாக' : 'District Wise'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRefreshAbstract}
                disabled={isRefreshingAbstract}
                className="portal-fis-chip"
                title={lang === 'ta' ? 'அட்டவணை சுருக்கத்தைப் புதுப்பி' : 'Refresh Abstract Table'}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingAbstract ? 'animate-spin' : ''}`} style={{ color: 'var(--theme-accent)' }} />
                <span>{lang === 'ta' ? 'புதுப்பி' : 'Refresh'}</span>
                {abstractRefreshTime && (
                  <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
                    {abstractRefreshTime}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => downloadExcel('abstract')}
                className="portal-fis-chip portal-fis-chip-excel"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{lang === 'ta' ? 'எக்செல்' : 'Excel Export'}</span>
              </button>
            </div>
          </div>

          <div className="portal-dash-table overflow-x-auto">
            <table className="w-full text-center text-xs border-collapse">
              {abstractViewMode === 'category' && (
                <>
                  <thead>
                    <tr>
                      <th className="text-left">{lang === 'ta' ? 'வகை' : 'Category'}</th>
                      <th className="text-left">{lang === 'ta' ? 'துணைப் பிரிவு' : 'Subcategory'}</th>
                      <th>{lang === 'ta' ? 'மொத்தப் பிரச்சினைகள்' : 'Total Issues'}</th>
                      <th>{lang === 'ta' ? 'நிலுவை (Pending)' : 'Pending'}</th>
                      <th>{lang === 'ta' ? 'செயல்பாட்டில் (In Progress)' : 'In Progress'}</th>
                      <th>{lang === 'ta' ? 'தீர்க்கப்பட்டவை (Resolved)' : 'Resolved'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCategories.flatMap((cat: any) => 
                      (cat.subcategories || []).map((sub: any) => {
                        const subcatIssues = baseFilteredIssues.filter((i: any) => i.category === cat.id && i.subcategory === sub.id);
                        const total = subcatIssues.length;
                        const pending = subcatIssues.filter((i: any) => i.status === 'Pending').length;
                        const inProgress = subcatIssues.filter((i: any) => i.status === 'In Progress' || i.status === 'Active').length;
                        const resolved = subcatIssues.filter((i: any) => i.status === 'Resolved' || i.status === 'Closed').length;
                        const isSelected = selectedAbstractCategory === cat.id && selectedAbstractSubcategory === sub.id;

                        return (
                          <tr 
                            key={`${cat.id}-${sub.id}`} 
                            className={`cursor-pointer ${isSelected ? 'is-selected' : ''}`}
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
                            <td className="text-left font-bold">{lang === 'ta' ? cat.nameTa : cat.nameEn}</td>
                            <td className="text-left">{lang === 'ta' ? sub.nameTa : sub.nameEn}</td>
                            <td className="portal-dash-num">{total}</td>
                            <td className="portal-dash-num is-pending">{pending}</td>
                            <td className="portal-dash-num is-progress">{inProgress}</td>
                            <td className="portal-dash-num is-resolved">{resolved}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2} className="text-right">{lang === 'ta' ? 'மொத்தம்' : 'Total'}</td>
                      <td>{(() => {
                        let total = 0;
                        visibleCategories.forEach((cat: any) => (cat.subcategories || []).forEach((sub: any) => {
                          total += baseFilteredIssues.filter((i: any) => i.category === cat.id && i.subcategory === sub.id).length;
                        }));
                        return total;
                      })()}</td>
                      <td className="portal-dash-num is-pending">{(() => {
                        let pending = 0;
                        visibleCategories.forEach((cat: any) => (cat.subcategories || []).forEach((sub: any) => {
                          pending += baseFilteredIssues.filter((i: any) => i.category === cat.id && i.subcategory === sub.id && i.status === 'Pending').length;
                        }));
                        return pending;
                      })()}</td>
                      <td className="portal-dash-num is-progress">{(() => {
                        let inProgress = 0;
                        visibleCategories.forEach((cat: any) => (cat.subcategories || []).forEach((sub: any) => {
                          inProgress += baseFilteredIssues.filter((i: any) => i.category === cat.id && i.subcategory === sub.id && (i.status === 'In Progress' || i.status === 'Active')).length;
                        }));
                        return inProgress;
                      })()}</td>
                      <td className="portal-dash-num is-resolved">{(() => {
                        let resolved = 0;
                        visibleCategories.forEach((cat: any) => (cat.subcategories || []).forEach((sub: any) => {
                          resolved += baseFilteredIssues.filter((i: any) => i.category === cat.id && i.subcategory === sub.id && (i.status === 'Resolved' || i.status === 'Closed')).length;
                        }));
                        return resolved;
                      })()}</td>
                    </tr>
                  </tfoot>
                </>
              )}

              {abstractViewMode === 'zone' && (
                <>
                  <thead>
                    <tr>
                      <th className="text-left">{lang === 'ta' ? 'மண்டலம்' : 'Zone'}</th>
                      <th>{lang === 'ta' ? 'மொத்தப் பிரச்சினைகள்' : 'Total Issues'}</th>
                      <th>{lang === 'ta' ? 'நிலுவை (Pending)' : 'Pending'}</th>
                      <th>{lang === 'ta' ? 'செயல்பாட்டில் (In Progress)' : 'In Progress'}</th>
                      <th>{lang === 'ta' ? 'தீர்க்கப்பட்டவை (Resolved)' : 'Resolved'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zones.map((zone: any) => {
                      const zoneTPs = townPanchayats.filter((tp: any) => tp.zoneId === zone.id);
                      const tpIds = zoneTPs.map((tp: any) => tp.id);
                      const zoneIssues = baseFilteredIssues.filter((i: any) => tpIds.includes(i.townPanchayatId));
                      const total = zoneIssues.length;
                      const pending = zoneIssues.filter((i: any) => i.status === 'Pending').length;
                      const inProgress = zoneIssues.filter((i: any) => i.status === 'In Progress' || i.status === 'Active').length;
                      const resolved = zoneIssues.filter((i: any) => i.status === 'Resolved' || i.status === 'Closed').length;
                      const isSelected = filterZoneId === zone.id;

                      return (
                        <tr 
                          key={zone.id} 
                          className={`cursor-pointer ${isSelected ? 'is-selected' : ''}`}
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
                          <td className="text-left font-bold">{tObj(zone)}</td>
                          <td className="portal-dash-num">{total}</td>
                          <td className="portal-dash-num is-pending">{pending}</td>
                          <td className="portal-dash-num is-progress">{inProgress}</td>
                          <td className="portal-dash-num is-resolved">{resolved}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="text-right">{lang === 'ta' ? 'மொத்தம்' : 'Total'}</td>
                      <td>{(() => {
                        let total = 0;
                        zones.forEach((zone: any) => {
                          const zoneTPs = townPanchayats.filter((tp: any) => tp.zoneId === zone.id);
                          const tpIds = zoneTPs.map((tp: any) => tp.id);
                          total += baseFilteredIssues.filter((i: any) => tpIds.includes(i.townPanchayatId)).length;
                        });
                        return total;
                      })()}</td>
                      <td className="portal-dash-num is-pending">{(() => {
                        let pending = 0;
                        zones.forEach((zone: any) => {
                          const zoneTPs = townPanchayats.filter((tp: any) => tp.zoneId === zone.id);
                          const tpIds = zoneTPs.map((tp: any) => tp.id);
                          pending += baseFilteredIssues.filter((i: any) => tpIds.includes(i.townPanchayatId) && i.status === 'Pending').length;
                        });
                        return pending;
                      })()}</td>
                      <td className="portal-dash-num is-progress">{(() => {
                        let inProgress = 0;
                        zones.forEach((zone: any) => {
                          const zoneTPs = townPanchayats.filter((tp: any) => tp.zoneId === zone.id);
                          const tpIds = zoneTPs.map((tp: any) => tp.id);
                          inProgress += baseFilteredIssues.filter((i: any) => tpIds.includes(i.townPanchayatId) && (i.status === 'In Progress' || i.status === 'Active')).length;
                        });
                        return inProgress;
                      })()}</td>
                      <td className="portal-dash-num is-resolved">{(() => {
                        let resolved = 0;
                        zones.forEach((zone: any) => {
                          const zoneTPs = townPanchayats.filter((tp: any) => tp.zoneId === zone.id);
                          const tpIds = zoneTPs.map((tp: any) => tp.id);
                          resolved += baseFilteredIssues.filter((i: any) => tpIds.includes(i.townPanchayatId) && (i.status === 'Resolved' || i.status === 'Closed')).length;
                        });
                        return resolved;
                      })()}</td>
                    </tr>
                  </tfoot>
                </>
              )}

              {abstractViewMode === 'district' && (
                <>
                  <thead>
                    <tr>
                      <th className="text-left">{lang === 'ta' ? 'மண்டலம்' : 'Zone'}</th>
                      <th className="text-left">{lang === 'ta' ? 'மாவட்டம்' : 'District'}</th>
                      <th>{lang === 'ta' ? 'மொத்தப் பிரச்சினைகள்' : 'Total Issues'}</th>
                      <th>{lang === 'ta' ? 'நிலுவை (Pending)' : 'Pending'}</th>
                      <th>{lang === 'ta' ? 'செயல்பாட்டில் (In Progress)' : 'In Progress'}</th>
                      <th>{lang === 'ta' ? 'தீர்க்கப்பட்டவை (Resolved)' : 'Resolved'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const userDistricts = currentUser.scopeType === 'Zone' 
                        ? districts.filter((d: any) => d.zoneId === currentUser.scopeId) 
                        : districts;

                      return userDistricts.map((district: any) => {
                        const distTPs = townPanchayats.filter((tp: any) => tp.districtId === district.id);
                        const tpIds = distTPs.map((tp: any) => tp.id);
                        const distIssues = baseFilteredIssues.filter((i: any) => tpIds.includes(i.townPanchayatId));
                        const total = distIssues.length;
                        const pending = distIssues.filter((i: any) => i.status === 'Pending').length;
                        const inProgress = distIssues.filter((i: any) => i.status === 'In Progress' || i.status === 'Active').length;
                        const resolved = distIssues.filter((i: any) => i.status === 'Resolved' || i.status === 'Closed').length;
                        const isSelected = filterDistrictId === district.id;
                        const zone = zones.find((z: any) => z.id === district.zoneId);

                        return (
                          <tr 
                            key={district.id} 
                            className={`cursor-pointer ${isSelected ? 'is-selected' : ''}`}
                            onClick={() => {
                              if (isSelected) {
                                setFilterDistrictId('');
                              } else {
                                if (zone) setFilterZoneId(zone.id);
                                setFilterDistrictId(district.id);
                                setFilterTPId('');
                              }
                            }}
                          >
                            <td className="text-left text-slate-400">{zone ? tObj(zone) : ''}</td>
                            <td className="text-left font-bold">{tObj(district)}</td>
                            <td className="portal-dash-num">{total}</td>
                            <td className="portal-dash-num is-pending">{pending}</td>
                            <td className="portal-dash-num is-progress">{inProgress}</td>
                            <td className="portal-dash-num is-resolved">{resolved}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={2} className="text-right">{lang === 'ta' ? 'மொத்தம்' : 'Total'}</td>
                      <td>{(() => {
                        let total = 0;
                        const userDistricts = currentUser.scopeType === 'Zone' 
                          ? districts.filter((d: any) => d.zoneId === currentUser.scopeId) 
                          : districts;
                        userDistricts.forEach((district: any) => {
                          const distTPs = townPanchayats.filter((tp: any) => tp.districtId === district.id);
                          const tpIds = distTPs.map((tp: any) => tp.id);
                          total += baseFilteredIssues.filter((i: any) => tpIds.includes(i.townPanchayatId)).length;
                        });
                        return total;
                      })()}</td>
                      <td className="portal-dash-num is-pending">{(() => {
                        let pending = 0;
                        const userDistricts = currentUser.scopeType === 'Zone' 
                          ? districts.filter((d: any) => d.zoneId === currentUser.scopeId) 
                          : districts;
                        userDistricts.forEach((district: any) => {
                          const distTPs = townPanchayats.filter((tp: any) => tp.districtId === district.id);
                          const tpIds = distTPs.map((tp: any) => tp.id);
                          pending += baseFilteredIssues.filter((i: any) => tpIds.includes(i.townPanchayatId) && i.status === 'Pending').length;
                        });
                        return pending;
                      })()}</td>
                      <td className="portal-dash-num is-progress">{(() => {
                        let inProgress = 0;
                        const userDistricts = currentUser.scopeType === 'Zone' 
                          ? districts.filter((d: any) => d.zoneId === currentUser.scopeId) 
                          : districts;
                        userDistricts.forEach((district: any) => {
                          const distTPs = townPanchayats.filter((tp: any) => tp.districtId === district.id);
                          const tpIds = distTPs.map((tp: any) => tp.id);
                          inProgress += baseFilteredIssues.filter((i: any) => tpIds.includes(i.townPanchayatId) && (i.status === 'In Progress' || i.status === 'Active')).length;
                        });
                        return inProgress;
                      })()}</td>
                      <td className="portal-dash-num is-resolved">{(() => {
                        let resolved = 0;
                        const userDistricts = currentUser.scopeType === 'Zone' 
                          ? districts.filter((d: any) => d.zoneId === currentUser.scopeId) 
                          : districts;
                        userDistricts.forEach((district: any) => {
                          const distTPs = townPanchayats.filter((tp: any) => tp.districtId === district.id);
                          const tpIds = distTPs.map((tp: any) => tp.id);
                          resolved += baseFilteredIssues.filter((i: any) => tpIds.includes(i.townPanchayatId) && (i.status === 'Resolved' || i.status === 'Closed')).length;
                        });
                        return resolved;
                      })()}</td>
                    </tr>
                  </tfoot>
                </>
              )}
            </table>
          </div>
        </div>

        {/* Feedback Filter Bar for Issues Table */}
        {(selectedAbstractCategory || selectedAbstractSubcategory || selectedAbstractStatus) && (
          <div className="portal-dash-toolbar text-xs">
            <span className="font-semibold text-slate-700 flex flex-wrap items-center gap-2">
              <span>{lang === 'ta' ? 'அட்டவணை வடிகட்டப்பட்டது: ' : 'Detailed View Filtered By: '}</span>
              {selectedAbstractCategory && (
                <span className="portal-dash-chip">
                  {lang === 'ta' ? 'வகை' : 'Category'}: <strong>{CATEGORIES_MAP[selectedAbstractCategory]?.[lang] || selectedAbstractCategory}</strong>
                </span>
              )}
              {selectedAbstractSubcategory && (
                <span className="portal-dash-chip">
                  {lang === 'ta' ? 'துணைப் பிரிவு' : 'Subcategory'}: <strong>{getSubcategoryName(selectedAbstractCategory, selectedAbstractSubcategory, lang)}</strong>
                </span>
              )}
              {selectedAbstractStatus && (
                <span className="portal-dash-chip">
                  {lang === 'ta' ? 'நிலை' : 'Stage'}: <strong>{selectedAbstractStatus}</strong>
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
              className="portal-dash-pill is-active"
            >
              {lang === 'ta' ? 'அனைத்தையும் காட்டு' : 'Clear Cell Selection'}
            </button>
          </div>
        )}

        {/* Detailed Issues Table */}
        <div className="flex flex-col gap-2">
          <div className="portal-dash-toolbar">
            <h4 className="portal-fis-bar-label">
              <span>{lang === 'ta' ? 'விவரமானப் பிரச்சினைகள் பட்டியல்' : 'Detailed Issues Ledger'}</span>
              <span className="text-xs text-slate-400 font-normal">({lang === 'ta' ? 'வரிசைகள்' : 'Rows'}: {sortedIssues.length})</span>
            </h4>
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
                className="portal-dash-pill is-active"
              >
                <MonitorPlay className="w-3.5 h-3.5" />
                <span>{lang === 'ta' ? 'விளக்க காட்சி' : 'Slide View'}</span>
              </button>
              <button
                type="button"
                onClick={() => downloadExcel('detailed')}
                className="portal-fis-chip portal-fis-chip-excel"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{lang === 'ta' ? 'எக்செல்' : 'Excel Export'}</span>
              </button>
            </div>
          </div>
          <div className="portal-dash-table overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr>
                  <th className="cursor-pointer" onClick={() => handleSort('issueId')}>
                    <div className="flex items-center">
                      {lang === 'ta' ? 'விண்ணப்ப எண்' : 'Issue ID'}
                      {renderSortIcon('issueId')}
                    </div>
                  </th>
                  <th className="cursor-pointer" onClick={() => handleSort('zone')}>
                    <div className="flex items-center">
                      {lang === 'ta' ? 'மண்டலம்' : 'Zone'}
                      {renderSortIcon('zone')}
                    </div>
                  </th>
                  <th className="cursor-pointer" onClick={() => handleSort('district')}>
                    <div className="flex items-center">
                      {lang === 'ta' ? 'மாவட்டம்' : 'District'}
                      {renderSortIcon('district')}
                    </div>
                  </th>
                  <th className="cursor-pointer" onClick={() => handleSort('townPanchayatId')}>
                    <div className="flex items-center">
                      {lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat'}
                      {renderSortIcon('townPanchayatId')}
                    </div>
                  </th>
                  <th className="cursor-pointer min-w-[250px] max-w-[350px]" onClick={() => handleSort('subject')}>
                    <div className="flex items-center">
                      {lang === 'ta' ? 'பொருள் (Subject)' : 'Subject'}
                      {renderSortIcon('subject')}
                    </div>
                  </th>
                  <th className="cursor-pointer" onClick={() => handleSort('category')}>
                    <div className="flex items-center">
                      {lang === 'ta' ? 'வகை / உட்பிரிவு' : 'Category Sub category'}
                      {renderSortIcon('category')}
                    </div>
                  </th>
                  <th className="cursor-pointer" onClick={() => handleSort('lastUpdated')}>
                    <div className="flex items-center">
                      {lang === 'ta' ? 'கடைசியாக புதுப்பிக்கப்பட்டது' : 'Last updated date'}
                      {renderSortIcon('lastUpdated')}
                    </div>
                  </th>
                  <th className="cursor-pointer" onClick={() => handleSort('status')}>
                    <div className="flex items-center">
                      {lang === 'ta' ? 'நிலை (Stage)' : 'Stage status'}
                      {renderSortIcon('status')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedIssues.map((issue: any) => {
                  const catName = CATEGORIES_MAP[issue.category]?.[lang] || issue.category;
                  const lastUpdateDateStr = issue.updatedAt || issue.createdAt;
                  
                  // Dynamic status classification
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
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedLedgerIssue(issue);
                        setActivePreviewFile(null);
                      }}
                    >
                      <td className="portal-dash-id">{issue.issueId}</td>
                      <td>{getZoneNameByTP(issue.townPanchayatId)}</td>
                      <td>{getDistrictNameByTP(issue.townPanchayatId)}</td>
                      <td>{getTPName(issue.townPanchayatId)}</td>
                      <td className="min-w-[250px] max-w-[350px] font-bold whitespace-normal break-words" title={issue.subject || '-'}>{issue.subject || '-'}</td>
                      <td>
                        <span className="font-bold">{catName}</span>
                        <span className="text-slate-400"> / {getSubcategoryName(issue.category, issue.subcategory, lang)}</span>
                      </td>
                      <td className="font-mono text-slate-400">
                        {lastUpdateDateStr ? new Date(lastUpdateDateStr).toLocaleDateString(lang === 'ta' ? 'ta-IN' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        }) : '-'}
                      </td>
                      <td>
                        <span className={`portal-dash-status ${
                          displayStatus === 'Pending' ? 'is-pending' :
                          displayStatus === 'In Progress' ? 'is-progress' :
                          'is-resolved'
                        }`}>
                          {lang === 'ta'
                            ? (displayStatus === 'Pending' ? 'நிலுவை' : displayStatus === 'In Progress' ? 'நடவடிக்கை' : 'முடிக்கப்பட்டது')
                            : displayStatus
                          }
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {sortedIssues.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-5 text-center text-gray-400 font-semibold italic">
                      {lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்ட வடிகட்டிகளில் பிரச்சினைகள் எதுவும் இல்லை.' : 'No issues match the selected filter criteria.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      </div>

      {/* Ledger Issue Details Popup Modal */}
      {selectedLedgerIssue && (
        <div className="portal-modal-overlay">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="portal-modal w-full max-w-5xl"
          >
            {/* Modal Header */}
            <div className="portal-dash-modal-head flex justify-between items-center px-6 py-4">
              <div>
                <span className="portal-dash-modal-badge text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
                  {selectedLedgerIssue.status}
                </span>
                <h3 className="text-md font-extrabold tracking-tight mt-1">
                  {lang === 'ta' ? `விண்ணப்ப விவரம்: ${selectedLedgerIssue.issueId}` : `Issue Details: ${selectedLedgerIssue.issueId}`}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedLedgerIssue(null)}
                className="portal-modal-close"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 overflow-y-auto flex-1">
              {/* Left Pane: Detailed Information */}
              <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh] md:max-h-full">
                {/* Location context */}
                <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                      {lang === 'ta' ? 'மண்டலம்' : 'Zone'}
                    </label>
                    <span className="text-xs font-bold text-slate-800 block mt-0.5">
                      {getZoneNameByTP(selectedLedgerIssue.townPanchayatId)}
                    </span>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                      {lang === 'ta' ? 'மாவட்டம்' : 'District'}
                    </label>
                    <span className="text-xs font-bold text-slate-800 block mt-0.5">
                      {getDistrictNameByTP(selectedLedgerIssue.townPanchayatId)}
                    </span>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                      {lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat'}
                    </label>
                    <span className="text-xs font-bold text-slate-800 block mt-0.5">
                      {getTPName(selectedLedgerIssue.townPanchayatId)}
                    </span>
                  </div>
                </div>

                {/* Subject and Details */}
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      {lang === 'ta' ? 'பொருள் (Subject)' : 'Subject'}
                    </label>
                    <div className="p-3 bg-indigo-50/20 border border-indigo-50/50 rounded-xl font-bold text-slate-900 text-xs">
                      {selectedLedgerIssue.subject || '-'}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      {lang === 'ta' ? 'விவரங்கள் (Issue Details)' : 'Issue Details'}
                    </label>
                    <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl font-normal text-slate-700 text-xs leading-relaxed whitespace-pre-wrap">
                      {selectedLedgerIssue.issueDetails || '-'}
                    </div>
                  </div>
                </div>

                {/* Category classification */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      {lang === 'ta' ? 'வகை (Category)' : 'Category'}
                    </label>
                    <span className="text-xs font-bold text-slate-850 mt-1 block">
                      {CATEGORIES_MAP[selectedLedgerIssue.category]?.[lang] || selectedLedgerIssue.category}
                    </span>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      {lang === 'ta' ? 'உட்பிரிவு (Subcategory)' : 'Subcategory'}
                    </label>
                    <span className="text-xs font-medium text-slate-650 mt-1 block">
                      {getSubcategoryName(selectedLedgerIssue.category, selectedLedgerIssue.subcategory, lang) || '-'}
                    </span>
                  </div>
                </div>

                {/* Dynamic fields from schemas */}
                {(() => {
                  const schemaFields = moduleSchemas.filter((s: any) => s.category === selectedLedgerIssue.category);
                  const fieldsData = selectedLedgerIssue.fieldsData || {};
                  if (schemaFields.length === 0) return null;

                  return (
                    <div className="space-y-3 border-t border-slate-100 pt-4">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {lang === 'ta' ? 'கூடுதல் புலங்கள் தரவு' : 'Additional Specifications'}
                      </h4>
                      <div className="grid grid-cols-2 gap-3.5">
                        {schemaFields.map((field: any) => {
                          const val = fieldsData[field.fieldName] || '-';
                          const label = lang === 'ta' ? (field.displayNameTa || field.displayNameEn) : field.displayNameEn;
                          return (
                            <div key={field.id} className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                              <span className="text-[9px] font-bold text-gray-400 block">{label}</span>
                              <span className="text-xs font-semibold text-slate-800 block mt-0.5">{val}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* History Timeline */}
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {lang === 'ta' ? 'நடவடிக்கை வரலாறு (Timeline)' : 'Workflow Progress Timeline'}
                  </h4>
                  <div className="space-y-4 pl-2.5 border-l border-indigo-100">
                    {selectedLedgerIssue.comments && selectedLedgerIssue.comments.length > 0 ? (
                      selectedLedgerIssue.comments.map((comment: any, idx: number) => {
                        const isClosedStatus = comment.status === 'Closed';
                        return (
                          <div key={comment.id || idx} className="relative pl-4 text-xs space-y-1">
                            <div className={`absolute -left-[15px] top-1.5 w-2.5 h-2.5 rounded-full border border-white shadow-xs ${isClosedStatus ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            <div className="flex justify-between items-center font-bold text-slate-800">
                              <span className="flex items-center gap-1.5">
                                {comment.status}
                                <span className="text-[9px] text-indigo-700 bg-indigo-50 font-bold px-1.5 py-0.5 rounded-sm">
                                  {comment.scopeType || 'TP'}
                                </span>
                              </span>
                              <span className="text-[10px] text-gray-400 font-normal">
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
                              <p className="text-gray-600 font-medium bg-slate-50 p-2.5 rounded-lg border border-slate-100/50 leading-relaxed whitespace-pre-wrap">
                                {comment.notes}
                              </p>
                            )}
                            <div className="text-[9px] text-gray-400">
                              By: {lang === 'ta' ? (comment.userNameTa || comment.userName) : comment.userName} {comment.userDesignation ? `• ${comment.userDesignation}` : ''}
                            </div>
                            {comment.file?.url && (
                              <div className="pt-1">
                                <a 
                                  href={comment.file.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] rounded-md font-bold transition"
                                >
                                  <Paperclip className="w-3 h-3" />
                                  <span>{lang === 'ta' ? 'கோப்பு இணைப்பு' : 'Attachment'}: {comment.file.fileName}</span>
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="relative pl-4 text-xs">
                        <div className="absolute left-[-15px] top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 border border-white" />
                        <div className="flex justify-between items-center font-bold text-slate-800">
                          <span>Created & Initiated</span>
                          <span className="text-[10px] text-gray-400 font-normal">
                            {new Date(selectedLedgerIssue.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-gray-500 font-normal mt-0.5">
                          {lang === 'ta' ? 'விண்ணப்பம் வெற்றிகரமாக உருவாக்கப்பட்டது' : 'Issue ticket generated in the Town Panchayat management system.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Pane: Attachments & Document Preview */}
              <div className="p-6 bg-slate-50/50 flex flex-col min-h-[40vh] md:min-h-0">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                  {lang === 'ta' ? 'கோப்புகள் மற்றும் இணைப்புகள்' : 'Files & Document Previews'}
                </h4>

                {/* List of Attachments */}
                {(() => {
                  const initFiles = (selectedLedgerIssue.attachments || selectedLedgerIssue.files || []).map((file: any) => ({
                    url: file.url,
                    name: file.name || file.fileName || 'Document'
                  }));

                  const commentFiles = (selectedLedgerIssue.comments || [])
                    .filter((c: any) => c.file && c.file.url)
                    .map((c: any) => ({
                      url: c.file.url,
                      name: c.file.fileName || 'Comment_Attachment'
                    }));

                  const attachments = [...initFiles, ...commentFiles];
                  const currentPreview = activePreviewFile || (attachments.length > 0 ? attachments[0] : null);

                  return (
                    <>
                      {attachments.length > 0 ? (
                        <div className="space-y-2 mb-4">
                          {attachments.map((file: any, i: number) => {
                            const isCurrent = currentPreview && (currentPreview.url === file.url);
                            return (
                              <div 
                                key={i} 
                                onClick={() => setActivePreviewFile(file)}
                                className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                                  isCurrent 
                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-bold' 
                                    : 'bg-white border-gray-150 hover:bg-slate-50 text-slate-700'
                                  }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Paperclip className="w-4 h-4 text-gray-400 shrink-0" />
                                  <span className="text-xs truncate">{file.name}</span>
                                </div>
                                <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md uppercase shrink-0 font-extrabold">
                                  {file.name?.split('.').pop() || 'doc'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center text-gray-400 bg-white">
                          <Paperclip className="w-8 h-8 text-gray-300 mb-2" />
                          <span className="text-xs font-semibold">
                            {lang === 'ta' ? 'இணைப்புகள் எதுவும் இல்லை' : 'No attachments uploaded with this issue.'}
                          </span>
                        </div>
                      )}

                      {/* Active Preview Pane */}
                      {currentPreview && (
                        <div className="flex-1 bg-white rounded-2xl border border-gray-150 shadow-inner overflow-hidden flex flex-col min-h-[280px]">
                          <div className="bg-slate-100 px-4 py-2 border-b border-gray-150 flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]">
                              {currentPreview.name}
                            </span>
                            <a 
                              href={currentPreview.url} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="portal-dash-action text-[10px] px-2.5 py-1 rounded-md font-bold transition cursor-pointer shrink-0"
                            >
                              {lang === 'ta' ? 'பதிவிறக்கம்' : 'Open in New Tab'}
                            </a>
                          </div>
                          <div className="flex-1 bg-slate-900 flex items-center justify-center p-2 relative min-h-[220px]">
                            {currentPreview.url?.toLowerCase().endsWith('.pdf') ? (
                              <iframe 
                                src={`${currentPreview.url}#toolbar=0`} 
                                className="w-full h-full min-h-[220px] rounded-lg border-0"
                                title="PDF Preview"
                              />
                            ) : (
                              <img 
                                src={currentPreview.url} 
                                alt={currentPreview.name} 
                                className="max-w-full max-h-[300px] object-contain rounded-lg shadow-md"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="portal-modal-foot">
              <button
                type="button"
                onClick={() => setSelectedLedgerIssue(null)}
                className="px-5 py-2 rounded-xl border border-gray-200 hover:bg-gray-100 text-slate-700 font-extrabold text-xs transition cursor-pointer"
              >
                {lang === 'ta' ? 'மூடு' : 'Close'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* --- REPORT VIEWER: PPT SLIDESHOW OVERLAY --- */}
      {isSlideViewActive && (() => {
        const currentIssue = sortedIssues[activeSlideIndex];
        if (!currentIssue) return null;

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
        const docs = [...initFiles, ...commentFiles];
        const activeDoc = slideActivePreviewFile || (docs.length > 0 ? docs[0] : null);

        const schemaFields = state.pendingIssuesSchema || [];
        const catFields = schemaFields.filter((f: any) => f.category === currentIssue.category);
        const hasFields = catFields.some((f: any) => currentIssue.fieldsData && currentIssue.fieldsData[f.id] !== undefined && currentIssue.fieldsData[f.id] !== '');

        const isAdmin = currentUser.roleId === 'admin' || currentUser.roleId === 'ad' || currentUser.roleId === 'dtp_admin' || currentUser.roleId === 'dtp_user';
        const isDTPUser = currentUser.roleId === 'dtp_user';

        return (
          <div className="fixed inset-0 z-50 bg-slate-100 text-slate-800 flex flex-col overflow-hidden select-none animate-in fade-in duration-200">
            {/* Header with Theme Color Background and Single Line Details */}
            <div className="portal-dash-modal-head px-6 py-3.5 flex flex-row justify-between items-center gap-4 shrink-0 shadow-md overflow-hidden">
              <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-2 whitespace-nowrap text-xs md:text-sm text-white/90 font-medium">
                  {/* Zone */}
                  <span className="text-white font-bold">{getZoneNameByTP(currentIssue.townPanchayatId)}</span>
                  <span className="text-white/40 font-light">/</span>
                  {/* District */}
                  <span className="text-white font-bold">{getDistrictNameByTP(currentIssue.townPanchayatId)}</span>
                  <span className="text-white/40 font-light">/</span>
                  {/* TP */}
                  <span className="text-white font-bold">{getTPName(currentIssue.townPanchayatId)}</span>
                  <span className="text-white/40 font-light">/</span>
                  {/* Cat */}
                  <span className="text-white/90 font-bold">
                    {CATEGORIES_MAP[currentIssue.category]?.[lang] || currentIssue.category}
                  </span>
                  <span className="text-white/40 font-light">/</span>
                  {/* Sub */}
                  <span className="text-white font-bold">{getSubcategoryName(currentIssue.category, currentIssue.subcategory, lang)}</span>
                  <span className="text-white/40 font-light">/</span>
                  {/* ID */}
                  <span className="portal-dash-modal-badge font-mono px-2.5 py-0.5 rounded-lg font-black text-xs md:text-sm">
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
                    className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-xl transition cursor-pointer text-white border border-white/15"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-xs font-bold font-mono px-2 text-white/80">
                    {activeSlideIndex + 1} / {sortedIssues.length}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextSlide}
                    disabled={activeSlideIndex === sortedIssues.length - 1}
                    className="p-2 bg-white/10 hover:bg-white/20 disabled:opacity-30 rounded-xl transition cursor-pointer text-white border border-white/15"
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
                  className="p-2 bg-white/10 hover:bg-rose-700/80 hover:text-rose-100 rounded-xl transition cursor-pointer text-white border border-white/15"
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
                  <span className="text-[10px] font-black uppercase portal-dash-label tracking-wider">
                    {lang === 'ta' ? 'விண்ணப்பத் தலைப்பு (பொருள்)' : 'Subject'}
                  </span>
                  <h2 className="text-md font-black text-slate-900 leading-snug">
                    {currentIssue.subject || (lang === 'ta' ? 'விவரம் ஏதுமில்லை' : 'No subject specified')}
                  </h2>
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <span className="text-[10px] font-black uppercase portal-dash-label tracking-wider">
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
                    <h4 className="text-[10px] font-black uppercase portal-dash-label tracking-wider flex items-center gap-2">
                      <Sliders className="w-4 h-4 portal-dash-label" />
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
                  <h4 className="text-[10px] font-black uppercase portal-dash-label tracking-wider flex items-center gap-1.5">
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
                    <h4 className="text-[10px] font-black uppercase portal-dash-label tracking-wider">
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
                                    ? 'portal-dash-action border-transparent text-white' 
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
                              className="portal-dash-label font-extrabold hover:underline"
                            >
                              {lang === 'ta' ? 'புதிய தாவலில் திற' : 'Open in New Tab'}
                            </a>
                          </div>
                          <div className="flex-1 min-h-0 mt-3 relative">
                            {activeDoc?.url ? (
                              activeDoc.url.toLowerCase().endsWith('.pdf') ? (
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
                  <label className="text-[10px] font-black uppercase portal-dash-label tracking-wider">
                    {lang === 'ta' ? 'அடுத்த கட்ட நிலை' : 'Next Stage'}
                  </label>
                  <ThemeSelect
                    value={slideUpdateStatus}
                    onChange={(e: any) => setSlideUpdateStatus(e.target.value)}
                    className="w-full text-xs font-bold p-2.5 rounded-xl border border-slate-200 bg-white outline-none focus:ring-1 focus:ring-indigo-500 text-gray-800"
                  >
                    {(() => {
                      const isTPOrZoneUser = currentUser.scopeType === 'TownPanchayat' || currentUser.scopeType === 'Zone';
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
                  </ThemeSelect>
                </div>

                {/* Notes/Remarks */}
                <div className="md:col-span-6 space-y-1">
                  <label className="text-[10px] font-black uppercase portal-dash-label tracking-wider">
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
                  <label className="text-[10px] font-black uppercase portal-dash-label tracking-wider block">
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
                    className="portal-dash-action w-full px-4 py-2.5 disabled:opacity-50 text-white text-xs font-extrabold uppercase rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
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
