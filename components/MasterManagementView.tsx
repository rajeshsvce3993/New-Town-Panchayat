'use client';
import ThemeSelect from './ThemeSelect';

import React, { useState, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { motion } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Download, 
  Upload, 
  MapPin, 
  Briefcase, 
  Grid,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Pencil,
  Layers,
  FolderTree,
  Users,
  X,
  Home,
  ChevronRight
} from 'lucide-react';
import { Language, translations } from './translations';

interface MasterManagementProps {
  state: any;
  lang: Language;
  onSaveCollection: (key: string, data: any[], skipCacheRebuild?: boolean) => Promise<void>;
  onDeleteCollectionItem?: (key: string, itemId: string) => Promise<void>;
}

export default function MasterManagementView({ state, lang, onSaveCollection, onDeleteCollectionItem }: MasterManagementProps) {
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'employee_masters'>('hierarchy');
  const [hierarchySubTab, setHierarchySubTab] = useState<'zone' | 'district' | 'tp' | 'ward_street'>('zone');

  const [hierarchyViewMode, setHierarchyViewMode] = useState<'cards' | 'table'>('cards');
  const [mastersViewMode, setMastersViewMode] = useState<'cards' | 'table'>('cards');
  const [hierarchySearch, setHierarchySearch] = useState('');
  const [hierarchyZoneFilter, setHierarchyZoneFilter] = useState('all');
  const [hierarchyDistrictFilter, setHierarchyDistrictFilter] = useState('all');
  const [hierarchyTpFilter, setHierarchyTpFilter] = useState('all');
  const [openZones, setOpenZones] = useState<Record<string, boolean>>({});
  const [openDistricts, setOpenDistricts] = useState<Record<string, boolean>>({});
  const [openTps, setOpenTps] = useState<Record<string, boolean>>({});
  const [openPostMasterSections, setOpenPostMasterSections] = useState<Record<string, boolean>>({});
  const [openPostMasterLists, setOpenPostMasterLists] = useState<Record<string, boolean>>({});
  const POST_MASTER_TONES: Record<string, string> = {
    pay: '#1d4ed8',
    category: '#0f766e',
    nature: '#c2410c',
    reason: '#7c3aed',
  };
  const ZONE_TONES = ['#1d4ed8', '#7c3aed', '#c2410c', '#0f766e', '#be185d', '#0369a1', '#b45309', '#4f46e5'];
  const DISTRICT_TONES = ['#0d9488', '#2563eb', '#d97706', '#db2777', '#059669', '#7c3aed', '#ea580c', '#0284c7'];

  const [mastersSearch, setMastersSearch] = useState('');
  const [mastersCategoryFilter, setMastersCategoryFilter] = useState('all');
  const [mastersNatureFilter, setMastersNatureFilter] = useState('all');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvFeedback, setCsvFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showTemplateGuide, setShowTemplateGuide] = useState(false);

  // Edit hierarchy modal states
  const [editingType, setEditingType] = useState<'zone' | 'district' | 'tp' | 'ward_street' | null>(null);
  const [editingId, setEditingId] = useState<string>('');
  const [editNameEn, setEditNameEn] = useState<string>('');
  const [editNameTa, setEditNameTa] = useState<string>('');
  const [editZoneId, setEditZoneId] = useState<string>('');
  const [editDistrictId, setEditDistrictId] = useState<string>('');
  const [editTpId, setEditTpId] = useState<string>('');
  const [editWardNo, setEditWardNo] = useState<string>('');
  const [editDistrictCode, setEditDistrictCode] = useState<string>('');
  const [editTpCode, setEditTpCode] = useState<string>('');

  // Forms states
  const [zoneEn, setZoneEn] = useState('');
  const [zoneTa, setZoneTa] = useState('');
  const [districtEn, setDistrictEn] = useState('');
  const [districtTa, setDistrictTa] = useState('');
  const [districtCode, setDistrictCode] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [tpEn, setTpEn] = useState('');
  const [tpTa, setTpTa] = useState('');
  const [tpCode, setTpCode] = useState('');
  const [selectedDistrictId, setSelectedDistrictId] = useState('');
  const [wardStreetTpId, setWardStreetTpId] = useState('');
  const [wardNo, setWardNo] = useState('');
  const [streetEn, setStreetEn] = useState('');
  const [streetTa, setStreetTa] = useState('');

  // Employee master form states
  const [postEn, setPostEn] = useState('');
  const [postTa, setPostTa] = useState('');
  const [postPayLevelId, setPostPayLevelId] = useState('');
  const [postNatureId, setPostNatureId] = useState('');
  const [postCategoryId, setPostCategoryId] = useState('');
  const [postGroupId, setPostGroupId] = useState('');
  const [groupEn, setGroupEn] = useState('');
  const [groupTa, setGroupTa] = useState('');
  const [categoryEn, setCategoryEn] = useState('');
  const [categoryTa, setCategoryTa] = useState('');
  const [natureEn, setNatureEn] = useState('');
  const [natureTa, setNatureTa] = useState('');
  const [payLevelEn, setPayLevelEn] = useState('');
  const [payLevelTa, setPayLevelTa] = useState('');
  const [minPay, setMinPay] = useState('');
  const [maxPay, setMaxPay] = useState('');
  const [transferReasonEn, setTransferReasonEn] = useState('');
  const [transferReasonTa, setTransferReasonTa] = useState('');

  const t = (key: keyof typeof translations['en']) => {
    return translations[lang][key] || translations['en'][key] || key;
  };

  const tObj = (obj: any) => {
    if (!obj) return '';
    return lang === 'ta' ? (obj.nameTa || obj.nameEn) : (obj.nameEn || obj.nameTa);
  };

  const groupStreetsByWard = (items: any[]) => {
    const map = new Map<string, any[]>();
    items.forEach((ws: any) => {
      const key = String(ws.wardNo ?? '');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ws);
    });
    return [...map.entries()].sort((a, b) => {
      const na = parseInt(String(a[0]).replace(/\D/g, ''), 10);
      const nb = parseInt(String(b[0]).replace(/\D/g, ''), 10);
      if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
      return String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true });
    });
  };

  const {
    zones = [],
    districts = [],
    townPanchayats = [],
    wardsAndStreets = [],
    employeeGroups = [],
    employeeCategories = [],
    postNatures = [],
    payLevels = [],
    posts = [],
    transferReasons = []
  } = state || {};

  // Handlers for Town Panchayat Hierarchy
  const handleAddZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneEn || !zoneTa) return;
    const newZone = {
      id: 'z' + (zones.length + 1) + '_' + Math.random().toString(36).substr(2, 4),
      nameEn: zoneEn,
      nameTa: zoneTa
    };
    await onSaveCollection('zones', [...zones, newZone]);
    setZoneEn('');
    setZoneTa('');
  };

  // Helper to suggest next 2-digit district code across districts
  const getNextDistrictCode = () => {
    const numericCodes = (districts || [])
      .map((d: any) => parseInt(d.code, 10))
      .filter((n: number) => !isNaN(n) && n > 0);
    const max = numericCodes.length > 0 ? Math.max(...numericCodes) : 0;
    return String(max + 1).padStart(2, '0');
  };

  // Helper to suggest next 2-digit TP code starting from 01 for each district
  const getNextTpCode = (distId: string) => {
    if (!distId) return '01';
    const tpsInDistrict = (townPanchayats || []).filter((t: any) => t.districtId === distId);
    const numericCodes = tpsInDistrict
      .map((t: any) => parseInt(t.code, 10))
      .filter((n: number) => !isNaN(n) && n > 0);
    const max = numericCodes.length > 0 ? Math.max(...numericCodes) : 0;
    return String(max + 1).padStart(2, '0');
  };

  const handleAddDistrict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!districtEn || !districtTa || !selectedZoneId) return;
    const finalCode = (districtCode.trim() || getNextDistrictCode()).padStart(2, '0');
    const newDistrict = {
      id: 'd' + (districts.length + 1) + '_' + Math.random().toString(36).substr(2, 4),
      zoneId: selectedZoneId,
      nameEn: districtEn,
      nameTa: districtTa,
      code: finalCode
    };
    await onSaveCollection('districts', [...districts, newDistrict]);
    setDistrictEn('');
    setDistrictTa('');
    setDistrictCode('');
  };

  const handleAddTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tpEn || !tpTa || !selectedDistrictId) return;
    const finalCode = (tpCode.trim() || getNextTpCode(selectedDistrictId)).padStart(2, '0');
    const newTP = {
      id: 'tp' + (townPanchayats.length + 1) + '_' + Math.random().toString(36).substr(2, 4),
      districtId: selectedDistrictId,
      nameEn: tpEn,
      nameTa: tpTa,
      code: finalCode
    };
    await onSaveCollection('townPanchayats', [...townPanchayats, newTP]);
    setTpEn('');
    setTpTa('');
    setTpCode('');
  };

  const handleAddWardAndStreet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wardStreetTpId || !wardNo || !streetEn || !streetTa) return;
    const newWs = {
      id: 'ws_' + Math.random().toString(36).substr(2, 6),
      tpId: wardStreetTpId,
      wardNo: wardNo.trim(),
      streetNameEn: streetEn.trim(),
      streetNameTa: streetTa.trim()
    };
    await onSaveCollection('wardsAndStreets', [...wardsAndStreets, newWs]);
    setStreetEn('');
    setStreetTa('');
  };

  // Handlers for Employee Masters
  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupEn || !groupTa) return;
    const newGroup = {
      id: groupEn.toUpperCase(),
      nameEn: `Group ${groupEn.toUpperCase()}`,
      nameTa: `குழு ${groupTa}`
    };
    await onSaveCollection('employeeGroups', [...employeeGroups, newGroup]);
    setGroupEn('');
    setGroupTa('');
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryEn || !categoryTa) return;
    const newCategory = {
      id: categoryEn.toLowerCase().replace(/\s+/g, '_'),
      nameEn: categoryEn,
      nameTa: categoryTa
    };
    await onSaveCollection('employeeCategories', [...employeeCategories, newCategory]);
    setCategoryEn('');
    setCategoryTa('');
  };

  const handleAddNature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!natureEn || !natureTa) return;
    const newNature = {
      id: natureEn.toLowerCase().replace(/\s+/g, '_'),
      nameEn: natureEn,
      nameTa: natureTa
    };
    await onSaveCollection('postNatures', [...postNatures, newNature]);
    setNatureEn('');
    setNatureTa('');
  };

  const handleAddTransferReason = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!transferReasonEn || !transferReasonTa) return;
    const newReason = {
      id: 'tr_reason_' + Math.random().toString(36).substr(2, 4),
      nameEn: transferReasonEn,
      nameTa: transferReasonTa
    };
    await onSaveCollection('transferReasons', [...transferReasons, newReason]);
    setTransferReasonEn('');
    setTransferReasonTa('');
  };

  const handleAddPayLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payLevelEn || !payLevelTa || !minPay || !maxPay) return;
    const newPay = {
      id: 'pb_' + Math.random().toString(36).substr(2, 4),
      nameEn: `${payLevelEn} (${minPay} - ${maxPay})`,
      nameTa: `${payLevelTa} (${minPay} - ${maxPay})`,
      minPay: parseInt(minPay),
      maxPay: parseInt(maxPay)
    };
    await onSaveCollection('payLevels', [...payLevels, newPay]);
    setPayLevelEn('');
    setPayLevelTa('');
    setMinPay('');
    setMaxPay('');
  };

  const handleAddPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postEn || !postTa) return;
    const newPost = {
      id: postEn.toLowerCase().replace(/\s+/g, '_'),
      nameEn: postEn,
      nameTa: postTa,
      payLevelId: postPayLevelId || undefined,
      postNatureId: postNatureId || undefined,
      categoryId: postCategoryId || undefined,
      groupId: postGroupId || undefined
    };
    await onSaveCollection('posts', [...posts, newPost]);
    setPostEn('');
    setPostTa('');
    setPostPayLevelId('');
    setPostNatureId('');
    setPostCategoryId('');
    setPostGroupId('');
  };

  // Delete helpers
  const handleDeleteMasterItem = async (collectionKey: string, itemId: string) => {
    const geoKeys = ['zones', 'districts', 'townPanchayats', 'wardsAndStreets'];
    if (onDeleteCollectionItem && geoKeys.includes(collectionKey)) {
      await onDeleteCollectionItem(collectionKey, itemId);
      return;
    }
    const currentList = state[collectionKey] || [];
    const updated = currentList.filter((item: any) => item.id !== itemId);
    if (geoKeys.includes(collectionKey) && updated.length === 0) return;
    await onSaveCollection(collectionKey, updated);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editNameEn || !editNameTa) return;

    if (editingType === 'zone') {
      const updatedZones = zones.map((z: any) => 
        z.id === editingId ? { ...z, nameEn: editNameEn, nameTa: editNameTa } : z
      );
      await onSaveCollection('zones', updatedZones);
    } else if (editingType === 'district') {
      const updatedDistricts = districts.map((d: any) => 
        d.id === editingId ? { ...d, nameEn: editNameEn, nameTa: editNameTa, zoneId: editZoneId, code: editDistrictCode.replace(/\D/g, '').padStart(2, '0') } : d
      );
      await onSaveCollection('districts', updatedDistricts);
    } else if (editingType === 'tp') {
      const updatedTPs = townPanchayats.map((tp: any) => 
        tp.id === editingId ? { ...tp, nameEn: editNameEn, nameTa: editNameTa, districtId: editDistrictId, code: editTpCode.replace(/\D/g, '').padStart(2, '0') } : tp
      );
      await onSaveCollection('townPanchayats', updatedTPs);
    } else if (editingType === 'ward_street') {
      const updatedWs = wardsAndStreets.map((ws: any) =>
        ws.id === editingId ? { ...ws, streetNameEn: editNameEn, streetNameTa: editNameTa, wardNo: editWardNo, tpId: editTpId } : ws
      );
      await onSaveCollection('wardsAndStreets', updatedWs);
    }

    setEditingType(null);
    setEditingId('');
    setEditNameEn('');
    setEditNameTa('');
    setEditZoneId('');
    setEditDistrictId('');
    setEditTpId('');
    setEditWardNo('');
    setEditDistrictCode('');
    setEditTpCode('');
  };

  // CSV Template Generation with BOTH languages for all 5 levels (Zone, District, TP, Ward, Street)
  const downloadHierarchyTemplate = () => {
    const rows: string[] = [
      "ZoneNameEn,ZoneNameTa,DistrictCode,DistrictNameEn,DistrictNameTa,TownPanchayatCode,TownPanchayatNameEn,TownPanchayatNameTa,WardNo,StreetNameEn,StreetNameTa"
    ];

    if (townPanchayats && townPanchayats.length > 0) {
      townPanchayats.forEach((tp: any) => {
        const dist = districts.find((d: any) => d.id === tp.districtId);
        const zone = zones.find((z: any) => z.id === (dist?.zoneId || tp.zoneId));
        const zEn = zone?.nameEn || 'Kanchipuram';
        const zTa = zone?.nameTa || 'காஞ்சிபுரம்';
        const dCode = dist?.code || '01';
        const dEn = dist?.nameEn || 'Thiruvallur';
        const dTa = dist?.nameTa || 'திருவள்ளூர்';
        const tpCode = tp?.code || '01';
        const tpEn = tp?.nameEn || 'Thirumazhisai';
        const tpTa = tp?.nameTa || 'திருமழிசை';

        const tpStreets = (wardsAndStreets || []).filter((ws: any) => ws.tpId === tp.id || ws.townPanchayatId === tp.id);
        if (tpStreets.length > 0) {
          tpStreets.forEach((ws: any) => {
            const wNo = String(ws.wardNo || '1').trim();
            const sEn = ws.streetNameEn || 'Bazaar Street';
            const sTa = ws.streetNameTa || ws.streetNameEn || 'பஜார் தெரு';
            rows.push(`"${zEn}","${zTa}","${dCode}","${dEn}","${dTa}","${tpCode}","${tpEn}","${tpTa}","${wNo}","${sEn}","${sTa}"`);
          });
        } else {
          rows.push(`"${zEn}","${zTa}","${dCode}","${dEn}","${dTa}","${tpCode}","${tpEn}","${tpTa}","1","Bazaar Street","பஜார் தெரு"`);
          rows.push(`"${zEn}","${zTa}","${dCode}","${dEn}","${dTa}","${tpCode}","${tpEn}","${tpTa}","2","Gandhi Street","காந்தி தெரு"`);
        }
      });
    } else {
      // Clean blank state sample rows with BOTH languages and Tamil "வார்டு 1" compatible WardNo
      rows.push(`"Chennai Zone","சென்னை மண்டலம்","01","Thiruvallur","திருவள்ளூர்","01","Thirumazhisai","திருமழிசை","1","Bazaar Street","பஜார் தெரு"`);
      rows.push(`"Chennai Zone","சென்னை மண்டலம்","01","Thiruvallur","திருவள்ளூர்","01","Thirumazhisai","திருமழிசை","2","Gandhi Street","காந்தி தெரு"`);
      rows.push(`"Chennai Zone","சென்னை மண்டலம்","01","Thiruvallur","திருவள்ளூர்","01","Thirumazhisai","திருமழிசை","வார்டு 1","Anna Street","அண்ணா தெரு"`);
    }

    const csvContent = "\uFEFF" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "TownPanchayat_Hierarchy_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadEmployeeMastersTemplate = () => {
    const csvContent = "\uFEFFPostNameEn,PostNameTa,GroupName,CategoryNameEn,CategoryNameTa,PostNatureNameEn,PostNatureNameTa,PayLevelEn,PayLevelTa,MinPay,MaxPay\nExecutive Officer,செயல் அலுவலர்,B,Administration,நிர்வாகம்,Provincialised,மாநில அளவிலானது,PB 2,பிபி 2,20600,65500";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Employee_Masters_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // CSV Parsing and Upload
  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        let text = (e.target?.result as string) || '';
        if (text.charCodeAt(0) === 0xFEFF) {
          text = text.slice(1);
        }
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l);
        if (lines.length <= 1) {
          setCsvFeedback({ type: 'error', message: 'The CSV file is empty or missing data rows.' });
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const normHeaders = headers.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

        if (activeTab === 'hierarchy') {
          // Parsing hierarchy with flexible header detection — merge into existing records, never replace/wipe
          const uploadedZones: any[] = [...zones];
          const uploadedDistricts: any[] = [...districts];
          const uploadedTPs: any[] = [...townPanchayats];
          const uploadedWardsAndStreets: any[] = [...wardsAndStreets];

          // Locate columns by name or fallback to index
          const hasCustomHeaders = normHeaders.some(h => h.includes('districtcode') || h.includes('tpcode') || h.includes('townpanchayatcode'));
          
          const zEnIdx = normHeaders.findIndex(h => h === 'zonenameen' || h === 'zoneen' || h === 'zone');
          const zTaIdx = normHeaders.findIndex(h => h === 'zonenameta' || h === 'zoneta');
          const dCodeIdx = normHeaders.findIndex(h => h === 'districtcode' || h === 'distcode' || h === 'dcode');
          const dEnIdx = normHeaders.findIndex(h => h === 'districtnameen' || h === 'districten' || h === 'district');
          const dTaIdx = normHeaders.findIndex(h => h === 'districtnameta' || h === 'districtta');
          const tpCodeIdx = normHeaders.findIndex(h => h === 'townpanchayatcode' || h === 'tpcode' || h === 'panchayatcode');
          const tEnIdx = normHeaders.findIndex(h => h === 'townpanchayatnameen' || h === 'tpnameen' || h === 'townpanchayaten' || h === 'townpanchayat' || h === 'tp');
          const tTaIdx = normHeaders.findIndex(h => h === 'townpanchayatnameta' || h === 'tpnameta' || h === 'townpanchayatta');
          const wardIdx = normHeaders.findIndex(h => h === 'wardno' || h === 'wardnumber' || h === 'ward');
          const sEnIdx = normHeaders.findIndex(h => h === 'streetnameen' || h === 'streeten' || h === 'street');
          const sTaIdx = normHeaders.findIndex(h => h === 'streetnameta' || h === 'streetta');

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length < 4) continue;

            let zEn = '';
            let zTa = '';
            let rawDCode = '';
            let dEn = '';
            let dTa = '';
            let rawTpCode = '';
            let tEn = '';
            let tTa = '';
            let wardNum = '';
            let sEn = '';
            let sTa = '';

            if (hasCustomHeaders || dCodeIdx !== -1 || tpCodeIdx !== -1) {
              zEn = zEnIdx >= 0 ? values[zEnIdx] || '' : values[0] || '';
              zTa = zTaIdx >= 0 ? values[zTaIdx] || '' : values[1] || '';
              rawDCode = dCodeIdx >= 0 ? values[dCodeIdx] || '' : '';
              dEn = dEnIdx >= 0 ? values[dEnIdx] || '' : '';
              dTa = dTaIdx >= 0 ? values[dTaIdx] || '' : '';
              rawTpCode = tpCodeIdx >= 0 ? values[tpCodeIdx] || '' : '';
              tEn = tEnIdx >= 0 ? values[tEnIdx] || '' : '';
              tTa = tTaIdx >= 0 ? values[tTaIdx] || '' : '';
              wardNum = wardIdx >= 0 ? values[wardIdx] || '' : '';
              sEn = sEnIdx >= 0 ? values[sEnIdx] || '' : '';
              sTa = sTaIdx >= 0 ? values[sTaIdx] || '' : '';
            } else if (values.length >= 11) {
              // 11-column standard: ZoneEn, ZoneTa, DistrictCode, DistrictEn, DistrictTa, TPCode, TPEn, TPTa, WardNo, StreetEn, StreetTa
              [zEn, zTa, rawDCode, dEn, dTa, rawTpCode, tEn, tTa, wardNum, sEn, sTa] = values;
            } else {
              // Legacy 9-column format
              [zEn, zTa, dEn, dTa, tEn, tTa, wardNum, sEn, sTa] = values;
            }

            if (!zEn || !dEn || !tEn) continue;

            // 1. Find or create Zone
            let zObj = uploadedZones.find(z => z.nameEn.toLowerCase() === zEn.toLowerCase());
            if (!zObj) {
              zObj = { id: 'z_csv_' + Math.random().toString(36).substr(2, 4), nameEn: zEn, nameTa: zTa || zEn };
              uploadedZones.push(zObj);
            }

            // 2. Format / calculate manual District Code
            let formattedDCode = '';
            if (rawDCode) {
              const digits = rawDCode.replace(/\D/g, '');
              if (digits) formattedDCode = digits.padStart(2, '0');
            }

            // Find or create District
            let dObj = uploadedDistricts.find(d => d.nameEn.toLowerCase() === dEn.toLowerCase() && d.zoneId === zObj.id);
            if (!dObj) {
              const assignedCode = formattedDCode || getNextDistrictCode();
              dObj = {
                id: 'd_csv_' + Math.random().toString(36).substr(2, 4),
                zoneId: zObj.id,
                nameEn: dEn,
                nameTa: dTa || dEn,
                code: assignedCode
              };
              uploadedDistricts.push(dObj);
            } else if (formattedDCode && (!dObj.code || dObj.code !== formattedDCode)) {
              // Update existing district code if specified in CSV
              dObj.code = formattedDCode;
            }

            // 3. Format / calculate manual Town Panchayat Code (starts from 01 per district)
            let formattedTpCode = '';
            if (rawTpCode) {
              const digits = rawTpCode.replace(/\D/g, '');
              if (digits) formattedTpCode = digits.padStart(2, '0');
            }

            // Find or create TP
            let tpObj = uploadedTPs.find(tp => tp.nameEn.toLowerCase() === tEn.toLowerCase() && tp.districtId === dObj.id);
            if (!tpObj) {
              const assignedTpCode = formattedTpCode || getNextTpCode(dObj.id);
              tpObj = {
                id: 'tp_csv_' + Math.random().toString(36).substr(2, 4),
                districtId: dObj.id,
                nameEn: tEn,
                nameTa: tTa || tEn,
                code: assignedTpCode
              };
              uploadedTPs.push(tpObj);
            } else if (formattedTpCode && (!tpObj.code || tpObj.code !== formattedTpCode)) {
              // Update existing TP code if specified in CSV
              tpObj.code = formattedTpCode;
            }

            // 4. If Ward and Street provided
            if (wardNum && (sEn || sTa)) {
              const rawWard = String(wardNum).trim();
              const wardDigits = rawWard.replace(/[^0-9]/g, '');
              const cleanWardNum = wardDigits ? String(parseInt(wardDigits, 10)) : rawWard;
              const streetEnName = sEn || sTa || '';
              const streetTaName = sTa || sEn || '';

              const existingWs = uploadedWardsAndStreets.find(ws => 
                ws.tpId === tpObj!.id && 
                (ws.wardNo === cleanWardNum || ws.wardNo === rawWard) && 
                (ws.streetNameEn.toLowerCase() === streetEnName.toLowerCase() || (streetTaName && ws.streetNameTa?.toLowerCase() === streetTaName.toLowerCase()))
              );
              if (!existingWs) {
                uploadedWardsAndStreets.push({
                  id: 'ws_csv_' + Math.random().toString(36).substr(2, 6),
                  tpId: tpObj.id,
                  wardNo: cleanWardNum,
                  wardNameEn: `Ward ${cleanWardNum}`,
                  wardNameTa: `வார்டு ${cleanWardNum}`,
                  streetNameEn: streetEnName,
                  streetNameTa: streetTaName
                });
              }
            }
          }

          await onSaveCollection('zones', uploadedZones, true);
          await onSaveCollection('districts', uploadedDistricts, true);
          await onSaveCollection('townPanchayats', uploadedTPs, true);
          await onSaveCollection('wardsAndStreets', uploadedWardsAndStreets, false);
          setCsvFeedback({ 
            type: 'success', 
            message: lang === 'ta'
              ? 'படிநிலை CSV வெற்றிகரமாக பதிவேற்றப்பட்டது! மண்டலங்கள், மாவட்டங்கள் (Manual Code உடன்), பேரூராட்சிகள் (Manual Code உடன்) மற்றும் வார்டு/தெருக்கள் புதுப்பிக்கப்பட்டன.'
              : 'Hierarchy CSV imported successfully! Zones, Districts (with Codes), Town Panchayats (with Codes starting from 01), and Wards/Streets updated.' 
          });
        } else {
          // Parsing employee masters
          const uploadedPosts = [...posts];
          const uploadedGroups = [...employeeGroups];
          const uploadedCats = [...employeeCategories];
          const uploadedNatures = [...postNatures];
          const uploadedPays = [...payLevels];

          for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length < 11) continue;

            const [pEn, pTa, grp, cEn, cTa, nEn, nTa, payEn, payTa, minP, maxP] = values;

            // Post
            if (pEn && !uploadedPosts.some(p => p.nameEn.toLowerCase() === pEn.toLowerCase())) {
              uploadedPosts.push({ id: pEn.toLowerCase().replace(/\s+/g, '_'), nameEn: pEn, nameTa: pTa });
            }
            // Group
            if (grp && !uploadedGroups.some(g => g.id === grp.toUpperCase())) {
              uploadedGroups.push({ id: grp.toUpperCase(), nameEn: `Group ${grp.toUpperCase()}`, nameTa: `குழு ${grp.toUpperCase()}` });
            }
            // Category
            if (cEn && !uploadedCats.some(c => c.nameEn.toLowerCase() === cEn.toLowerCase())) {
              uploadedCats.push({ id: cEn.toLowerCase().replace(/\s+/g, '_'), nameEn: cEn, nameTa: cTa });
            }
            // Nature
            if (nEn && !uploadedNatures.some(n => n.nameEn.toLowerCase() === nEn.toLowerCase())) {
              uploadedNatures.push({ id: nEn.toLowerCase().replace(/\s+/g, '_'), nameEn: nEn, nameTa: nTa });
            }
            // Pay level
            if (payEn && !uploadedPays.some(py => py.nameEn.includes(payEn))) {
              uploadedPays.push({
                id: 'pb_csv_' + Math.random().toString(36).substr(2, 4),
                nameEn: `${payEn} (${minP} - ${maxP})`,
                nameTa: `${payTa} (${minP} - ${maxP})`,
                minPay: parseInt(minP) || 15000,
                maxPay: parseInt(maxP) || 50000
              });
            }
          }

          await onSaveCollection('posts', uploadedPosts);
          await onSaveCollection('employeeGroups', uploadedGroups);
          await onSaveCollection('employeeCategories', uploadedCats);
          await onSaveCollection('postNatures', uploadedNatures);
          await onSaveCollection('payLevels', uploadedPays);
          setCsvFeedback({ type: 'success', message: 'Employee Masters CSV imported successfully! Created posts, groups, categories, natures, and pay levels.' });
        }
      } catch (err: any) {
        setCsvFeedback({ type: 'error', message: 'Error parsing CSV file. Please make sure the format is correct.' });
      }
    };
    reader.readAsText(file, 'UTF-8');
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div id="master-management-container" className="portal-studio">
      <div className="portal-fis-hero">
        <div className="relative z-[1] flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/20">
            <Layers className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 leading-tight">
            <h3 className="text-[14px] font-semibold tracking-tight text-white">
              {t('masterManagement')}
            </h3>
            <p className="text-[10px] text-white/70">
              {lang === 'ta'
                ? 'மாதிரி CSV கோப்பைப் பதிவிறக்கி உங்கள் தரவை உள்ளிட்டுப் பதிவேற்றவும்.'
                : 'Download our standard format, input your master registry rows, and upload to populate the DB.'}
            </p>
          </div>
        </div>

        <div className="relative z-[1] flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={activeTab === 'hierarchy' ? downloadHierarchyTemplate : downloadEmployeeMastersTemplate}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/15 cursor-pointer"
          >
            <Download className="h-3 w-3" />
            {lang === 'ta' ? 'மாதிரி படிவம் (CSV)' : 'Template (CSV)'}
          </button>

          <button
            type="button"
            onClick={() => setShowTemplateGuide(!showTemplateGuide)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/15 cursor-pointer"
          >
            <FileSpreadsheet className="h-3 w-3" />
            {showTemplateGuide
              ? (lang === 'ta' ? 'வழிகாட்டியை மறை' : 'Hide Format Guide')
              : (lang === 'ta' ? 'மாதிரி வழிகாட்டி' : 'View Format Guide')}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white shadow-md hover:brightness-110 cursor-pointer"
            style={{ background: 'var(--theme-accent)' }}
          >
            <Upload className="h-3 w-3" />
            {lang === 'ta' ? 'பல்க் பதிவேற்றம்' : 'Bulk CSV Upload'}
          </button>

          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            onChange={handleCsvUpload}
            className="hidden"
          />
        </div>
      </div>

      <div className="portal-fis-body portal-page">
      {showTemplateGuide && activeTab === 'hierarchy' && (
        <div className="portal-dashboard-panel">
          <div className="portal-dash-head">
            <div>
              <h3>
                <span className="portal-dash-icon">
                  <FileSpreadsheet className="h-3 w-3" />
                </span>
                {lang === 'ta' ? 'படிநிலை மாதிரி CSV கட்டமைப்பு (இருமொழி & Manual Code ஆதரவு)' : 'Hierarchy Model CSV Template (Bilingual & Manual Codes)'}
              </h3>
              <p>
                {lang === 'ta'
                  ? 'மண்டலம், மாவட்டம், பேரூராட்சி, வார்டு மற்றும் தெருக்கள் அனைத்தும் ஆங்கிலம் மற்றும் தமிழ் இருமொழிகளிலும் பதிவேற்றப்பட வேண்டும்.'
                  : 'Zone, District, Town Panchayat, Ward, and Street all require both English and Tamil names.'}
              </p>
            </div>
            <button
              type="button"
              onClick={downloadHierarchyTemplate}
              className="portal-dash-head-action"
            >
              <Download className="h-3 w-3" />
              <span>{lang === 'ta' ? 'மாதிரி டெம்ப்ளேட் பதிவிறக்கு (CSV)' : 'Download Model Template (CSV)'}</span>
            </button>
          </div>
          <div className="portal-dash-body">
            <div className="portal-dash-table">
              <table>
                <thead>
                  <tr>
                    <th>ZoneNameEn</th>
                    <th>ZoneNameTa</th>
                    <th>DistrictCode</th>
                    <th>DistrictNameEn</th>
                    <th>DistrictNameTa</th>
                    <th>TownPanchayatCode</th>
                    <th>TownPanchayatNameEn</th>
                    <th>TownPanchayatNameTa</th>
                    <th>WardNo</th>
                    <th>StreetNameEn</th>
                    <th>StreetNameTa</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Kanchipuram</td>
                    <td>காஞ்சிபுரம்</td>
                    <td className="portal-dash-id">01</td>
                    <td>Thiruvallur</td>
                    <td>திருவள்ளூர்</td>
                    <td className="portal-dash-id">01</td>
                    <td>Thirumazhisai</td>
                    <td>திருமழிசை</td>
                    <td className="portal-dash-id">1</td>
                    <td>Bazaar Street</td>
                    <td>பஜார் தெரு</td>
                  </tr>
                  <tr>
                    <td>Kanchipuram</td>
                    <td>காஞ்சிபுரம்</td>
                    <td className="portal-dash-id">01</td>
                    <td>Thiruvallur</td>
                    <td>திருவள்ளூர்</td>
                    <td className="portal-dash-id">01</td>
                    <td>Thirumazhisai</td>
                    <td>திருமழிசை</td>
                    <td className="portal-dash-id">2</td>
                    <td>Gandhi Street</td>
                    <td>காந்தி தெரு</td>
                  </tr>
                  <tr>
                    <td>Kanchipuram</td>
                    <td>காஞ்சிபுரம்</td>
                    <td className="portal-dash-id">01</td>
                    <td>Thiruvallur</td>
                    <td>திருவள்ளூர்</td>
                    <td className="portal-dash-id">02</td>
                    <td>Arani</td>
                    <td>ஆரணி</td>
                    <td className="portal-dash-id">1</td>
                    <td>Sannathi Street</td>
                    <td>சன்னதி தெரு</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-500 pt-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                <strong>DistrictCode:</strong> {lang === 'ta' ? 'மாநில அளவிலான 2-இலக்க மாவட்ட எண் (எ.கா. 01, 02, 03)' : '2-digit district code across state (e.g. 01, 02, 03)'}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <strong>TownPanchayatCode:</strong> {lang === 'ta' ? 'ஒவ்வொரு மாவட்டத்திலும் 01 முதல் தொடங்கும் (எ.கா. 01, 02...)' : 'Starts from 01 for each district (e.g. 01, 02...)'}
              </span>
            </div>
          </div>
        </div>
      )}

      {csvFeedback && (
        <div className={`p-3 rounded-xl border flex items-start gap-3 ${csvFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
          {csvFeedback.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
          <p className="text-xs font-medium">{csvFeedback.message}</p>
        </div>
      )}

      <div className="portal-dash-toolbar">
        <div className="portal-dash-pills">
          <button
            type="button"
            onClick={() => { setActiveTab('hierarchy'); setCsvFeedback(null); }}
            className={`portal-dash-pill ${activeTab === 'hierarchy' ? 'is-active' : ''}`}
          >
            <FolderTree className="h-3.5 w-3.5" />
            <span>{t('tpTabs')}</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('employee_masters'); setCsvFeedback(null); }}
            className={`portal-dash-pill ${activeTab === 'employee_masters' ? 'is-active' : ''}`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>{t('employeeTabs')}</span>
          </button>
        </div>
      </div>

      {activeTab === 'hierarchy' ? (
        <div className="portal-wt-grid">
          <div className="portal-dashboard-panel">
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <Plus className="h-3 w-3" />
                  </span>
                  {hierarchySubTab === 'zone'
                    ? (lang === 'ta' ? 'புதிய மண்டலம் உருவாக்கு' : 'Create New Zone')
                    : hierarchySubTab === 'district'
                      ? (lang === 'ta' ? 'புதிய மாவட்டம் உருவாக்கு' : 'Create New District')
                      : hierarchySubTab === 'tp'
                        ? (lang === 'ta' ? 'புதிய பேரூராட்சி உருவாக்கு' : 'Create New Town Panchayat')
                        : (lang === 'ta' ? 'புதிய வார்டு & தெரு உருவாக்கு' : 'Create New Ward & Street')}
                </h3>
              </div>
            </div>
            <div className="portal-dash-body portal-wt-form">
              <div className="portal-dash-pills">
                <button
                  type="button"
                  onClick={() => setHierarchySubTab('zone')}
                  className={`portal-dash-pill ${hierarchySubTab === 'zone' ? 'is-active' : ''}`}
                >
                  <MapPin className="h-3.5 w-3.5" />
                  <span>{lang === 'ta' ? 'மண்டலம்' : 'Zone'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHierarchySubTab('district')}
                  className={`portal-dash-pill ${hierarchySubTab === 'district' ? 'is-active' : ''}`}
                >
                  <Grid className="h-3.5 w-3.5" />
                  <span>{lang === 'ta' ? 'மாவட்டம்' : 'District'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHierarchySubTab('tp')}
                  className={`portal-dash-pill ${hierarchySubTab === 'tp' ? 'is-active' : ''}`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>{lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHierarchySubTab('ward_street')}
                  className={`portal-dash-pill ${hierarchySubTab === 'ward_street' ? 'is-active' : ''}`}
                >
                  <Home className="h-3.5 w-3.5" />
                  <span>{lang === 'ta' ? 'வார்டு & தெரு' : 'Ward & Street'}</span>
                </button>
              </div>
              {hierarchySubTab === 'zone' && (
                <form onSubmit={handleAddZone} className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <label>{t('zoneNameEn')}</label>
                      <input
                        type="text"
                        value={zoneEn}
                        onChange={(e) => setZoneEn(e.target.value)}
                        placeholder="e.g. Kanchipuram"
                        required
                      />
                    </div>
                    <div>
                      <label>{t('zoneNameTa')}</label>
                      <input
                        type="text"
                        value={zoneTa}
                        onChange={(e) => setZoneTa(e.target.value)}
                        placeholder="எ.கா. காஞ்சிபுரம்"
                        required
                      />
                    </div>
                  </div>
                  <button type="submit">
                    <Plus className="h-3.5 w-3.5" />
                    {lang === 'ta' ? 'மண்டலத்தை சேர்' : 'Add Zone'}
                  </button>
                </form>
              )}

              {hierarchySubTab === 'district' && (
                <form onSubmit={handleAddDistrict} className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <label>{t('selectZone')}</label>
                      <ThemeSelect
                        value={selectedZoneId}
                        onChange={(e) => setSelectedZoneId(e.target.value)}
                        required
                      >
                        <option value="">-- Choose Zone --</option>
                        {zones.map((z: any) => (
                          <option key={z.id} value={z.id}>{tObj(z)}</option>
                        ))}
                      </ThemeSelect>
                    </div>
                    <div>
                      <label>{t('districtNameEn')}</label>
                      <input
                        type="text"
                        value={districtEn}
                        onChange={(e) => setDistrictEn(e.target.value)}
                        placeholder="e.g. Chengalpattu"
                        required
                      />
                    </div>
                    <div>
                      <label>{t('districtNameTa')}</label>
                      <input
                        type="text"
                        value={districtTa}
                        onChange={(e) => setDistrictTa(e.target.value)}
                        placeholder="எ.கா. செங்கல்பட்டு"
                        required
                      />
                    </div>
                    <div>
                      <label>{lang === 'ta' ? 'மாவட்ட குறியீடு (2 இலக்கம்)' : 'District Code (2-digit)'}</label>
                      <input
                        type="text"
                        maxLength={2}
                        value={districtCode}
                        onChange={(e) => setDistrictCode(e.target.value.replace(/\D/g, ''))}
                        placeholder={getNextDistrictCode()}
                      />
                      <span className="text-[10px] text-gray-400 mt-0.5 block">
                        {lang === 'ta' ? `தானியங்கி குறியீடு: ${getNextDistrictCode()}` : `Auto code suggested: ${getNextDistrictCode()}`}
                      </span>
                    </div>
                  </div>
                  <button type="submit">
                    <Plus className="h-3.5 w-3.5" />
                    {lang === 'ta' ? 'மாவட்டத்தை சேர்' : 'Add District'}
                  </button>
                </form>
              )}

              {hierarchySubTab === 'tp' && (
                <form onSubmit={handleAddTP} className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <label>{t('selectDistrict')}</label>
                      <ThemeSelect
                        value={selectedDistrictId}
                        onChange={(e) => {
                          const distId = e.target.value;
                          setSelectedDistrictId(distId);
                          setTpCode(getNextTpCode(distId));
                        }}
                        required
                      >
                        <option value="">-- Choose District --</option>
                        {districts.map((d: any) => {
                          const zone = zones.find((z: any) => z.id === d.zoneId);
                          return (
                            <option key={d.id} value={d.id}>{tObj(d)} {d.code ? `[Code: ${d.code}]` : ''} ({zone ? tObj(zone) : ''})</option>
                          );
                        })}
                      </ThemeSelect>
                    </div>
                    <div>
                      <label>{t('tpNameEn')}</label>
                      <input
                        type="text"
                        value={tpEn}
                        onChange={(e) => setTpEn(e.target.value)}
                        placeholder="e.g. Thiruporur"
                        required
                      />
                    </div>
                    <div>
                      <label>{t('tpNameTa')}</label>
                      <input
                        type="text"
                        value={tpTa}
                        onChange={(e) => setTpTa(e.target.value)}
                        placeholder="எ.கா. திருப்போரூர்"
                        required
                      />
                    </div>
                    <div>
                      <label>{lang === 'ta' ? 'பேரூராட்சி குறியீடு (2 இலக்கம்)' : 'Town Panchayat Code (2-digit)'}</label>
                      <input
                        type="text"
                        maxLength={2}
                        value={tpCode}
                        onChange={(e) => setTpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder={getNextTpCode(selectedDistrictId)}
                      />
                      <span className="text-[10px] text-gray-400 mt-0.5 block">
                        {lang === 'ta' 
                          ? `ஒவ்வொரு மாவட்டத்திலும் 01 முதல் தொடங்கும் (பரிந்துரை: ${getNextTpCode(selectedDistrictId)})` 
                          : `Starts from 01 for each district (Suggested: ${getNextTpCode(selectedDistrictId)})`}
                      </span>
                    </div>
                  </div>
                  <button type="submit">
                    <Plus className="h-3.5 w-3.5" />
                    {lang === 'ta' ? 'பேரூராட்சியை சேர்' : 'Add Town Panchayat'}
                  </button>
                </form>
              )}

              {hierarchySubTab === 'ward_street' && (
                <form onSubmit={handleAddWardAndStreet} className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <label>{lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat'}</label>
                      <ThemeSelect
                        value={wardStreetTpId}
                        onChange={(e) => setWardStreetTpId(e.target.value)}
                        required
                      >
                        <option value="">-- Choose Town Panchayat --</option>
                        {townPanchayats.map((tp: any) => {
                          const dist = districts.find((d: any) => d.id === tp.districtId);
                          return (
                            <option key={tp.id} value={tp.id}>{tObj(tp)} {dist ? `(${tObj(dist)})` : ''}</option>
                          );
                        })}
                      </ThemeSelect>
                    </div>
                    <div>
                      <label>{t('wardNo')}</label>
                      <input
                        type="text"
                        value={wardNo}
                        onChange={(e) => setWardNo(e.target.value)}
                        placeholder="e.g. 1"
                        required
                      />
                    </div>
                    <div>
                      <label>{t('streetNameEn')}</label>
                      <input
                        type="text"
                        value={streetEn}
                        onChange={(e) => setStreetEn(e.target.value)}
                        placeholder="e.g. Anna Street"
                        required
                      />
                    </div>
                    <div>
                      <label>{t('streetNameTa')}</label>
                      <input
                        type="text"
                        value={streetTa}
                        onChange={(e) => setStreetTa(e.target.value)}
                        placeholder="எ.கா. அண்ணா தெரு"
                        required
                      />
                    </div>
                  </div>
                  <button type="submit">
                    <Plus className="h-3.5 w-3.5" />
                    {lang === 'ta' ? 'வார்டு & தெருவைச் சேர்' : 'Add Ward & Street'}
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="portal-dashboard-panel">
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <MapPin className="h-3 w-3" />
                  </span>
                  {lang === 'ta' ? 'தற்போதைய மண்டல படிநிலை வரைபடம்' : 'Active Town Panchayat Jurisdictions'}
                </h3>
                <p>
                  {lang === 'ta' ? 'அனைத்து மண்டலம், மாவட்டம், பேரூராட்சி மற்றும் வார்டுகள்.' : 'Full list of zones, districts, town panchayats, and wards.'}
                </p>
              </div>
              <div className="portal-dash-pills">
                <button
                  type="button"
                  onClick={() => setHierarchyViewMode('cards')}
                  className={`portal-dash-pill ${hierarchyViewMode === 'cards' ? 'is-active' : ''}`}
                >
                  {lang === 'ta' ? 'வரைபடம்' : 'Tree'}
                </button>
                <button
                  type="button"
                  onClick={() => setHierarchyViewMode('table')}
                  className={`portal-dash-pill ${hierarchyViewMode === 'table' ? 'is-active' : ''}`}
                >
                  {lang === 'ta' ? 'அட்டவணை' : 'Table'}
                </button>
              </div>
            </div>
            <div className="portal-dash-body is-jurisdictions">
            {hierarchyViewMode === 'table' ? (() => {
              // Construct Flat Hierarchy List
              const flatHierarchy: any[] = [];
              
              // 1. Add Wards & Streets
              wardsAndStreets.forEach((ws: any) => {
                const tp = townPanchayats.find((t: any) => t.id === ws.tpId);
                const dist = districts.find((d: any) => d.id === (ws.districtId || tp?.districtId));
                const zone = zones.find((z: any) => z.id === (ws.zoneId || dist?.zoneId));
                flatHierarchy.push({
                  id: ws.id,
                  type: 'Ward & Street',
                  zoneId: zone?.id || '',
                  zoneName: zone ? (lang === 'ta' ? (zone.nameTa || zone.nameEn) : (zone.nameEn || zone.nameTa)) : '—',
                  districtId: dist?.id || '',
                  districtName: dist ? (lang === 'ta' ? (dist.nameTa || dist.nameEn) : (dist.nameEn || dist.nameTa)) : '—',
                  districtCode: dist?.code || '—',
                  tpId: tp?.id || '',
                  tpName: tp ? (lang === 'ta' ? (tp.nameTa || tp.nameEn) : (tp.nameEn || tp.nameTa)) : '—',
                  tpCode: tp?.code || '—',
                  wardNo: ws.wardNo || '—',
                  streetNameEn: ws.streetNameEn || '',
                  streetNameTa: ws.streetNameTa || '',
                  streetName: lang === 'ta' ? (ws.streetNameTa || ws.streetNameEn) : (ws.streetNameEn || ws.streetNameTa)
                });
              });

              // 2. Add Empty Town Panchayats
              townPanchayats.forEach((tp: any) => {
                const hasWards = wardsAndStreets.some((ws: any) => ws.tpId === tp.id);
                if (!hasWards) {
                  const dist = districts.find((d: any) => d.id === tp.districtId);
                  const zone = zones.find((z: any) => z.id === dist?.zoneId);
                  flatHierarchy.push({
                    id: tp.id,
                    type: 'Town Panchayat Only',
                    zoneId: zone?.id || '',
                    zoneName: zone ? (lang === 'ta' ? (zone.nameTa || zone.nameEn) : (zone.nameEn || zone.nameTa)) : '—',
                    districtId: dist?.id || '',
                    districtName: dist ? (lang === 'ta' ? (dist.nameTa || dist.nameEn) : (dist.nameEn || dist.nameTa)) : '—',
                    districtCode: dist?.code || '—',
                    tpId: tp.id,
                    tpName: lang === 'ta' ? (tp.nameTa || tp.nameEn) : (tp.nameEn || tp.nameTa),
                    tpCode: tp.code || '—',
                    wardNo: '—',
                    streetNameEn: '—',
                    streetNameTa: '—',
                    streetName: '—'
                  });
                }
              });

              // Apply search & filters
              const filteredHierarchy = flatHierarchy.filter((item: any) => {
                const matchesZone = hierarchyZoneFilter === 'all' || item.zoneId === hierarchyZoneFilter;
                const matchesDist = hierarchyDistrictFilter === 'all' || item.districtId === hierarchyDistrictFilter;
                const matchesTp = hierarchyTpFilter === 'all' || item.tpId === hierarchyTpFilter;

                const q = hierarchySearch.toLowerCase().trim();
                const matchesSearch = q === '' ||
                  item.zoneName.toLowerCase().includes(q) ||
                  item.districtName.toLowerCase().includes(q) ||
                  item.tpName.toLowerCase().includes(q) ||
                  item.streetNameEn.toLowerCase().includes(q) ||
                  item.streetNameTa.toLowerCase().includes(q);

                return matchesZone && matchesDist && matchesTp && matchesSearch;
              });

              const handleExportExcel = () => {
                let rowsHtml = '';
                filteredHierarchy.forEach((item) => {
                  rowsHtml += `
                    <tr>
                      <td>${item.zoneName}</td>
                      <td>${item.districtName}</td>
                      <td>${item.districtCode}</td>
                      <td>${item.tpName}</td>
                      <td>${item.tpCode}</td>
                      <td>${item.wardNo}</td>
                      <td>${item.streetName}</td>
                    </tr>
                  `;
                });

                const template = `
                  <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                  <head>
                    <meta charset="utf-8">
                    <style>
                      table { border-collapse: collapse; width: 100%; font-family: sans-serif; }
                      th, td { border: 1px solid #cbd5e1; padding: 6px; font-size: 11px; text-align: left; }
                      th { background-color: #f1f5f9; font-weight: bold; }
                    </style>
                  </head>
                  <body>
                    <h3>${lang === 'ta' ? 'அதிகார வரம்பு படிநிலை அறிக்கை' : 'Jurisdictional Hierarchy Report'}</h3>
                    <p>Generated on: ${new Date().toLocaleString()}</p>
                    <table>
                      <thead>
                        <tr>
                          <th>Zone</th>
                          <th>District Name</th>
                          <th>District Code</th>
                          <th>Town Panchayat</th>
                          <th>TP Code</th>
                          <th>Ward Number</th>
                          <th>Street Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${rowsHtml}
                      </tbody>
                    </table>
                  </body>
                  </html>
                `;

                const blob = new Blob([template], { type: 'application/vnd.ms-excel;charset=utf-8' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `Jurisdictional_Hierarchy_Report_${new Date().toISOString().slice(0,10)}.xls`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              };

                const handleExportPDF = () => {
                const doc = new jsPDF('l', 'mm', 'a4');
                const reportTitle = lang === 'ta' ? 'அதிகார வரம்பு படிநிலை அறிக்கை (Jurisdictional Hierarchy Report)' : 'Jurisdictional Hierarchy Report';
                const drawPageHeader = () => {
                  doc.setFont('helvetica', 'bold');
                  doc.setFontSize(8);
                  doc.setTextColor(2, 132, 199);
                  doc.text(lang === 'ta' ? 'பேரூராட்சிகள் இயக்ககம்' : 'Directorate of Town Panchayats', 14, 8);
                  doc.setFontSize(13);
                  doc.setTextColor(79, 70, 229);
                  doc.text(reportTitle, 14, 14);
                  doc.setFont('helvetica', 'normal');
                  doc.setFontSize(9);
                  doc.setTextColor(71, 85, 105);
                  doc.text(`Generated on: ${new Date().toLocaleString()} • Total Items: ${filteredHierarchy.length}`, 14, 19);
                  doc.setFontSize(8);
                  doc.setTextColor(148, 163, 184);
                  doc.text(`${lang === 'ta' ? 'பக்கம்' : 'Page'} ${doc.getNumberOfPages()}`, 283, 8, { align: 'right' });
                };
                drawPageHeader();

                const startY = 24;
                doc.setFillColor(241, 245, 249);
                doc.rect(14, startY, 269, 8, 'F');
                
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8.5);
                doc.setTextColor(15, 23, 42);
                
                doc.text('Zone', 16, startY + 5.5);
                doc.text('District Name', 55, startY + 5.5);
                doc.text('Dist Code', 95, startY + 5.5);
                doc.text('Town Panchayat', 115, startY + 5.5);
                doc.text('TP Code', 165, startY + 5.5);
                doc.text('Ward No', 185, startY + 5.5);
                doc.text('Street Name', 205, startY + 5.5);
                
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(51, 65, 85);
                
                let currentY = startY + 8;
                filteredHierarchy.forEach((item) => {
                  if (currentY > 185) {
                    doc.addPage();
                    drawPageHeader();
                    currentY = 24;
                    doc.setFillColor(241, 245, 249);
                    doc.rect(14, currentY, 269, 8, 'F');
                    doc.setFont('helvetica', 'bold');
                    doc.text('Zone', 16, currentY + 5.5);
                    doc.text('District Name', 55, currentY + 5.5);
                    doc.text('Dist Code', 95, currentY + 5.5);
                    doc.text('Town Panchayat', 115, currentY + 5.5);
                    doc.text('TP Code', 165, currentY + 5.5);
                    doc.text('Ward No', 185, currentY + 5.5);
                    doc.text('Street Name', 205, currentY + 5.5);
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(8);
                    currentY += 8;
                  }
                  
                  doc.setDrawColor(241, 245, 249);
                  doc.line(14, currentY, 283, currentY);
                  
                  doc.text(item.zoneName.substring(0, 20), 16, currentY + 5);
                  doc.text(item.districtName.substring(0, 20), 55, currentY + 5);
                  doc.text(item.districtCode, 95, currentY + 5);
                  doc.text(item.tpName.substring(0, 24), 115, currentY + 5);
                  doc.text(item.tpCode, 165, currentY + 5);
                  doc.text(item.wardNo, 185, currentY + 5);
                  doc.text(item.streetName.substring(0, 42), 205, currentY + 5);
                  
                  currentY += 7.5;
                });
                
                doc.save(`Jurisdictional_Hierarchy_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
              };

              return (
                <div className="space-y-4">
                  {/* Search and Filters */}
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <ThemeSelect
                        value={hierarchyZoneFilter}
                        onChange={(e) => setHierarchyZoneFilter(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg p-2 bg-white text-gray-700 font-semibold"
                      >
                        <option value="all">{lang === 'ta' ? 'அனைத்து மண்டலம்' : 'All Zones'}</option>
                        {zones.map((z: any) => (
                          <option key={z.id} value={z.id}>{tObj(z)}</option>
                        ))}
                      </ThemeSelect>
                    </div>

                    <div>
                      <ThemeSelect
                        value={hierarchyDistrictFilter}
                        onChange={(e) => setHierarchyDistrictFilter(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg p-2 bg-white text-gray-700 font-semibold"
                      >
                        <option value="all">{lang === 'ta' ? 'அனைத்து மாவட்டம்' : 'All Districts'}</option>
                        {districts.map((d: any) => (
                          <option key={d.id} value={d.id}>{tObj(d)}</option>
                        ))}
                      </ThemeSelect>
                    </div>

                    <div>
                      <ThemeSelect
                        value={hierarchyTpFilter}
                        onChange={(e) => setHierarchyTpFilter(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg p-2 bg-white text-gray-700 font-semibold"
                      >
                        <option value="all">{lang === 'ta' ? 'அனைத்து பேரூராட்சி' : 'All Town Panchayats'}</option>
                        {townPanchayats.map((tp: any) => (
                          <option key={tp.id} value={tp.id}>{tObj(tp)}</option>
                        ))}
                      </ThemeSelect>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        placeholder={lang === 'ta' ? 'வார்டு / தெரு மூலம் தேடு...' : 'Search street or zone...'}
                        value={hierarchySearch}
                        onChange={(e) => setHierarchySearch(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg p-2 bg-white text-gray-700 outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1 text-xs">
                    <span className="text-gray-500 font-semibold">
                      {lang === 'ta' ? `காட்டப்படும் உருப்படிகள்: ${filteredHierarchy.length}` : `Showing ${filteredHierarchy.length} hierarchy records`}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportExcel}
                        className="portal-dash-head-action"
                        style={{ background: 'var(--theme-accent)', color: '#fff', borderColor: 'transparent' }}
                      >
                        <FileSpreadsheet className="h-3 w-3" />
                        {lang === 'ta' ? 'Excel பதிவிறக்கு' : 'Download Excel'}
                      </button>
                      <button
                        type="button"
                        onClick={handleExportPDF}
                        className="portal-dash-head-action"
                        style={{ background: 'var(--theme-accent)', color: '#fff', borderColor: 'transparent' }}
                      >
                        <Download className="h-3 w-3" />
                        {lang === 'ta' ? 'PDF பதிவிறக்கு' : 'Download PDF'}
                      </button>
                    </div>
                  </div>

                  <div className="portal-dash-table">
                    <table>
                      <thead>
                        <tr>
                          <th>{lang === 'ta' ? 'மண்டலம்' : 'Zone'}</th>
                          <th>{lang === 'ta' ? 'மாவட்டம் (குறியீடு)' : 'District (Code)'}</th>
                          <th>{lang === 'ta' ? 'பேரூராட்சி (குறியீடு)' : 'Town Panchayat (Code)'}</th>
                          <th>{lang === 'ta' ? 'வார்டு எண்' : 'Ward No'}</th>
                          <th>{lang === 'ta' ? 'தெரு / வார்டு பெயர்' : 'Street / Ward Name'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredHierarchy.map((item: any) => (
                          <tr key={item.id}>
                            <td>{item.zoneName}</td>
                            <td>
                              <span className="font-semibold text-gray-800">{item.districtName}</span>
                              <span className="portal-dash-id ml-1">#{item.districtCode}</span>
                            </td>
                            <td>
                              <span className="font-semibold text-gray-800">{item.tpName}</span>
                              <span className="portal-dash-id ml-1">#{item.tpCode}</span>
                            </td>
                            <td>
                              {item.wardNo && item.wardNo !== '—' 
                                ? (lang === 'ta' ? `வார்டு ${item.wardNo}` : `Ward ${item.wardNo}`) 
                                : '—'}
                            </td>
                            <td>{item.streetName}</td>
                          </tr>
                        ))}

                        {filteredHierarchy.length === 0 && (
                          <tr>
                            <td colSpan={5} className="portal-wt-empty is-center">
                              {lang === 'ta' ? 'அதிகார வரம்புகள் அல்லது தெருக்கள் எதுவும் இல்லை' : 'No jurisdictional records or streets found'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })() : (
              <div className="portal-wt-tree is-scroll">
                {zones.length === 0 && (
                  <p className="portal-wt-empty is-center">
                    {lang === 'ta'
                      ? 'அதிகார வரம்புகள் எதுவும் இல்லை. மேலே உள்ள CSV மூலம் பதிவேற்றவும் அல்லது மண்டலம் சேர்க்கவும்.'
                      : 'No jurisdictional data. Upload a CSV above or create a zone to populate this tree.'}
                  </p>
                )}
                {zones.map((zone: any, zIdx: number) => {
                  const zoneDistricts = districts.filter((d: any) => d.zoneId === zone.id);
                  const zoneOpen = Boolean(openZones[zone.id]);
                  const zoneTone = ZONE_TONES[zIdx % ZONE_TONES.length];
                  return (
                    <div
                      key={zone.id}
                      className={`portal-wt-node${zoneOpen ? ' is-open' : ''}`}
                      style={{ ['--wt-tone' as string]: zoneTone }}
                    >
                      <div className="portal-wt-node-head">
                        <button
                          type="button"
                          className="portal-wt-toggle"
                          onClick={() => setOpenZones((prev) => ({ ...prev, [zone.id]: !prev[zone.id] }))}
                          aria-expanded={zoneOpen}
                        >
                          <ChevronRight className={`portal-wt-caret${zoneOpen ? ' is-open' : ''}`} />
                          <div className="portal-wt-copy">
                            <div className="portal-wt-title">
                              <span>{tObj(zone)}</span>
                              <span className="portal-wt-count">
                                {zoneDistricts.length} {lang === 'ta' ? 'மாவட்டங்கள்' : 'districts'}
                              </span>
                            </div>
                          </div>
                        </button>
                        <div className="portal-wt-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingType('zone');
                              setEditingId(zone.id);
                              setEditNameEn(zone.nameEn);
                              setEditNameTa(zone.nameTa);
                            }}
                            className="portal-fis-icon-btn"
                            title="Edit Zone"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMasterItem('zones', zone.id)}
                            className="portal-fis-icon-btn is-danger"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {zoneOpen && (
                        <div className="portal-wt-cats">
                          {zoneDistricts.length === 0 && (
                            <p className="portal-wt-empty">{lang === 'ta' ? 'மாவட்டங்கள் இல்லை' : 'No districts mapped to this zone yet'}</p>
                          )}
                          {zoneDistricts.map((dist: any, dIdx: number) => {
                            const distTPs = townPanchayats.filter((tp: any) => tp.districtId === dist.id);
                            const distOpen = Boolean(openDistricts[dist.id]);
                            const distTone = DISTRICT_TONES[dIdx % DISTRICT_TONES.length];
                            return (
                              <div
                                key={dist.id}
                                className={`portal-wt-cat${distOpen ? ' is-open' : ''}`}
                                style={{ ['--wt-tone' as string]: distTone }}
                              >
                                <div className="portal-wt-cat-head">
                                  <button
                                    type="button"
                                    className="portal-wt-toggle"
                                    onClick={() => setOpenDistricts((prev) => ({ ...prev, [dist.id]: !prev[dist.id] }))}
                                    aria-expanded={distOpen}
                                  >
                                    <ChevronRight className={`portal-wt-caret${distOpen ? ' is-open' : ''}`} />
                                    <div className="portal-wt-copy">
                                      <div className="portal-wt-title">
                                        <span>{tObj(dist)}</span>
                                        {dist.code && <span className="portal-dash-id">#{dist.code}</span>}
                                        <span className="portal-wt-count">
                                          {distTPs.length} {lang === 'ta' ? 'பேரூராட்சி' : 'TPs'}
                                        </span>
                                      </div>
                                    </div>
                                  </button>
                                  <div className="portal-wt-actions">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingType('district');
                                        setEditingId(dist.id);
                                        setEditNameEn(dist.nameEn);
                                        setEditNameTa(dist.nameTa);
                                        setEditZoneId(dist.zoneId);
                                        setEditDistrictCode(dist.code || '');
                                      }}
                                      className="portal-fis-icon-btn"
                                      title="Edit District"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteMasterItem('districts', dist.id)}
                                      className="portal-fis-icon-btn is-danger"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>

                                {distOpen && (
                                  <div className="portal-wt-fields">
                                    {distTPs.length === 0 && (
                                      <p className="portal-wt-empty">{lang === 'ta' ? 'பேரூராட்சிகள் இல்லை' : 'No town panchayats added yet'}</p>
                                    )}
                                    {distTPs.map((tp: any) => {
                                      const tpWards = wardsAndStreets.filter((ws: any) => ws.tpId === tp.id);
                                      const tpOpen = Boolean(openTps[tp.id]);
                                      return (
                                        <div key={tp.id} className={`portal-wt-cat${tpOpen ? ' is-open' : ''}`}>
                                          <div className="portal-wt-cat-head">
                                            <button
                                              type="button"
                                              className="portal-wt-toggle"
                                              onClick={() => setOpenTps((prev) => ({ ...prev, [tp.id]: !prev[tp.id] }))}
                                              aria-expanded={tpOpen}
                                            >
                                              <ChevronRight className={`portal-wt-caret${tpOpen ? ' is-open' : ''}`} />
                                              <div className="portal-wt-copy">
                                                <div className="portal-wt-title">
                                                  <span>{tObj(tp)}</span>
                                                  {tp.code && <span className="portal-dash-id">#{tp.code}</span>}
                                                  <span className="portal-wt-count">
                                                    {tpWards.length} {lang === 'ta' ? 'தெருக்கள்' : 'streets'}
                                                  </span>
                                                </div>
                                              </div>
                                            </button>
                                            <div className="portal-wt-actions">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setEditingType('tp');
                                                  setEditingId(tp.id);
                                                  setEditNameEn(tp.nameEn);
                                                  setEditNameTa(tp.nameTa);
                                                  setEditDistrictId(tp.districtId);
                                                  setEditTpCode(tp.code || '');
                                                }}
                                                className="portal-fis-icon-btn"
                                                title="Edit Town Panchayat"
                                              >
                                                <Pencil className="h-3 w-3" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteMasterItem('townPanchayats', tp.id)}
                                                className="portal-fis-icon-btn is-danger"
                                                title="Delete Town Panchayat"
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </button>
                                            </div>
                                          </div>
                                          {tpOpen && (
                                            <div className="portal-wt-fields is-leaves">
                                              {tpWards.length === 0 && (
                                                <p className="portal-wt-empty">{lang === 'ta' ? 'வார்டு/தெரு சேர்க்கப்படவில்லை' : 'No wards/streets mapped yet'}</p>
                                              )}
                                              {groupStreetsByWard(tpWards).map(([wardNo, streets]) => (
                                                <div key={`ward-${wardNo}`} className="portal-wt-ward-block">
                                                  <div className="portal-wt-ward-label">{lang === 'ta' ? 'வார்டு' : 'Ward'} {wardNo}</div>
                                                  <div className="portal-wt-street-list">
                                                  {streets.map((ws: any) => {
                                                    const streetName = lang === 'ta'
                                                      ? (String(ws.streetNameTa || '').trim() || String(ws.streetNameEn || '').trim() || '—')
                                                      : (String(ws.streetNameEn || '').trim() || String(ws.streetNameTa || '').trim() || '—');
                                                    return (
                                                      <div key={ws.id} className="portal-wt-field portal-wt-leaf">
                                                        <div className="portal-wt-field-main">
                                                          <span className="portal-wt-leaf-name" title={streetName}>{streetName}</span>
                                                        </div>
                                                        <div className="portal-wt-actions">
                                                          <button
                                                            type="button"
                                                            onClick={() => {
                                                              setEditingType('ward_street');
                                                              setEditingId(ws.id);
                                                              setEditNameEn(ws.streetNameEn);
                                                              setEditNameTa(ws.streetNameTa);
                                                              setEditWardNo(ws.wardNo);
                                                              setEditTpId(ws.tpId);
                                                            }}
                                                            className="portal-fis-icon-btn"
                                                            title="Edit Ward & Street"
                                                          >
                                                            <Pencil className="h-3 w-3" />
                                                          </button>
                                                          <button
                                                            type="button"
                                                            onClick={() => handleDeleteMasterItem('wardsAndStreets', ws.id)}
                                                            className="portal-fis-icon-btn is-danger"
                                                            title="Delete Street"
                                                          >
                                                            <Trash2 className="h-3 w-3" />
                                                          </button>
                                                        </div>
                                                      </div>
                                                    );
                                                  })}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </div>
        </div>
      ) : (
        <div className="portal-wt-grid">
          <div className="portal-dashboard-panel">
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <Plus className="h-3 w-3" />
                  </span>
                  {lang === 'ta' ? 'பதவி உருவாக்கம்' : 'Create Post Master'}
                </h3>
                <p>{lang === 'ta' ? 'பதவி விவரம் மற்றும் துணைப் பதிவேடுகள்' : 'Post details and supporting masters'}</p>
              </div>
            </div>
            <div className="portal-dash-body portal-wt-form">
              <form onSubmit={handleAddPost} className="flex flex-col gap-3">
                <div className="portal-wt-section">
                  <div className="portal-wt-section-title">
                    <span>{lang === 'ta' ? 'பதவி விவரம்' : 'Post details'}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label>{t('postNameEn')}</label>
                      <input
                        type="text"
                        value={postEn}
                        onChange={(e) => setPostEn(e.target.value)}
                        placeholder="e.g. Executive Officer"
                        required
                      />
                    </div>
                    <div>
                      <label>{t('postNameTa')}</label>
                      <input
                        type="text"
                        value={postTa}
                        onChange={(e) => setPostTa(e.target.value)}
                        placeholder="எ.கா. செயல் அலுவலர்"
                        required
                      />
                    </div>
                    <div>
                      <label>{t('payLevel')}</label>
                      <ThemeSelect
                        value={postPayLevelId}
                        onChange={(e) => setPostPayLevelId(e.target.value)}
                      >
                        <option value="">-- Choose Pay Scale --</option>
                        {payLevels.map((p: any) => (
                          <option key={p.id} value={p.id}>{tObj(p)}</option>
                        ))}
                      </ThemeSelect>
                    </div>
                    <div>
                      <label>{t('nature')}</label>
                      <ThemeSelect
                        value={postNatureId}
                        onChange={(e) => setPostNatureId(e.target.value)}
                      >
                        <option value="">-- Choose Nature --</option>
                        {postNatures.map((n: any) => (
                          <option key={n.id} value={n.id}>{tObj(n)}</option>
                        ))}
                      </ThemeSelect>
                    </div>
                    <div>
                      <label>{t('category')}</label>
                      <ThemeSelect
                        value={postCategoryId}
                        onChange={(e) => setPostCategoryId(e.target.value)}
                      >
                        <option value="">-- Choose Category --</option>
                        {employeeCategories.map((c: any) => (
                          <option key={c.id} value={c.id}>{tObj(c)}</option>
                        ))}
                      </ThemeSelect>
                    </div>
                    <div>
                      <label>{t('group')}</label>
                      <ThemeSelect
                        value={postGroupId}
                        onChange={(e) => setPostGroupId(e.target.value)}
                      >
                        <option value="">-- Choose Group --</option>
                        {employeeGroups.map((g: any) => (
                          <option key={g.id} value={g.id}>{tObj(g)}</option>
                        ))}
                      </ThemeSelect>
                    </div>
                  </div>
                </div>
                <button type="submit">
                  {lang === 'ta' ? 'பதவியை சேர்' : 'Add Post'}
                </button>
              </form>

              <div className="portal-wt-tree">
                <div
                  className={`portal-wt-node${openPostMasterSections.pay ? ' is-open' : ''}`}
                  style={{ ['--wt-tone' as string]: POST_MASTER_TONES.pay }}
                >
                  <div className="portal-wt-node-head">
                    <button
                      type="button"
                      className="portal-wt-toggle"
                      onClick={() => setOpenPostMasterSections((prev) => ({ ...prev, pay: !prev.pay }))}
                      aria-expanded={Boolean(openPostMasterSections.pay)}
                    >
                      <ChevronRight className={`portal-wt-caret${openPostMasterSections.pay ? ' is-open' : ''}`} />
                      <div className="portal-wt-copy">
                        <div className="portal-wt-title">
                          <span>{lang === 'ta' ? 'சம்பள நிலை உருவாக்கம்' : 'Create Pay Level Master'}</span>
                          <span className="portal-wt-count">{payLevels.length}</span>
                        </div>
                      </div>
                    </button>
                  </div>
                  {openPostMasterSections.pay && (
                    <div className="portal-wt-fields">
                      <form onSubmit={handleAddPayLevel} className="flex flex-col gap-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label>{t('payLevelEn')}</label>
                            <input
                              type="text"
                              value={payLevelEn}
                              onChange={(e) => setPayLevelEn(e.target.value)}
                              placeholder="e.g. PB 1"
                              required
                            />
                          </div>
                          <div>
                            <label>{t('payLevelTa')}</label>
                            <input
                              type="text"
                              value={payLevelTa}
                              onChange={(e) => setPayLevelTa(e.target.value)}
                              placeholder="எ.கா. பிபி 1"
                              required
                            />
                          </div>
                          <div>
                            <label>{t('minPay')}</label>
                            <input
                              type="number"
                              value={minPay}
                              onChange={(e) => setMinPay(e.target.value)}
                              placeholder="15700"
                              required
                            />
                          </div>
                          <div>
                            <label>{t('maxPay')}</label>
                            <input
                              type="number"
                              value={maxPay}
                              onChange={(e) => setMaxPay(e.target.value)}
                              placeholder="50000"
                              required
                            />
                          </div>
                        </div>
                        <button type="submit">
                          {lang === 'ta' ? 'சம்பள நிலையை சேர்' : 'Add Pay Level'}
                        </button>
                      </form>
                    </div>
                  )}
                </div>

                <div
                  className={`portal-wt-node${openPostMasterSections.category ? ' is-open' : ''}`}
                  style={{ ['--wt-tone' as string]: POST_MASTER_TONES.category }}
                >
                  <div className="portal-wt-node-head">
                    <button
                      type="button"
                      className="portal-wt-toggle"
                      onClick={() => setOpenPostMasterSections((prev) => ({ ...prev, category: !prev.category }))}
                      aria-expanded={Boolean(openPostMasterSections.category)}
                    >
                      <ChevronRight className={`portal-wt-caret${openPostMasterSections.category ? ' is-open' : ''}`} />
                      <div className="portal-wt-copy">
                        <div className="portal-wt-title">
                          <span>{lang === 'ta' ? 'ஊழியர் பிரிவு' : 'Employee Category'}</span>
                          <span className="portal-wt-count">{employeeCategories.length}</span>
                        </div>
                      </div>
                    </button>
                  </div>
                  {openPostMasterSections.category && (
                    <div className="portal-wt-fields">
                      <form onSubmit={handleAddCategory} className="flex flex-col gap-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label>{lang === 'ta' ? 'பெயர் (ஆங்கிலம்)' : 'Name (English)'}</label>
                            <input
                              type="text"
                              placeholder="e.g. Engineering"
                              value={categoryEn}
                              onChange={(e) => setCategoryEn(e.target.value)}
                            />
                          </div>
                          <div>
                            <label>{lang === 'ta' ? 'பெயர் (தமிழ்)' : 'Name (Tamil)'}</label>
                            <input
                              type="text"
                              placeholder="எ.கா. பொறியியல்"
                              value={categoryTa}
                              onChange={(e) => setCategoryTa(e.target.value)}
                            />
                          </div>
                        </div>
                        <button type="submit">
                          {lang === 'ta' ? 'பிரிவைச் சேர்' : 'Add Category'}
                        </button>
                      </form>
                    </div>
                  )}
                </div>

                <div
                  className={`portal-wt-node${openPostMasterSections.nature ? ' is-open' : ''}`}
                  style={{ ['--wt-tone' as string]: POST_MASTER_TONES.nature }}
                >
                  <div className="portal-wt-node-head">
                    <button
                      type="button"
                      className="portal-wt-toggle"
                      onClick={() => setOpenPostMasterSections((prev) => ({ ...prev, nature: !prev.nature }))}
                      aria-expanded={Boolean(openPostMasterSections.nature)}
                    >
                      <ChevronRight className={`portal-wt-caret${openPostMasterSections.nature ? ' is-open' : ''}`} />
                      <div className="portal-wt-copy">
                        <div className="portal-wt-title">
                          <span>{lang === 'ta' ? 'பதவித் தன்மை' : 'Post Nature'}</span>
                          <span className="portal-wt-count">{postNatures.length}</span>
                        </div>
                      </div>
                    </button>
                  </div>
                  {openPostMasterSections.nature && (
                    <div className="portal-wt-fields">
                      <form onSubmit={handleAddNature} className="flex flex-col gap-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label>{lang === 'ta' ? 'பெயர் (ஆங்கிலம்)' : 'Name (English)'}</label>
                            <input
                              type="text"
                              placeholder="e.g. Provincialised"
                              value={natureEn}
                              onChange={(e) => setNatureEn(e.target.value)}
                            />
                          </div>
                          <div>
                            <label>{lang === 'ta' ? 'பெயர் (தமிழ்)' : 'Name (Tamil)'}</label>
                            <input
                              type="text"
                              placeholder="எ.கா. மாநில அளவிலானது"
                              value={natureTa}
                              onChange={(e) => setNatureTa(e.target.value)}
                            />
                          </div>
                        </div>
                        <button type="submit">
                          {lang === 'ta' ? 'தன்மையைச் சேர்' : 'Add Nature'}
                        </button>
                      </form>
                    </div>
                  )}
                </div>

                <div
                  className={`portal-wt-node${openPostMasterSections.reason ? ' is-open' : ''}`}
                  style={{ ['--wt-tone' as string]: POST_MASTER_TONES.reason }}
                >
                  <div className="portal-wt-node-head">
                    <button
                      type="button"
                      className="portal-wt-toggle"
                      onClick={() => setOpenPostMasterSections((prev) => ({ ...prev, reason: !prev.reason }))}
                      aria-expanded={Boolean(openPostMasterSections.reason)}
                    >
                      <ChevronRight className={`portal-wt-caret${openPostMasterSections.reason ? ' is-open' : ''}`} />
                      <div className="portal-wt-copy">
                        <div className="portal-wt-title">
                          <span>{lang === 'ta' ? 'இடமாற்றக் காரணம்' : 'Transfer Reason'}</span>
                          <span className="portal-wt-count">{transferReasons.length}</span>
                        </div>
                      </div>
                    </button>
                  </div>
                  {openPostMasterSections.reason && (
                    <div className="portal-wt-fields">
                      <form onSubmit={handleAddTransferReason} className="flex flex-col gap-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label>{lang === 'ta' ? 'பெயர் (ஆங்கிலம்)' : 'Name (English)'}</label>
                            <input
                              type="text"
                              placeholder="e.g. Spouse Employment"
                              value={transferReasonEn}
                              onChange={(e) => setTransferReasonEn(e.target.value)}
                            />
                          </div>
                          <div>
                            <label>{lang === 'ta' ? 'பெயர் (தமிழ்)' : 'Name (Tamil)'}</label>
                            <input
                              type="text"
                              placeholder="எ.கா. மருத்துவ காரணங்கள்"
                              value={transferReasonTa}
                              onChange={(e) => setTransferReasonTa(e.target.value)}
                            />
                          </div>
                        </div>
                        <button type="submit">
                          {lang === 'ta' ? 'காரணத்தைச் சேர்' : 'Add Reason'}
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="portal-dashboard-panel">
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <Briefcase className="h-3 w-3" />
                  </span>
                  {lang === 'ta' ? 'பதவிகள் பட்டியல்' : 'Designatory Posts Registry'}
                </h3>
                <p>{posts.length} {lang === 'ta' ? 'பதவிகள்' : 'posts'}</p>
              </div>
            </div>
            <div className="portal-dash-body">
              <div className="portal-wt-fields">
                {posts.length === 0 && (
                  <p className="portal-wt-empty is-center">
                    {lang === 'ta' ? 'பதவிகள் இல்லை' : 'No posts added yet'}
                  </p>
                )}
                {posts.map((p: any) => {
                  const pay = payLevels.find((pl: any) => pl.id === p.payLevelId);
                  const nat = postNatures.find((n: any) => n.id === p.postNatureId);
                  const cat = employeeCategories.find((c: any) => c.id === p.categoryId);
                  const grp = employeeGroups.find((g: any) => g.id === p.groupId);
                  return (
                    <div key={p.id} className="portal-wt-field">
                      <div className="portal-wt-field-main">
                        <div className="portal-wt-field-name">{tObj(p)}</div>
                        <div className="portal-wt-chips">
                          {pay && <span className="portal-wt-chip">{tObj(pay)}</span>}
                          {nat && <span className="portal-wt-chip">{tObj(nat)}</span>}
                          {cat && <span className="portal-wt-chip">{tObj(cat)}</span>}
                          {(grp || p.groupId) && (
                            <span className="portal-wt-chip">{grp ? tObj(grp) : `Group ${p.groupId}`}</span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteMasterItem('posts', p.id)}
                        className="portal-fis-icon-btn is-danger"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="portal-wt-tree" style={{ marginTop: '0.75rem' }}>
                {([
                  {
                    key: 'pay',
                    tone: POST_MASTER_TONES.pay,
                    title: lang === 'ta' ? 'சம்பள நிலை' : 'Pay Scale',
                    empty: lang === 'ta' ? 'சம்பள நிலை இல்லை' : 'No pay scales yet',
                    items: payLevels,
                    collection: 'payLevels',
                  },
                  {
                    key: 'category',
                    tone: POST_MASTER_TONES.category,
                    title: lang === 'ta' ? 'ஊழியர் பிரிவுகள்' : 'Employee Categories',
                    empty: lang === 'ta' ? 'பிரிவுகள் இல்லை' : 'No categories yet',
                    items: employeeCategories,
                    collection: 'employeeCategories',
                  },
                  {
                    key: 'nature',
                    tone: POST_MASTER_TONES.nature,
                    title: lang === 'ta' ? 'பதவி தன்மைகள்' : 'Post Natures',
                    empty: lang === 'ta' ? 'தன்மைகள் இல்லை' : 'No natures yet',
                    items: postNatures,
                    collection: 'postNatures',
                  },
                  {
                    key: 'reason',
                    tone: POST_MASTER_TONES.reason,
                    title: lang === 'ta' ? 'இடமாற்றக் காரணங்கள்' : 'Transfer Reasons',
                    empty: lang === 'ta' ? 'காரணங்கள் இல்லை' : 'No reasons yet',
                    items: transferReasons,
                    collection: 'transferReasons',
                  },
                ] as const).map((section) => {
                  const isOpen = Boolean(openPostMasterLists[section.key]);
                  return (
                    <div
                      key={section.key}
                      className={`portal-wt-node${isOpen ? ' is-open' : ''}`}
                      style={{ ['--wt-tone' as string]: section.tone }}
                    >
                      <div className="portal-wt-node-head">
                        <button
                          type="button"
                          className="portal-wt-toggle"
                          onClick={() => setOpenPostMasterLists((prev) => ({ ...prev, [section.key]: !prev[section.key] }))}
                          aria-expanded={isOpen}
                        >
                          <ChevronRight className={`portal-wt-caret${isOpen ? ' is-open' : ''}`} />
                          <div className="portal-wt-copy">
                            <div className="portal-wt-title">
                              <span>{section.title}</span>
                              <span className="portal-wt-count">{section.items.length}</span>
                            </div>
                          </div>
                        </button>
                      </div>
                      {isOpen && (
                        <div className="portal-wt-fields">
                          {section.items.length === 0 && (
                            <p className="portal-wt-empty">{section.empty}</p>
                          )}
                          {section.items.map((item: any) => (
                            <div key={item.id} className="portal-wt-field">
                              <div className="portal-wt-field-main">
                                <div className="portal-wt-field-name">{tObj(item)}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteMasterItem(section.collection, item.id)}
                                className="portal-fis-icon-btn is-danger"
                              >
                                <Trash2 className="h-3 w-3" />
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
        </div>
      )}

      {editingType && (
        <div className="portal-modal-overlay">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="portal-modal max-w-md w-full"
          >
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <Pencil className="h-3 w-3" />
                  </span>
                  {lang === 'ta' ? 'விவரங்களை மாற்று' : 'Edit Hierarchy Item'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingType(null)}
                className="portal-dash-head-action"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            <div className="portal-dash-body portal-wt-form">
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label>{lang === 'ta' ? 'பெயர் (ஆங்கிலம்)' : 'Name (English)'}</label>
                <input
                  type="text"
                  value={editNameEn}
                  onChange={(e) => setEditNameEn(e.target.value)}
                  required
                />
              </div>

              <div>
                <label>{lang === 'ta' ? 'பெயர் (தமிழ்)' : 'Name (Tamil)'}</label>
                <input
                  type="text"
                  value={editNameTa}
                  onChange={(e) => setEditNameTa(e.target.value)}
                  required
                />
              </div>

              {editingType === 'district' && (
                <>
                  <div>
                    <label>{lang === 'ta' ? 'மண்டலம்' : 'Zone'}</label>
                    <ThemeSelect
                      value={editZoneId}
                      onChange={(e) => setEditZoneId(e.target.value)}
                      required
                    >
                      <option value="">{lang === 'ta' ? 'மண்டலத்தைத் தேர்ந்தெடுக்கவும்' : 'Select Zone'}</option>
                      {zones.map((z: any) => (
                        <option key={z.id} value={z.id}>{tObj(z)}</option>
                      ))}
                    </ThemeSelect>
                  </div>
                  <div>
                    <label>{lang === 'ta' ? 'மாவட்டக் குறியீடு (2 இலக்கம்)' : 'District Code (2-digit)'}</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={editDistrictCode}
                      onChange={(e) => setEditDistrictCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="01"
                    />
                  </div>
                </>
              )}

              {editingType === 'tp' && (
                <>
                  <div>
                    <label>{lang === 'ta' ? 'மாவட்டம்' : 'District'}</label>
                    <ThemeSelect
                      value={editDistrictId}
                      onChange={(e) => setEditDistrictId(e.target.value)}
                      required
                    >
                      <option value="">{lang === 'ta' ? 'மாவட்டத்தைத் தேர்ந்தெடுக்கவும்' : 'Select District'}</option>
                      {districts.map((d: any) => (
                        <option key={d.id} value={d.id}>{tObj(d)}</option>
                      ))}
                    </ThemeSelect>
                  </div>
                  <div>
                    <label>{lang === 'ta' ? 'பேரூராட்சிக் குறியீடு (2 இலக்கம்)' : 'Town Panchayat Code (2-digit)'}</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={editTpCode}
                      onChange={(e) => setEditTpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="01"
                    />
                    <span className="text-[10px] text-gray-400 mt-0.5 block">
                      {lang === 'ta' ? 'ஒவ்வொரு மாவட்டத்திலும் 01 முதல் தொடங்கும்' : 'Starts from 01 for each district'}
                    </span>
                  </div>
                </>
              )}

              {editingType === 'ward_street' && (
                <>
                  <div>
                    <label>{lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat'}</label>
                    <ThemeSelect
                      value={editTpId}
                      onChange={(e) => setEditTpId(e.target.value)}
                      required
                    >
                      <option value="">{lang === 'ta' ? 'பேரூராட்சியைத் தேர்ந்தெடுக்கவும்' : 'Select Town Panchayat'}</option>
                      {townPanchayats.map((tp: any) => (
                        <option key={tp.id} value={tp.id}>{tObj(tp)}</option>
                      ))}
                    </ThemeSelect>
                  </div>
                  <div>
                    <label>{t('wardNo')}</label>
                    <input
                      type="text"
                      value={editWardNo}
                      onChange={(e) => setEditWardNo(e.target.value)}
                      required
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingType(null)}
                  className="portal-wt-link"
                >
                  {lang === 'ta' ? 'ரத்துசெய்' : 'Cancel'}
                </button>
                <button type="submit">
                  {lang === 'ta' ? 'சேமி' : 'Save Changes'}
                </button>
              </div>
            </form>
            </div>
          </motion.div>
        </div>
      )}
      </div>
    </div>
  );
}
