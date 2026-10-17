'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  ShieldAlert, 
  Building, 
  UserPlus, 
  Eye, 
  EyeOff, 
  Trash2, 
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  FileSpreadsheet,
  Download,
  UploadCloud,
  AlertCircle,
  Edit,
  X,
  Settings2,
  Lock,
  Key,
  ShieldCheck,
  CheckSquare,
  Square,
  Search,
  SlidersHorizontal,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  LayoutDashboard
} from 'lucide-react';
import { Language, translations } from './translations';
import { 
  SYSTEM_PAGES, 
  getDefaultRolePages, 
  getUserEffectiveAllowedPages, 
  ALL_PAGE_IDS, 
  SystemPage 
} from '@/lib/pageAccessControl';

interface UserManagementViewProps {
  state: any;
  lang: Language;
  onSaveCollection: (key: string, data: any[]) => Promise<void>;
}

export default function UserManagementView({ state, lang, onSaveCollection }: UserManagementViewProps) {
  const [activeTab, setActiveTab] = useState<'roles' | 'offices' | 'create_user' | 'user_list' | 'page_access'>('user_list');
  const [csvFeedback, setCsvFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    zones = [],
    districts = [],
    townPanchayats = [],
    posts = [],
    roles = [],
    users = [],
    officeCategories = []
  } = state || {};

  // Page Access Control States
  const [accessMode, setAccessMode] = useState<'role_wise' | 'user_wise'>('role_wise');
  const [selectedRoleForAccess, setSelectedRoleForAccess] = useState<string>('');
  const [selectedUserForAccess, setSelectedUserForAccess] = useState<string>('');
  const [pageAccessSearch, setPageAccessSearch] = useState<string>('');
  const [pageCategoryFilter, setPageCategoryFilter] = useState<string>('ALL');
  const [pageAccessFeedback, setPageAccessFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [savingPageAccess, setSavingPageAccess] = useState(false);

  // Draft buffers for editing
  const [rolePermissionsDraft, setRolePermissionsDraft] = useState<{ [roleId: string]: string[] }>({});
  const [userCustomPermissionsDraft, setUserCustomPermissionsDraft] = useState<{ [userId: string]: string[] }>({});
  const [userIsCustomDraft, setUserIsCustomDraft] = useState<{ [userId: string]: boolean }>({});

  // Helper to get effective role permissions
  const getRolePermissions = (roleId: string): string[] => {
    if (rolePermissionsDraft[roleId]) {
      return rolePermissionsDraft[roleId];
    }
    const role = roles.find((r: any) => r.id === roleId);
    if (role?.pagePermissions && Array.isArray(role.pagePermissions) && role.pagePermissions.length > 0) {
      return role.pagePermissions;
    }
    return getDefaultRolePages(roleId);
  };

  // Helper to get effective user permissions
  const getUserPermissionsInfo = (user: any) => {
    if (!user) return { isCustom: false, pages: [], rolePages: [] };
    const rolePages = getRolePermissions(user.roleId || '');
    const isCustom = userIsCustomDraft[user.id] !== undefined
      ? userIsCustomDraft[user.id]
      : Array.isArray(user.customPagePermissions);

    let pages: string[];
    if (userCustomPermissionsDraft[user.id]) {
      pages = userCustomPermissionsDraft[user.id];
    } else if (isCustom && Array.isArray(user.customPagePermissions)) {
      pages = user.customPagePermissions;
    } else {
      pages = rolePages;
    }
    return { isCustom, pages, rolePages };
  };

  const handleToggleRolePage = (roleId: string, pageId: string) => {
    const current = getRolePermissions(roleId);
    const updated = current.includes(pageId)
      ? current.filter(id => id !== pageId)
      : [...current, pageId];
    setRolePermissionsDraft(prev => ({ ...prev, [roleId]: updated }));
  };

  const handleSelectAllRolePages = (roleId: string) => {
    setRolePermissionsDraft(prev => ({ ...prev, [roleId]: [...ALL_PAGE_IDS] }));
  };

  const handleDeselectAllRolePages = (roleId: string) => {
    setRolePermissionsDraft(prev => ({ ...prev, [roleId]: ['dashboard'] }));
  };

  const handleResetRolePages = (roleId: string) => {
    setRolePermissionsDraft(prev => ({ ...prev, [roleId]: getDefaultRolePages(roleId) }));
  };

  const handleSaveRolePermissions = async (roleId: string) => {
    setSavingPageAccess(true);
    setPageAccessFeedback(null);
    try {
      const allowedPages = getRolePermissions(roleId);
      const updatedRoles = roles.map((r: any) => {
        if (r.id === roleId) {
          return { ...r, pagePermissions: allowedPages };
        }
        return r;
      });
      await onSaveCollection('roles', updatedRoles);
      const targetRole = roles.find((r: any) => r.id === roleId);
      const count = users.filter((u: any) => u.roleId === roleId && !Array.isArray(u.customPagePermissions)).length;
      setPageAccessFeedback({
        type: 'success',
        message: lang === 'ta'
          ? `"${tObj(targetRole)}" பங்கிற்கான பக்க அனுமதிகள் வெற்றிகரமாக சேமிக்கப்பட்டன! அந்தப் பங்கில் உள்ள ${count} பயனர்களுக்கும் உடனடியாகப் பொருந்தும்.`
          : `Page permissions for "${targetRole?.nameEn || roleId}" saved successfully! Applied to ${count} users with this role.`
      });
    } catch (e: any) {
      setPageAccessFeedback({
        type: 'error',
        message: lang === 'ta' ? 'அனுமதிகளை சேமிப்பதில் பிழை ஏற்பட்டது.' : 'Failed to save role permissions.'
      });
    } finally {
      setSavingPageAccess(false);
    }
  };

  const handleToggleUserPage = (userId: string, pageId: string) => {
    const user = users.find((u: any) => u.id === userId);
    if (!user) return;
    const { pages } = getUserPermissionsInfo(user);
    const updated = pages.includes(pageId)
      ? pages.filter(id => id !== pageId)
      : [...pages, pageId];
    setUserIsCustomDraft(prev => ({ ...prev, [userId]: true }));
    setUserCustomPermissionsDraft(prev => ({ ...prev, [userId]: updated }));
  };

  const handleSetUserCustomMode = (userId: string, isCustom: boolean) => {
    const user = users.find((u: any) => u.id === userId);
    if (!user) return;
    setUserIsCustomDraft(prev => ({ ...prev, [userId]: isCustom }));
    if (isCustom && !userCustomPermissionsDraft[userId]) {
      const rolePages = getRolePermissions(user.roleId || '');
      setUserCustomPermissionsDraft(prev => ({ ...prev, [userId]: [...rolePages] }));
    }
  };

  const handleSelectAllUserPages = (userId: string) => {
    setUserIsCustomDraft(prev => ({ ...prev, [userId]: true }));
    setUserCustomPermissionsDraft(prev => ({ ...prev, [userId]: [...ALL_PAGE_IDS] }));
  };

  const handleDeselectAllUserPages = (userId: string) => {
    setUserIsCustomDraft(prev => ({ ...prev, [userId]: true }));
    setUserCustomPermissionsDraft(prev => ({ ...prev, [userId]: ['dashboard'] }));
  };

  const handleCopyFromRole = (userId: string) => {
    const user = users.find((u: any) => u.id === userId);
    if (!user) return;
    const rolePages = getRolePermissions(user.roleId || '');
    setUserIsCustomDraft(prev => ({ ...prev, [userId]: true }));
    setUserCustomPermissionsDraft(prev => ({ ...prev, [userId]: [...rolePages] }));
  };

  const handleSaveUserPermissions = async (userId: string) => {
    setSavingPageAccess(true);
    setPageAccessFeedback(null);
    try {
      const user = users.find((u: any) => u.id === userId);
      if (!user) return;
      const isCustom = userIsCustomDraft[userId] !== undefined
        ? userIsCustomDraft[userId]
        : Array.isArray(user.customPagePermissions);
      
      const customPages = isCustom 
        ? (userCustomPermissionsDraft[userId] || user.customPagePermissions || getRolePermissions(user.roleId || '')) 
        : null;

      const updatedUsers = users.map((u: any) => {
        if (u.id === userId) {
          return {
            ...u,
            customPagePermissions: customPages
          };
        }
        return u;
      });

      await onSaveCollection('users', updatedUsers);
      setPageAccessFeedback({
        type: 'success',
        message: lang === 'ta'
          ? `"${tObj(user)}" பயனருக்கான பக்க அனுமதிகள் வெற்றிகரமாக சேமிக்கப்பட்டன!`
          : `Page access permissions for "${user.nameEn || user.username}" saved successfully!`
      });
    } catch (e: any) {
      setPageAccessFeedback({
        type: 'error',
        message: lang === 'ta' ? 'பயனர் அனுமதிகளை சேமிப்பதில் பிழை ஏற்பட்டது.' : 'Failed to save user permissions.'
      });
    } finally {
      setSavingPageAccess(false);
    }
  };

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [scopeType, setScopeType] = useState<'HOD' | 'Zone' | 'TownPanchayat'>('HOD');
  const [scopeId, setScopeId] = useState('all');
  const [fullNameEn, setFullNameEn] = useState('');
  const [fullNameTa, setFullNameTa] = useState('');

  // Edit user states
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRoleId, setEditRoleId] = useState('');
  const [editScopeType, setEditScopeType] = useState<'HOD' | 'Zone' | 'TownPanchayat'>('HOD');
  const [editScopeId, setEditScopeId] = useState('all');
  const [editFullNameEn, setEditFullNameEn] = useState('');
  const [editFullNameTa, setEditFullNameTa] = useState('');

  const handleStartEditUser = (user: any) => {
    setEditingUser(user);
    setEditUsername(user.username || '');
    setEditPassword(user.passwordHash || '');
    setEditRoleId(user.roleId || '');
    setEditScopeType(user.scopeType || 'HOD');
    setEditScopeId(user.scopeId || 'all');
    setEditFullNameEn(user.nameEn || '');
    setEditFullNameTa(user.nameTa || '');
  };

  const handleUpdateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editUsername || !editPassword || !editRoleId || !editFullNameEn || !editFullNameTa) return;

    const updatedUsers = users.map((u: any) => {
      if (u.id === editingUser.id) {
        return {
          ...u,
          username: editUsername,
          passwordHash: editPassword,
          roleId: editRoleId,
          scopeType: editScopeType,
          scopeId: editScopeType === 'HOD' ? 'all' : editScopeId,
          nameEn: editFullNameEn,
          nameTa: editFullNameTa
        };
      }
      return u;
    });

    await onSaveCollection('users', updatedUsers);
    setEditingUser(null);
  };

  // Password visibility
  const [showPasswords, setShowPasswords] = useState<{ [userId: string]: boolean }>({});

  // Office Category states
  const [officeNameEn, setOfficeNameEn] = useState('');
  const [officeNameTa, setOfficeNameTa] = useState('');
  const [officeType, setOfficeType] = useState('DTP'); // DTP, ADTP, TP
  const [officeZoneId, setOfficeZoneId] = useState('');
  const [officeDistrictId, setOfficeDistrictId] = useState('');
  const [officeTPId, setOfficeTPId] = useState('');
  const [sanctions, setSanctions] = useState<{ [postId: string]: number }>({});
  const officeCsvInputRef = useRef<HTMLInputElement>(null);

  const t = (key: keyof typeof translations['en']) => {
    return translations[lang][key] || translations['en'][key] || key;
  };

  const tObj = (obj: any) => {
    if (!obj) return '';
    return lang === 'ta' ? (obj.nameTa || obj.nameEn) : (obj.nameEn || obj.nameTa);
  };

  const getSelectedOfficeDetails = () => {
    if (officeType === 'DTP') {
      return {
        targetId: 'dtp',
        nameEn: 'Directorate (DTP)',
        nameTa: 'இயக்குநரகம் (DTP)',
        isValid: true
      };
    } else if (officeType === 'ADTP') {
      const zone = zones.find((z: any) => z.id === officeZoneId);
      if (zone) {
        return {
          targetId: officeZoneId,
          nameEn: `${zone.nameEn} Zone - ADTP`,
          nameTa: `${zone.nameTa || zone.nameEn} மண்டலம் - ADTP`,
          isValid: true
        };
      }
      return { targetId: '', nameEn: '', nameTa: '', isValid: false };
    } else if (officeType === 'TP') {
      const tp = townPanchayats.find((t: any) => t.id === officeTPId);
      if (tp) {
        return {
          targetId: officeTPId,
          nameEn: `${tp.nameEn} Town Panchayat`,
          nameTa: `${tp.nameTa || tp.nameEn} பேரூராட்சி`,
          isValid: true
        };
      }
      return { targetId: '', nameEn: '', nameTa: '', isValid: false };
    }
    return { targetId: '', nameEn: '', nameTa: '', isValid: false };
  };

  const currentOfficeDetails = getSelectedOfficeDetails();
  const isDuplicateOffice = officeCategories.some((oc: any) => 
    (oc.targetId && oc.targetId === currentOfficeDetails.targetId && currentOfficeDetails.targetId !== '') ||
    (oc.nameEn.toLowerCase() === currentOfficeDetails.nameEn.toLowerCase() && currentOfficeDetails.nameEn !== '')
  );

  // User save handler
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !selectedRoleId || !fullNameEn || !fullNameTa) return;

    const newUser = {
      id: 'u' + (users.length + 1) + '_' + Math.random().toString(36).substr(2, 4),
      username,
      passwordHash: password,
      roleId: selectedRoleId,
      scopeType,
      scopeId: scopeType === 'HOD' ? 'all' : scopeId,
      status: 'Active' as 'Active' | 'Inactive',
      nameEn: fullNameEn,
      nameTa: fullNameTa
    };

    await onSaveCollection('users', [...users, newUser]);
    setUsername('');
    setPassword('');
    setFullNameEn('');
    setFullNameTa('');
    setScopeId('all');
  };

  // Office category save handler
  const handleAddOfficeCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const details = getSelectedOfficeDetails();
    if (!details.isValid || isDuplicateOffice) return;

    const newCategory = {
      id: 'oc_' + Math.random().toString(36).substr(2, 4),
      nameEn: details.nameEn,
      nameTa: details.nameTa,
      type: officeType,
      targetId: details.targetId,
      sanctions: { ...sanctions }
    };

    await onSaveCollection('officeCategories', [...officeCategories, newCategory]);
    setOfficeZoneId('');
    setOfficeDistrictId('');
    setOfficeTPId('');
    setSanctions({});
  };

  const handleUpdateSanction = (postId: string, count: number) => {
    setSanctions(prev => ({
      ...prev,
      [postId]: count >= 0 ? count : 0
    }));
  };

  // CSV Template download and upload for Office configurations
  const handleDownloadOfficeTemplate = () => {
    const headers = ['OfficeType', 'ZoneName', 'DistrictName', 'TownPanchayatName', ...posts.map((p: any) => p.nameEn)];
    const escapedHeaders = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',');
    
    const sampleRows = [
      ['DTP', '', '', '', ...posts.map((_: any, i: number) => i === 0 ? '5' : '2')],
      ['ADTP', 'Coimbatore', '', '', ...posts.map((_: any, i: number) => i === 0 ? '3' : '1')],
      ['TP', 'Coimbatore', 'Coimbatore', 'Sulur', ...posts.map((_: any, i: number) => i === 0 ? '2' : '1')]
    ];
    
    const csvLines = [escapedHeaders];
    for (const row of sampleRows) {
      csvLines.push(row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','));
    }
    
    const csvContent = "\uFEFF" + csvLines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Office_Post_Sanctions_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const parseCSVRow = (text: string) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleOfficeCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setCsvFeedback({ type: 'error', message: 'The CSV is empty.' });
        return;
      }

      try {
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length <= 1) {
          setCsvFeedback({ type: 'error', message: 'The CSV is empty or has no data rows.' });
          return;
        }

        const headers = parseCSVRow(lines[0]);
        if (headers.length < 4) {
          setCsvFeedback({ type: 'error', message: 'Invalid CSV format. Must have OfficeType, ZoneName, DistrictName, and TownPanchayatName headers.' });
          return;
        }

        const colToPostId: { [colIndex: number]: string } = {};
        for (let i = 4; i < headers.length; i++) {
          const headerName = headers[i].toLowerCase();
          const matchedPost = posts.find((p: any) => 
            p.nameEn.toLowerCase() === headerName || 
            p.nameTa?.toLowerCase() === headerName ||
            p.id.toLowerCase() === headerName
          );
          if (matchedPost) {
            colToPostId[i] = matchedPost.id;
          }
        }

        const updatedOfficeCategories = [...officeCategories];
        let addedCount = 0;
        let updatedCount = 0;

        const updatedZones = [...zones];
        const updatedDistricts = [...districts];
        const updatedTownPanchayats = [...townPanchayats];
        let stateChanged = false;

        for (let i = 1; i < lines.length; i++) {
          const row = parseCSVRow(lines[i]);
          if (row.length < 4) continue;

          const csvOfficeType = row[0].toUpperCase();
          const csvZoneName = row[1];
          const csvDistrictName = row[2];
          const csvTownPanchayatName = row[3];

          if (!['DTP', 'ADTP', 'TP'].includes(csvOfficeType)) {
            continue;
          }

          let targetId = '';
          let resolvedNameEn = '';
          let resolvedNameTa = '';

          if (csvOfficeType === 'DTP') {
            targetId = 'dtp';
            resolvedNameEn = 'Directorate (DTP)';
            resolvedNameTa = 'இயக்குநரகம் (DTP)';
          } else if (csvOfficeType === 'ADTP') {
            if (!csvZoneName) continue;
            let matchedZone = updatedZones.find((z: any) => 
              z.nameEn.toLowerCase() === csvZoneName.toLowerCase() ||
              z.nameTa?.toLowerCase() === csvZoneName.toLowerCase()
            );
            if (!matchedZone) {
              const newZoneId = 'z_csv_' + Math.random().toString(36).substr(2, 4);
              matchedZone = { id: newZoneId, nameEn: csvZoneName, nameTa: csvZoneName };
              updatedZones.push(matchedZone);
              stateChanged = true;
            }
            targetId = matchedZone.id;
            resolvedNameEn = `${matchedZone.nameEn} Zone - ADTP`;
            resolvedNameTa = `${matchedZone.nameTa || matchedZone.nameEn} மண்டலம் - ADTP`;
          } else if (csvOfficeType === 'TP') {
            if (!csvTownPanchayatName) continue;
            let matchedTP = updatedTownPanchayats.find((tp: any) => 
              tp.nameEn.toLowerCase() === csvTownPanchayatName.toLowerCase() ||
              tp.nameTa?.toLowerCase() === csvTownPanchayatName.toLowerCase()
            );

            if (!matchedTP) {
              let matchedZone = updatedZones.find((z: any) => 
                z.nameEn.toLowerCase() === (csvZoneName || 'default').toLowerCase() ||
                z.nameTa?.toLowerCase() === (csvZoneName || 'default').toLowerCase()
              );
              if (!matchedZone && csvZoneName) {
                const newZoneId = 'z_csv_' + Math.random().toString(36).substr(2, 4);
                matchedZone = { id: newZoneId, nameEn: csvZoneName, nameTa: csvZoneName };
                updatedZones.push(matchedZone);
                stateChanged = true;
              }

              let matchedDistrict = updatedDistricts.find((d: any) => 
                d.nameEn.toLowerCase() === (csvDistrictName || 'default').toLowerCase() ||
                d.nameTa?.toLowerCase() === (csvDistrictName || 'default').toLowerCase()
              );
              if (!matchedDistrict && csvDistrictName) {
                const newDistId = 'd_csv_' + Math.random().toString(36).substr(2, 4);
                matchedDistrict = { id: newDistId, zoneId: matchedZone?.id || 'z_default', nameEn: csvDistrictName, nameTa: csvDistrictName };
                updatedDistricts.push(matchedDistrict);
                stateChanged = true;
              }

              const newTPId = 'tp_csv_' + Math.random().toString(36).substr(2, 4);
              matchedTP = { id: newTPId, districtId: matchedDistrict?.id || 'd_default', nameEn: csvTownPanchayatName, nameTa: csvTownPanchayatName };
              updatedTownPanchayats.push(matchedTP);
              stateChanged = true;
            }

            targetId = matchedTP.id;
            resolvedNameEn = `${matchedTP.nameEn} Town Panchayat`;
            resolvedNameTa = `${matchedTP.nameTa || matchedTP.nameEn} பேரூராட்சி`;
          }

          if (!targetId) continue;

          const rowSanctions: { [postId: string]: number } = {};
          for (let j = 4; j < row.length; j++) {
            const postId = colToPostId[j];
            if (postId) {
              rowSanctions[postId] = parseInt(row[j]) || 0;
            }
          }

          const existingIndex = updatedOfficeCategories.findIndex((oc: any) => oc.targetId === targetId);
          if (existingIndex > -1) {
            updatedOfficeCategories[existingIndex] = {
              ...updatedOfficeCategories[existingIndex],
              nameEn: resolvedNameEn,
              nameTa: resolvedNameTa,
              type: csvOfficeType,
              sanctions: {
                ...updatedOfficeCategories[existingIndex].sanctions,
                ...rowSanctions
              }
            };
            updatedCount++;
          } else {
            updatedOfficeCategories.push({
              id: 'oc_' + Math.random().toString(36).substr(2, 4),
              nameEn: resolvedNameEn,
              nameTa: resolvedNameTa,
              type: csvOfficeType,
              targetId,
              sanctions: rowSanctions
            });
            addedCount++;
          }
        }

        if (stateChanged) {
          await onSaveCollection('zones', updatedZones);
          await onSaveCollection('districts', updatedDistricts);
          await onSaveCollection('townPanchayats', updatedTownPanchayats);
        }
        await onSaveCollection('officeCategories', updatedOfficeCategories);

        setCsvFeedback({
          type: 'success',
          message: lang === 'ta'
            ? `CSV கோப்பு வெற்றிகரமாக பதிவேற்றப்பட்டது. ${addedCount} புதிய அலுவலகங்கள் சேர்க்கப்பட்டன, ${updatedCount} அலுவலகங்கள் புதுப்பிக்கப்பட்டன.`
            : `Office configurations imported successfully! Added ${addedCount} new office(s) and updated ${updatedCount} existing office(s).`
        });
      } catch (err: any) {
        setCsvFeedback({ type: 'error', message: 'Error parsing office CSV file.' });
      }
    };
    reader.readAsText(file);
    if (officeCsvInputRef.current) officeCsvInputRef.current.value = '';
  };

  // Toggle user status
  const toggleUserStatus = async (userId: string) => {
    const updatedUsers = users.map((u: any) => {
      if (u.id === userId) {
        return { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' };
      }
      return u;
    });
    await onSaveCollection('users', updatedUsers);
  };

  // Delete user account
  const handleDeleteUser = async (userId: string) => {
    const updated = users.filter((u: any) => u.id !== userId);
    await onSaveCollection('users', updated);
  };

  const togglePasswordVisibility = (userId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  // CSV bulk template downloader with actual system details
  const downloadUsersTemplate = () => {
    const rows = [
      "Username,Password,RoleID,ScopeType,ScopeNameEn,FullNameEn,FullNameTa"
    ];

    if (townPanchayats && townPanchayats.length > 0) {
      townPanchayats.slice(0, 15).forEach((tp: any) => {
        const cleanName = (tp.nameEn || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
        const eoRole = roles.find((r: any) => r.id === 'eo' || r.code === 'eo') || { id: 'eo' };
        rows.push(`eo_${cleanName},pass123,${eoRole.id},TownPanchayat,"${tp.nameEn}","EO ${tp.nameEn} Office","செயல் அலுவலர் ${tp.nameTa || tp.nameEn}"`);
      });
    } else {
      rows.push("eo_thiruporur,pass123,eo,TownPanchayat,Thiruporur,Eo Thiruporur Office,செயல் அலுவலர் திருப்போரூர்");
    }

    if (zones && zones.length > 0) {
      zones.forEach((z: any) => {
        const cleanName = (z.nameEn || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
        const adRole = roles.find((r: any) => r.id === 'ad' || r.code === 'ad') || { id: 'ad' };
        rows.push(`ad_${cleanName},pass123,${adRole.id},Zone,"${z.nameEn}","AD ${z.nameEn} Office","மண்டல உதவி இயக்குனர் ${z.nameTa || z.nameEn}"`);
      });
    } else {
      rows.push("ad_kanchipuram,pass456,ad,Zone,Kanchipuram,AD Kanchipuram,மண்டல உதவி இயக்குனர்");
    }

    // Always include HOD administrator row
    const adminRole = roles.find((r: any) => r.id === 'admin') || { id: 'admin' };
    rows.push(`admin_dtp,pass123,${adminRole.id},HOD,All,"Director of Town Panchayats","பேரூராட்சிகள் இயக்குனர்"`);

    const csvContent = "\uFEFF" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "User_Accounts_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Parse bulk user creation
  const handleUsersCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
          setCsvFeedback({ type: 'error', message: 'The CSV is empty.' });
          return;
        }

        const uploadedUsers = [...users];

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVRow(lines[i]).map(v => v.replace(/^"|"$/g, '').trim());
          if (values.length < 7) continue;

          const [uname, pass, roleIdInput, sType, sNameEn, fNameEn, fNameTa] = values;

          let sId = 'all';
          if (sType === 'Zone') {
            const zMatch = zones.find((z: any) => z.nameEn.toLowerCase() === sNameEn.toLowerCase() || z.nameTa === sNameEn);
            sId = zMatch ? zMatch.id : 'all';
          } else if (sType === 'TownPanchayat') {
            const tpMatch = townPanchayats.find((t: any) => t.nameEn.toLowerCase() === sNameEn.toLowerCase() || t.nameTa === sNameEn);
            sId = tpMatch ? tpMatch.id : 'all';
          }

          // Ensure username unique
          if (!uploadedUsers.some(u => u.username.toLowerCase() === uname.toLowerCase())) {
            uploadedUsers.push({
              id: 'u_csv_' + Math.random().toString(36).substr(2, 6),
              username: uname,
              passwordHash: pass,
              roleId: roleIdInput.toLowerCase(),
              scopeType: sType as 'HOD' | 'Zone' | 'TownPanchayat',
              scopeId: sId,
              status: 'Active',
              nameEn: fNameEn,
              nameTa: fNameTa
            });
          }
        }

        await onSaveCollection('users', uploadedUsers);
        setCsvFeedback({ type: 'success', message: lang === 'ta' ? 'பயனர் கணக்குகள் வெற்றிகரமாக சேர்க்கப்பட்டன!' : 'Administrative user accounts imported successfully!' });
      } catch (err: any) {
        setCsvFeedback({ type: 'error', message: 'Error parsing users CSV.' });
      }
    };
    reader.readAsText(file, 'UTF-8');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div id="user-management-container" className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex justify-start sm:justify-center overflow-x-auto scrollbar-custom whitespace-nowrap border-b border-gray-100 bg-white px-6 pt-4 rounded-t-2xl shadow-xs">
        <button
          onClick={() => { setActiveTab('user_list'); setCsvFeedback(null); }}
          className={`pb-4 px-6 text-sm font-semibold border-b-2 transition shrink-0 ${activeTab === 'user_list' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          {t('userAccounts')}
        </button>
        <button
          onClick={() => { setActiveTab('create_user'); setCsvFeedback(null); }}
          className={`pb-4 px-6 text-sm font-semibold border-b-2 transition shrink-0 ${activeTab === 'create_user' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          {t('userCreation')}
        </button>
        <button
          onClick={() => { 
            setActiveTab('page_access'); 
            setCsvFeedback(null);
            if (!selectedRoleForAccess && roles.length > 0) {
              const defaultR = roles.find((r: any) => r.id === 'ad') || roles[0];
              setSelectedRoleForAccess(defaultR.id);
            }
            if (!selectedUserForAccess && users.length > 0) {
              setSelectedUserForAccess(users[0].id);
            }
          }}
          className={`pb-4 px-6 text-sm font-semibold border-b-2 transition shrink-0 flex items-center gap-1.5 ${activeTab === 'page_access' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Key className="w-4 h-4 text-amber-500" />
          <span>{lang === 'ta' ? 'பக்க அனுமதி மேலாண்மை' : 'Page Access Control'}</span>
        </button>
        <button
          onClick={() => { setActiveTab('offices'); setCsvFeedback(null); }}
          className={`pb-4 px-6 text-sm font-semibold border-b-2 transition shrink-0 ${activeTab === 'offices' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          {t('officeCategory')}
        </button>
        <button
          onClick={() => { setActiveTab('roles'); setCsvFeedback(null); }}
          className={`pb-4 px-6 text-sm font-semibold border-b-2 transition shrink-0 ${activeTab === 'roles' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          {t('roleManagement')}
        </button>
      </div>

      {activeTab === 'user_list' && (
        <div className="space-y-6">
          {/* CSV Bulk Option for Users */}
          <div className="p-5 bg-white rounded-2xl border border-gray-100 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
                {lang === 'ta' ? 'அலுவலக பயனர் கணக்குகள் மொத்தப் பதிவேற்றம்' : 'Bulk Upload User Accounts'}
              </h4>
              <p className="text-xs text-gray-400 mt-1">
                {lang === 'ta' ? 'பயனர் கணக்கு விபரங்கள் அடங்கிய CSV கோப்பினை மாதிரி வடிவத்தில் பதிவேற்றவும்.' : 'Directly register multiple AD / EO administration logins via CSV matching.'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={downloadUsersTemplate}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 hover:bg-gray-50 rounded-xl text-xs font-semibold text-gray-600 transition"
              >
                <Download className="w-4 h-4 text-indigo-600" />
                {t('downloadTemplate')}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-xs"
              >
                <UploadCloud className="w-4 h-4" />
                {t('selectFile')}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                onChange={handleUsersCsvUpload}
                className="hidden"
              />
            </div>
          </div>

          {csvFeedback && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 ${csvFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              {csvFeedback.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
              <p className="text-xs font-medium">{csvFeedback.message}</p>
            </div>
          )}

          {/* Users Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-gray-50">
              <h3 className="font-semibold text-gray-800 text-sm">{t('userAccounts')}</h3>
            </div>
            <div className="overflow-x-auto scrollbar-custom w-full">
              <table className="w-full min-w-[950px] text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="p-4 pl-6">{lang === 'ta' ? 'அலுவலக பயனர்' : 'User Full Name'}</th>
                    <th className="p-4">{t('usernameLabel')}</th>
                    <th className="p-4">{t('passwordLabel')}</th>
                    <th className="p-4">{t('role')}</th>
                    <th className="p-4">{t('scopeType')}</th>
                    <th className="p-4">{lang === 'ta' ? 'பக்க அனுமதி' : 'Page Access'}</th>
                    <th className="p-4">{t('status')}</th>
                    <th className="p-4 text-right pr-6">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-xs text-gray-600">
                  {users.map((user: any) => {
                    const matchedRole = roles.find((r: any) => r.id === user.roleId);
                    const isVisible = !!showPasswords[user.id];
                    const { isCustom, pages } = getUserPermissionsInfo(user);

                    let scopeLabel = '';
                    if (user.scopeType === 'HOD') {
                      scopeLabel = t('hodScope');
                    } else if (user.scopeType === 'Zone') {
                      const zone = zones.find((z: any) => z.id === user.scopeId);
                      scopeLabel = zone ? `${t('zoneScope')}: ${tObj(zone)}` : t('zoneScope');
                    } else {
                      const tp = townPanchayats.find((t: any) => t.id === user.scopeId);
                      scopeLabel = tp ? `${t('tpScope')}: ${tObj(tp)}` : t('tpScope');
                    }

                    return (
                      <tr key={user.id} className="hover:bg-gray-50/50 transition">
                        <td className="p-4 pl-6 font-semibold text-gray-900">{tObj(user)}</td>
                        <td className="p-4 font-mono text-gray-500">{user.username}</td>
                        <td className="p-4 font-mono">
                          <div className="flex items-center gap-2">
                            <span>{isVisible ? user.passwordHash : '••••••••'}</span>
                            <button
                              onClick={() => togglePasswordVisibility(user.id)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-1 rounded-md text-[10px]">
                            {matchedRole ? tObj(matchedRole) : user.roleId}
                          </span>
                        </td>
                        <td className="p-4 font-medium text-gray-500">{scopeLabel}</td>
                        <td className="p-4">
                          <button
                            onClick={() => {
                              setSelectedUserForAccess(user.id);
                              setAccessMode('user_wise');
                              setActiveTab('page_access');
                              setPageAccessFeedback(null);
                            }}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                              isCustom
                                ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                            }`}
                            title={lang === 'ta' ? 'பக்க அனுமதியை அமை / திருத்து' : 'Configure Page Access'}
                          >
                            {isCustom ? (
                              <ShieldAlert className="w-3 h-3 text-amber-600" />
                            ) : (
                              <ShieldCheck className="w-3 h-3 text-indigo-600" />
                            )}
                            <span>
                              {isCustom
                                ? (lang === 'ta' ? `தனிப்பயன் (${pages.length} பக்கங்கள்)` : `Custom (${pages.length} pgs)`)
                                : (lang === 'ta' ? `பங்கு (${pages.length} பக்கங்கள்)` : `Role (${pages.length} pgs)`)}
                            </span>
                          </button>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => toggleUserStatus(user.id)}
                            className={`flex items-center gap-1.5 font-semibold text-[10px] uppercase tracking-wider rounded-full px-2.5 py-1 transition ${
                              user.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            {user.status === 'Active' ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                            {user.status === 'Active' ? t('activeStatus') : t('inactiveStatus')}
                          </button>
                        </td>
                        <td className="p-4 text-right pr-6">
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedUserForAccess(user.id);
                                setAccessMode('user_wise');
                                setActiveTab('page_access');
                                setPageAccessFeedback(null);
                              }}
                              className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                              title={lang === 'ta' ? 'பக்க அனுமதி மேலாண்மை' : 'Manage Page Permissions'}
                            >
                              <Key className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleStartEditUser(user)}
                              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                              title={lang === 'ta' ? 'திருத்து' : 'Edit'}
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
      )}

      {activeTab === 'create_user' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <form onSubmit={handleAddUser} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
              <h3 className="font-semibold text-gray-800 text-md flex items-center gap-2 border-b border-gray-50 pb-2">
                <UserPlus className="w-5 h-5 text-indigo-500" />
                {lang === 'ta' ? 'புதிய பயனர் கணக்கு' : 'Provision Administrative User'}
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('userFullNameEn')}</label>
                  <input
                    type="text"
                    value={fullNameEn}
                    onChange={(e) => setFullNameEn(e.target.value)}
                    placeholder="e.g. Anand Kumar K"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('userFullNameTa')}</label>
                  <input
                    type="text"
                    value={fullNameTa}
                    onChange={(e) => setFullNameTa(e.target.value)}
                    placeholder="எ.கா. ஆனந்த் குமார் கே"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-500">{t('usernameLabel')}</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="ad_chengalpet"
                      className="w-full border border-gray-200 rounded-xl p-3 text-xs mt-1 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500">{t('passwordLabel')}</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full border border-gray-200 rounded-xl p-3 text-xs mt-1 outline-none"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('role')}</label>
                  <select
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none bg-white"
                    required
                  >
                    <option value="">-- Choose Role --</option>
                    {roles.map((r: any) => (
                      <option key={r.id} value={r.id}>{tObj(r)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('scopeType')}</label>
                  <select
                    value={scopeType}
                    onChange={(e) => {
                      const val = e.target.value as 'HOD' | 'Zone' | 'TownPanchayat';
                      setScopeType(val);
                      setScopeId(val === 'HOD' ? 'all' : '');
                    }}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none bg-white"
                    required
                  >
                    <option value="HOD">{t('hodScope')}</option>
                    <option value="Zone">{t('zoneScope')}</option>
                    <option value="TownPanchayat">{t('tpScope')}</option>
                  </select>
                </div>

                {scopeType === 'Zone' && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500">{t('selectZone')}</label>
                    <select
                      value={scopeId}
                      onChange={(e) => setScopeId(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none bg-white"
                      required
                    >
                      <option value="">-- Choose Zone --</option>
                      {zones.map((z: any) => (
                        <option key={z.id} value={z.id}>{tObj(z)}</option>
                      ))}
                    </select>
                  </div>
                )}

                {scopeType === 'TownPanchayat' && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500">{t('selectTP')}</label>
                    <select
                      value={scopeId}
                      onChange={(e) => setScopeId(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none bg-white"
                      required
                    >
                      <option value="">-- Choose Town Panchayat --</option>
                      {townPanchayats.map((tp: any) => (
                        <option key={tp.id} value={tp.id}>{tObj(tp)}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition mt-2 shadow-xs">
                {lang === 'ta' ? 'பயனரை உருவாக்கு' : 'Create User Account'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
            <h4 className="font-semibold text-gray-800 text-sm border-b border-gray-50 pb-2">{lang === 'ta' ? 'அதிகார வரம்புகள் வழிகாட்டி' : 'Administrative Jurisdiction Scope Map'}</h4>
            <div className="space-y-3 text-xs text-gray-500">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <span className="font-bold text-gray-800 block truncate">{t('hodScope')} (DTP Director)</span>
                <span className="mt-1 block leading-relaxed">{lang === 'ta' ? 'முழு மாநிலத்தின் அனைத்து மண்டலங்கள் மற்றும் அனைத்து பேரூராட்சி ஊழியர்களையும் கட்டுப்படுத்தும் முழுமையான அதிகாரம்.' : 'Full administrative access across all Zones, Districts, Town Panchayats, and Modules.'}</span>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <span className="font-bold text-gray-800 block truncate">{t('zoneScope')} (Assistant Director)</span>
                <span className="mt-1 block leading-relaxed">{lang === 'ta' ? 'ஒதுக்கப்பட்ட மண்டலத்தில் உள்ள மாவட்டங்கள் மற்றும் அதற்குரிய பேரூராட்சிகளை கட்டுப்படுத்தும் வரையறுக்கப்பட்ட அதிகாரம்.' : 'Scope locked to the assigned zone. Can create, edit, and audit employees belonging only to Town Panchayats inside this specific zone.'}</span>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <span className="font-bold text-gray-800 block truncate">{t('tpScope')} (Executive Officer)</span>
                <span className="mt-1 block leading-relaxed">{lang === 'ta' ? 'அந்தந்த குறிப்பிட்ட பேரூராட்சியை மட்டும் நிர்வகிக்கும் உள்ளூர் அளவிலான அதிகாரம்.' : 'Local municipal scope. Can manage records, details, and dynamic modules strictly for their own Town Panchayat.'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page Access Management Tab (Role-wise & User-wise) */}
      {activeTab === 'page_access' && (
        <div className="space-y-6">
          {/* Main header banner */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  {lang === 'ta' ? 'பக்க அனுமதி மேலாண்மை' : 'Page Access Control Management'}
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                    RBAC & Custom ACL
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-1 max-w-2xl leading-relaxed">
                  {lang === 'ta' 
                    ? 'பங்கு வாரியாக (Role-Wise) மற்றும் தனிப் பயனர் வாரியாக (User-Wise) பக்க அனுமதிகளை மாற்றியமைக்கவும். அனுமதிகள் இல்லாத பக்கங்கள் மெனு பட்டியலிலும் வராது, நேரடி URL வழியாகவும் அணுக முடியாது.' 
                    : 'Manage role-wise baseline permissions or individual user-wise custom page overrides. Restricted pages are completely omitted from the menu and blocked from direct navigation.'}
                </p>
              </div>
            </div>

            {/* Mode Switcher Toggle */}
            <div className="flex p-1 bg-gray-100 rounded-xl self-start md:self-center border border-gray-200">
              <button
                onClick={() => { setAccessMode('role_wise'); setPageAccessFeedback(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  accessMode === 'role_wise'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span>{lang === 'ta' ? 'பங்கு வாரியாக (Role-Wise)' : 'Role-Wise Access'}</span>
              </button>
              <button
                onClick={() => { setAccessMode('user_wise'); setPageAccessFeedback(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                  accessMode === 'user_wise'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>{lang === 'ta' ? 'தனிப் பயனர் வாரியாக (User-Wise)' : 'User-Wise Access'}</span>
              </button>
            </div>
          </div>

          {pageAccessFeedback && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 ${pageAccessFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
              {pageAccessFeedback.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />}
              <p className="text-xs font-semibold leading-relaxed">{pageAccessFeedback.message}</p>
            </div>
          )}

          {/* MODE 1: ROLE-WISE ACCESS */}
          {accessMode === 'role_wise' && (
            <div className="space-y-6">
              {/* Role Selection Row */}
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-3">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                  {lang === 'ta' ? '1. பங்கைத் தேர்ந்தெடுக்கவும் (Select Role)' : '1. Select Role to Configure'}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {roles.map((r: any) => {
                    const isSelected = (selectedRoleForAccess || roles[0]?.id) === r.id;
                    const rPages = getRolePermissions(r.id);
                    const usersInRole = users.filter((u: any) => u.roleId === r.id);
                    return (
                      <button
                        key={r.id}
                        onClick={() => { setSelectedRoleForAccess(r.id); setPageAccessFeedback(null); }}
                        className={`p-4 rounded-xl border text-left transition relative cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-200 shadow-xs'
                            : 'bg-gray-50/60 border-gray-200/80 hover:bg-gray-100/70 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-gray-200 text-indigo-700 uppercase">
                            {r.id}
                          </span>
                          <span className="text-[10px] font-bold text-gray-500">
                            {rPages.length} / {ALL_PAGE_IDS.length} {lang === 'ta' ? 'பக்கங்கள்' : 'pages'}
                          </span>
                        </div>
                        <h4 className="font-bold text-gray-900 text-sm mt-2">{tObj(r)}</h4>
                        <p className="text-[11px] text-gray-500 mt-1">
                          {usersInRole.length} {lang === 'ta' ? 'செயலில் உள்ள பயனர்கள்' : 'active user accounts'}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Permission Matrix for Selected Role */}
              {(() => {
                const currentRoleId = selectedRoleForAccess || roles[0]?.id;
                const activeRole = roles.find((r: any) => r.id === currentRoleId);
                if (!activeRole) return null;
                const allowedPages = getRolePermissions(currentRoleId);
                const usersCount = users.filter((u: any) => u.roleId === currentRoleId).length;

                // Category filters
                const categories = ['ALL', ...Array.from(new Set(SYSTEM_PAGES.map(p => p.categoryEn)))];
                const filteredPages = SYSTEM_PAGES.filter(p => {
                  const matchCat = pageCategoryFilter === 'ALL' || p.categoryEn === pageCategoryFilter;
                  const matchQuery = !pageAccessSearch.trim() || 
                    p.nameEn.toLowerCase().includes(pageAccessSearch.toLowerCase()) || 
                    p.nameTa.toLowerCase().includes(pageAccessSearch.toLowerCase()) ||
                    p.id.toLowerCase().includes(pageAccessSearch.toLowerCase());
                  return matchCat && matchQuery;
                });

                return (
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-6">
                    {/* Role Header Info */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-gray-100 gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-600 text-white uppercase">
                            {activeRole.id}
                          </span>
                          <h4 className="font-bold text-gray-900 text-base">{tObj(activeRole)}</h4>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {lang === 'ta' 
                            ? `இந்தப் பக்க அனுமதிகள் '${tObj(activeRole)}' பங்கில் உள்ள அனைத்து (${usersCount}) பயனர்களுக்கும் தானாகவே பொருந்தும்.` 
                            : `These page permissions will automatically apply to all ${usersCount} users assigned to '${activeRole.nameEn}'.`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSelectAllRolePages(currentRoleId)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          {t('selectAll')}
                        </button>
                        <button
                          onClick={() => handleDeselectAllRolePages(currentRoleId)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                        >
                          {t('deselectAll')}
                        </button>
                        <button
                          onClick={() => handleResetRolePages(currentRoleId)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>{lang === 'ta' ? 'இயல்புநிலை' : 'Reset'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Filter and Search Bar */}
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                      <div className="relative flex-1 max-w-sm">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={pageAccessSearch}
                          onChange={(e) => setPageAccessSearch(e.target.value)}
                          placeholder={lang === 'ta' ? 'பக்கங்களைத் தேடு...' : 'Search pages...'}
                          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50/50 outline-none focus:bg-white focus:border-indigo-500"
                        />
                      </div>

                      <div className="flex items-center gap-1 overflow-x-auto scrollbar-custom pb-1 sm:pb-0">
                        {categories.map((cat: string) => (
                          <button
                            key={cat}
                            onClick={() => setPageCategoryFilter(cat)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition cursor-pointer ${
                              pageCategoryFilter === cat
                                ? 'bg-indigo-600 text-white shadow-2xs'
                                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {cat === 'ALL' ? (lang === 'ta' ? 'அனைத்தும்' : 'All') : cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Page Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {filteredPages.map((page: SystemPage) => {
                        const Icon = page.icon || LayoutDashboard;
                        const isChecked = allowedPages.includes(page.id);

                        return (
                          <div
                            key={page.id}
                            onClick={() => handleToggleRolePage(currentRoleId, page.id)}
                            className={`p-4 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                              isChecked
                                ? 'bg-indigo-50/40 border-indigo-300 ring-1 ring-indigo-200'
                                : 'bg-gray-50/40 border-gray-200 hover:bg-gray-100/60 opacity-70'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                    isChecked ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'
                                  }`}>
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h5 className="font-bold text-gray-900 text-xs leading-tight">
                                      {lang === 'ta' ? page.nameTa : page.nameEn}
                                    </h5>
                                    <span className="text-[10px] text-gray-400 font-mono">{page.id}</span>
                                  </div>
                                </div>

                                <div className="shrink-0 mt-0.5">
                                  {isChecked ? (
                                    <CheckSquare className="w-5 h-5 text-indigo-600" />
                                  ) : (
                                    <Square className="w-5 h-5 text-gray-300" />
                                  )}
                                </div>
                              </div>

                              <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">
                                {lang === 'ta' ? page.descriptionTa : page.descriptionEn}
                              </p>
                            </div>

                            <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px]">
                              <span className="text-gray-400 font-medium">
                                {lang === 'ta' ? page.categoryTa : page.categoryEn}
                              </span>
                              <span className={`font-bold ${isChecked ? 'text-indigo-600' : 'text-gray-400'}`}>
                                {isChecked ? (lang === 'ta' ? 'அனுமதிக்கப்பட்டது' : 'Enabled') : (lang === 'ta' ? 'மறுக்கப்பட்டது' : 'Disabled')}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Footer Save Action */}
                    <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span>
                          {lang === 'ta'
                            ? `மொத்தம் ${allowedPages.length} பக்கங்கள் '${tObj(activeRole)}' பங்கிற்கு தேர்ந்தெடுக்கப்பட்டுள்ளன.`
                            : `${allowedPages.length} of ${ALL_PAGE_IDS.length} pages enabled for '${activeRole.nameEn}'.`}
                        </span>
                      </div>

                      <button
                        onClick={() => handleSaveRolePermissions(currentRoleId)}
                        disabled={savingPageAccess}
                        className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>{savingPageAccess ? 'Saving...' : (lang === 'ta' ? 'பங்கு அனுமதியைச் சேமி' : 'Save Role Permissions')}</span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* MODE 2: USER-WISE ACCESS */}
          {accessMode === 'user_wise' && (
            <div className="space-y-6">
              {/* User Selection & Search Bar */}
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                  {lang === 'ta' ? '1. பயனரைத் தேர்ந்தெடுக்கவும் (Select User)' : '1. Select User for Custom Access'}
                </span>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-5 relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={pageAccessSearch}
                      onChange={(e) => setPageAccessSearch(e.target.value)}
                      placeholder={lang === 'ta' ? 'பயனர் பெயர் அல்லது ஐடி தேடுக...' : 'Search user by name or username...'}
                      className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-xs bg-gray-50/50 outline-none focus:bg-white focus:border-indigo-500"
                    />
                  </div>

                  <div className="md:col-span-7">
                    <select
                      value={selectedUserForAccess || users[0]?.id || ''}
                      onChange={(e) => { setSelectedUserForAccess(e.target.value); setPageAccessFeedback(null); }}
                      className="w-full p-2.5 border border-gray-200 rounded-xl text-xs bg-white font-medium text-gray-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                      {users
                        .filter((u: any) => {
                          if (!pageAccessSearch.trim()) return true;
                          const q = pageAccessSearch.toLowerCase();
                          return (u.username || '').toLowerCase().includes(q) ||
                            (u.nameEn || '').toLowerCase().includes(q) ||
                            (u.nameTa || '').includes(q);
                        })
                        .map((u: any) => {
                          const r = roles.find((rx: any) => rx.id === u.roleId);
                          const isCust = Array.isArray(u.customPagePermissions);
                          return (
                            <option key={u.id} value={u.id}>
                              {tObj(u)} ({u.username}) — Role: {r ? tObj(r) : u.roleId} {isCust ? '[Custom Override]' : '[Role Default]'}
                            </option>
                          );
                        })}
                    </select>
                  </div>
                </div>
              </div>

              {/* User Access Controls */}
              {(() => {
                const currentUserId = selectedUserForAccess || users[0]?.id;
                const activeUser = users.find((u: any) => u.id === currentUserId);
                if (!activeUser) return null;

                const matchedRole = roles.find((r: any) => r.id === activeUser.roleId);
                const { isCustom, pages, rolePages } = getUserPermissionsInfo(activeUser);

                // Filter pages
                const categories = ['ALL', ...Array.from(new Set(SYSTEM_PAGES.map(p => p.categoryEn)))];
                const filteredPages = SYSTEM_PAGES.filter(p => {
                  const matchCat = pageCategoryFilter === 'ALL' || p.categoryEn === pageCategoryFilter;
                  const matchQuery = !pageAccessSearch.trim() || 
                    p.nameEn.toLowerCase().includes(pageAccessSearch.toLowerCase()) || 
                    p.nameTa.toLowerCase().includes(pageAccessSearch.toLowerCase()) ||
                    p.id.toLowerCase().includes(pageAccessSearch.toLowerCase());
                  return matchCat && matchQuery;
                });

                return (
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-6">
                    {/* User Profile Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-gray-100 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                          {(activeUser.nameEn || activeUser.username || 'U').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-gray-900 text-sm sm:text-base">{tObj(activeUser)}</h4>
                            <span className="font-mono text-xs text-gray-400">({activeUser.username})</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold">
                              {matchedRole ? tObj(matchedRole) : activeUser.roleId}
                            </span>
                            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] font-medium">
                              Scope: {activeUser.scopeType} ({activeUser.scopeId})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Access Mode Toggle (Inherit from Role VS Custom Override) */}
                      <div className="flex p-1 bg-gray-100 rounded-xl border border-gray-200">
                        <button
                          onClick={() => handleSetUserCustomMode(activeUser.id, false)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                            !isCustom
                              ? 'bg-white text-indigo-700 shadow-xs'
                              : 'text-gray-500 hover:text-gray-800'
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>{lang === 'ta' ? 'பங்கின் அனுமதிப்படி' : 'Inherit from Role'}</span>
                        </button>
                        <button
                          onClick={() => handleSetUserCustomMode(activeUser.id, true)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                            isCustom
                              ? 'bg-white text-amber-700 shadow-xs'
                              : 'text-gray-500 hover:text-gray-800'
                          }`}
                        >
                          <Key className="w-3.5 h-3.5 text-amber-600" />
                          <span>{lang === 'ta' ? 'பிரத்யேக அனுமதி (Custom)' : 'Custom Permissions'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Mode Notice Banner */}
                    {!isCustom ? (
                      <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <CheckCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-indigo-900">
                              {lang === 'ta' 
                                ? `இந்த பயனர் '${matchedRole ? tObj(matchedRole) : activeUser.roleId}' பங்கின் இயல்புநிலை அனுமதிகளைப் பயன்படுத்துகிறார் (${rolePages.length} பக்கங்கள்).` 
                                : `This user inherits baseline permissions from their role '${matchedRole?.nameEn || activeUser.roleId}' (${rolePages.length} pages enabled).`}
                            </p>
                            <p className="text-[11px] text-indigo-700 mt-0.5">
                              {lang === 'ta'
                                ? 'பங்கு மேலாண்மையில் செய்யப்படும் மாற்றங்கள் தானாகவே இந்த பயனருக்கும் பொருந்தும்.'
                                : 'Any changes made to that role will automatically reflect for this user.'}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleSetUserCustomMode(activeUser.id, true)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition self-start sm:self-center shrink-0 cursor-pointer"
                        >
                          {lang === 'ta' ? 'பிரத்யேக அனுமதியை அமை' : 'Enable Custom Override'}
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-bold text-amber-900">
                              {lang === 'ta'
                                ? `பிரத்யேக பக்க அனுமதி இயக்கப்பட்டுள்ளது (${pages.length} பக்கங்கள் அனுமதிக்கப்பட்டுள்ளன).`
                                : `Exclusive custom permissions active for this user (${pages.length} pages enabled).`}
                            </p>
                            <p className="text-[11px] text-amber-700 mt-0.5">
                              {lang === 'ta'
                                ? 'இது அந்த பங்கின் இயல்புநிலை அனுமதியை விட அதிகாரம் கொண்டது. இந்த பயனருக்கு மட்டும் பிரத்யேகமாக பொருந்தும்.'
                                : 'This overrides the role defaults exclusively for this individual user.'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                          <button
                            onClick={() => handleCopyFromRole(activeUser.id)}
                            className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{lang === 'ta' ? 'பங்கிலிருந்து நகலெடு' : 'Copy from Role'}</span>
                          </button>
                          <button
                            onClick={() => handleSetUserCustomMode(activeUser.id, false)}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            {lang === 'ta' ? 'பங்கு முறைக்கு திரும்பு' : 'Revert to Role'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Toolbar for selecting pages if custom or viewing */}
                    {isCustom && (
                      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSelectAllUserPages(activeUser.id)}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                          >
                            {t('selectAll')}
                          </button>
                          <button
                            onClick={() => handleDeselectAllUserPages(activeUser.id)}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                          >
                            {t('deselectAll')}
                          </button>
                        </div>

                        <div className="flex items-center gap-1 overflow-x-auto scrollbar-custom pb-1 sm:pb-0">
                          {categories.map((cat: string) => (
                            <button
                              key={cat}
                              onClick={() => setPageCategoryFilter(cat)}
                              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition cursor-pointer ${
                                pageCategoryFilter === cat
                                  ? 'bg-indigo-600 text-white shadow-2xs'
                                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              {cat === 'ALL' ? (lang === 'ta' ? 'அனைத்தும்' : 'All') : cat}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pages Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {filteredPages.map((page: SystemPage) => {
                        const Icon = page.icon || LayoutDashboard;
                        const isChecked = pages.includes(page.id);

                        return (
                          <div
                            key={page.id}
                            onClick={() => {
                              if (isCustom) {
                                handleToggleUserPage(activeUser.id, page.id);
                              }
                            }}
                            className={`p-4 rounded-xl border text-left transition flex flex-col justify-between ${
                              !isCustom ? 'cursor-default' : 'cursor-pointer'
                            } ${
                              isChecked
                                ? isCustom
                                  ? 'bg-amber-50/40 border-amber-300 ring-1 ring-amber-200'
                                  : 'bg-indigo-50/40 border-indigo-200'
                                : 'bg-gray-50/40 border-gray-200 opacity-60'
                            }`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                    isChecked 
                                      ? (isCustom ? 'bg-amber-600 text-white' : 'bg-indigo-600 text-white')
                                      : 'bg-gray-200 text-gray-500'
                                  }`}>
                                    <Icon className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <h5 className="font-bold text-gray-900 text-xs leading-tight">
                                      {lang === 'ta' ? page.nameTa : page.nameEn}
                                    </h5>
                                    <span className="text-[10px] text-gray-400 font-mono">{page.id}</span>
                                  </div>
                                </div>

                                <div className="shrink-0 mt-0.5">
                                  {isChecked ? (
                                    <CheckSquare className={`w-5 h-5 ${isCustom ? 'text-amber-600' : 'text-indigo-600'}`} />
                                  ) : (
                                    <Square className="w-5 h-5 text-gray-300" />
                                  )}
                                </div>
                              </div>

                              <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">
                                {lang === 'ta' ? page.descriptionTa : page.descriptionEn}
                              </p>
                            </div>

                            <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px]">
                              <span className="text-gray-400 font-medium">
                                {lang === 'ta' ? page.categoryTa : page.categoryEn}
                              </span>
                              <span className={`font-bold ${isChecked ? (isCustom ? 'text-amber-600' : 'text-indigo-600') : 'text-gray-400'}`}>
                                {isChecked ? (lang === 'ta' ? 'அனுமதிக்கப்பட்டது' : 'Enabled') : (lang === 'ta' ? 'மறுக்கப்பட்டது' : 'Disabled')}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Footer Save Action */}
                    <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span>
                          {lang === 'ta'
                            ? `மொத்தம் ${pages.length} பக்கங்கள் '${tObj(activeUser)}' பயனருக்கு ஒதுக்கப்பட்டுள்ளன (${isCustom ? 'தனிப்பயன் முறை' : 'பங்கு முறை'}).`
                            : `${pages.length} of ${ALL_PAGE_IDS.length} pages accessible for '${activeUser.nameEn || activeUser.username}' (${isCustom ? 'Custom Override' : 'Inheriting from Role'}).`}
                        </span>
                      </div>

                      <button
                        onClick={() => handleSaveUserPermissions(activeUser.id)}
                        disabled={savingPageAccess}
                        className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>{savingPageAccess ? 'Saving...' : (lang === 'ta' ? 'பயனர் அனுமதியைச் சேமி' : 'Save User Permissions')}</span>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {activeTab === 'offices' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <form onSubmit={handleAddOfficeCategory} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
              <h3 className="font-semibold text-gray-800 text-md flex items-center gap-2 border-b border-gray-50 pb-2">
                <Building className="w-5 h-5 text-indigo-500" />
                {lang === 'ta' ? 'அலுவலக வகை மற்றும் பணியிட வரம்பு' : 'Office Post Sanctions Limit'}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('officeType')}</label>
                  <select
                    value={officeType}
                    onChange={(e) => {
                      setOfficeType(e.target.value);
                      setOfficeZoneId('');
                      setOfficeDistrictId('');
                      setOfficeTPId('');
                    }}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none bg-white font-medium text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="DTP">DTP (Directorate)</option>
                    <option value="ADTP">ADTP (Assistant Director Office)</option>
                    <option value="TP">TP (Town Panchayat)</option>
                  </select>
                </div>

                {officeType === 'ADTP' && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="text-xs font-semibold text-gray-500">{lang === 'ta' ? 'மண்டலத்தைத் தேர்ந்தெடுக்கவும்' : 'Select Zone'}</label>
                      <select
                        value={officeZoneId}
                        onChange={(e) => setOfficeZoneId(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none bg-white font-medium text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        required
                      >
                        <option value="">-- {lang === 'ta' ? 'மண்டலத்தைத் தேர்ந்தெடு' : 'Choose Zone'} --</option>
                        {zones.map((z: any) => (
                          <option key={z.id} value={z.id}>{tObj(z)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {officeType === 'TP' && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="text-xs font-semibold text-gray-500">{lang === 'ta' ? 'மண்டலத்தைத் தேர்ந்தெடுக்கவும்' : 'Select Zone'}</label>
                      <select
                        value={officeZoneId}
                        onChange={(e) => {
                          setOfficeZoneId(e.target.value);
                          setOfficeDistrictId('');
                          setOfficeTPId('');
                        }}
                        className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none bg-white font-medium text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        required
                      >
                        <option value="">-- {lang === 'ta' ? 'மண்டலத்தைத் தேர்ந்தெடு' : 'Choose Zone'} --</option>
                        {zones.map((z: any) => (
                          <option key={z.id} value={z.id}>{tObj(z)}</option>
                        ))}
                      </select>
                    </div>

                    {officeZoneId && (
                      <div>
                        <label className="text-xs font-semibold text-gray-500">{lang === 'ta' ? 'மாவட்டத்தைத் தேர்ந்தெடுக்கவும்' : 'Select District'}</label>
                        <select
                          value={officeDistrictId}
                          onChange={(e) => {
                            setOfficeDistrictId(e.target.value);
                            setOfficeTPId('');
                          }}
                          className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none bg-white font-medium text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          required
                        >
                          <option value="">-- {lang === 'ta' ? 'மாவட்டத்தைத் தேர்ந்தெடு' : 'Choose District'} --</option>
                          {districts.filter((d: any) => d.zoneId === officeZoneId).map((d: any) => (
                            <option key={d.id} value={d.id}>{tObj(d)}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {officeDistrictId && (
                      <div>
                        <label className="text-xs font-semibold text-gray-500">{lang === 'ta' ? 'பேரூராட்சியைத் தேர்ந்தெடுக்கவும்' : 'Select Town Panchayat'}</label>
                        <select
                          value={officeTPId}
                          onChange={(e) => setOfficeTPId(e.target.value)}
                          className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none bg-white font-medium text-gray-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          required
                        >
                          <option value="">-- {lang === 'ta' ? 'பேரூராட்சியைத் தேர்ந்தெடு' : 'Choose Town Panchayat'} --</option>
                          {townPanchayats.filter((tp: any) => tp.districtId === officeDistrictId).map((tp: any) => (
                            <option key={tp.id} value={tp.id}>{tObj(tp)}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {currentOfficeDetails.isValid && (
                  <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-1">
                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">{lang === 'ta' ? 'தானாக உருவான பெயர்' : 'Auto-Generated Name'}</span>
                    <p className="text-sm font-bold text-indigo-900">{currentOfficeDetails.nameEn}</p>
                    <p className="text-xs text-indigo-700 font-medium">{currentOfficeDetails.nameTa}</p>
                  </div>
                )}

                {currentOfficeDetails.isValid && isDuplicateOffice && (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="font-medium leading-relaxed">
                      {lang === 'ta' 
                        ? 'இந்த அலுவலக பணியிட அமைப்பு ஏற்கனவே உருவாக்கப்பட்டுள்ளது. மாற்றியமைக்க மேட்ரிக்ஸிலிருந்து பழையதை நீக்கவும்.' 
                        : 'This office configuration has already been configured. Please delete the existing entry from the matrix if you wish to reconfigure.'}
                    </p>
                  </div>
                )}

                {currentOfficeDetails.isValid && !isDuplicateOffice && (
                  <div className="space-y-2 pt-2 border-t border-gray-50">
                    <span className="text-xs font-bold text-gray-800 block">{t('postSanctions')}</span>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-custom">
                      {posts.map((p: any) => (
                        <div key={p.id} className="flex justify-between items-center text-xs p-1 hover:bg-gray-50 rounded transition">
                          <span className="text-gray-600 font-medium">{tObj(p)}</span>
                          <input
                            type="number"
                            min="0"
                            value={sanctions[p.id] || 0}
                            onChange={(e) => handleUpdateSanction(p.id, parseInt(e.target.value) || 0)}
                            className="w-20 border border-gray-200 rounded-lg p-1.5 text-center font-bold text-indigo-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button 
                type="submit"
                disabled={!currentOfficeDetails.isValid || isDuplicateOffice}
                className={`w-full py-3 text-white rounded-xl text-xs font-semibold transition mt-2 shadow-xs ${(!currentOfficeDetails.isValid || isDuplicateOffice) ? 'bg-gray-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                {lang === 'ta' ? 'அலுவலகத்தை உருவாக்கு' : 'Add Office Configuration'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
            {/* Sleek CSV Control Panel */}
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h5 className="font-bold text-gray-800 text-xs flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
                    {lang === 'ta' ? 'மொத்தமாக பணியிட வரம்பு பதிவேற்றம் (CSV)' : 'Bulk Sanctions Upload via CSV'}
                  </h5>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {lang === 'ta' 
                      ? 'மாதிரி படிவத்தை பதிவிறக்கி, விவரங்களை பூர்த்தி செய்து பதிவேற்றவும்.' 
                      : 'Download the model template with current posts, fill it, and upload.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadOfficeTemplate}
                  className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-semibold transition flex items-center gap-1.5 self-start sm:self-center"
                >
                  <Download className="w-3.5 h-3.5" />
                  {lang === 'ta' ? 'மாதிரி படிவம்' : 'Model Template'}
                </button>
              </div>

              <div className="border-t border-slate-200/60 pt-2.5 flex items-center gap-3">
                <label className="cursor-pointer px-4 py-2 bg-white border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs">
                  <UploadCloud className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                  <span>{lang === 'ta' ? 'CSV கோப்பைத் தேர்ந்தெடு' : 'Select Office CSV'}</span>
                  <input
                    type="file"
                    ref={officeCsvInputRef}
                    accept=".csv"
                    onChange={handleOfficeCsvUpload}
                    className="hidden"
                  />
                </label>
                <span className="text-[10px] text-gray-400 font-mono">Accepts .csv files</span>
              </div>
            </div>

            {csvFeedback && (
              <div className={`p-4 rounded-xl border flex items-start gap-3 ${csvFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                {csvFeedback.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
                <p className="text-xs font-medium leading-relaxed">{csvFeedback.message}</p>
              </div>
            )}

            <h4 className="font-semibold text-gray-800 text-sm border-b border-gray-50 pb-2">{lang === 'ta' ? 'பணியிட வரம்பு நிலைகள்' : 'Sanctioned Post Configurations Matrix'}</h4>
            <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1 scrollbar-custom">
              {officeCategories.map((oc: any) => (
                <div key={oc.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2 text-xs hover:border-indigo-100 transition">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-800 block text-sm">{tObj(oc)} <span className="text-xs font-mono text-gray-400">({oc.type})</span></span>
                    <button
                      onClick={() => onSaveCollection('officeCategories', officeCategories.filter((x: any) => x.id !== oc.id))}
                      className="text-gray-300 hover:text-red-500 text-lg font-bold leading-none"
                    >
                      ×
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-gray-500">
                    {Object.keys(oc.sanctions || {}).map((postId) => {
                      const pst = posts.find((p: any) => p.id === postId);
                      const count = oc.sanctions[postId];
                      if (!count) return null;
                      return (
                        <div key={postId} className="bg-white px-2 py-1.5 rounded border border-gray-100 flex justify-between">
                          <span className="truncate max-w-[70%]">{pst ? tObj(pst) : postId}</span>
                          <span className="font-bold text-indigo-600 font-mono">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-6">
          <div className="flex justify-between items-center border-b border-gray-50 pb-3">
            <h3 className="font-semibold text-gray-800 text-md flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-indigo-500" />
              {t('roleManagement')}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {roles.map((role: any) => (
              <div key={role.id} className="p-5 border border-gray-100 rounded-2xl bg-gray-50/50 space-y-3">
                <span className="bg-indigo-600 text-white font-bold px-2.5 py-1 rounded text-[10px] uppercase tracking-wider inline-block">
                  {role.id}
                </span>
                <h4 className="font-bold text-gray-950 text-sm">{tObj(role)}</h4>
                
                <div className="space-y-1.5 border-t border-gray-100 pt-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{t('assignPermissions')}</span>
                  <div className="space-y-1 text-xs text-gray-500">
                    {role.permissions?.map((p: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                        <span>{p === 'all' ? (lang === 'ta' ? 'அனைத்து அனுமதிகளும்' : 'Super Admin Permissions') : p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-gray-100 max-h-[90vh] flex flex-col"
          >
            <div className="bg-indigo-950 p-5 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Edit className="w-5 h-5 text-indigo-400" />
                {lang === 'ta' ? 'பயனர் விபரங்களை திருத்துக' : 'Edit User Details'}
              </h3>
              <button 
                type="button"
                onClick={() => setEditingUser(null)} 
                className="p-1 hover:bg-white/10 rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateUserSubmit} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500">{t('userFullNameEn')}</label>
                <input
                  type="text"
                  value={editFullNameEn}
                  onChange={(e) => setEditFullNameEn(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 font-medium"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500">{t('userFullNameTa')}</label>
                <input
                  type="text"
                  value={editFullNameTa}
                  onChange={(e) => setEditFullNameTa(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 font-medium"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('usernameLabel')}</label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-xs mt-1 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('passwordLabel')}</label>
                  <input
                    type="text"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-xs mt-1 outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500">{t('role')}</label>
                <select
                  value={editRoleId}
                  onChange={(e) => setEditRoleId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none bg-white focus:ring-1 focus:ring-indigo-500 text-gray-800 font-medium"
                  required
                >
                  <option value="">-- Choose Role --</option>
                  {roles.map((r: any) => (
                    <option key={r.id} value={r.id}>{tObj(r)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500">{t('scopeType')}</label>
                <select
                  value={editScopeType}
                  onChange={(e) => {
                    const val = e.target.value as 'HOD' | 'Zone' | 'TownPanchayat';
                    setEditScopeType(val);
                    setEditScopeId(val === 'HOD' ? 'all' : '');
                  }}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none bg-white focus:ring-1 focus:ring-indigo-500 text-gray-800 font-medium"
                  required
                >
                  <option value="HOD">{t('hodScope')}</option>
                  <option value="Zone">{t('zoneScope')}</option>
                  <option value="TownPanchayat">{t('tpScope')}</option>
                </select>
              </div>

              {editScopeType === 'Zone' && (
                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('selectZone')}</label>
                  <select
                    value={editScopeId}
                    onChange={(e) => setEditScopeId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none bg-white focus:ring-1 focus:ring-indigo-500 text-gray-800 font-medium"
                    required
                  >
                    <option value="">-- Choose Zone --</option>
                    {zones.map((z: any) => (
                      <option key={z.id} value={z.id}>{tObj(z)}</option>
                    ))}
                  </select>
                </div>
              )}

              {editScopeType === 'TownPanchayat' && (
                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('selectTP')}</label>
                  <select
                    value={editScopeId}
                    onChange={(e) => setEditScopeId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none bg-white focus:ring-1 focus:ring-indigo-500 text-gray-800 font-medium"
                    required
                  >
                    <option value="">-- Choose Town Panchayat --</option>
                    {townPanchayats.map((tp: any) => (
                      <option key={tp.id} value={tp.id}>{tObj(tp)}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setEditingUser(null)} 
                  className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-xs font-semibold hover:bg-gray-50 transition cursor-pointer"
                >
                  {lang === 'ta' ? 'ரத்துசெய்' : 'Cancel'}
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-xs cursor-pointer"
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
