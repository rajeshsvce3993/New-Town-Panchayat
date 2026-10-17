'use client';

import React, { useState, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { motion } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Download, 
  UploadCloud, 
  MapPin, 
  Briefcase, 
  Grid,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Pencil,
  Layers
} from 'lucide-react';
import { Language, translations } from './translations';

interface MasterManagementProps {
  state: any;
  lang: Language;
  onSaveCollection: (key: string, data: any[], skipCacheRebuild?: boolean) => Promise<void>;
}

export default function MasterManagementView({ state, lang, onSaveCollection }: MasterManagementProps) {
  const [activeTab, setActiveTab] = useState<'hierarchy' | 'employee_masters'>('hierarchy');
  const [hierarchySubTab, setHierarchySubTab] = useState<'zone' | 'district' | 'tp' | 'ward_street'>('zone');

  const [hierarchyViewMode, setHierarchyViewMode] = useState<'cards' | 'table'>('cards');
  const [mastersViewMode, setMastersViewMode] = useState<'cards' | 'table'>('cards');
  const [hierarchySearch, setHierarchySearch] = useState('');
  const [hierarchyZoneFilter, setHierarchyZoneFilter] = useState('all');
  const [hierarchyDistrictFilter, setHierarchyDistrictFilter] = useState('all');
  const [hierarchyTpFilter, setHierarchyTpFilter] = useState('all');

  const [mastersSearch, setMastersSearch] = useState('');
  const [mastersCategoryFilter, setMastersCategoryFilter] = useState('all');
  const [mastersNatureFilter, setMastersNatureFilter] = useState('all');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvFeedback, setCsvFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showTemplateGuide, setShowTemplateGuide] = useState(false);
  const [replaceOnUpload, setReplaceOnUpload] = useState(true);

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
    const currentList = state[collectionKey] || [];
    const updated = currentList.filter((item: any) => item.id !== itemId);
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

  // Clear all mock / jurisdictional data to start completely blank
  const handleClearAllJurisdictions = async () => {
    const confirmMsg = lang === 'ta'
      ? 'அனைத்து மண்டலம், மாவட்டம், பேரூராட்சி மற்றும் வார்டு/தெரு தரவுகளையும் முழுமையாக நீக்க விரும்புகிறீர்களா? (Clear Blank State)'
      : 'Are you sure you want to clear all zones, districts, town panchayats, and wards/streets to start fresh with a blank state?';
    if (!window.confirm(confirmMsg)) return;

    await onSaveCollection('zones', []);
    await onSaveCollection('districts', []);
    await onSaveCollection('townPanchayats', []);
    await onSaveCollection('wardsAndStreets', []);
    setCsvFeedback({
      type: 'success',
      message: lang === 'ta'
        ? 'அனைத்து அதிகார வரம்புகளும் அழிக்கப்பட்டன (வெற்று நிலை - Blank State). இப்போது உங்கள் புதிய CSV கோப்பைப் பதிவேற்றலாம்.'
        : 'All jurisdictions cleared successfully. Clean blank state ready for your CSV upload.'
    });
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
          // Parsing hierarchy with flexible header detection
          const uploadedZones = replaceOnUpload ? [] : [...zones];
          const uploadedDistricts = replaceOnUpload ? [] : [...districts];
          const uploadedTPs = replaceOnUpload ? [] : [...townPanchayats];
          const uploadedWardsAndStreets = replaceOnUpload ? [] : [...wardsAndStreets];

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
    <div id="master-management-container" className="space-y-6">
      {/* Header Tabs */}
      <div className="flex justify-start sm:justify-center overflow-x-auto scrollbar-custom whitespace-nowrap border-b border-gray-100 bg-white px-6 pt-4 rounded-t-2xl shadow-xs">
        <button
          onClick={() => { setActiveTab('hierarchy'); setCsvFeedback(null); }}
          className={`pb-4 px-6 text-sm font-semibold border-b-2 transition shrink-0 ${activeTab === 'hierarchy' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          {t('tpTabs')}
        </button>
        <button
          onClick={() => { setActiveTab('employee_masters'); setCsvFeedback(null); }}
          className={`pb-4 px-6 text-sm font-semibold border-b-2 transition shrink-0 ${activeTab === 'employee_masters' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          {t('employeeTabs')}
        </button>
      </div>

      {/* Bulk Upload Widget */}
      <div className="p-6 bg-white rounded-2xl border border-gray-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-gray-800 text-md flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
              {t('bulkUpload')}
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              {lang === 'ta' 
                ? 'மாதிரி CSV கோப்பைப் பதிவிறக்கி உங்கள் தரவை உள்ளிட்டுப் பதிவேற்றவும்.'
                : 'Download our standard format, input your master registry rows, and upload to populate the DB.'
              }
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={activeTab === 'hierarchy' ? downloadHierarchyTemplate : downloadEmployeeMastersTemplate}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 hover:bg-gray-50 rounded-xl text-xs font-semibold text-gray-600 transition"
            >
              <Download className="w-4 h-4 text-indigo-600" />
              {t('downloadTemplate')}
            </button>
            <button
              type="button"
              onClick={() => setShowTemplateGuide(!showTemplateGuide)}
              className="flex items-center gap-1.5 px-3 py-2 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold transition"
            >
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              {showTemplateGuide 
                ? (lang === 'ta' ? 'வழிகாட்டியை மறை' : 'Hide Format Guide') 
                : (lang === 'ta' ? 'மாதிரி வழிகாட்டி' : 'View Format Guide')}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-xs"
            >
              <UploadCloud className="w-4 h-4" />
              {t('selectFile')}
            </button>
            {activeTab === 'hierarchy' && (
              <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition shadow-2xs">
                <input
                  type="checkbox"
                  checked={replaceOnUpload}
                  onChange={(e) => setReplaceOnUpload(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                />
                <span>
                  {lang === 'ta' ? 'வெற்று நிலை பதிவேற்றம் (Replace Blank)' : 'Blank Replace'}
                </span>
              </label>
            )}
            {activeTab === 'hierarchy' && (
              <button
                type="button"
                onClick={handleClearAllJurisdictions}
                className="flex items-center gap-1.5 px-3 py-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold transition shadow-2xs"
                title={lang === 'ta' ? 'அனைத்து மாதிரி மண்டலம், மாவட்டம், பேரூராட்சி, வார்டு தெருக்களையும் அழித்து புதிய வெற்று நிலைக்கு மாற்றவும்' : 'Clear all mock zones, districts, TPs, and wards for clean blank state'}
              >
                <Trash2 className="w-4 h-4 text-rose-600" />
                {lang === 'ta' ? 'அனைத்தையும் அழி (Clear Blank)' : 'Clear Blank State'}
              </button>
            )}
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              onChange={handleCsvUpload}
              className="hidden"
            />
          </div>
        </div>

        {/* Model Template Format Guide */}
        {showTemplateGuide && activeTab === 'hierarchy' && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700">
                  <FileSpreadsheet className="w-4 h-4" />
                </span>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    {lang === 'ta' ? 'படிநிலை மாதிரி CSV கட்டமைப்பு (இருமொழி & Manual Code ஆதரவு)' : 'Hierarchy Model CSV Template (Bilingual & Manual Codes)'}
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-100 text-emerald-800 font-bold">11 Columns (En + Ta)</span>
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {lang === 'ta'
                      ? 'மண்டலம், மாவட்டம், பேரூராட்சி, வார்டு மற்றும் தெருக்கள் அனைத்தும் ஆங்கிலம் மற்றும் தமிழ் இருமொழிகளிலும் பதிவேற்றப்பட வேண்டும்.'
                      : 'Zone, District, Town Panchayat, Ward, and Street all require both English and Tamil names.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={downloadHierarchyTemplate}
                className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                {lang === 'ta' ? 'மாதிரி டெம்ப்ளேட் பதிவிறக்கு (CSV)' : 'Download Model Template (CSV)'}
              </button>
            </div>

            {/* Preview Sample Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-[11px] text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2">ZoneNameEn</th>
                    <th className="p-2">ZoneNameTa</th>
                    <th className="p-2 bg-purple-50 text-purple-900 border-x border-purple-100">DistrictCode</th>
                    <th className="p-2">DistrictNameEn</th>
                    <th className="p-2">DistrictNameTa</th>
                    <th className="p-2 bg-emerald-50 text-emerald-900 border-x border-emerald-100">TownPanchayatCode</th>
                    <th className="p-2">TownPanchayatNameEn</th>
                    <th className="p-2">TownPanchayatNameTa</th>
                    <th className="p-2 bg-indigo-50 text-indigo-900 border-x border-indigo-100 text-center">WardNo</th>
                    <th className="p-2">StreetNameEn</th>
                    <th className="p-2">StreetNameTa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[10px]">
                  <tr className="hover:bg-slate-50">
                    <td className="p-2 font-medium">Kanchipuram</td>
                    <td className="p-2 font-medium">காஞ்சிபுரம்</td>
                    <td className="p-2 bg-purple-50/50 text-purple-700 font-bold border-x border-purple-100 font-mono">01</td>
                    <td className="p-2">Thiruvallur</td>
                    <td className="p-2">திருவள்ளூர்</td>
                    <td className="p-2 bg-emerald-50/50 text-emerald-700 font-bold border-x border-emerald-100 font-mono">01</td>
                    <td className="p-2">Thirumazhisai</td>
                    <td className="p-2">திருமழிசை</td>
                    <td className="p-2 bg-indigo-50/50 text-indigo-700 font-bold border-x border-indigo-100 font-mono text-center">1</td>
                    <td className="p-2">Bazaar Street</td>
                    <td className="p-2">பஜார் தெரு</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="p-2 font-medium">Kanchipuram</td>
                    <td className="p-2 font-medium">காஞ்சிபுரம்</td>
                    <td className="p-2 bg-purple-50/50 text-purple-700 font-bold border-x border-purple-100 font-mono">01</td>
                    <td className="p-2">Thiruvallur</td>
                    <td className="p-2">திருவள்ளூர்</td>
                    <td className="p-2 bg-emerald-50/50 text-emerald-700 font-bold border-x border-emerald-100 font-mono">01</td>
                    <td className="p-2">Thirumazhisai</td>
                    <td className="p-2">திருமழிசை</td>
                    <td className="p-2 bg-indigo-50/50 text-indigo-700 font-bold border-x border-indigo-100 font-mono text-center">2</td>
                    <td className="p-2">Gandhi Street</td>
                    <td className="p-2">காந்தி தெரு</td>
                  </tr>
                  <tr className="hover:bg-slate-50">
                    <td className="p-2 font-medium">Kanchipuram</td>
                    <td className="p-2 font-medium">காஞ்சிபுரம்</td>
                    <td className="p-2 bg-purple-50/50 text-purple-700 font-bold border-x border-purple-100 font-mono">01</td>
                    <td className="p-2">Thiruvallur</td>
                    <td className="p-2">திருவள்ளூர்</td>
                    <td className="p-2 bg-emerald-50/50 text-emerald-700 font-bold border-x border-emerald-100 font-mono">02</td>
                    <td className="p-2">Arani</td>
                    <td className="p-2">ஆரணி</td>
                    <td className="p-2 bg-indigo-50/50 text-indigo-700 font-bold border-x border-indigo-100 font-mono text-center">1</td>
                    <td className="p-2">Sannathi Street</td>
                    <td className="p-2">சன்னதி தெரு</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[10px] text-slate-500 pt-1">
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
        )}

        {/* CSV Upload Feedback alerts */}
        {csvFeedback && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${csvFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
            {csvFeedback.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
            <p className="text-xs font-medium">{csvFeedback.message}</p>
          </div>
        )}
      </div>

      {activeTab === 'hierarchy' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Side */}
          <div className="lg:col-span-5 space-y-6">
            {/* Hierarchy Level Tabs */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex gap-2">
              <button
                onClick={() => setHierarchySubTab('zone')}
                className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition ${hierarchySubTab === 'zone' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-500'}`}
              >
                {lang === 'ta' ? 'மண்டலம்' : 'Zone'}
              </button>
              <button
                onClick={() => setHierarchySubTab('district')}
                className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition ${hierarchySubTab === 'district' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-500'}`}
              >
                {lang === 'ta' ? 'மாவட்டம்' : 'District'}
              </button>
              <button
                onClick={() => setHierarchySubTab('tp')}
                className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition ${hierarchySubTab === 'tp' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-500'}`}
              >
                {lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat'}
              </button>
              <button
                onClick={() => setHierarchySubTab('ward_street')}
                className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition ${hierarchySubTab === 'ward_street' ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-500'}`}
              >
                {lang === 'ta' ? 'வார்டு & தெரு' : 'Ward & Street'}
              </button>
            </div>

            {/* Creation Forms */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs">
              {hierarchySubTab === 'zone' && (
                <form onSubmit={handleAddZone} className="space-y-4">
                  <h4 className="font-semibold text-gray-800 text-sm border-b border-gray-100 pb-2">
                    {lang === 'ta' ? 'புதிய மண்டலம் உருவாக்கு' : 'Create New Zone'}
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500">{t('zoneNameEn')}</label>
                      <input
                        type="text"
                        value={zoneEn}
                        onChange={(e) => setZoneEn(e.target.value)}
                        placeholder="e.g. Kanchipuram"
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">{t('zoneNameTa')}</label>
                      <input
                        type="text"
                        value={zoneTa}
                        onChange={(e) => setZoneTa(e.target.value)}
                        placeholder="எ.கா. காஞ்சிபுரம்"
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 shadow-xs">
                    <Plus className="w-4 h-4" />
                    {lang === 'ta' ? 'மண்டலத்தை சேர்' : 'Add Zone'}
                  </button>
                </form>
              )}

              {hierarchySubTab === 'district' && (
                <form onSubmit={handleAddDistrict} className="space-y-4">
                  <h4 className="font-semibold text-gray-800 text-sm border-b border-gray-100 pb-2">
                    {lang === 'ta' ? 'புதிய மாவட்டம் உருவாக்கு' : 'Create New District'}
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500">{t('selectZone')}</label>
                      <select
                        value={selectedZoneId}
                        onChange={(e) => setSelectedZoneId(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white"
                        required
                      >
                        <option value="">-- Choose Zone --</option>
                        {zones.map((z: any) => (
                          <option key={z.id} value={z.id}>{tObj(z)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">{t('districtNameEn')}</label>
                      <input
                        type="text"
                        value={districtEn}
                        onChange={(e) => setDistrictEn(e.target.value)}
                        placeholder="e.g. Chengalpattu"
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">{t('districtNameTa')}</label>
                      <input
                        type="text"
                        value={districtTa}
                        onChange={(e) => setDistrictTa(e.target.value)}
                        placeholder="எ.கா. செங்கல்பட்டு"
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">{lang === 'ta' ? 'மாவட்ட குறியீடு (2 இலக்கம்)' : 'District Code (2-digit)'}</label>
                      <input
                        type="text"
                        maxLength={2}
                        value={districtCode}
                        onChange={(e) => setDistrictCode(e.target.value.replace(/\D/g, ''))}
                        placeholder={getNextDistrictCode()}
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none font-mono"
                      />
                      <span className="text-[10px] text-gray-400 mt-0.5 block">
                        {lang === 'ta' ? `தானியங்கி குறியீடு: ${getNextDistrictCode()}` : `Auto code suggested: ${getNextDistrictCode()}`}
                      </span>
                    </div>
                  </div>
                  <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 shadow-xs">
                    <Plus className="w-4 h-4" />
                    {lang === 'ta' ? 'மாவட்டத்தை சேர்' : 'Add District'}
                  </button>
                </form>
              )}

              {hierarchySubTab === 'tp' && (
                <form onSubmit={handleAddTP} className="space-y-4">
                  <h4 className="font-semibold text-gray-800 text-sm border-b border-gray-100 pb-2">
                    {lang === 'ta' ? 'புதிய பேரூராட்சி உருவாக்கு' : 'Create New Town Panchayat'}
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500">{t('selectDistrict')}</label>
                      <select
                        value={selectedDistrictId}
                        onChange={(e) => {
                          const distId = e.target.value;
                          setSelectedDistrictId(distId);
                          setTpCode(getNextTpCode(distId));
                        }}
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white"
                        required
                      >
                        <option value="">-- Choose District --</option>
                        {districts.map((d: any) => {
                          const zone = zones.find((z: any) => z.id === d.zoneId);
                          return (
                            <option key={d.id} value={d.id}>{tObj(d)} {d.code ? `[Code: ${d.code}]` : ''} ({zone ? tObj(zone) : ''})</option>
                          );
                        })}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">{t('tpNameEn')}</label>
                      <input
                        type="text"
                        value={tpEn}
                        onChange={(e) => setTpEn(e.target.value)}
                        placeholder="e.g. Thiruporur"
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">{t('tpNameTa')}</label>
                      <input
                        type="text"
                        value={tpTa}
                        onChange={(e) => setTpTa(e.target.value)}
                        placeholder="எ.கா. திருப்போரூர்"
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">{lang === 'ta' ? 'பேரூராட்சி குறியீடு (2 இலக்கம்)' : 'Town Panchayat Code (2-digit)'}</label>
                      <input
                        type="text"
                        maxLength={2}
                        value={tpCode}
                        onChange={(e) => setTpCode(e.target.value.replace(/\D/g, ''))}
                        placeholder={getNextTpCode(selectedDistrictId)}
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none font-mono"
                      />
                      <span className="text-[10px] text-gray-400 mt-0.5 block">
                        {lang === 'ta' 
                          ? `ஒவ்வொரு மாவட்டத்திலும் 01 முதல் தொடங்கும் (பரிந்துரை: ${getNextTpCode(selectedDistrictId)})` 
                          : `Starts from 01 for each district (Suggested: ${getNextTpCode(selectedDistrictId)})`}
                      </span>
                    </div>
                  </div>
                  <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 shadow-xs">
                    <Plus className="w-4 h-4" />
                    {lang === 'ta' ? 'பேரூராட்சியை சேர்' : 'Add Town Panchayat'}
                  </button>
                </form>
              )}

              {hierarchySubTab === 'ward_street' && (
                <form onSubmit={handleAddWardAndStreet} className="space-y-4">
                  <h4 className="font-semibold text-gray-800 text-sm border-b border-gray-100 pb-2">
                    {lang === 'ta' ? 'புதிய வார்டு & தெரு உருவாக்கு' : 'Create New Ward & Street'}
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500">{lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat'}</label>
                      <select
                        value={wardStreetTpId}
                        onChange={(e) => setWardStreetTpId(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white"
                        required
                      >
                        <option value="">-- Choose Town Panchayat --</option>
                        {townPanchayats.map((tp: any) => {
                          const dist = districts.find((d: any) => d.id === tp.districtId);
                          return (
                            <option key={tp.id} value={tp.id}>{tObj(tp)} {dist ? `(${tObj(dist)})` : ''}</option>
                          );
                        })}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">{t('wardNo')}</label>
                      <input
                        type="text"
                        value={wardNo}
                        onChange={(e) => setWardNo(e.target.value)}
                        placeholder="e.g. 1"
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">{t('streetNameEn')}</label>
                      <input
                        type="text"
                        value={streetEn}
                        onChange={(e) => setStreetEn(e.target.value)}
                        placeholder="e.g. Anna Street"
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">{t('streetNameTa')}</label>
                      <input
                        type="text"
                        value={streetTa}
                        onChange={(e) => setStreetTa(e.target.value)}
                        placeholder="எ.கா. அண்ணா தெரு"
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 shadow-xs">
                    <Plus className="w-4 h-4" />
                    {lang === 'ta' ? 'வார்டு & தெருவைச் சேர்' : 'Add Ward & Street'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* List Side */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h4 className="font-bold text-gray-800 text-md flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-indigo-500" />
                  {lang === 'ta' ? 'தற்போதைய மண்டல படிநிலை வரைபடம்' : 'Active Town Panchayat Jurisdictions'}
                </h4>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {lang === 'ta' ? 'அனைத்து மண்டலம், மாவட்டம், பேரூராட்சி மற்றும் வார்டுகள்.' : 'Full list of zones, districts, town panchayats, and wards.'}
                </p>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setHierarchyViewMode('cards')}
                  className={`px-3 py-1 rounded-md transition ${hierarchyViewMode === 'cards' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {lang === 'ta' ? 'வரைபடம்' : 'Tree View'}
                </button>
                <button
                  type="button"
                  onClick={() => setHierarchyViewMode('table')}
                  className={`px-3 py-1 rounded-md transition ${hierarchyViewMode === 'table' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {lang === 'ta' ? 'அட்டவணை' : 'Table View'}
                </button>
              </div>
            </div>

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
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(13);
                doc.setTextColor(79, 70, 229);
                doc.text(lang === 'ta' ? 'அதிகார வரம்பு படிநிலை அறிக்கை (Jurisdictional Hierarchy Report)' : 'Jurisdictional Hierarchy Report', 14, 15);
                
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(71, 85, 105);
                doc.text(`Generated on: ${new Date().toLocaleString()} • Total Items: ${filteredHierarchy.length}`, 14, 21);

                const startY = 28;
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
                    currentY = 20;
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
                      <select
                        value={hierarchyZoneFilter}
                        onChange={(e) => setHierarchyZoneFilter(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg p-2 bg-white text-gray-700 font-semibold"
                      >
                        <option value="all">{lang === 'ta' ? 'அனைத்து மண்டலம்' : 'All Zones'}</option>
                        {zones.map((z: any) => (
                          <option key={z.id} value={z.id}>{tObj(z)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <select
                        value={hierarchyDistrictFilter}
                        onChange={(e) => setHierarchyDistrictFilter(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg p-2 bg-white text-gray-700 font-semibold"
                      >
                        <option value="all">{lang === 'ta' ? 'அனைத்து மாவட்டம்' : 'All Districts'}</option>
                        {districts.map((d: any) => (
                          <option key={d.id} value={d.id}>{tObj(d)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <select
                        value={hierarchyTpFilter}
                        onChange={(e) => setHierarchyTpFilter(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg p-2 bg-white text-gray-700 font-semibold"
                      >
                        <option value="all">{lang === 'ta' ? 'அனைத்து பேரூராட்சி' : 'All Town Panchayats'}</option>
                        {townPanchayats.map((tp: any) => (
                          <option key={tp.id} value={tp.id}>{tObj(tp)}</option>
                        ))}
                      </select>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        placeholder={lang === 'ta' ? 'வார்டு / தெரு மூலம் தேடு...' : 'Search street or zone...'}
                        value={hierarchySearch}
                        onChange={(e) => setHierarchySearch(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg p-2 bg-white text-gray-700 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Export Controls and Summaries */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1 text-xs">
                    <span className="text-gray-500 font-semibold">
                      {lang === 'ta' ? `காட்டப்படும் உருப்படிகள்: ${filteredHierarchy.length}` : `Showing ${filteredHierarchy.length} hierarchy records`}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleExportExcel}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        {lang === 'ta' ? 'Excel பதிவிறக்கு' : 'Download Excel'}
                      </button>
                      <button
                        onClick={handleExportPDF}
                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {lang === 'ta' ? 'PDF பதிவிறக்கு' : 'Download PDF'}
                      </button>
                    </div>
                  </div>

                  {/* Table Element */}
                  <div className="border border-gray-100 rounded-xl overflow-hidden max-h-[360px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-gray-50 text-[10px] uppercase font-bold text-gray-500 tracking-wider border-b border-gray-200 sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">{lang === 'ta' ? 'மண்டலம்' : 'Zone'}</th>
                          <th className="py-2.5 px-3">{lang === 'ta' ? 'மாவட்டம் (குறியீடு)' : 'District (Code)'}</th>
                          <th className="py-2.5 px-3">{lang === 'ta' ? 'பேரூராட்சி (குறியீடு)' : 'Town Panchayat (Code)'}</th>
                          <th className="py-2.5 px-3 text-center">{lang === 'ta' ? 'வார்டு எண்' : 'Ward No'}</th>
                          <th className="py-2.5 px-3">{lang === 'ta' ? 'தெரு / வார்டு பெயர்' : 'Street / Ward Name'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredHierarchy.map((item: any) => (
                          <tr key={item.id} className="hover:bg-gray-50/70 transition">
                            <td className="py-2 px-3 font-semibold text-gray-700">{item.zoneName}</td>
                            <td className="py-2 px-3">
                              <span className="font-semibold text-gray-800">{item.districtName}</span>
                              <span className="ml-1 px-1 py-0.5 rounded text-[9px] bg-purple-50 text-purple-700 border border-purple-100 font-mono font-bold">
                                #{item.districtCode}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <span className="font-semibold text-gray-800">{item.tpName}</span>
                              <span className="ml-1 px-1 py-0.5 rounded text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-100 font-mono font-bold">
                                #{item.tpCode}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-indigo-600 font-mono">
                              {item.wardNo && item.wardNo !== '—' 
                                ? (lang === 'ta' ? `வார்டு ${item.wardNo}` : `Ward ${item.wardNo}`) 
                                : '—'}
                            </td>
                            <td className="py-2 px-3 text-gray-600 font-medium">{item.streetName}</td>
                          </tr>
                        ))}

                        {filteredHierarchy.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-gray-400">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                                  <Layers className="w-5 h-5" />
                                </div>
                                <span className="font-semibold text-gray-700 text-xs">
                                  {lang === 'ta' ? 'அதிகார வரம்புகள் அல்லது தெருக்கள் எதுவும் இல்லை (வெற்று நிலை - Blank State)' : 'No jurisdictional records or streets found (Clean Blank State)'}
                                </span>
                                <span className="text-[11px] text-gray-400 max-w-sm">
                                  {lang === 'ta' ? 'மண்டலம், மாவட்டம், பேரூராட்சி, வார்டு மற்றும் தெருக்களைக் கொண்ட உங்கள் புதிய CSV கோப்பைப் பதிவேற்றவும்.' : 'Please upload your new CSV file containing Zone, District, TP, Ward, and Street.'}
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })() : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                {zones.length === 0 && (
                  <div className="text-center py-12 px-4 border border-dashed border-gray-300 rounded-2xl bg-gray-50/50 space-y-2">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                      <Layers className="w-5 h-5" />
                    </div>
                    <h4 className="text-xs font-bold text-gray-800">
                      {lang === 'ta' ? 'அதிகார வரம்புகள் எதுவும் இல்லை (வெற்று நிலை)' : 'No Jurisdictional Data (Clean Blank State)'}
                    </h4>
                    <p className="text-[11px] text-gray-500 max-w-md mx-auto">
                      {lang === 'ta'
                        ? 'தற்போது மண்டலம், மாவட்டம், பேரூராட்சி, வார்டு/தெரு மாதிரி தரவுகள் எதுவும் இல்லை. மேலே உள்ள "கோப்பைத் தேர்ந்தெடு (CSV)" மூலம் உங்கள் புதிய அதிகாரப்பூர்வ கோப்பைப் பதிவேற்றவும்.'
                        : 'Currently no zones, districts, town panchayats, or wards/streets exist. Upload your official CSV file above to populate.'}
                    </p>
                  </div>
                )}
                {zones.map((zone: any) => {
                  const zoneDistricts = districts.filter((d: any) => d.zoneId === zone.id);
                  return (
                    <div key={zone.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50 space-y-3">
                      <div className="flex justify-between items-center">
                        <h5 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                          {tObj(zone)} <span className="text-xs font-normal text-gray-400">({lang === 'ta' ? 'மண்டலம்' : 'Zone'})</span>
                        </h5>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingType('zone');
                              setEditingId(zone.id);
                              setEditNameEn(zone.nameEn);
                              setEditNameTa(zone.nameTa);
                            }}
                            className="p-1 hover:bg-indigo-100 hover:text-indigo-600 text-gray-400 rounded-lg transition"
                            title="Edit Zone"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteMasterItem('zones', zone.id)}
                            className="p-1.5 hover:bg-red-50 hover:text-red-600 text-gray-400 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="pl-4 space-y-2 border-l border-indigo-100">
                        {zoneDistricts.map((dist: any) => {
                          const distTPs = townPanchayats.filter((tp: any) => tp.districtId === dist.id);
                          return (
                            <div key={dist.id} className="bg-white p-3 rounded-lg border border-gray-100 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                  {tObj(dist)}
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                    {lang === 'ta' ? 'மாவட்டம்' : 'Dist'} {dist.code ? `#${dist.code}` : ''}
                                  </span>
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingType('district');
                                      setEditingId(dist.id);
                                      setEditNameEn(dist.nameEn);
                                      setEditNameTa(dist.nameTa);
                                      setEditZoneId(dist.zoneId);
                                      setEditDistrictCode(dist.code || '');
                                    }}
                                    className="p-1 hover:text-indigo-600 text-gray-400 rounded transition"
                                    title="Edit District"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMasterItem('districts', dist.id)}
                                    className="p-1 hover:text-red-600 text-gray-300 rounded transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="pl-4 space-y-2">
                                {distTPs.map((tp: any) => {
                                  const tpWards = wardsAndStreets.filter((ws: any) => ws.tpId === tp.id);
                                  return (
                                    <div key={tp.id} className="bg-white border border-gray-100 rounded-xl p-2.5 space-y-1.5 shadow-2xs">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                          {tObj(tp)}
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            {lang === 'ta' ? 'பேரூராட்சி' : 'TP'} {tp.code ? `#${tp.code}` : ''}
                                          </span>
                                          <span className="text-[10px] font-normal text-gray-400">
                                            ({tpWards.length} {lang === 'ta' ? 'வார்டு/தெருக்கள்' : 'wards/streets'})
                                          </span>
                                        </span>
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() => {
                                              setEditingType('tp');
                                              setEditingId(tp.id);
                                              setEditNameEn(tp.nameEn);
                                              setEditNameTa(tp.nameTa);
                                              setEditDistrictId(tp.districtId);
                                              setEditTpCode(tp.code || '');
                                            }}
                                            className="p-1 hover:text-indigo-600 text-gray-400 rounded transition"
                                            title="Edit Town Panchayat"
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteMasterItem('townPanchayats', tp.id)}
                                            className="p-1 hover:text-red-500 text-gray-400 rounded transition"
                                            title="Delete Town Panchayat"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Wards & Streets under this TP */}
                                      {tpWards.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-50">
                                          {tpWards.map((ws: any) => (
                                            <span key={ws.id} className="inline-flex items-center gap-1 bg-indigo-50/70 border border-indigo-100 text-[10px] font-medium text-indigo-800 px-2 py-0.5 rounded-md">
                                              <span className="font-bold text-indigo-900">{lang === 'ta' ? 'வார்டு' : 'Ward'} {ws.wardNo}:</span>
                                              <span>{lang === 'ta' ? (ws.streetNameTa || ws.streetNameEn) : (ws.streetNameEn || ws.streetNameTa)}</span>
                                              <button
                                                onClick={() => {
                                                  setEditingType('ward_street');
                                                  setEditingId(ws.id);
                                                  setEditNameEn(ws.streetNameEn);
                                                  setEditNameTa(ws.streetNameTa);
                                                  setEditWardNo(ws.wardNo);
                                                  setEditTpId(ws.tpId);
                                                }}
                                                className="hover:text-indigo-950 text-indigo-400 transition ml-0.5"
                                                title="Edit Ward & Street"
                                              >
                                                ✎
                                              </button>
                                              <button
                                                onClick={() => handleDeleteMasterItem('wardsAndStreets', ws.id)}
                                                className="hover:text-red-600 text-indigo-400 transition ml-0.5"
                                                title="Delete Street"
                                              >
                                                ×
                                              </button>
                                            </span>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-[10px] text-gray-400 italic">
                                          {lang === 'ta' ? 'வார்டு/தெரு சேர்க்கப்படவில்லை' : 'No wards/streets mapped yet'}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                                {distTPs.length === 0 && (
                                  <span className="text-[11px] text-gray-400 italic pl-1">{lang === 'ta' ? 'பேரூராட்சிகள் இல்லை' : 'No town panchayats added yet'}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {zoneDistricts.length === 0 && (
                          <p className="text-xs text-gray-400 italic pl-2">{lang === 'ta' ? 'மாவட்டங்கள் இல்லை' : 'No districts mapped to this zone yet'}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
                {zones.length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-sm text-gray-400 italic">{lang === 'ta' ? 'மண்டலங்கள் எதுவும் இல்லை. புதிய மண்டலத்தை சேர்க்கவும் அல்லது CSV-யை பதிவேற்றவும்.' : 'No zones created yet. Create a zone or upload a CSV above.'}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Side */}
          <div className="lg:col-span-5 space-y-6">
            {/* Create Post */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
              <h4 className="font-semibold text-gray-800 text-sm border-b border-gray-100 pb-2 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-500" />
                {lang === 'ta' ? 'பதவி உருவாக்கம்' : 'Create Post Master'}
              </h4>
              <form onSubmit={handleAddPost} className="space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-gray-400">{t('postNameEn')}</label>
                  <input
                    type="text"
                    value={postEn}
                    onChange={(e) => setPostEn(e.target.value)}
                    placeholder="e.g. Executive Officer"
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-xs mt-1 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-400">{t('postNameTa')}</label>
                  <input
                    type="text"
                    value={postTa}
                    onChange={(e) => setPostTa(e.target.value)}
                    placeholder="எ.கா. செயல் அலுவலர்"
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-xs mt-1 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-400">{t('payLevel')}</label>
                  <select
                    value={postPayLevelId}
                    onChange={(e) => setPostPayLevelId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-xs mt-1 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    <option value="">-- Choose Pay Scale --</option>
                    {payLevels.map((p: any) => (
                      <option key={p.id} value={p.id}>{tObj(p)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-400">{t('nature')}</label>
                  <select
                    value={postNatureId}
                    onChange={(e) => setPostNatureId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-xs mt-1 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    <option value="">-- Choose Nature --</option>
                    {postNatures.map((n: any) => (
                      <option key={n.id} value={n.id}>{tObj(n)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-400">{t('category')}</label>
                  <select
                    value={postCategoryId}
                    onChange={(e) => setPostCategoryId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-xs mt-1 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    <option value="">-- Choose Category --</option>
                    {employeeCategories.map((c: any) => (
                      <option key={c.id} value={c.id}>{tObj(c)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-gray-400">{t('group')}</label>
                  <select
                    value={postGroupId}
                    onChange={(e) => setPostGroupId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-2.5 text-xs mt-1 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    <option value="">-- Choose Group --</option>
                    {employeeGroups.map((g: any) => (
                      <option key={g.id} value={g.id}>{tObj(g)}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition">
                  {lang === 'ta' ? 'பதவியை சேர்' : 'Add Post'}
                </button>
              </form>
            </div>

            {/* Create Pay Level */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
              <h4 className="font-semibold text-gray-800 text-sm border-b border-gray-100 pb-2 flex items-center gap-2">
                <Grid className="w-4 h-4 text-indigo-500" />
                {lang === 'ta' ? 'சம்பள நிலை உருவாக்கம்' : 'Create Pay Level Master'}
              </h4>
              <form onSubmit={handleAddPayLevel} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400">{t('payLevelEn')}</label>
                    <input
                      type="text"
                      value={payLevelEn}
                      onChange={(e) => setPayLevelEn(e.target.value)}
                      placeholder="e.g. PB 1"
                      className="w-full border border-gray-200 rounded-xl p-2.5 text-xs mt-1 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400">{t('payLevelTa')}</label>
                    <input
                      type="text"
                      value={payLevelTa}
                      onChange={(e) => setPayLevelTa(e.target.value)}
                      placeholder="எ.கா. பிபி 1"
                      className="w-full border border-gray-200 rounded-xl p-2.5 text-xs mt-1 outline-none"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400">{t('minPay')}</label>
                    <input
                      type="number"
                      value={minPay}
                      onChange={(e) => setMinPay(e.target.value)}
                      placeholder="15700"
                      className="w-full border border-gray-200 rounded-xl p-2.5 text-xs mt-1 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400">{t('maxPay')}</label>
                    <input
                      type="number"
                      value={maxPay}
                      onChange={(e) => setMaxPay(e.target.value)}
                      placeholder="50000"
                      className="w-full border border-gray-200 rounded-xl p-2.5 text-xs mt-1 outline-none"
                      required
                    />
                  </div>
                </div>
                <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition">
                  {lang === 'ta' ? 'சம்பள நிலையை சேர்' : 'Add Pay Level'}
                </button>
              </form>
            </div>

            {/* Other quick masters (Category, Nature, Transfer Reasons) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Category form */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-2">
                <span className="text-xs font-bold text-gray-800">{lang === 'ta' ? 'ஊழியர் பிரிவு' : 'Category'}</span>
                <input
                  type="text"
                  placeholder="En (e.g. Engineering)"
                  value={categoryEn}
                  onChange={(e) => setCategoryEn(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                />
                <input
                  type="text"
                  placeholder="Ta (எ.கா. பொறியியல்)"
                  value={categoryTa}
                  onChange={(e) => setCategoryTa(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                />
                <button onClick={handleAddCategory} className="w-full py-1.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-[11px] font-semibold transition">
                  + Add Category
                </button>
              </div>

              {/* Post Nature form */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-2">
                <span className="text-xs font-bold text-gray-800">{lang === 'ta' ? 'பதவித் தன்மை' : 'Post Nature'}</span>
                <input
                  type="text"
                  placeholder="En (e.g. Provincialised)"
                  value={natureEn}
                  onChange={(e) => setNatureEn(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                />
                <input
                  type="text"
                  placeholder="Ta (எ.கா. மாநில அளவிலானது)"
                  value={natureTa}
                  onChange={(e) => setNatureTa(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                />
                <button onClick={handleAddNature} className="w-full py-1.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-[11px] font-semibold transition">
                  + Add Nature
                </button>
              </div>

              {/* Transfer Reason form */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-2">
                <span className="text-xs font-bold text-gray-800">{lang === 'ta' ? 'இடமாற்றக் காரணம்' : 'Transfer Reason'}</span>
                <input
                  type="text"
                  placeholder="En (e.g. Spouse Employment)"
                  value={transferReasonEn}
                  onChange={(e) => setTransferReasonEn(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                />
                <input
                  type="text"
                  placeholder="Ta (எ.கா. மருத்துவ காரணங்கள்)"
                  value={transferReasonTa}
                  onChange={(e) => setTransferReasonTa(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg p-2 text-xs"
                />
                <button onClick={handleAddTransferReason} className="w-full py-1.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-[11px] font-semibold transition">
                  + Add Reason
                </button>
              </div>
            </div>
          </div>

          {/* List Side */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-6">
            {/* Posts list */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-800 text-sm flex items-center justify-between border-b border-gray-100 pb-2">
                <span>{lang === 'ta' ? 'பதவிகள் பட்டியல்' : 'Designatory Posts Registry'}</span>
                <span className="text-xs text-gray-400 font-normal">({posts.length} {lang === 'ta' ? 'பதவிகள்' : 'posts'})</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {posts.map((p: any) => {
                  const pay = payLevels.find((pl: any) => pl.id === p.payLevelId);
                  const nat = postNatures.find((n: any) => n.id === p.postNatureId);
                  const cat = employeeCategories.find((c: any) => c.id === p.categoryId);
                  return (
                    <div key={p.id} className="flex flex-col gap-1 p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs relative pr-8">
                      <div className="font-bold text-indigo-800">{tObj(p)}</div>
                      <div className="flex flex-col gap-0.5 text-[10px] text-gray-500 mt-1">
                        {pay && <span className="truncate">🎯 <span className="font-semibold">{t('payLevel')}:</span> {tObj(pay)}</span>}
                        {nat && <span className="truncate">🌿 <span className="font-semibold">{t('nature')}:</span> {tObj(nat)}</span>}
                        {cat && <span className="truncate">📁 <span className="font-semibold">{t('category')}:</span> {tObj(cat)}</span>}
                        {p.groupId && <span className="truncate">👥 <span className="font-semibold">{t('group')}:</span> Group {p.groupId}</span>}
                      </div>
                      <button 
                        onClick={() => handleDeleteMasterItem('posts', p.id)} 
                        className="absolute top-2.5 right-2 text-gray-400 hover:text-red-500 transition text-base font-bold"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pay scales list */}
            <div className="space-y-3">
              <h4 className="font-semibold text-gray-800 text-sm flex items-center justify-between border-b border-gray-100 pb-2">
                <span>{lang === 'ta' ? 'சம்பள நிலைகள் பட்டியல்' : 'Pay Scale Matrix'}</span>
                <span className="text-xs text-gray-400 font-normal">({payLevels.length} {lang === 'ta' ? 'நிலைகள்' : 'levels'})</span>
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {payLevels.map((p: any) => (
                  <div key={p.id} className="flex justify-between items-center p-2.5 bg-gray-50 border border-gray-100 rounded-lg text-xs">
                    <span className="font-semibold text-gray-700">{tObj(p)}</span>
                    <button onClick={() => handleDeleteMasterItem('payLevels', p.id)} className="p-1 hover:text-red-600 text-gray-400 rounded transition">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Employee Categories, Natures & Transfer Reasons lists side-by-side */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-gray-100 pt-4">
              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-800 block truncate">{lang === 'ta' ? 'ஊழியர் பிரிவுகள்' : 'Employee Categories'}</span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {employeeCategories.map((c: any) => (
                    <div key={c.id} className="flex justify-between items-center p-2 bg-gray-50 rounded text-[11px]">
                      <span className="text-gray-600 truncate">{tObj(c)}</span>
                      <button onClick={() => handleDeleteMasterItem('employeeCategories', c.id)} className="hover:text-red-600 text-gray-400">×</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-800 block truncate">{lang === 'ta' ? 'பதவி தன்மைகள்' : 'Post Natures'}</span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {postNatures.map((n: any) => (
                    <div key={n.id} className="flex justify-between items-center p-2 bg-gray-50 rounded text-[11px]">
                      <span className="text-gray-600 truncate">{tObj(n)}</span>
                      <button onClick={() => handleDeleteMasterItem('postNatures', n.id)} className="hover:text-red-600 text-gray-400">×</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-gray-800 block truncate">{lang === 'ta' ? 'இடமாற்றக் காரணங்கள்' : 'Transfer Reasons'}</span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {transferReasons.map((r: any) => (
                    <div key={r.id} className="flex justify-between items-center p-2 bg-gray-50 rounded text-[11px]">
                      <span className="text-gray-600 truncate">{tObj(r)}</span>
                      <button onClick={() => handleDeleteMasterItem('transferReasons', r.id)} className="hover:text-red-600 text-gray-400">×</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingType && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full p-6 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-800">
                {lang === 'ta' ? 'விவரங்களை மாற்று' : 'Edit Hierarchy Item'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingType(null)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {lang === 'ta' ? 'பெயர் (ஆங்கிலம்)' : 'Name (English)'}
                </label>
                <input
                  type="text"
                  value={editNameEn}
                  onChange={(e) => setEditNameEn(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {lang === 'ta' ? 'பெயர் (தமிழ்)' : 'Name (Tamil)'}
                </label>
                <input
                  type="text"
                  value={editNameTa}
                  onChange={(e) => setEditNameTa(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              {editingType === 'district' && (
                <>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {lang === 'ta' ? 'மண்டலம்' : 'Zone'}
                    </label>
                    <select
                      value={editZoneId}
                      onChange={(e) => setEditZoneId(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                      required
                    >
                      <option value="">{lang === 'ta' ? 'மண்டலத்தைத் தேர்ந்தெடுக்கவும்' : 'Select Zone'}</option>
                      {zones.map((z: any) => (
                        <option key={z.id} value={z.id}>{tObj(z)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {lang === 'ta' ? 'மாவட்டக் குறியீடு (2 இலக்கம்)' : 'District Code (2-digit)'}
                    </label>
                    <input
                      type="text"
                      maxLength={2}
                      value={editDistrictCode}
                      onChange={(e) => setEditDistrictCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="01"
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none font-mono"
                    />
                  </div>
                </>
              )}

              {editingType === 'tp' && (
                <>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {lang === 'ta' ? 'மாவட்டம்' : 'District'}
                    </label>
                    <select
                      value={editDistrictId}
                      onChange={(e) => setEditDistrictId(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                      required
                    >
                      <option value="">{lang === 'ta' ? 'மாவட்டத்தைத் தேர்ந்தெடுக்கவும்' : 'Select District'}</option>
                      {districts.map((d: any) => (
                        <option key={d.id} value={d.id}>{tObj(d)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {lang === 'ta' ? 'பேரூராட்சிக் குறியீடு (2 இலக்கம்)' : 'Town Panchayat Code (2-digit)'}
                    </label>
                    <input
                      type="text"
                      maxLength={2}
                      value={editTpCode}
                      onChange={(e) => setEditTpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="01"
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none font-mono"
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
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat'}
                    </label>
                    <select
                      value={editTpId}
                      onChange={(e) => setEditTpId(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                      required
                    >
                      <option value="">{lang === 'ta' ? 'பேரூராட்சியைத் தேர்ந்தெடுக்கவும்' : 'Select Town Panchayat'}</option>
                      {townPanchayats.map((tp: any) => (
                        <option key={tp.id} value={tp.id}>{tObj(tp)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {t('wardNo')}
                    </label>
                    <input
                      type="text"
                      value={editWardNo}
                      onChange={(e) => setEditWardNo(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                      required
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingType(null)}
                  className="flex-1 py-3 border border-gray-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                >
                  {lang === 'ta' ? 'ரத்துசெய்' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {lang === 'ta' ? 'சேமி' : 'Save Changes'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
