/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/purity */
'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Building, 
  Map, 
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
  Download
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Smartphone } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Language, translations } from './translations';
import { ThemeType, themesConfig } from '@/lib/themeConfig';

const InspectionReportsView = dynamic(
  () => import('./InspectionReportsView'),
  { 
    ssr: false,
    loading: () => (
      <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
        <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
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
}

export default function DashboardView({ state, lang, currentUser, setActiveTab, theme, onSaveCollection }: DashboardViewProps) {
  const currentTheme = themesConfig[theme] || themesConfig['sunset-aurora'];

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
  const scopedIssues = currentUser?.scopeType === 'HOD'
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
  const permissibleModes = currentUser.scopeType === 'HOD'
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
  const [abstractRefreshTime, setAbstractRefreshTime] = useState<string>('');

  const handleRefreshAbstract = async () => {
    setIsRefreshingAbstract(true);
    try {
      if (typeof window !== 'undefined') {
        const ev = new CustomEvent('portal:refresh-state');
        window.dispatchEvent(ev);
      }
      await fetch('/api/portal-state', { cache: 'no-store' });
      setAbstractRefreshTime(new Date().toLocaleTimeString());
    } catch (_) {
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
    if (!currentUser) return null;
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
  }, [currentUser, townPanchayats, districts]);

  const userDistrictId = useMemo(() => {
    if (!currentUser) return null;
    if (currentUser.scopeType === 'TownPanchayat' || currentUser.isEmployee) {
      const tpId = currentUser.tpId || currentUser.scopeId;
      const tpObj = (townPanchayats || []).find((t: any) => t.id === tpId);
      return tpObj?.districtId || null;
    }
    return null;
  }, [currentUser, townPanchayats]);

  const userTpId = useMemo(() => {
    if (!currentUser) return null;
    if (currentUser.scopeType === 'TownPanchayat' || currentUser.isEmployee) {
      return currentUser.tpId || currentUser.scopeId;
    }
    return null;
  }, [currentUser]);

  const scopedInspectionWorks = useMemo(() => {
    const list = state.inspectionWorks || [];
    return list.filter((w: any) => {
      if (userZoneId && w.zoneId !== userZoneId) return false;
      if (userDistrictId && w.districtId !== userDistrictId) return false;
      if (userTpId && w.tpId !== userTpId) return false;
      return true;
    });
  }, [state.inspectionWorks, userZoneId, userDistrictId, userTpId]);

  const dashboardAbstractData = useMemo(() => {
    const subjectsMap: Record<string, {
      subjectId: string;
      subjectNameEn: string;
      subjectNameTa: string;
      totalInspections: number;
    }> = {};

    scopedInspectionWorks.forEach((work: any) => {
      const sId = work.subjectId || 'unknown';
      if (!subjectsMap[sId]) {
        subjectsMap[sId] = {
          subjectId: sId,
          subjectNameEn: work.subjectNameEn || 'General Inspection',
          subjectNameTa: work.subjectNameTa || 'பொது ஆய்வு',
          totalInspections: 0
        };
      }
      subjectsMap[sId].totalInspections += 1;
    });

    return Object.values(subjectsMap);
  }, [scopedInspectionWorks]);

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

  const handleDownloadInspectionPDF = () => {
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
    if (currentUser.scopeType === 'HOD') {
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
  const isZonalUser = currentUser.scopeType === 'Zone' || currentUser.roleId === 'ad';
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
      color: 'from-indigo-500 to-purple-600',
      shadow: 'shadow-indigo-100',
      action: () => scrollToAbstract('')
    },
    {
      id: 'pending_issues',
      title: lang === 'ta' ? 'நிலுவையில் உள்ளவை (Pending)' : 'Pending Issues',
      count: pendingIssuesCount,
      icon: AlertTriangle,
      color: 'from-amber-500 to-rose-600',
      shadow: 'shadow-amber-100',
      action: () => scrollToAbstract('Pending')
    },
    {
      id: 'in_progress_issues',
      title: lang === 'ta' ? 'செயல்பாட்டில் உள்ளவை (In Progress)' : 'In Progress',
      count: inProgressIssuesCount,
      icon: Activity,
      color: 'from-blue-500 to-indigo-600',
      shadow: 'shadow-blue-100',
      action: () => scrollToAbstract('In Progress')
    },
    {
      id: 'resolved_issues',
      title: lang === 'ta' ? 'தீர்க்கப்பட்டவை (Resolved)' : 'Resolved Issues',
      count: resolvedIssuesCount,
      icon: CheckCircle2,
      color: 'from-emerald-500 to-teal-600',
      shadow: 'shadow-emerald-100',
      action: () => scrollToAbstract('Resolved')
    }
  ];

  let cards = [];
  if (isTPUser) {
    cards = [
      ...standardIssueCards,
      {
        id: 'add_new_issue',
        title: lang === 'ta' ? 'புதிய பிரச்சினை சேர்க்கவும்' : 'Add New Issue (+)',
        count: '+',
        icon: PlusCircle,
        color: 'from-fuchsia-500 to-pink-600',
        shadow: 'shadow-fuchsia-100',
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
        color: 'from-teal-500 to-emerald-600',
        shadow: 'shadow-teal-100',
        action: () => {}
      },
      ...standardIssueCards
    ];
  } else if (isAdminRole) {
    cards = [
      {
        id: 'zones',
        title: t('totalZones'),
        count: zones.length,
        icon: Map,
        color: 'from-blue-500 to-indigo-600',
        shadow: 'shadow-blue-100',
        action: () => setActiveTab('masters')
      },
      {
        id: 'districts',
        title: t('totalDistricts'),
        count: districts.length,
        icon: MapPin,
        color: 'from-purple-500 to-pink-600',
        shadow: 'shadow-purple-100',
        action: () => setActiveTab('masters')
      },
      {
        id: 'tps',
        title: t('totalTPs'),
        count: townPanchayats.length,
        icon: Building,
        color: 'from-teal-500 to-emerald-600',
        shadow: 'shadow-teal-100',
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
      ? <ArrowUp className="w-3 h-3 ml-1 text-indigo-600 shrink-0" />
      : <ArrowDown className="w-3 h-3 ml-1 text-indigo-600 shrink-0" />;
  };

  // Allowed scopes based on user role
  const allowedZones = currentUser.scopeType === 'HOD' 
    ? zones 
    : currentUser.scopeType === 'Zone' 
      ? zones.filter((z: any) => z.id === currentUser.scopeId)
      : zones.filter((z: any) => z.id === getTPZoneId(townPanchayats.find((tp: any) => tp.id === currentUser.scopeId)));

  const allowedDistricts = currentUser.scopeType === 'HOD'
    ? districts
    : currentUser.scopeType === 'Zone'
      ? districts.filter((d: any) => d.zoneId === currentUser.scopeId)
      : districts.filter((d: any) => d.id === (townPanchayats.find((tp: any) => tp.id === currentUser.scopeId)?.districtId));

  const allowedTPs = currentUser.scopeType === 'HOD'
    ? townPanchayats
    : currentUser.scopeType === 'Zone'
      ? townPanchayats.filter((tp: any) => getTPZoneId(tp) === currentUser.scopeId)
      : townPanchayats.filter((tp: any) => tp.id === currentUser.scopeId);

  // Helper lists for dropdown filters
  const availableDistricts = allowedDistricts.filter((d: any) => {
    if (currentUser.scopeType === 'HOD' && !filterZoneId) return false;
    if (filterZoneId && d.zoneId !== filterZoneId) return false;
    return true;
  });

  const availableTPs = allowedTPs.filter((tp: any) => {
    if (currentUser.scopeType !== 'TownPanchayat' && !filterDistrictId) return false;
    if (filterZoneId && getTPZoneId(tp) !== filterZoneId) return false;
    if (filterDistrictId && tp.districtId !== filterDistrictId) return false;
    return true;
  });

  return (
    <div id="dashboard-view-container" className="space-y-6">
      {/* Top Header Block with Greeting */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 w-full">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-950 tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 animate-pulse" style={{ color: currentTheme.accentColor }} />
            <span>{lang === 'ta' ? 'வணக்கம்,' : 'Welcome back,'} {tObj(currentUser)}</span>
          </h2>
          <p className="text-sm text-gray-500">
            {lang === 'ta' 
              ? 'தமிழ்நாடு பேரூராட்சிகள் நிர்வாகப் பதிவு மற்றும் கண்காணிப்பு தளம்.' 
              : 'Tamil Nadu Town Panchayats Administration and Monitoring Portal.'}
          </p>
        </div>
        {isTPUser && (
          <div className="mt-6 pt-4 border-t border-gray-50">
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  localStorage.setItem('pendingIssuesSubTab', 'create');
                }
                setActiveTab('pendingIssues');
              }}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-white font-bold text-sm bg-indigo-600 hover:bg-indigo-700 shadow-xs transition-all cursor-pointer border-none"
            >
              <PlusCircle className="w-5 h-5" />
              <span>{lang === 'ta' ? 'புதிய பிரச்சினை சேர்க்கவும் (+)' : 'Add New Issue (+)'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Abstract Report Frame */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-gray-100 w-full">
        <InspectionReportsView 
          state={state} 
          lang={lang} 
          theme={theme} 
          currentUser={currentUser}
          defaultActiveTab="abstract"
          hideTabsHeader={true}
          hideTopTitle={true}
        />
      </div>

      {/* KPI Grid */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${cards.length === 5 ? 'lg:grid-cols-5' : cards.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
        {cards.map((card) => (
          <motion.button
            key={card.id}
            id={`kpi-card-${card.id}`}
            whileHover={{ y: -3, scale: 1.01 }}
            transition={{ duration: 0.15 }}
            onClick={card.action}
            className={`flex items-center justify-between ${isAdminRole ? 'p-4' : 'p-5'} bg-white rounded-2xl border border-gray-100 text-left w-full shadow-xs cursor-pointer hover:border-gray-200`}
          >
            <div className="space-y-1">
              <span className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wider">{card.title}</span>
              <h3 className={`${isAdminRole ? 'text-2xl' : 'text-3xl'} font-bold text-gray-900`}>{card.count}</h3>
            </div>
            <div className={`${isAdminRole ? 'p-2.5' : 'p-3.5'} rounded-xl bg-gradient-to-br ${card.color} text-white shadow-md`}>
              <card.icon className={`${isAdminRole ? 'w-5 h-5' : 'w-6 h-6'}`} />
            </div>
          </motion.button>
        ))}
      </div>

      {/* Visual Charts / Diagrams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Category Wise Diagrams */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-800 tracking-tight">
                {lang === 'ta' ? 'வகை வாரியான வரைபடம்' : 'Category Wise Diagram'}
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {lang === 'ta' ? 'வகை வாரியாகப் பிரச்சினைகளைத் தேர்ந்தெடுக்கவும்' : 'Click a category to filter subcategories'}
              </p>
            </div>
            {selectedChartCategory && (
              <button 
                onClick={() => setSelectedChartCategory('')}
                className="text-[11px] font-bold text-fuchsia-600 hover:text-fuchsia-700 bg-fuchsia-50 px-2 py-1 rounded-md transition"
              >
                {lang === 'ta' ? 'அனைத்தும் காட்டு' : 'Clear Filter'}
              </button>
            )}
          </div>

          <div className="space-y-3 pt-1">
            {CATEGORIES_LIST.map((cat: any) => {
              const val = baseFilteredIssues.filter((i: any) => i.category === cat.id).length;
              const maxCount = Math.max(...CATEGORIES_LIST.map((c: any) => baseFilteredIssues.filter((i: any) => i.category === c.id).length), 1);
              const widthPct = (val / maxCount) * 100;
              const isSelected = selectedChartCategory === cat.id;
              const categoryThemeColor = getCategoryThemeColor(cat.id);

              return (
                <div 
                  key={cat.id} 
                  onClick={() => setSelectedChartCategory(isSelected ? '' : cat.id)}
                  style={isSelected ? {
                    borderColor: `${categoryThemeColor}40`,
                    backgroundColor: `${categoryThemeColor}08`,
                    boxShadow: `0 0 0 1px ${categoryThemeColor}20`
                  } : {}}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected 
                      ? 'shadow-sm' 
                      : 'border-gray-50 hover:border-gray-200 bg-gray-50/20 hover:bg-gray-50/50'
                  }`}
                >
                  <div className="flex justify-between text-xs font-bold text-slate-700 mb-2">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: categoryThemeColor }} />
                      {lang === 'ta' ? cat.nameTa : cat.nameEn}
                    </span>
                    <span>{val} {lang === 'ta' ? 'பிரச்சினைகள்' : 'Issues'}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${widthPct}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: categoryThemeColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Subcategory Wise Diagrams */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-gray-800 tracking-tight">
                {lang === 'ta' ? 'துணை வகை வாரியான வரைபடம்' : 'Subcategory Wise Diagram'}
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {(() => {
                  if (selectedChartCategory) {
                    const matched = CATEGORIES_LIST.find((c: any) => c.id === selectedChartCategory);
                    const name = matched ? (lang === 'ta' ? matched.nameTa : matched.nameEn) : '';
                    return lang === 'ta' ? `வகைக்கான துணை வகைகள்: ${name}` : `Subcategories for ${name}`;
                  }
                  return lang === 'ta' ? 'அனைத்து துணை வகைகளின் பட்டியல்' : 'All subcategories across all categories';
                })()}
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-1 max-h-[340px] overflow-y-auto pr-1">
            {(() => {
              // Collect active subcategories to display
              let displayedSubcats: any[] = [];
              if (selectedChartCategory) {
                const parentCat = CATEGORIES_LIST.find((c: any) => c.id === selectedChartCategory);
                if (parentCat) {
                  displayedSubcats = (parentCat.subcategories || []).map((sub: any) => ({
                    ...sub,
                    color: parentCat.color,
                    categoryEn: parentCat.nameEn,
                    categoryTa: parentCat.nameTa,
                    categoryId: parentCat.id
                  }));
                }
              } else {
                CATEGORIES_LIST.forEach((cat: any) => {
                  (cat.subcategories || []).forEach((sub: any) => {
                    displayedSubcats.push({
                      ...sub,
                      color: cat.color,
                      categoryEn: cat.nameEn,
                      categoryTa: cat.nameTa,
                      categoryId: cat.id
                    });
                  });
                });
              }

              // Compute counts
              const subcatData = displayedSubcats.map((sub: any) => {
                const val = baseFilteredIssues.filter((i: any) => i.subcategory === sub.id).length;
                return { ...sub, count: val };
              });

              const maxSubcatCount = Math.max(...subcatData.map((s: any) => s.count), 1);

              return subcatData.map((sub: any) => {
                const widthPct = (sub.count / maxSubcatCount) * 100;
                return (
                  <div key={`${sub.categoryId}_${sub.id}`} className="p-3 bg-slate-50/30 rounded-xl border border-slate-50">
                    <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1.5">
                      <span className="truncate max-w-[200px]" title={lang === 'ta' ? sub.nameTa : sub.nameEn}>
                        {lang === 'ta' ? sub.nameTa : sub.nameEn}
                        {!selectedChartCategory && (
                          <span className="text-[9px] text-gray-400 font-bold ml-1.5 px-1 py-0.5 bg-gray-100 rounded-sm">
                            {lang === 'ta' ? sub.categoryTa : sub.categoryEn}
                          </span>
                        )}
                      </span>
                      <span className="font-bold text-slate-800 shrink-0">{sub.count} {lang === 'ta' ? 'பதிவுகள்' : 'cases'}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPct}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: getCategoryThemeColor(sub.categoryId) }}
                      />
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* Abstract Table with Filters Section */}
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
              className="w-full text-xs p-2.5 rounded-xl border border-gray-200 outline-none bg-white font-medium"
            >
              {currentUser.scopeType === 'HOD' && (
                <option value="">{lang === 'ta' ? 'அனைத்து மண்டலங்கள்' : 'All Zones'}</option>
              )}
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
              className="w-full text-xs p-2.5 rounded-xl border border-gray-200 outline-none bg-white font-medium"
            >
              {currentUser.scopeType !== 'TownPanchayat' && (
                <option value="">{lang === 'ta' ? 'அனைத்து மாவட்டங்கள்' : 'All Districts'}</option>
              )}
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
              className="w-full text-xs p-2.5 rounded-xl border border-gray-200 outline-none bg-white font-medium"
            >
              {currentUser.scopeType !== 'TownPanchayat' && (
                <option value="">{lang === 'ta' ? 'அனைத்து பேரூராட்சிகள்' : 'All Town Panchayats'}</option>
              )}
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
              onChange={(e) => setFilterCategory(e.target.value)}
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

        {/* Abstract Table (Summary Matrix of Issue Counts based on active filters) */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-2 rounded-2xl border border-gray-100">
            {/* Left side: View Mode Toggles */}
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

            {/* Right side: Refresh & Download Excel Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRefreshAbstract}
                disabled={isRefreshingAbstract}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold shadow-2xs transition-all cursor-pointer select-none disabled:opacity-60"
                title={lang === 'ta' ? 'அட்டவணை சுருக்கத்தைப் புதுப்பி' : 'Refresh Abstract Table'}
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isRefreshingAbstract ? 'animate-spin' : ''}`} />
                <span>{lang === 'ta' ? 'புதுப்பி (Refresh)' : 'Refresh'}</span>
                {abstractRefreshTime && (
                  <span className="text-[10px] text-slate-400 font-mono hidden md:inline ml-1">
                    {abstractRefreshTime}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => downloadExcel('abstract')}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer select-none"
              >
                <FileText className="w-4 h-4" />
                <span>{lang === 'ta' ? 'அட்டவணை சுருக்கம் பதிவிறக்கம் (Excel)' : 'Download Abstract Excel'}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-150 shadow-2xs">
            <table className="w-full text-center text-xs border-collapse">
              {abstractViewMode === 'category' && (
                <>
                  <thead>
                    <tr className="bg-slate-50 font-bold text-slate-600 border-b border-gray-150 text-[10px] uppercase tracking-wider">
                      <th className="p-3 text-left border-r border-gray-150">{lang === 'ta' ? 'வகை' : 'Category'}</th>
                      <th className="p-3 text-left border-r border-gray-150">{lang === 'ta' ? 'துணைப் பிரிவு' : 'Subcategory'}</th>
                      <th className="p-3 border-r border-gray-150">{lang === 'ta' ? 'மொத்தப் பிரச்சினைகள்' : 'Total Issues'}</th>
                      <th className="p-3 border-r border-gray-150 text-amber-700">{lang === 'ta' ? 'நிலுவை (Pending)' : 'Pending'}</th>
                      <th className="p-3 border-r border-gray-150 text-indigo-700">{lang === 'ta' ? 'செயல்பாட்டில் (In Progress)' : 'In Progress'}</th>
                      <th className="p-3 border-r border-gray-150 text-emerald-700">{lang === 'ta' ? 'தீர்க்கப்பட்டவை (Resolved)' : 'Resolved'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 font-medium text-slate-700">
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
                            className={`hover:bg-slate-50/40 transition cursor-pointer ${isSelected ? 'bg-fuchsia-50/70 font-bold' : ''}`}
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
                            <td className="p-3 text-left font-bold border-r border-gray-150 bg-slate-50/20">{lang === 'ta' ? cat.nameTa : cat.nameEn}</td>
                            <td className="p-3 text-left border-r border-gray-150">{lang === 'ta' ? sub.nameTa : sub.nameEn}</td>
                            <td className="p-3 font-bold border-r border-gray-150">{total}</td>
                            <td className="p-3 border-r border-gray-150 font-bold text-amber-600">{pending}</td>
                            <td className="p-3 border-r border-gray-150 font-bold text-indigo-600">{inProgress}</td>
                            <td className="p-3 border-r border-gray-150 font-bold text-emerald-600">{resolved}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 font-bold text-slate-800 bg-slate-100">
                    <tr>
                      <td colSpan={2} className="p-3 text-right border-r border-gray-150 font-extrabold text-[11px] uppercase tracking-wider">{lang === 'ta' ? 'மொத்தம்' : 'Total'}</td>
                      <td className="p-3 border-r border-gray-150 font-extrabold text-sm">{(() => {
                        let total = 0;
                        visibleCategories.forEach((cat: any) => (cat.subcategories || []).forEach((sub: any) => {
                          total += baseFilteredIssues.filter((i: any) => i.category === cat.id && i.subcategory === sub.id).length;
                        }));
                        return total;
                      })()}</td>
                      <td className="p-3 border-r border-gray-150 font-extrabold text-sm text-amber-700">{(() => {
                        let pending = 0;
                        visibleCategories.forEach((cat: any) => (cat.subcategories || []).forEach((sub: any) => {
                          pending += baseFilteredIssues.filter((i: any) => i.category === cat.id && i.subcategory === sub.id && i.status === 'Pending').length;
                        }));
                        return pending;
                      })()}</td>
                      <td className="p-3 border-r border-gray-150 font-extrabold text-sm text-indigo-700">{(() => {
                        let inProgress = 0;
                        visibleCategories.forEach((cat: any) => (cat.subcategories || []).forEach((sub: any) => {
                          inProgress += baseFilteredIssues.filter((i: any) => i.category === cat.id && i.subcategory === sub.id && (i.status === 'In Progress' || i.status === 'Active')).length;
                        }));
                        return inProgress;
                      })()}</td>
                      <td className="p-3 border-r border-gray-150 font-extrabold text-sm text-emerald-700">{(() => {
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
                    <tr className="bg-slate-50 font-bold text-slate-600 border-b border-gray-150 text-[10px] uppercase tracking-wider">
                      <th className="p-3 text-left border-r border-gray-150">{lang === 'ta' ? 'மண்டலம்' : 'Zone'}</th>
                      <th className="p-3 border-r border-gray-150">{lang === 'ta' ? 'மொத்தப் பிரச்சினைகள்' : 'Total Issues'}</th>
                      <th className="p-3 border-r border-gray-150 text-amber-700">{lang === 'ta' ? 'நிலுவை (Pending)' : 'Pending'}</th>
                      <th className="p-3 border-r border-gray-150 text-indigo-700">{lang === 'ta' ? 'செயல்பாட்டில் (In Progress)' : 'In Progress'}</th>
                      <th className="p-3 border-r border-gray-150 text-emerald-700">{lang === 'ta' ? 'தீர்க்கப்பட்டவை (Resolved)' : 'Resolved'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-150 font-medium text-slate-700">
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
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 font-bold text-slate-800 bg-slate-100">
                    <tr>
                      <td className="p-3 text-right border-r border-gray-150 font-extrabold text-[11px] uppercase tracking-wider">{lang === 'ta' ? 'மொத்தம்' : 'Total'}</td>
                      <td className="p-3 border-r border-gray-150 font-extrabold text-sm">{(() => {
                        let total = 0;
                        zones.forEach((zone: any) => {
                          const zoneTPs = townPanchayats.filter((tp: any) => tp.zoneId === zone.id);
                          const tpIds = zoneTPs.map((tp: any) => tp.id);
                          total += baseFilteredIssues.filter((i: any) => tpIds.includes(i.townPanchayatId)).length;
                        });
                        return total;
                      })()}</td>
                      <td className="p-3 border-r border-gray-150 font-extrabold text-sm text-amber-700">{(() => {
                        let pending = 0;
                        zones.forEach((zone: any) => {
                          const zoneTPs = townPanchayats.filter((tp: any) => tp.zoneId === zone.id);
                          const tpIds = zoneTPs.map((tp: any) => tp.id);
                          pending += baseFilteredIssues.filter((i: any) => tpIds.includes(i.townPanchayatId) && i.status === 'Pending').length;
                        });
                        return pending;
                      })()}</td>
                      <td className="p-3 border-r border-gray-150 font-extrabold text-sm text-indigo-700">{(() => {
                        let inProgress = 0;
                        zones.forEach((zone: any) => {
                          const zoneTPs = townPanchayats.filter((tp: any) => tp.zoneId === zone.id);
                          const tpIds = zoneTPs.map((tp: any) => tp.id);
                          inProgress += baseFilteredIssues.filter((i: any) => tpIds.includes(i.townPanchayatId) && (i.status === 'In Progress' || i.status === 'Active')).length;
                        });
                        return inProgress;
                      })()}</td>
                      <td className="p-3 border-r border-gray-150 font-extrabold text-sm text-emerald-700">{(() => {
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
                            className={`hover:bg-slate-50/40 transition cursor-pointer ${isSelected ? 'bg-indigo-50/70 font-bold' : ''}`}
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
                            <td className="p-3 text-left border-r border-gray-150 text-gray-400 font-normal">{zone ? tObj(zone) : ''}</td>
                            <td className="p-3 text-left font-bold border-r border-gray-150 bg-slate-50/20">{tObj(district)}</td>
                            <td className="p-3 font-bold border-r border-gray-150">{total}</td>
                            <td className="p-3 border-r border-gray-150 font-bold text-amber-600">{pending}</td>
                            <td className="p-3 border-r border-gray-150 font-bold text-indigo-600">{inProgress}</td>
                            <td className="p-3 border-r border-gray-150 font-bold text-emerald-600">{resolved}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-300 font-bold text-slate-800 bg-slate-100">
                    <tr>
                      <td colSpan={2} className="p-3 text-right border-r border-gray-150 font-extrabold text-[11px] uppercase tracking-wider">{lang === 'ta' ? 'மொத்தம்' : 'Total'}</td>
                      <td className="p-3 border-r border-gray-150 font-extrabold text-sm">{(() => {
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
                      <td className="p-3 border-r border-gray-150 font-extrabold text-sm text-amber-700">{(() => {
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
                      <td className="p-3 border-r border-gray-150 font-extrabold text-sm text-indigo-700">{(() => {
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
                      <td className="p-3 border-r border-gray-150 font-extrabold text-sm text-emerald-700">{(() => {
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
          <div className="flex flex-wrap justify-between items-center gap-3 bg-fuchsia-50 p-4 rounded-xl border border-fuchsia-100 text-xs">
            <span className="font-semibold text-fuchsia-800 flex flex-wrap items-center gap-2">
              <span>{lang === 'ta' ? 'அட்டவணை வடிகட்டப்பட்டது: ' : 'Detailed View Filtered By: '}</span>
              {selectedAbstractCategory && (
                <span className="bg-white px-2 py-1 rounded-md border border-fuchsia-200">
                  {lang === 'ta' ? 'வகை' : 'Category'}: <strong className="text-fuchsia-900 font-extrabold">{CATEGORIES_MAP[selectedAbstractCategory]?.[lang] || selectedAbstractCategory}</strong>
                </span>
              )}
              {selectedAbstractSubcategory && (
                <span className="bg-white px-2 py-1 rounded-md border border-fuchsia-200">
                  {lang === 'ta' ? 'துணைப் பிரிவு' : 'Subcategory'}: <strong className="text-fuchsia-900 font-extrabold">{getSubcategoryName(selectedAbstractCategory, selectedAbstractSubcategory, lang)}</strong>
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

        {/* Detailed Issues Table */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <span>{lang === 'ta' ? 'விவரமானப் பிரச்சினைகள் பட்டியல்' : 'Detailed Issues Ledger'}</span>
              <span className="text-xs text-gray-400 font-normal">({lang === 'ta' ? 'காண்பிக்கப்படும் வரிசைகள்' : 'Showing rows'}: {sortedIssues.length})</span>
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
          <div className="overflow-x-auto rounded-xl border border-gray-100">
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
                  <th className="p-3 cursor-pointer hover:bg-slate-100 transition min-w-[250px] max-w-[350px]" onClick={() => handleSort('subject')}>
                    <div className="flex items-center">
                      {lang === 'ta' ? 'பொருள் (Subject)' : 'Subject'}
                      {renderSortIcon('subject')}
                    </div>
                  </th>
                  <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('category')}>
                    <div className="flex items-center">
                      {lang === 'ta' ? 'வகை / உட்பிரிவு' : 'Category Sub category'}
                      {renderSortIcon('category')}
                    </div>
                  </th>
                  <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('lastUpdated')}>
                    <div className="flex items-center">
                      {lang === 'ta' ? 'கடைசியாக புதுப்பிக்கப்பட்டது' : 'Last updated date'}
                      {renderSortIcon('lastUpdated')}
                    </div>
                  </th>
                  <th className="p-3 cursor-pointer hover:bg-slate-100 transition" onClick={() => handleSort('status')}>
                    <div className="flex items-center">
                      {lang === 'ta' ? 'நிலை (Stage)' : 'Stage status'}
                      {renderSortIcon('status')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-medium text-slate-700">
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
                      className="hover:bg-indigo-50/20 transition cursor-pointer"
                      onClick={() => {
                        setSelectedLedgerIssue(issue);
                        setActivePreviewFile(null);
                      }}
                    >
                      <td className="p-3 font-mono font-bold text-indigo-700">{issue.issueId}</td>
                      <td className="p-3">{getZoneNameByTP(issue.townPanchayatId)}</td>
                      <td className="p-3">{getDistrictNameByTP(issue.townPanchayatId)}</td>
                      <td className="p-3">{getTPName(issue.townPanchayatId)}</td>
                      <td className="p-3 min-w-[250px] max-w-[350px] text-slate-800 font-bold whitespace-normal break-words" title={issue.subject || '-'}>{issue.subject || '-'}</td>
                      <td className="p-3">
                        <span className="font-bold text-slate-800">{catName}</span>
                        <span className="text-gray-400 font-semibold"> / {getSubcategoryName(issue.category, issue.subcategory, lang)}</span>
                      </td>
                      <td className="p-3 font-mono text-gray-400">
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
                    </tr>
                  );
                })}
                {sortedIssues.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400 font-semibold italic">
                      {lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்ட வடிகட்டிகளில் பிரச்சினைகள் எதுவும் இல்லை.' : 'No issues match the selected filter criteria.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Ledger Issue Details Popup Modal */}
      {selectedLedgerIssue && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center bg-indigo-950 px-6 py-4 text-white">
              <div>
                <span className="bg-indigo-900 text-indigo-200 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider border border-indigo-850">
                  {selectedLedgerIssue.status}
                </span>
                <h3 className="text-md font-extrabold tracking-tight mt-1">
                  {lang === 'ta' ? `விண்ணப்ப விவரம்: ${selectedLedgerIssue.issueId}` : `Issue Details: ${selectedLedgerIssue.issueId}`}
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedLedgerIssue(null)}
                className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition cursor-pointer"
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
                              className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-md font-bold transition cursor-pointer shrink-0"
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
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
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
                    {CATEGORIES_MAP[currentIssue.category]?.[lang] || currentIssue.category}
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
                  <label className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">
                    {lang === 'ta' ? 'அடுத்த கட்ட நிலை' : 'Next Stage'}
                  </label>
                  <select
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
