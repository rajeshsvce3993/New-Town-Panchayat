'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  FileText, 
  Search, 
  Printer, 
  Download, 
  Filter, 
  Building, 
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  LayoutDashboard,
  AlertTriangle,
  Briefcase,
  CheckCircle,
  Clock
} from 'lucide-react';
import { Language, translations } from './translations';
import { ThemeType, themesConfig } from '@/lib/themeConfig';

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

interface ReportsViewProps {
  state: any;
  lang: Language;
  theme: ThemeType;
  currentUser?: any;
}

export default function ReportsView({ state, lang, theme, currentUser }: ReportsViewProps) {
  const currentTheme = themesConfig[theme] || themesConfig['sunset-aurora'];

  const isEmployeeMgmtDisabled = state?.settings?.enableEmployeeManagement === false;

  // Toggle between Employee Reports and Pending TP Issues Reports
  const [reportType, setReportType] = useState<'employees' | 'pendingIssues'>(
    isEmployeeMgmtDisabled ? 'pendingIssues' : 'employees'
  );

  React.useEffect(() => {
    if (isEmployeeMgmtDisabled && reportType !== 'pendingIssues') {
      setReportType('pendingIssues');
    }
  }, [isEmployeeMgmtDisabled, reportType]);

  const {
    zones = [],
    districts = [],
    townPanchayats = [],
    posts = [],
    employees = [],
    employeeGroups = [],
    employeeCategories = [],
    postNatures = [],
    payLevels = [],
    officeCategories = [],
    pendingIssues = []
  } = state || {};

  // Helper to determine if the logged in user is Admin or Director (full unrestricted state-wide access)
  const isAdminOrDirector = React.useMemo(() => {
    if (!currentUser) return false;
    const r = String(currentUser.roleId || currentUser.role || '').toLowerCase();
    const u = String(currentUser.username || '').toLowerCase();
    return (
      r === 'admin' ||
      r === 'superadmin' ||
      r === 'director' ||
      r === 'directorate' ||
      r === 'state' ||
      r.includes('admin') ||
      r.includes('director') ||
      u === 'admin' ||
      u === 'director'
    );
  }, [currentUser]);

  // Role scope helpers
  const userTpId = React.useMemo(() => {
    if (isAdminOrDirector || !currentUser) return null;
    const role = String(currentUser.roleId || currentUser.role || '').toLowerCase();
    const isZonalRole = currentUser.scopeType === 'Zone' || role === 'zonal' || role.includes('zone') || role === 'ad';
    if (isZonalRole) return null;
    const uName = String(currentUser.username || '').toLowerCase();
    const isTpRole = currentUser.scopeType === 'TownPanchayat' || role === 'eo' || role.includes('tp') || !!currentUser.tpId || uName.includes('arani') || uName.startsWith('eo_') || uName.startsWith('tp_');
    if (isTpRole) {
      const explicitTp = currentUser.tpId || (currentUser.scopeType === 'TownPanchayat' ? currentUser.scopeId : null);
      if (explicitTp && explicitTp !== 'all') {
        const matched = townPanchayats.find((t: any) => 
          String(t.id).toLowerCase() === String(explicitTp).toLowerCase() ||
          String(t.nameEn || '').toLowerCase() === String(explicitTp).toLowerCase()
        );
        return matched ? matched.id : explicitTp;
      }
      if (currentUser.scopeId && currentUser.scopeId !== 'all') {
        const matched = townPanchayats.find((t: any) => 
          String(t.id).toLowerCase() === String(currentUser.scopeId).toLowerCase() ||
          String(t.nameEn || '').toLowerCase() === String(currentUser.scopeId).toLowerCase()
        );
        return matched ? matched.id : currentUser.scopeId;
      }
      if (Array.isArray(currentUser.townPanchayatIds) && currentUser.townPanchayatIds.length > 0) {
        return currentUser.townPanchayatIds[0];
      }
      if (uName.includes('arani')) {
        const araniTp = townPanchayats.find((t: any) => 
          String(t.nameEn || '').toLowerCase().includes('arani') ||
          String(t.id || '').toLowerCase().includes('arani')
        );
        if (araniTp) return araniTp.id;
      }
    }
    return null;
  }, [currentUser, isAdminOrDirector, townPanchayats]);

  const userDistrictId = React.useMemo(() => {
    if (isAdminOrDirector || !currentUser) return null;
    const role = String(currentUser.roleId || currentUser.role || '').toLowerCase();
    const isZonalRole = currentUser.scopeType === 'Zone' || role === 'zonal' || role.includes('zone') || role === 'ad';
    if (isZonalRole) return null;
    if (userTpId) {
      const tpObj = townPanchayats.find((t: any) => 
        String(t.id).toLowerCase() === String(userTpId).toLowerCase() || 
        String(t.nameEn || '').toLowerCase() === String(userTpId).toLowerCase()
      );
      if (tpObj?.districtId) return tpObj.districtId;
      if (currentUser.districtId && currentUser.districtId !== 'all') return currentUser.districtId;
      if (String(userTpId).toLowerCase().includes('arani')) {
        const thiruvallurDist = districts.find((d: any) => 
          String(d.nameEn || '').toLowerCase().includes('thiruvallur') || 
          String(d.id || '').toLowerCase().includes('thiruvallur')
        );
        if (thiruvallurDist) return thiruvallurDist.id;
      }
    }
    if (!isZonalRole && currentUser.districtId && currentUser.districtId !== 'all') {
      return currentUser.districtId;
    }
    return null;
  }, [currentUser, userTpId, isAdminOrDirector, townPanchayats, districts]);

  const userZoneId = React.useMemo(() => {
    if (isAdminOrDirector || !currentUser) return null;
    const role = String(currentUser.roleId || currentUser.role || '').toLowerCase();
    const isZonalRole = currentUser.scopeType === 'Zone' || role === 'zonal' || role.includes('zone') || role === 'ad';
    if (isZonalRole) {
      const explicitZone = currentUser.zoneId || (currentUser.scopeType === 'Zone' ? currentUser.scopeId : null);
      if (explicitZone && explicitZone !== 'all') {
        const matched = zones.find((z: any) => 
          String(z.id).toLowerCase() === String(explicitZone).toLowerCase() ||
          String(z.nameEn || '').toLowerCase() === String(explicitZone).toLowerCase()
        );
        return matched ? matched.id : explicitZone;
      }
      if (currentUser.scopeId && currentUser.scopeId !== 'all') {
        const matched = zones.find((z: any) => 
          String(z.id).toLowerCase() === String(currentUser.scopeId).toLowerCase() ||
          String(z.nameEn || '').toLowerCase() === String(currentUser.scopeId).toLowerCase()
        );
        return matched ? matched.id : currentUser.scopeId;
      }
    }
    if (userDistrictId) {
      const distObj = districts.find((d: any) => 
        String(d.id).toLowerCase() === String(userDistrictId).toLowerCase() ||
        String(d.nameEn || '').toLowerCase() === String(userDistrictId).toLowerCase()
      );
      if (distObj?.zoneId) return distObj.zoneId;
    }
    if (userTpId) {
      const tpObj = townPanchayats.find((t: any) => 
        String(t.id).toLowerCase() === String(userTpId).toLowerCase() || 
        String(t.nameEn || '').toLowerCase() === String(userTpId).toLowerCase()
      );
      if (tpObj) {
        const distObj = districts.find((d: any) => 
          String(d.id).toLowerCase() === String(tpObj.districtId).toLowerCase() ||
          String(d.nameEn || '').toLowerCase() === String(tpObj.districtNameEn || '').toLowerCase()
        );
        if (distObj?.zoneId) return distObj.zoneId;
      }
      const matchZone = zones.find((z: any) => 
        String(z.nameEn || '').toLowerCase().includes('thiruvallur') ||
        String(z.nameEn || '').toLowerCase().includes('chennai')
      );
      if (matchZone) return matchZone.id;
    }
    if (currentUser.zoneId && currentUser.zoneId !== 'all') return currentUser.zoneId;
    return null;
  }, [currentUser, userTpId, userDistrictId, isAdminOrDirector, townPanchayats, districts, zones]);

  // Pending issues filter states
  const [filterIssueCategory, setFilterIssueCategory] = useState('');
  const [filterIssueStatus, setFilterIssueStatus] = useState('');
  const [filterIssueTP, setFilterIssueTP] = useState('');
  const [filterIssueSearch, setFilterIssueSearch] = useState('');

  const CATEGORIES = (state?.issueCategories && state.issueCategories.length > 0) ? state.issueCategories : STATIC_CATEGORIES;

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterZone, setFilterZone] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [filterTP, setFilterTP] = useState('');
  const [filterPost, setFilterPost] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterNature, setFilterNature] = useState('');
  const [filterPayLevel, setFilterPayLevel] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Auto-apply scope restrictions
  React.useEffect(() => {
    if (userZoneId) {
      setFilterZone(userZoneId);
    }
    if (userDistrictId) {
      setFilterDistrict(userDistrictId);
    }
    if (userTpId) {
      setFilterTP(userTpId);
      setFilterIssueTP(userTpId);
    }
  }, [userZoneId, userDistrictId, userTpId]);

  // Sorting state
  const [sortField, setSortField] = useState('employeeId');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Dashboard state
  const [dashboardOfficeId, setDashboardOfficeId] = useState('all');

  const t = (key: keyof typeof translations['en']) => {
    return translations[lang][key] || translations['en'][key] || key;
  };

  const tObj = (obj: any) => {
    if (!obj) return '';
    return lang === 'ta' ? (obj.nameTa || obj.nameEn) : (obj.nameEn || obj.nameTa);
  };

  // Perform multi-filter search
  const filteredEmployees = employees.filter((emp: any) => {
    const matchesSearch = searchQuery ? (
      emp.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.nameTa.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(searchQuery.toLowerCase())
    ) : true;

    const matchesZone = filterZone ? emp.zoneId === filterZone : true;
    const matchesDistrict = filterDistrict ? emp.districtId === filterDistrict : true;
    const matchesTP = filterTP ? emp.townPanchayatId === filterTP : true;
    const matchesPost = filterPost ? emp.postId === filterPost : true;
    const matchesGroup = filterGroup ? emp.groupId === filterGroup : true;
    const matchesCategory = filterCategory ? emp.categoryId === filterCategory : true;
    const matchesNature = filterNature ? emp.postNatureId === filterNature : true;
    const matchesPayLevel = filterPayLevel ? emp.payLevelId === filterPayLevel : true;
    const matchesStatus = filterStatus ? emp.status === filterStatus : true;

    return matchesSearch && matchesZone && matchesDistrict && matchesTP && matchesPost && matchesGroup && matchesCategory && matchesNature && matchesPayLevel && matchesStatus;
  });

  // Apply sorting on filtered data
  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    let valA = '';
    let valB = '';

    if (sortField === 'employeeId') {
      valA = a.employeeId || '';
      valB = b.employeeId || '';
    } else if (sortField === 'name') {
      valA = lang === 'ta' ? (a.nameTa || a.nameEn) : (a.nameEn || a.nameTa);
      valB = lang === 'ta' ? (b.nameTa || b.nameEn) : (b.nameEn || b.nameTa);
    } else if (sortField === 'post') {
      const pA = posts.find((p: any) => p.id === a.postId);
      const pB = posts.find((p: any) => p.id === b.postId);
      valA = pA ? (lang === 'ta' ? pA.nameTa || pA.nameEn : pA.nameEn) : '';
      valB = pB ? (lang === 'ta' ? pB.nameTa || pB.nameEn : pB.nameEn) : '';
    } else if (sortField === 'townPanchayat') {
      const tpA = townPanchayats.find((t: any) => t.id === a.townPanchayatId);
      const tpB = townPanchayats.find((t: any) => t.id === b.townPanchayatId);
      valA = tpA ? (lang === 'ta' ? tpA.nameTa || tpA.nameEn : tpA.nameEn) : '';
      valB = tpB ? (lang === 'ta' ? tpB.nameTa || tpB.nameEn : tpB.nameEn) : '';
    } else if (sortField === 'group') {
      valA = a.groupId || '';
      valB = b.groupId || '';
    } else if (sortField === 'category') {
      const cA = employeeCategories.find((c: any) => c.id === a.categoryId);
      const cB = employeeCategories.find((c: any) => c.id === b.categoryId);
      valA = cA ? (lang === 'ta' ? cA.nameTa || cA.nameEn : cA.nameEn) : '';
      valB = cB ? (lang === 'ta' ? cB.nameTa || cB.nameEn : cB.nameEn) : '';
    } else if (sortField === 'nature') {
      const nA = postNatures.find((n: any) => n.id === a.postNatureId);
      const nB = postNatures.find((n: any) => n.id === b.postNatureId);
      valA = nA ? (lang === 'ta' ? nA.nameTa || nA.nameEn : nA.nameEn) : '';
      valB = nB ? (lang === 'ta' ? nB.nameTa || nB.nameEn : nB.nameEn) : '';
    } else if (sortField === 'status') {
      valA = a.status || '';
      valB = b.status || '';
    }

    const comparison = valA.localeCompare(valB, lang === 'ta' ? 'ta' : 'en', { numeric: true, sensitivity: 'base' });
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Export filtered & sorted list to CSV
  const handleExportCSV = () => {
    const headers = "EmployeeID,NameEnglish,NameTamil,Post,TownPanchayat,Group,Category,Nature,Status\n";
    const rows = sortedEmployees.map((emp: any) => {
      const pst = posts.find((p: any) => p.id === emp.postId);
      const tp = townPanchayats.find((t: any) => t.id === emp.townPanchayatId);
      const cat = employeeCategories.find((c: any) => c.id === emp.categoryId);
      const nat = postNatures.find((n: any) => n.id === emp.postNatureId);

      return `"${emp.employeeId}","${emp.nameEn}","${emp.nameTa}","${pst ? pst.nameEn : emp.postId}","${tp ? tp.nameEn : emp.townPanchayatId}","${emp.groupId}","${cat ? cat.nameEn : emp.categoryId}","${nat ? nat.nameEn : emp.postNatureId}","${emp.status}"`;
    }).join('\n');

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + rows);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `Filtered_Sorted_Employees_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Trigger browser print
  const handlePrint = () => {
    window.print();
  };

  // Filter pending issues
  const filteredIssues = pendingIssues.filter((issue: any) => {
    const matchesSearch = filterIssueSearch ? (
      issue.id.toLowerCase().includes(filterIssueSearch.toLowerCase()) ||
      (issue.title || '').toLowerCase().includes(filterIssueSearch.toLowerCase()) ||
      (issue.description || '').toLowerCase().includes(filterIssueSearch.toLowerCase())
    ) : true;

    const matchesCategory = filterIssueCategory ? issue.categoryId === filterIssueCategory : true;
    const matchesStatus = filterIssueStatus ? issue.status === filterIssueStatus : true;
    const matchesTP = filterIssueTP ? issue.townPanchayatId === filterIssueTP : true;

    return matchesSearch && matchesCategory && matchesStatus && matchesTP;
  });

  // Export filtered issues to CSV
  const handleExportIssuesCSV = () => {
    const headers = "IssueID,Title,Category,Subcategory,TownPanchayat,District,Zone,Status,CreatedAt\n";
    const rows = filteredIssues.map((issue: any) => {
      const tp = townPanchayats.find((t: any) => t.id === issue.townPanchayatId);
      const dst = districts.find((d: any) => d.id === issue.districtId);
      const zn = zones.find((z: any) => z.id === issue.zoneId);
      const catId = issue.categoryId || issue.category || '';
      const subcatId = issue.subcategoryId || issue.subcategory || '';
      const cat = CATEGORIES.find((c: any) => c.id?.toLowerCase() === catId.toLowerCase());
      const catName = cat ? (lang === 'ta' ? (cat.nameTa || cat.nameEn) : cat.nameEn) : catId;
      const subcat = cat?.subcategories?.find((s: any) => s.id?.toLowerCase() === subcatId.toLowerCase());
      const subcatName = subcat ? (lang === 'ta' ? (subcat.nameTa || subcat.nameEn) : subcat.nameEn) : subcatId;

      return `"${issue.id}","${issue.title || ''}","${catName}","${subcatName}","${tp ? tp.nameEn : issue.townPanchayatId}","${dst ? dst.nameEn : ''}","${zn ? zn.nameEn : ''}","${issue.status}","${issue.createdAt ? issue.createdAt.substring(0, 10) : ''}"`;
    }).join('\n');

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(headers + rows);
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", `TP_Pending_Issues_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sorting columns helper
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const renderSortHeader = (field: string, label: string) => {
    const isCurrent = sortField === field;
    return (
      <th 
        onClick={() => handleSort(field)}
        className={`p-4 cursor-pointer select-none group hover:bg-gray-100/70 transition ${field === 'employeeId' ? 'pl-6' : ''} ${field === 'status' ? 'pr-6' : ''}`}
      >
        <div className="flex items-center gap-1 font-semibold text-gray-500 hover:text-gray-900 transition">
          <span>{label}</span>
          <span className="shrink-0 text-gray-400 group-hover:text-indigo-500 transition">
            {isCurrent ? (
              sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-indigo-500" /> : <ArrowDown className="w-3.5 h-3.5 text-indigo-500" />
            ) : (
              <ArrowUpDown className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition" />
            )}
          </span>
        </div>
      </th>
    );
  };

  // Dashboard calculation block
  const isAll = dashboardOfficeId === 'all';
  const selectedOffice = officeCategories.find((oc: any) => oc.id === dashboardOfficeId);

  // Compute Sanctions map for selected office category
  const currentSanctionsMap: { [postId: string]: number } = {};
  posts.forEach((p: any) => { currentSanctionsMap[p.id] = 0; });

  if (isAll) {
    officeCategories.forEach((oc: any) => {
      if (oc.sanctions) {
        Object.entries(oc.sanctions).forEach(([postId, count]) => {
          currentSanctionsMap[postId] = (currentSanctionsMap[postId] || 0) + (Number(count) || 0);
        });
      }
    });
  } else if (selectedOffice) {
    if (selectedOffice.sanctions) {
      Object.entries(selectedOffice.sanctions).forEach(([postId, count]) => {
        currentSanctionsMap[postId] = Number(count) || 0;
      });
    }
  }

  // Compute Filled map (only counting Active employees mapped to this scope)
  const currentFilledMap: { [postId: string]: number } = {};
  posts.forEach((p: any) => { currentFilledMap[p.id] = 0; });

  const activeEmployees = employees.filter((emp: any) => emp.status === 'Active');
  const relevantEmployees = isAll 
    ? activeEmployees 
    : activeEmployees.filter((emp: any) => {
        if (!selectedOffice) return false;
        if (selectedOffice.type === 'DTP') {
          return !emp.zoneId && !emp.townPanchayatId;
        } else if (selectedOffice.type === 'ADTP') {
          return emp.zoneId === selectedOffice.targetId && !emp.townPanchayatId;
        } else if (selectedOffice.type === 'TP') {
          return emp.townPanchayatId === selectedOffice.targetId;
        }
        return false;
      });

  relevantEmployees.forEach((emp: any) => {
    if (currentFilledMap[emp.postId] !== undefined) {
      currentFilledMap[emp.postId] += 1;
    } else {
      currentFilledMap[emp.postId] = 1;
    }
  });

  // Calculate aggregate totals
  let totalSanctioned = 0;
  let totalFilled = 0;
  let totalVacancy = 0;
  let totalSurplus = 0;

  posts.forEach((p: any) => {
    const sanctioned = currentSanctionsMap[p.id] || 0;
    const filled = currentFilledMap[p.id] || 0;
    totalSanctioned += sanctioned;
    totalFilled += filled;
    if (sanctioned > filled) {
      totalVacancy += (sanctioned - filled);
    } else if (filled > sanctioned) {
      totalSurplus += (filled - sanctioned);
    }
  });

  const filledPercentage = totalSanctioned > 0 
    ? Math.round((totalFilled / totalSanctioned) * 100) 
    : 0;

  if (reportType === 'pendingIssues') {
    return (
      <div id="reports-view-container" className="space-y-6 print:p-0">
        {/* Report Type Selector Tabs */}
        {!isEmployeeMgmtDisabled && (
          <div className="flex bg-slate-100 p-1 rounded-xl max-w-md print:hidden">
            <button
              onClick={() => setReportType('employees')}
              className="flex-1 py-2 text-xs font-bold rounded-lg transition duration-200 cursor-pointer text-center text-gray-500 hover:text-gray-900"
            >
              {lang === 'ta' ? 'ஊழியர் அறிக்கை' : 'Employee Census Report'}
            </button>
            <button
              onClick={() => setReportType('pendingIssues')}
              className="flex-1 py-2 text-xs font-bold rounded-lg transition duration-200 cursor-pointer text-center bg-white text-indigo-950 shadow-xs"
            >
              {lang === 'ta' ? 'பிரச்சனைகள்' : 'Pending TP Issues'}
            </button>
          </div>
        )}

        {/* Issues KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-400 block tracking-wider uppercase">
                {lang === 'ta' ? 'நிலுவை பிரச்சனைகள்' : 'Pending Issues'}
              </span>
              <span className="text-2xl font-extrabold text-gray-900 block mt-1">
                {filteredIssues.filter((i: any) => i.status === 'Pending').length}
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-400 block tracking-wider uppercase">
                {lang === 'ta' ? 'நடவடிக்கையில் உள்ளவை' : 'In-Progress'}
              </span>
              <span className="text-2xl font-extrabold text-gray-900 block mt-1">
                {filteredIssues.filter((i: any) => i.status === 'In Progress').length}
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-400 block tracking-wider uppercase">
                {lang === 'ta' ? 'தீர்க்கப்பட்டவை' : 'Resolved'}
              </span>
              <span className="text-2xl font-extrabold text-gray-900 block mt-1">
                {filteredIssues.filter((i: any) => i.status === 'Resolved').length}
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex items-center gap-4">
            <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-gray-400 block tracking-wider uppercase">
                {lang === 'ta' ? 'மொத்தப் புகார்கள்' : 'All Deployed Issues'}
              </span>
              <span className="text-2xl font-extrabold text-gray-900 block mt-1">
                {filteredIssues.length}
              </span>
            </div>
          </div>
        </div>

        {/* Issues Filters */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4 print:hidden">
          <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2 border-b border-gray-50 pb-2">
            <Filter className="w-5 h-5 text-indigo-600" />
            {lang === 'ta' ? 'வடிகட்டிகள்' : 'Issue Filter Controls'}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600">
            <div>
              <label className="font-semibold text-gray-400 block mb-1">Search Keywords</label>
              <input
                type="text"
                placeholder="Search ID, title..."
                value={filterIssueSearch}
                onChange={(e) => setFilterIssueSearch(e.target.value)}
                className="w-full border border-gray-200 hover:border-gray-300 rounded-xl px-3 py-2.5 outline-none bg-white font-medium text-gray-700"
              />
            </div>

            <div>
              <label className="font-semibold text-gray-400 block mb-1">Category</label>
              <select
                value={filterIssueCategory}
                onChange={(e) => setFilterIssueCategory(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-2.5 outline-none bg-white font-medium text-gray-700"
              >
                <option value="">{t('all')}</option>
                {CATEGORIES.map((c: any) => (
                  <option key={c.id} value={c.id}>{lang === 'ta' ? c.nameTa : c.nameEn}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-gray-400 block mb-1">Town Panchayat</label>
              <select
                value={filterIssueTP}
                disabled={!!userTpId}
                onChange={(e) => {
                  if (userTpId) return;
                  setFilterIssueTP(e.target.value);
                }}
                className={`w-full border rounded-xl p-2.5 outline-none font-medium ${
                  userTpId ? 'bg-slate-100 text-slate-700 border-slate-200 cursor-default' : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                {!userTpId && <option value="">{t('all')}</option>}
                {townPanchayats.filter((tp: any) => {
                  if (userTpId) return tp.id === userTpId || String(tp.nameEn || '').toLowerCase() === String(userTpId).toLowerCase();
                  if (filterDistrict || userDistrictId) {
                    const effD = filterDistrict || userDistrictId;
                    return tp.districtId === effD;
                  }
                  if (filterZone || userZoneId) {
                    const effZ = filterZone || userZoneId;
                    const d = districts.find((dist: any) => dist.id === tp.districtId);
                    return d && d.zoneId === effZ;
                  }
                  return true;
                }).map((tp: any) => (
                  <option key={tp.id} value={tp.id}>{tObj(tp)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-gray-400 block mb-1">Status</label>
              <select
                value={filterIssueStatus}
                onChange={(e) => setFilterIssueStatus(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-2.5 outline-none bg-white font-medium text-gray-700"
              >
                <option value="">{t('all')}</option>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-50">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 hover:bg-gray-50 rounded-xl text-xs font-semibold text-gray-600 transition"
            >
              <Printer className="w-4 h-4 text-indigo-600" />
              {t('printReport')}
            </button>
            <button
              onClick={handleExportIssuesCSV}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-xs"
            >
              <Download className="w-4 h-4" />
              {t('exportCsv')}
            </button>
          </div>
        </div>

        {/* Issues Table Grid */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-gray-50 flex justify-between items-center">
            <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              {lang === 'ta' ? 'பேரூராட்சி பிரச்சனைகள் பதிவேடு' : 'Town Panchayat Pending Issues Register'}
            </h3>
            <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded">
              {filteredIssues.length} issues found
            </span>
          </div>

          <div className="overflow-x-auto scrollbar-custom w-full">
            <table className="w-full min-w-[900px] text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/70 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="p-4 pl-6">ID</th>
                  <th className="p-4">Issue Details</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Town Panchayat</th>
                  <th className="p-4">Date Reported</th>
                  <th className="p-4 pr-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-xs text-gray-600">
                {filteredIssues.map((issue: any) => {
                  const tp = townPanchayats.find((t: any) => t.id === issue.townPanchayatId);
                  const catId = issue.categoryId || issue.category || '';
                  const subcatId = issue.subcategoryId || issue.subcategory || '';
                  const catObj = CATEGORIES.find((c: any) => c.id?.toLowerCase() === catId.toLowerCase());
                  const subcatObj = catObj?.subcategories?.find((s: any) => s.id?.toLowerCase() === subcatId.toLowerCase());

                  return (
                    <tr key={issue.id} className="hover:bg-gray-50/50 transition">
                      <td className="p-4 pl-6 font-mono font-bold text-indigo-600">{issue.id}</td>
                      <td className="p-4 max-w-sm">
                        <p className="font-semibold text-gray-950">{issue.title}</p>
                        <p className="text-gray-400 mt-0.5 truncate">{issue.description || 'No description provided'}</p>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-gray-800">
                          {catObj ? (lang === 'ta' ? catObj.nameTa : catObj.nameEn) : catId}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {subcatObj ? (lang === 'ta' ? subcatObj.nameTa : subcatObj.nameEn) : subcatId}
                        </p>
                      </td>
                      <td className="p-4 text-gray-500 font-medium">
                        {tp ? tObj(tp) : issue.townPanchayatId}
                      </td>
                      <td className="p-4 text-gray-400 font-semibold font-mono">
                        {issue.createdAt ? issue.createdAt.substring(0, 10) : ''}
                      </td>
                      <td className="p-4 pr-6">
                        <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                          issue.status === 'Pending' 
                            ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                            : issue.status === 'In Progress'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}>
                          {issue.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredIssues.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400 italic">
                      {t('noData')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="reports-view-container" className="space-y-6 print:p-0">
      {/* Report Type Selector Tabs */}
      {!isEmployeeMgmtDisabled && (
        <div className="flex bg-slate-100 p-1 rounded-xl max-w-md print:hidden">
          <button
            onClick={() => setReportType('employees')}
            className="flex-1 py-2 text-xs font-bold rounded-lg transition duration-200 cursor-pointer text-center bg-white text-indigo-950 shadow-xs"
          >
            {lang === 'ta' ? 'ஊழியர் அறிக்கை' : 'Employee Census Report'}
          </button>
          <button
            onClick={() => setReportType('pendingIssues')}
            className="flex-1 py-2 text-xs font-bold rounded-lg transition duration-200 cursor-pointer text-center text-gray-500 hover:text-gray-900"
          >
            {lang === 'ta' ? 'நிலுவைச் சிக்கல்கள்' : 'Pending TP Issues'}
          </button>
        </div>
      )}
      {/* Dashboard Summary Visualization Card for Office Heads */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-6 print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-50 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-[var(--theme-badge-bg)] text-[var(--theme-badge-text)] rounded-xl">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">
                {lang === 'ta' ? 'பணியிட ஒப்பீட்டு கட்டுப்பாட்டு பலகை' : 'Executive Post Sanctions & Strength Dashboard'}
              </h3>
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-0.5">
                {lang === 'ta' ? 'அலுவலகத் தலைவர்களுக்கான விபரம் மற்றும் பகுப்பாய்வு' : 'Dynamic summary insights for Office Heads'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-center">
            <label className="text-xs font-bold text-gray-500 shrink-0">
              {lang === 'ta' ? 'அலுவலகம்:' : 'Office / Station:'}
            </label>
            <select
              value={dashboardOfficeId}
              onChange={(e) => setDashboardOfficeId(e.target.value)}
              className="border border-gray-200 hover:border-indigo-300 rounded-xl px-3 py-2 text-xs font-semibold bg-white outline-none text-indigo-950 focus:ring-1 focus:ring-indigo-500 transition min-w-[200px] shadow-2xs"
            >
              <option value="all">-- {lang === 'ta' ? 'அனைத்து அலுவலகங்கள்' : 'All Configured Offices'} --</option>
              {officeCategories.map((oc: any) => (
                <option key={oc.id} value={oc.id}>
                  {tObj(oc)} ({oc.type})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 4 Summary Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Sanctioned Strength */}
          <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl flex items-start gap-4 hover:shadow-2xs transition">
            <div className="p-3 bg-[var(--theme-badge-bg)] text-[var(--theme-badge-text)] rounded-xl mt-0.5">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 block tracking-tight uppercase">
                {lang === 'ta' ? 'அனுமதிக்கப்பட்ட பணியிடங்கள்' : 'Sanctioned strength'}
              </span>
              <span className="text-3xl font-extrabold text-slate-800 block mt-1 tracking-tight">
                {totalSanctioned}
              </span>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {lang === 'ta' ? 'அரசாங்கத்தால் அங்கீகரிக்கப்பட்ட வரம்பு' : 'Total posts approved by Govt.'}
              </span>
            </div>
          </div>

          {/* Card 2: In Position */}
          <div className="bg-emerald-50/20 border border-emerald-100/50 p-5 rounded-2xl flex items-start gap-4 hover:shadow-2xs transition">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl mt-0.5">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-emerald-600 block tracking-tight uppercase">
                {lang === 'ta' ? 'பணியில் உள்ளவர்கள் (தற்போது)' : 'In-Position (Active)'}
              </span>
              <span className="text-3xl font-extrabold text-emerald-950 block mt-1 tracking-tight">
                {totalFilled}
              </span>
              <span className="text-[10px] text-emerald-600 mt-1 block font-medium">
                {lang === 'ta' ? 'பணியமர்த்தப்பட்ட நபர்கள்' : 'Currently deployed personnel'}
              </span>
            </div>
          </div>

          {/* Card 3: Vacancies */}
          <div className={`p-5 rounded-2xl border flex items-start gap-4 hover:shadow-2xs transition ${
            totalVacancy > 0 
              ? 'bg-amber-50/20 border-amber-100/50 text-amber-900' 
              : 'bg-slate-50 border-slate-100 text-slate-900'
          }`}>
            <div className={`p-3 rounded-xl mt-0.5 ${
              totalVacancy > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-200/60 text-slate-500'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className={`text-xs font-bold block tracking-tight uppercase ${
                totalVacancy > 0 ? 'text-amber-600' : 'text-slate-400'
              }`}>
                {lang === 'ta' ? 'காலியிடங்கள்' : 'Vacant Positions'}
              </span>
              <span className="text-3xl font-extrabold block mt-1 tracking-tight">
                {totalVacancy}
              </span>
              <span className="text-[10px] mt-1 block text-gray-400">
                {totalVacancy > 0 
                  ? (lang === 'ta' ? 'நிரப்பப்பட வேண்டிய பணியிடங்கள்' : 'Openings pending allocation')
                  : (lang === 'ta' ? 'காலியிடங்கள் ஏதுமில்லை' : 'No vacant positions')
                }
              </span>
            </div>
          </div>

          {/* Card 4: Utilization */}
          <div className="bg-[var(--theme-badge-bg)]/10 border border-[var(--theme-card-border)]/40 p-5 rounded-2xl hover:shadow-2xs transition space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold block tracking-tight uppercase" style={{ color: currentTheme.accentColor }}>
                {lang === 'ta' ? 'பணியாளர் நிலை' : 'Staffing Percentage'}
              </span>
              <span className="text-xs font-mono font-bold bg-[var(--theme-badge-bg)] text-[var(--theme-badge-text)] px-2.5 py-0.5 rounded-md">
                {filledPercentage}%
              </span>
            </div>
            
            <div className="space-y-1">
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${Math.min(100, filledPercentage)}%`,
                    backgroundColor: filledPercentage > 100 
                      ? '#f43f5e' 
                      : filledPercentage >= 80 
                        ? '#10b981' 
                        : filledPercentage >= 50 
                          ? currentTheme.accentColor 
                          : '#fbbf24'
                  }}
                />
              </div>
              <p className="text-[10px] text-gray-500 font-medium">
                {totalSurplus > 0 ? (
                  <span className="text-rose-500 font-semibold">
                    ⚠️ {totalSurplus} {lang === 'ta' ? 'அனுமதியை விட உபரி' : 'Surplus / Excess personnel'}
                  </span>
                ) : filledPercentage >= 100 ? (
                  <span className="text-emerald-600 font-semibold">✓ {lang === 'ta' ? 'முழுமையான பணியமர்வு' : 'Fully occupied strength'}</span>
                ) : (
                  <span>{lang === 'ta' ? 'பணியிட பயன்பாடு' : 'Capacity utilization rate'}</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Post-wise breakdown */}
        <div className="space-y-3.5 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Briefcase className="w-4 h-4" style={{ color: currentTheme.accentColor }} />
              {lang === 'ta' ? 'பதவி வாரியாக அனுமதி vs பணி நிலை ஒப்பீடு' : 'Designation-wise Strength Allocation & Vacancy Status'}
            </h4>
            <span className="text-[10px] text-gray-400 font-semibold italic">
              {lang === 'ta' ? 'நிரப்பப்பட்ட மற்றும் காலிப் பணியிட விபரங்கள்' : 'Detailed strength comparison across structured posts'}
            </span>
          </div>

          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <div className="overflow-x-auto scrollbar-custom max-h-[200px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="p-3 pl-4">{lang === 'ta' ? 'பதவி' : 'Post / Designation'}</th>
                    <th className="p-3 text-center">{lang === 'ta' ? 'அனுமதி' : 'Sanctioned'}</th>
                    <th className="p-3 text-center">{lang === 'ta' ? 'பணியில்' : 'In-Position'}</th>
                    <th className="p-3 text-center">{lang === 'ta' ? 'காலியிடம் / உபரி' : 'Status / Vacancies'}</th>
                    <th className="p-3 pr-4">{lang === 'ta' ? 'ஒதுக்கீடு வரைபடம்' : 'Strength Ratio'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs text-gray-600">
                  {posts.map((post: any) => {
                    const sanctioned = currentSanctionsMap[post.id] || 0;
                    const filled = currentFilledMap[post.id] || 0;
                    const diff = sanctioned - filled;
                    const vacancyVal = diff > 0 ? diff : 0;
                    const surplusVal = diff < 0 ? -diff : 0;
                    
                    const postPercentage = sanctioned > 0 ? Math.round((filled / sanctioned) * 100) : 0;
                    
                    if (sanctioned === 0 && filled === 0) return null;

                    return (
                      <tr key={post.id} className="hover:bg-slate-50/40 transition">
                        <td className="p-2.5 pl-4">
                          <p className="font-semibold text-gray-900">{tObj(post)}</p>
                          <p className="text-[9px] text-gray-400 font-mono mt-0.5">{post.code || post.id}</p>
                        </td>
                        <td className="p-2.5 text-center font-bold text-slate-800">{sanctioned}</td>
                        <td className="p-2.5 text-center font-bold" style={{ color: currentTheme.accentColor }}>{filled}</td>
                        <td className="p-2.5 text-center">
                          {vacancyVal > 0 ? (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 font-bold rounded-full text-[10px]">
                              {vacancyVal} {lang === 'ta' ? 'காலியிடம்' : 'Vacant'}
                            </span>
                          ) : surplusVal > 0 ? (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 font-bold rounded-full text-[10px]">
                              +{surplusVal} {lang === 'ta' ? 'உபரி' : 'Surplus'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded-full text-[10px]">
                              ✓ {lang === 'ta' ? 'நிரம்பியது' : 'Fully Staffed'}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 pr-4 min-w-[120px]">
                          <div className="flex items-center gap-2">
                            <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden shrink-0">
                              <div 
                                className="h-full rounded-full transition-all duration-300"
                                style={{ 
                                  width: `${Math.min(100, postPercentage)}%`,
                                  backgroundColor: postPercentage > 100 
                                    ? '#f43f5e' 
                                    : postPercentage === 100 
                                      ? '#10b981' 
                                      : postPercentage >= 50 
                                        ? currentTheme.accentColor 
                                        : '#fbbf24'
                                }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-gray-400 font-bold shrink-0">
                              {postPercentage}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Search Filter Widgets */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4 print:hidden">
        <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2 border-b border-gray-50 pb-2">
          <Filter className="w-5 h-5" style={{ color: currentTheme.accentColor }} />
          {t('filters')}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs text-gray-600">
          {/* Text search */}
          <div className="col-span-1 sm:col-span-2 md:col-span-1 relative">
            <label className="font-semibold text-gray-400 block mb-1">Search Keyword</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Name or Employee ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-gray-200 hover:border-gray-300 rounded-xl pl-9 pr-3 py-2.5 outline-none bg-white font-medium"
              />
            </div>
          </div>

          {/* Zone filter */}
          <div>
            <label className="font-semibold text-gray-400 block mb-1">{t('zone')}</label>
            <select
              value={filterZone}
              disabled={!!userZoneId}
              onChange={(e) => {
                if (userZoneId) return;
                setFilterZone(e.target.value);
                setFilterDistrict('');
                setFilterTP('');
              }}
              className={`w-full border rounded-xl p-2.5 outline-none font-medium ${
                userZoneId ? 'bg-slate-100 text-slate-700 border-slate-200 cursor-default' : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {!userZoneId && <option value="">{t('all')}</option>}
              {zones.filter((z: any) => !userZoneId || z.id === userZoneId || String(z.nameEn || '').toLowerCase() === String(userZoneId).toLowerCase()).map((z: any) => (
                <option key={z.id} value={z.id}>{tObj(z)}</option>
              ))}
            </select>
          </div>

          {/* District filter */}
          <div>
            <label className="font-semibold text-gray-400 block mb-1">{t('district')}</label>
            <select
              value={filterDistrict}
              disabled={!!userDistrictId}
              onChange={(e) => {
                if (userDistrictId) return;
                setFilterDistrict(e.target.value);
                setFilterTP('');
              }}
              className={`w-full border rounded-xl p-2.5 outline-none font-medium ${
                userDistrictId ? 'bg-slate-100 text-slate-700 border-slate-200 cursor-default' : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {!userDistrictId && <option value="">{t('all')}</option>}
              {districts.filter((d: any) => {
                if (userDistrictId) return d.id === userDistrictId || String(d.nameEn || '').toLowerCase() === String(userDistrictId).toLowerCase();
                const effZ = filterZone || userZoneId;
                if (effZ) return d.zoneId === effZ || String(d.zoneNameEn || '').toLowerCase() === String(effZ).toLowerCase();
                return true;
              }).map((d: any) => (
                <option key={d.id} value={d.id}>{tObj(d)}</option>
              ))}
            </select>
          </div>

          {/* TP Filter */}
          <div>
            <label className="font-semibold text-gray-400 block mb-1">{t('townPanchayat')}</label>
            <select
              value={filterTP}
              disabled={!!userTpId}
              onChange={(e) => {
                if (userTpId) return;
                setFilterTP(e.target.value);
              }}
              className={`w-full border rounded-xl p-2.5 outline-none font-medium ${
                userTpId ? 'bg-slate-100 text-slate-700 border-slate-200 cursor-default' : 'bg-white text-gray-700 border-gray-200'
              }`}
            >
              {!userTpId && <option value="">{t('all')}</option>}
              {townPanchayats.filter((tp: any) => {
                if (userTpId) return tp.id === userTpId || String(tp.nameEn || '').toLowerCase() === String(userTpId).toLowerCase();
                const effD = filterDistrict || userDistrictId;
                if (effD) return tp.districtId === effD || String(tp.districtNameEn || '').toLowerCase() === String(effD).toLowerCase();
                const effZ = filterZone || userZoneId;
                if (effZ) {
                  const d = districts.find((dist: any) => dist.id === tp.districtId);
                  return d && (d.zoneId === effZ || String(d.zoneNameEn || '').toLowerCase() === String(effZ).toLowerCase());
                }
                return true;
              }).map((tp: any) => (
                <option key={tp.id} value={tp.id}>{tObj(tp)}</option>
              ))}
            </select>
          </div>

          {/* Post Type / Title Filter */}
          <div>
            <label className="font-semibold text-gray-400 block mb-1">{lang === 'ta' ? 'பதவி வகை' : 'Post Type / Title'}</label>
            <select
              value={filterPost}
              onChange={(e) => setFilterPost(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-2.5 outline-none bg-white font-medium text-gray-700"
            >
              <option value="">{t('all')}</option>
              {posts.map((p: any) => (
                <option key={p.id} value={p.id}>{tObj(p)}</option>
              ))}
            </select>
          </div>

          {/* Group Filter */}
          <div>
            <label className="font-semibold text-gray-400 block mb-1">{t('group')}</label>
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-2.5 outline-none bg-white font-medium"
            >
              <option value="">{t('all')}</option>
              {employeeGroups.map((g: any) => (
                <option key={g.id} value={g.id}>{tObj(g)}</option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="font-semibold text-gray-400 block mb-1">{t('category')}</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-2.5 outline-none bg-white font-medium"
            >
              <option value="">{t('all')}</option>
              {employeeCategories.map((c: any) => (
                <option key={c.id} value={c.id}>{tObj(c)}</option>
              ))}
            </select>
          </div>

          {/* Nature filter */}
          <div>
            <label className="font-semibold text-gray-400 block mb-1">{t('nature')}</label>
            <select
              value={filterNature}
              onChange={(e) => setFilterNature(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-2.5 outline-none bg-white font-medium"
            >
              <option value="">{t('all')}</option>
              {postNatures.map((n: any) => (
                <option key={n.id} value={n.id}>{tObj(n)}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div>
            <label className="font-semibold text-gray-400 block mb-1">{t('status')}</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-xl p-2.5 outline-none bg-white font-medium"
            >
              <option value="">{t('all')}</option>
              <option value="Active">{t('activeStatus')}</option>
              <option value="Inactive">{t('inactiveStatus')}</option>
            </select>
          </div>
        </div>

        {/* Action button bar */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-50">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 hover:bg-gray-50 rounded-xl text-xs font-semibold text-gray-600 transition"
          >
            <Printer className="w-4 h-4 text-indigo-600" />
            {t('printReport')}
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-xs"
          >
            <Download className="w-4 h-4" />
            {t('exportCsv')}
          </button>
        </div>
      </div>

      {/* Reports Table Grid */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden print:border-none print:shadow-none">
        {/* Printable page header */}
        <div className="hidden print:block text-center space-y-2 p-6 border-b border-gray-200 mb-6">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">{t('appName')}</h1>
          <p className="text-sm text-gray-500 font-semibold">{t('tagline')}</p>
          <p className="text-xs font-mono text-gray-400 font-bold">Date generated: 2026-07-18 | Total Records: {sortedEmployees.length}</p>
        </div>

        <div className="p-5 border-b border-gray-50 flex justify-between items-center print:hidden">
          <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" />
            {lang === 'ta' ? 'ஊழியர் பதிவுகள் அறிக்கை' : 'Filtered Employee Census Registry'}
          </h3>
          <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded">
            {sortedEmployees.length} rows found
          </span>
        </div>

        <div className="overflow-x-auto scrollbar-custom w-full">
          <table className="w-full min-w-[1050px] text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider print:bg-gray-100">
                {renderSortHeader('employeeId', t('employeeId'))}
                {renderSortHeader('name', t('empName'))}
                {renderSortHeader('post', t('post'))}
                {renderSortHeader('townPanchayat', t('townPanchayat'))}
                {renderSortHeader('group', t('group'))}
                {renderSortHeader('category', t('category'))}
                {renderSortHeader('nature', t('nature'))}
                {renderSortHeader('status', t('status'))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-xs text-gray-600">
              {sortedEmployees.map((emp: any) => {
                const pst = posts.find((p: any) => p.id === emp.postId);
                const tp = townPanchayats.find((t: any) => t.id === emp.townPanchayatId);
                const cat = employeeCategories.find((c: any) => c.id === emp.categoryId);
                const nat = postNatures.find((n: any) => n.id === emp.postNatureId);

                return (
                  <tr key={emp.id} className="hover:bg-gray-50/50 transition">
                    <td className="p-4 pl-6 font-mono font-bold text-indigo-600">{emp.employeeId}</td>
                    <td className="p-4">
                      <p className="font-semibold text-gray-950">{emp.nameEn}</p>
                      <p className="text-gray-400 mt-0.5">{emp.nameTa}</p>
                    </td>
                    <td className="p-4 font-medium text-gray-500">{pst ? tObj(pst) : emp.postId}</td>
                    <td className="p-4 text-gray-500">{tp ? tObj(tp) : emp.townPanchayatId}</td>
                    <td className="p-4 font-mono font-bold text-gray-700">{emp.groupId}</td>
                    <td className="p-4 text-gray-500">{cat ? tObj(cat) : emp.categoryId}</td>
                    <td className="p-4 text-gray-500">{nat ? tObj(nat) : emp.postNatureId}</td>
                    <td className="p-4 pr-6">
                      <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                        emp.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {emp.status === 'Active' ? t('activeStatus') : t('inactiveStatus')}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {sortedEmployees.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-gray-400 italic">
                    {t('noData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
