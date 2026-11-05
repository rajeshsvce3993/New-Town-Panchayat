'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Download,
  Upload,
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
  LayoutDashboard,
  Plus,
  ChevronRight
} from 'lucide-react';
import { Language, translations } from './translations';
import { 
  SYSTEM_PAGES, 
  getDefaultRolePages, 
  getUserEffectiveAllowedPages, 
  ALL_PAGE_IDS, 
  SystemPage 
} from '@/lib/pageAccessControl';
import {
  applyUserPasswordFields,
  buildUserCredentialIndex,
  getUserStoredPassword,
  resolvePasswordFromIndex,
} from '@/lib/userCredentials';

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
    users: stateUsers = [],
    officeCategories = []
  } = state || {};

  const [localUsers, setLocalUsers] = useState<any[]>([]);
  const [credentialIndex, setCredentialIndex] = useState<Record<string, string>>({});

  const refreshPortalUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/state?key=users', { cache: 'no-store' });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setLocalUsers(json.data);
        setCredentialIndex(buildUserCredentialIndex(json.data));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshPortalUsers();
  }, [refreshPortalUsers, stateUsers]);

  const rememberUserCredential = (user: any, plain: string) => {
    const p = String(plain || '').trim();
    if (!p) return;
    setCredentialIndex((prev) => {
      const next = { ...prev };
      if (user?.id) next[String(user.id)] = p;
      if (user?.username) next[`u:${String(user.username).toLowerCase()}`] = p;
      return next;
    });
  };

  const displayPasswordForUser = (user: any) =>
    resolvePasswordFromIndex(user, credentialIndex) || getUserStoredPassword(user) || '';

  const users = localUsers.length > 0 ? localUsers : stateUsers;

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
    setEditPassword(displayPasswordForUser(user));
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
        return applyUserPasswordFields({
          ...u,
          username: editUsername,
          roleId: editRoleId,
          scopeType: editScopeType,
          scopeId: editScopeType === 'HOD' ? 'all' : editScopeId,
          nameEn: editFullNameEn,
          nameTa: editFullNameTa
        }, editPassword);
      }
      return u;
    });

    await onSaveCollection('users', updatedUsers);
    rememberUserCredential({ id: editingUser.id, username: editUsername }, editPassword);
    void refreshPortalUsers();
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
  const [openOfficeMatrix, setOpenOfficeMatrix] = useState<Record<string, boolean>>({});
  const [openRoleRows, setOpenRoleRows] = useState<Record<string, boolean>>({});
  const OFFICE_TONES: Record<string, string> = {
    DTP: '#1d4ed8',
    ADTP: '#0f766e',
    TP: '#c2410c',
  };
  const ROLE_TONES = ['#1d4ed8', '#0f766e', '#c2410c', '#7c3aed', '#be185d', '#0369a1'];
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

    const newUser = applyUserPasswordFields({
      id: 'u' + (users.length + 1) + '_' + Math.random().toString(36).substr(2, 4),
      username,
      roleId: selectedRoleId,
      scopeType,
      scopeId: scopeType === 'HOD' ? 'all' : scopeId,
      status: 'Active' as 'Active' | 'Inactive',
      nameEn: fullNameEn,
      nameTa: fullNameTa
    }, password);

    await onSaveCollection('users', [...users, newUser]);
    rememberUserCredential(newUser, password);
    void refreshPortalUsers();
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
            uploadedUsers.push(applyUserPasswordFields({
              id: 'u_csv_' + Math.random().toString(36).substr(2, 6),
              username: uname,
              roleId: roleIdInput.toLowerCase(),
              scopeType: sType as 'HOD' | 'Zone' | 'TownPanchayat',
              scopeId: sId,
              status: 'Active',
              nameEn: fNameEn,
              nameTa: fNameTa
            }, pass));
          }
        }

        await onSaveCollection('users', uploadedUsers);
        setCredentialIndex(buildUserCredentialIndex(uploadedUsers));
        void refreshPortalUsers();
        setCsvFeedback({ type: 'success', message: lang === 'ta' ? 'பயனர் கணக்குகள் வெற்றிகரமாக சேர்க்கப்பட்டன!' : 'Administrative user accounts imported successfully!' });
      } catch (err: any) {
        setCsvFeedback({ type: 'error', message: 'Error parsing users CSV.' });
      }
    };
    reader.readAsText(file, 'UTF-8');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div id="user-management-container" className="portal-studio portal-page">
      <div className="portal-fis-hero">
        <div className="relative z-[1] flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/20">
            <Users className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 leading-tight">
            <h3 className="text-[14px] font-semibold tracking-tight text-white">
              {t('userManagement')}
            </h3>
            <p className="text-[10px] text-white/70">
              {lang === 'ta'
                ? 'பயனர் கணக்குகள், பக்க அனுமதிகள், அலுவலக வகைகள் மற்றும் பங்குகளை நிர்வகிக்கவும்.'
                : 'Manage user accounts, page access, office categories, and roles.'}
            </p>
          </div>
        </div>

        <div className="relative z-[1] flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={downloadUsersTemplate}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/15 cursor-pointer"
          >
            <Download className="h-3 w-3" />
            {lang === 'ta' ? 'மாதிரி படிவம் (CSV)' : 'Template (CSV)'}
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
            onChange={handleUsersCsvUpload}
            className="hidden"
          />
        </div>
      </div>

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
            onClick={() => { setActiveTab('user_list'); setCsvFeedback(null); }}
            className={`portal-dash-pill ${activeTab === 'user_list' ? 'is-active' : ''}`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>{t('userAccounts')}</span>
            <span className="portal-fis-count">{users.length}</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('create_user'); setCsvFeedback(null); }}
            className={`portal-dash-pill ${activeTab === 'create_user' ? 'is-active' : ''}`}
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>{t('userCreation')}</span>
          </button>
          <button
            type="button"
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
            className={`portal-dash-pill ${activeTab === 'page_access' ? 'is-active' : ''}`}
          >
            <Key className="h-3.5 w-3.5" />
            <span>{lang === 'ta' ? 'பக்க அனுமதி மேலாண்மை' : 'Page Access Control'}</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('offices'); setCsvFeedback(null); }}
            className={`portal-dash-pill ${activeTab === 'offices' ? 'is-active' : ''}`}
          >
            <Building className="h-3.5 w-3.5" />
            <span>{t('officeCategory')}</span>
            <span className="portal-fis-count">{officeCategories.length}</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('roles'); setCsvFeedback(null); }}
            className={`portal-dash-pill ${activeTab === 'roles' ? 'is-active' : ''}`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>{t('roleManagement')}</span>
            <span className="portal-fis-count">{roles.length}</span>
          </button>
        </div>
      </div>

      {activeTab === 'user_list' && (
        <div className="portal-dashboard-panel">
          <div className="portal-dash-head">
            <div>
              <h3>
                <span className="portal-dash-icon">
                  <Users className="h-3 w-3" />
                </span>
                {t('userAccounts')}
              </h3>
              <p>
                {lang === 'ta' ? 'அலுவலக பயனர் கணக்குகள் பட்டியல்' : 'Administrative user accounts'}
              </p>
            </div>
          </div>
          <div className="portal-dash-body">
            <div className="portal-dash-table">
              <table>
                <thead>
                  <tr>
                    <th>{lang === 'ta' ? 'அலுவலக பயனர்' : 'User Full Name'}</th>
                    <th>{t('usernameLabel')}</th>
                    <th>{t('passwordLabel')}</th>
                    <th>{t('role')}</th>
                    <th>{t('scopeType')}</th>
                    <th>{lang === 'ta' ? 'பக்க அனுமதி' : 'Page Access'}</th>
                    <th>{t('status')}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={8} className="portal-wt-empty is-center">
                        {lang === 'ta' ? 'பயனர்கள் இல்லை' : 'No user accounts yet'}
                      </td>
                    </tr>
                  )}
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
                      <tr key={user.id}>
                        <td>
                          <div className="portal-user-identity">
                            <strong>{tObj(user)}</strong>
                            <span className="portal-dash-id">{user.username}</span>
                          </div>
                        </td>
                        <td className="portal-dash-id">{user.username}</td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <span className="portal-dash-id">{isVisible ? (displayPasswordForUser(user) || '—') : '••••••••'}</span>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(user.id)}
                              className="portal-fis-icon-btn is-muted"
                            >
                              {isVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            </button>
                          </div>
                        </td>
                        <td>
                          <span className="portal-wt-chip">{matchedRole ? tObj(matchedRole) : user.roleId}</span>
                        </td>
                        <td>
                          <span className="portal-wt-chip">{scopeLabel}</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUserForAccess(user.id);
                              setAccessMode('user_wise');
                              setActiveTab('page_access');
                              setPageAccessFeedback(null);
                            }}
                            className={`portal-dash-status ${isCustom ? 'is-pending' : 'is-progress'}`}
                            title={lang === 'ta' ? 'பக்க அனுமதியை அமை / திருத்து' : 'Configure Page Access'}
                          >
                            {isCustom ? <ShieldAlert className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
                            <span>
                              {isCustom
                                ? (lang === 'ta' ? `தனிப்பயன் (${pages.length})` : `Custom (${pages.length})`)
                                : (lang === 'ta' ? `பங்கு (${pages.length})` : `Role (${pages.length})`)}
                            </span>
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => toggleUserStatus(user.id)}
                            className={`portal-dash-status ${user.status === 'Active' ? 'is-resolved' : 'is-pending'}`}
                          >
                            {user.status === 'Active' ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                            {user.status === 'Active' ? t('activeStatus') : t('inactiveStatus')}
                          </button>
                        </td>
                        <td>
                          <div className="portal-wt-actions">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUserForAccess(user.id);
                                setAccessMode('user_wise');
                                setActiveTab('page_access');
                                setPageAccessFeedback(null);
                              }}
                              className="portal-fis-icon-btn"
                              title={lang === 'ta' ? 'பக்க அனுமதி மேலாண்மை' : 'Manage Page Permissions'}
                            >
                              <Key className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartEditUser(user)}
                              className="portal-fis-icon-btn"
                              title={lang === 'ta' ? 'திருத்து' : 'Edit'}
                            >
                              <Edit className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user.id)}
                              className="portal-fis-icon-btn is-danger"
                            >
                              <Trash2 className="h-3 w-3" />
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
        <div className="portal-wt-grid">
          <div className="portal-dashboard-panel">
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <Plus className="h-3 w-3" />
                  </span>
                  {lang === 'ta' ? 'புதிய பயனர் கணக்கு' : 'Provision Administrative User'}
                </h3>
              </div>
            </div>
            <div className="portal-dash-body portal-wt-form">
              <form onSubmit={handleAddUser} className="space-y-3">
                <div>
                  <label>{t('userFullNameEn')}</label>
                  <input
                    type="text"
                    value={fullNameEn}
                    onChange={(e) => setFullNameEn(e.target.value)}
                    placeholder="e.g. Anand Kumar K"
                    required
                  />
                </div>
                <div>
                  <label>{t('userFullNameTa')}</label>
                  <input
                    type="text"
                    value={fullNameTa}
                    onChange={(e) => setFullNameTa(e.target.value)}
                    placeholder="எ.கா. ஆனந்த் குமார் கே"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label>{t('usernameLabel')}</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="ad_chengalpet"
                      required
                    />
                  </div>
                  <div>
                    <label>{t('passwordLabel')}</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label>{t('role')}</label>
                  <select
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Role --</option>
                    {roles.map((r: any) => (
                      <option key={r.id} value={r.id}>{tObj(r)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>{t('scopeType')}</label>
                  <select
                    value={scopeType}
                    onChange={(e) => {
                      const val = e.target.value as 'HOD' | 'Zone' | 'TownPanchayat';
                      setScopeType(val);
                      setScopeId(val === 'HOD' ? 'all' : '');
                    }}
                    required
                  >
                    <option value="HOD">{t('hodScope')}</option>
                    <option value="Zone">{t('zoneScope')}</option>
                    <option value="TownPanchayat">{t('tpScope')}</option>
                  </select>
                </div>

                {scopeType === 'Zone' && (
                  <div>
                    <label>{t('selectZone')}</label>
                    <select
                      value={scopeId}
                      onChange={(e) => setScopeId(e.target.value)}
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
                    <label>{t('selectTP')}</label>
                    <select
                      value={scopeId}
                      onChange={(e) => setScopeId(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Town Panchayat --</option>
                      {townPanchayats.map((tp: any) => (
                        <option key={tp.id} value={tp.id}>{tObj(tp)}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button type="submit">
                  {lang === 'ta' ? 'பயனரை உருவாக்கு' : 'Create User Account'}
                </button>
              </form>
            </div>
          </div>

          <div className="portal-dashboard-panel">
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <ShieldCheck className="h-3 w-3" />
                  </span>
                  {lang === 'ta' ? 'அதிகார வரம்புகள் வழிகாட்டி' : 'Administrative Jurisdiction Scope Map'}
                </h3>
              </div>
            </div>
            <div className="portal-dash-body portal-wt-form">
              <div className="portal-wt-note">
                <span>
                  <strong>{t('hodScope')} (DTP Director)</strong>
                  {' — '}
                  {lang === 'ta' ? 'முழு மாநிலத்தின் அனைத்து மண்டலங்கள் மற்றும் அனைத்து பேரூராட்சி ஊழியர்களையும் கட்டுப்படுத்தும் முழுமையான அதிகாரம்.' : 'Full administrative access across all Zones, Districts, Town Panchayats, and Modules.'}
                </span>
              </div>
              <div className="portal-wt-note">
                <span>
                  <strong>{t('zoneScope')} (Assistant Director)</strong>
                  {' — '}
                  {lang === 'ta' ? 'ஒதுக்கப்பட்ட மண்டலத்தில் உள்ள மாவட்டங்கள் மற்றும் அதற்குரிய பேரூராட்சிகளை கட்டுப்படுத்தும் வரையறுக்கப்பட்ட அதிகாரம்.' : 'Scope locked to the assigned zone. Can create, edit, and audit employees belonging only to Town Panchayats inside this specific zone.'}
                </span>
              </div>
              <div className="portal-wt-note">
                <span>
                  <strong>{t('tpScope')} (Executive Officer)</strong>
                  {' — '}
                  {lang === 'ta' ? 'அந்தந்த குறிப்பிட்ட பேரூராட்சியை மட்டும் நிர்வகிக்கும் உள்ளூர் அளவிலான அதிகாரம்.' : 'Local municipal scope. Can manage records, details, and dynamic modules strictly for their own Town Panchayat.'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page Access Management Tab (Role-wise & User-wise) */}
      {activeTab === 'page_access' && (
        <div className="space-y-3">
          <div className="portal-dashboard-panel">
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <Key className="h-3 w-3" />
                  </span>
                  {lang === 'ta' ? 'பக்க அனுமதி மேலாண்மை' : 'Page Access Control Management'}
                </h3>
                <p>
                  {lang === 'ta'
                    ? 'பங்கு வாரியாக மற்றும் தனிப் பயனர் வாரியாக பக்க அனுமதிகளை மாற்றியமைக்கவும்.'
                    : 'Manage role-wise baseline permissions or individual user-wise custom page overrides.'}
                </p>
              </div>
              <div className="portal-dash-pills">
                <button
                  type="button"
                  onClick={() => { setAccessMode('role_wise'); setPageAccessFeedback(null); }}
                  className={`portal-dash-pill ${accessMode === 'role_wise' ? 'is-active' : ''}`}
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>{lang === 'ta' ? 'பங்கு வாரியாக' : 'Role-Wise Access'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setAccessMode('user_wise'); setPageAccessFeedback(null); }}
                  className={`portal-dash-pill ${accessMode === 'user_wise' ? 'is-active' : ''}`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>{lang === 'ta' ? 'தனிப் பயனர் வாரியாக' : 'User-Wise Access'}</span>
                </button>
              </div>
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
              <div className="portal-dashboard-panel">
                <div className="portal-dash-head">
                  <div>
                    <h3>
                      <span className="portal-dash-icon">
                        <ShieldAlert className="h-3 w-3" />
                      </span>
                      {lang === 'ta' ? 'பங்கைத் தேர்ந்தெடுக்கவும்' : 'Select Role to Configure'}
                    </h3>
                  </div>
                </div>
                <div className="portal-dash-body">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {roles.map((r: any) => {
                    const isSelected = (selectedRoleForAccess || roles[0]?.id) === r.id;
                    const rPages = getRolePermissions(r.id);
                    const usersInRole = users.filter((u: any) => u.roleId === r.id);
                    return (
                      <button
                        type="button"
                        key={r.id}
                        onClick={() => { setSelectedRoleForAccess(r.id); setPageAccessFeedback(null); }}
                        className={`portal-pick-card ${isSelected ? 'is-on' : ''}`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <span className="portal-dash-id">{r.id}</span>
                          <span className="portal-wt-count">
                            {rPages.length}/{ALL_PAGE_IDS.length}
                          </span>
                        </div>
                        <h4 className="text-[13px] font-bold text-slate-900">{tObj(r)}</h4>
                        <p className="text-[11px] text-slate-500">
                          {usersInRole.length} {lang === 'ta' ? 'செயலில் உள்ள பயனர்கள்' : 'active user accounts'}
                        </p>
                      </button>
                    );
                  })}
                </div>
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
                  <div className="portal-dashboard-panel">
                    <div className="portal-dash-head">
                      <div>
                        <h3>
                          <span className="portal-dash-icon">
                            <ShieldCheck className="h-3 w-3" />
                          </span>
                          {tObj(activeRole)}
                          <span className="portal-fis-count">{activeRole.id}</span>
                        </h3>
                        <p>
                          {lang === 'ta'
                            ? `இந்தப் பக்க அனுமதிகள் '${tObj(activeRole)}' பங்கில் உள்ள அனைத்து (${usersCount}) பயனர்களுக்கும் தானாகவே பொருந்தும்.`
                            : `These page permissions will automatically apply to all ${usersCount} users assigned to '${activeRole.nameEn}'.`}
                        </p>
                      </div>
                      <div className="portal-dash-pills">
                        <button
                          type="button"
                          onClick={() => handleSelectAllRolePages(currentRoleId)}
                          className="portal-dash-pill"
                        >
                          {t('selectAll')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeselectAllRolePages(currentRoleId)}
                          className="portal-dash-pill"
                        >
                          {t('deselectAll')}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetRolePages(currentRoleId)}
                          className="portal-dash-pill"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>{lang === 'ta' ? 'இயல்புநிலை' : 'Reset'}</span>
                        </button>
                      </div>
                    </div>
                    <div className="portal-dash-body space-y-3">
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                      <div className="relative flex-1 max-w-sm">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={pageAccessSearch}
                          onChange={(e) => setPageAccessSearch(e.target.value)}
                          placeholder={lang === 'ta' ? 'பக்கங்களைத் தேடு...' : 'Search pages...'}
                          className="w-full pl-8"
                        />
                      </div>

                      <div className="portal-dash-pills flex-wrap">
                        {categories.map((cat: string) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setPageCategoryFilter(cat)}
                            className={`portal-dash-pill ${pageCategoryFilter === cat ? 'is-active' : ''}`}
                          >
                            {cat === 'ALL' ? (lang === 'ta' ? 'அனைத்தும்' : 'All') : cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Page Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {filteredPages.map((page: SystemPage) => {
                        const Icon = page.icon || LayoutDashboard;
                        const isChecked = allowedPages.includes(page.id);

                        return (
                          <div
                            key={page.id}
                            onClick={() => handleToggleRolePage(currentRoleId, page.id)}
                            className={`portal-pick-card ${isChecked ? 'is-on' : 'is-off'}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="portal-pick-icon">
                                  <Icon className="h-3.5 w-3.5" />
                                </span>
                                <div className="min-w-0">
                                  <h5 className="text-xs font-bold leading-tight text-slate-900">
                                    {lang === 'ta' ? page.nameTa : page.nameEn}
                                  </h5>
                                  <span className="portal-dash-id">{page.id}</span>
                                </div>
                              </div>
                              {isChecked ? (
                                <CheckSquare className="h-4 w-4 shrink-0" style={{ color: 'var(--theme-accent)' }} />
                              ) : (
                                <Square className="h-4 w-4 shrink-0 text-slate-300" />
                              )}
                            </div>
                            <p className="line-clamp-2 text-[11px] text-slate-500">
                              {lang === 'ta' ? page.descriptionTa : page.descriptionEn}
                            </p>
                            <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 text-[10px]">
                              <span className="text-slate-400">{lang === 'ta' ? page.categoryTa : page.categoryEn}</span>
                              <span className="font-bold" style={isChecked ? { color: 'var(--theme-accent)' } : undefined}>
                                {isChecked ? (lang === 'ta' ? 'அனுமதிக்கப்பட்டது' : 'Enabled') : (lang === 'ta' ? 'மறுக்கப்பட்டது' : 'Disabled')}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span>
                          {lang === 'ta'
                            ? `மொத்தம் ${allowedPages.length} பக்கங்கள் '${tObj(activeRole)}' பங்கிற்கு தேர்ந்தெடுக்கப்பட்டுள்ளன.`
                            : `${allowedPages.length} of ${ALL_PAGE_IDS.length} pages enabled for '${activeRole.nameEn}'.`}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSaveRolePermissions(currentRoleId)}
                        disabled={savingPageAccess}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-semibold text-white shadow-md hover:brightness-110 cursor-pointer disabled:opacity-50"
                        style={{ background: 'var(--theme-accent)' }}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>{savingPageAccess ? 'Saving...' : (lang === 'ta' ? 'பங்கு அனுமதியைச் சேமி' : 'Save Role Permissions')}</span>
                      </button>
                    </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* MODE 2: USER-WISE ACCESS */}
          {accessMode === 'user_wise' && (
            <div className="space-y-3">
              <div className="portal-dashboard-panel">
                <div className="portal-dash-head">
                  <div>
                    <h3>
                      <span className="portal-dash-icon">
                        <Users className="h-3 w-3" />
                      </span>
                      {lang === 'ta' ? 'பயனரைத் தேர்ந்தெடுக்கவும்' : 'Select User for Custom Access'}
                    </h3>
                  </div>
                </div>
                <div className="portal-dash-body portal-wt-form">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                  <div className="md:col-span-5 relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={pageAccessSearch}
                      onChange={(e) => setPageAccessSearch(e.target.value)}
                      placeholder={lang === 'ta' ? 'பயனர் பெயர் அல்லது ஐடி தேடுக...' : 'Search user by name or username...'}
                      className="pl-8"
                    />
                  </div>

                  <div className="md:col-span-7">
                    <select
                      value={selectedUserForAccess || users[0]?.id || ''}
                      onChange={(e) => { setSelectedUserForAccess(e.target.value); setPageAccessFeedback(null); }}
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
                  <div className="portal-dashboard-panel">
                    <div className="portal-dash-head">
                      <div>
                        <h3>
                          <span className="portal-dash-icon">
                            <Key className="h-3 w-3" />
                          </span>
                          {tObj(activeUser)}
                          <span className="portal-fis-count">{activeUser.username}</span>
                        </h3>
                        <p>
                          {matchedRole ? tObj(matchedRole) : activeUser.roleId} · Scope: {activeUser.scopeType} ({activeUser.scopeId})
                        </p>
                      </div>
                      <div className="portal-dash-pills">
                        <button
                          type="button"
                          onClick={() => handleSetUserCustomMode(activeUser.id, false)}
                          className={`portal-dash-pill ${!isCustom ? 'is-active' : ''}`}
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          <span>{lang === 'ta' ? 'பங்கின் அனுமதிப்படி' : 'Inherit from Role'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetUserCustomMode(activeUser.id, true)}
                          className={`portal-dash-pill ${isCustom ? 'is-active' : ''}`}
                        >
                          <Key className="h-3.5 w-3.5" />
                          <span>{lang === 'ta' ? 'பிரத்யேக அனுமதி' : 'Custom Permissions'}</span>
                        </button>
                      </div>
                    </div>
                    <div className="portal-dash-body space-y-3">

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
                          type="button"
                          onClick={() => handleSetUserCustomMode(activeUser.id, true)}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white shadow-md hover:brightness-110 cursor-pointer self-start sm:self-center shrink-0"
                          style={{ background: 'var(--theme-accent)' }}
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
                        <div className="portal-dash-pills">
                          <button
                            type="button"
                            onClick={() => handleSelectAllUserPages(activeUser.id)}
                            className="portal-dash-pill"
                          >
                            {t('selectAll')}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeselectAllUserPages(activeUser.id)}
                            className="portal-dash-pill"
                          >
                            {t('deselectAll')}
                          </button>
                        </div>

                        <div className="portal-dash-pills flex-wrap">
                          {categories.map((cat: string) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setPageCategoryFilter(cat)}
                              className={`portal-dash-pill ${pageCategoryFilter === cat ? 'is-active' : ''}`}
                            >
                              {cat === 'ALL' ? (lang === 'ta' ? 'அனைத்தும்' : 'All') : cat}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pages Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
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
                            className={`portal-pick-card ${isChecked ? (isCustom ? 'is-custom' : 'is-on') : 'is-off'} ${!isCustom ? 'cursor-default' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="portal-pick-icon">
                                  <Icon className="h-3.5 w-3.5" />
                                </span>
                                <div className="min-w-0">
                                  <h5 className="text-xs font-bold leading-tight text-slate-900">
                                    {lang === 'ta' ? page.nameTa : page.nameEn}
                                  </h5>
                                  <span className="portal-dash-id">{page.id}</span>
                                </div>
                              </div>
                              {isChecked ? (
                                <CheckSquare className="h-4 w-4 shrink-0" style={{ color: isCustom ? '#d97706' : 'var(--theme-accent)' }} />
                              ) : (
                                <Square className="h-4 w-4 shrink-0 text-slate-300" />
                              )}
                            </div>
                            <p className="line-clamp-2 text-[11px] text-slate-500">
                              {lang === 'ta' ? page.descriptionTa : page.descriptionEn}
                            </p>
                            <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 text-[10px]">
                              <span className="text-slate-400">{lang === 'ta' ? page.categoryTa : page.categoryEn}</span>
                              <span className="font-bold" style={isChecked ? { color: isCustom ? '#d97706' : 'var(--theme-accent)' } : undefined}>
                                {isChecked ? (lang === 'ta' ? 'அனுமதிக்கப்பட்டது' : 'Enabled') : (lang === 'ta' ? 'மறுக்கப்பட்டது' : 'Disabled')}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span>
                          {lang === 'ta'
                            ? `மொத்தம் ${pages.length} பக்கங்கள் '${tObj(activeUser)}' பயனருக்கு ஒதுக்கப்பட்டுள்ளன (${isCustom ? 'தனிப்பயன் முறை' : 'பங்கு முறை'}).`
                            : `${pages.length} of ${ALL_PAGE_IDS.length} pages accessible for '${activeUser.nameEn || activeUser.username}' (${isCustom ? 'Custom Override' : 'Inheriting from Role'}).`}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSaveUserPermissions(activeUser.id)}
                        disabled={savingPageAccess}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-semibold text-white shadow-md hover:brightness-110 cursor-pointer disabled:opacity-50"
                        style={{ background: 'var(--theme-accent)' }}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>{savingPageAccess ? 'Saving...' : (lang === 'ta' ? 'பயனர் அனுமதியைச் சேமி' : 'Save User Permissions')}</span>
                      </button>
                    </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {activeTab === 'offices' && (
        <div className="portal-wt-grid">
          <div className="portal-dashboard-panel">
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <Plus className="h-3 w-3" />
                  </span>
                  {lang === 'ta' ? 'அலுவலக வகை மற்றும் பணியிட வரம்பு' : 'Office Post Sanctions Limit'}
                </h3>
              </div>
            </div>
            <div className="portal-dash-body portal-wt-form">
            <form onSubmit={handleAddOfficeCategory} className="space-y-3">

              <div className="space-y-3">
                <div>
                  <label>{t('officeType')}</label>
                  <select
                    value={officeType}
                    onChange={(e) => {
                      setOfficeType(e.target.value);
                      setOfficeZoneId('');
                      setOfficeDistrictId('');
                      setOfficeTPId('');
                    }}
                  >
                    <option value="DTP">DTP (Directorate)</option>
                    <option value="ADTP">ADTP (Assistant Director Office)</option>
                    <option value="TP">TP (Town Panchayat)</option>
                  </select>
                </div>

                {officeType === 'ADTP' && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label>{lang === 'ta' ? 'மண்டலத்தைத் தேர்ந்தெடுக்கவும்' : 'Select Zone'}</label>
                      <select
                        value={officeZoneId}
                        onChange={(e) => setOfficeZoneId(e.target.value)}
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
                      <label>{lang === 'ta' ? 'மண்டலத்தைத் தேர்ந்தெடுக்கவும்' : 'Select Zone'}</label>
                      <select
                        value={officeZoneId}
                        onChange={(e) => {
                          setOfficeZoneId(e.target.value);
                          setOfficeDistrictId('');
                          setOfficeTPId('');
                        }}
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
                        <label>{lang === 'ta' ? 'மாவட்டத்தைத் தேர்ந்தெடுக்கவும்' : 'Select District'}</label>
                        <select
                          value={officeDistrictId}
                          onChange={(e) => {
                            setOfficeDistrictId(e.target.value);
                            setOfficeTPId('');
                          }}
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
                        <label>{lang === 'ta' ? 'பேரூராட்சியைத் தேர்ந்தெடுக்கவும்' : 'Select Town Panchayat'}</label>
                        <select
                          value={officeTPId}
                          onChange={(e) => setOfficeTPId(e.target.value)}
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
                  <div className="portal-wt-note">
                    <span>
                      <strong>{lang === 'ta' ? 'தானாக உருவான பெயர்' : 'Auto-Generated Name'}</strong>
                      {' — '}
                      {currentOfficeDetails.nameEn} / {currentOfficeDetails.nameTa}
                    </span>
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
                  <div className="portal-wt-section">
                    <div className="portal-wt-section-title">{t('postSanctions')}</div>
                    <div className="portal-wt-fields portal-sanction-list">
                      {posts.length === 0 && (
                        <p className="portal-wt-empty">{lang === 'ta' ? 'பதவிகள் இல்லை' : 'No posts to sanction yet'}</p>
                      )}
                      {posts.map((p: any) => (
                        <div key={p.id} className="portal-wt-field">
                          <div className="portal-wt-field-main">
                            <div className="portal-wt-field-name">{tObj(p)}</div>
                          </div>
                          <input
                            type="number"
                            min="0"
                            value={sanctions[p.id] || 0}
                            onChange={(e) => handleUpdateSanction(p.id, parseInt(e.target.value) || 0)}
                            className="portal-sanction-input"
                            aria-label={tObj(p)}
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
              >
                {lang === 'ta' ? 'அலுவலகத்தை உருவாக்கு' : 'Add Office Configuration'}
              </button>
            </form>
            </div>
          </div>

          <div className="portal-dashboard-panel">
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <Building className="h-3 w-3" />
                  </span>
                  {lang === 'ta' ? 'பணியிட வரம்பு நிலைகள்' : 'Sanctioned Post Configurations Matrix'}
                </h3>
                <p>{officeCategories.length} {lang === 'ta' ? 'அலுவலகங்கள்' : 'offices'}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleDownloadOfficeTemplate}
                  className="portal-dash-head-action"
                >
                  <Download className="h-3 w-3" />
                  <span>{lang === 'ta' ? 'மாதிரி படிவம்' : 'Template'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => officeCsvInputRef.current?.click()}
                  className="portal-dash-head-action"
                >
                  <UploadCloud className="h-3 w-3" />
                  <span>{lang === 'ta' ? 'CSV' : 'Office CSV'}</span>
                </button>
                <input
                  type="file"
                  ref={officeCsvInputRef}
                  accept=".csv"
                  onChange={handleOfficeCsvUpload}
                  className="hidden"
                />
              </div>
            </div>
            <div className="portal-dash-body">
              {officeCategories.length === 0 && (
                <p className="portal-wt-empty is-center">
                  {lang === 'ta' ? 'அலுவலக அமைப்புகள் இல்லை' : 'No office configurations yet'}
                </p>
              )}
              <div className="portal-wt-tree">
                {officeCategories.map((oc: any) => {
                  const isOpen = Boolean(openOfficeMatrix[oc.id]);
                  const tone = OFFICE_TONES[oc.type] || OFFICE_TONES.DTP;
                  const sanctionEntries = Object.keys(oc.sanctions || {})
                    .map((postId) => {
                      const pst = posts.find((p: any) => p.id === postId);
                      const count = oc.sanctions[postId];
                      if (!count) return null;
                      return { postId, label: pst ? tObj(pst) : postId, count };
                    })
                    .filter(Boolean) as { postId: string; label: string; count: number }[];
                  return (
                    <div
                      key={oc.id}
                      className={`portal-wt-node${isOpen ? ' is-open' : ''}`}
                      style={{ ['--wt-tone' as string]: tone }}
                    >
                      <div className="portal-wt-node-head">
                        <button
                          type="button"
                          className="portal-wt-toggle"
                          onClick={() => setOpenOfficeMatrix((prev) => ({ ...prev, [oc.id]: !prev[oc.id] }))}
                          aria-expanded={isOpen}
                        >
                          <ChevronRight className={`portal-wt-caret${isOpen ? ' is-open' : ''}`} />
                          <div className="portal-wt-copy">
                            <div className="portal-wt-title">
                              <span>{tObj(oc)}</span>
                              <span className="portal-wt-count">{oc.type}</span>
                              <span className="portal-wt-count">{sanctionEntries.length}</span>
                            </div>
                          </div>
                        </button>
                        <div className="portal-wt-actions">
                          <button
                            type="button"
                            onClick={() => onSaveCollection('officeCategories', officeCategories.filter((x: any) => x.id !== oc.id))}
                            className="portal-fis-icon-btn is-danger"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      {isOpen && (
                        <div className="portal-wt-fields">
                          {sanctionEntries.length === 0 && (
                            <p className="portal-wt-empty">{lang === 'ta' ? 'பணியிட வரம்பு இல்லை' : 'No sanctioned posts'}</p>
                          )}
                          {sanctionEntries.map((entry) => (
                            <div key={entry.postId} className="portal-wt-field">
                              <div className="portal-wt-field-main">
                                <div className="portal-wt-field-name">{entry.label}</div>
                              </div>
                              <span className="portal-wt-count">{entry.count}</span>
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

      {activeTab === 'roles' && (
        <div className="portal-dashboard-panel">
          <div className="portal-dash-head">
            <div>
              <h3>
                <span className="portal-dash-icon">
                  <ShieldAlert className="h-3 w-3" />
                </span>
                {t('roleManagement')}
              </h3>
              <p>
                {lang === 'ta'
                  ? `${roles.length} பங்குகள் · அணுகல் வரம்பு மற்றும் பக்க அனுமதி`
                  : `${roles.length} roles · access scope and page permissions`}
              </p>
            </div>
          </div>
          <div className="portal-dash-body">
            {roles.length === 0 && (
              <p className="portal-wt-empty is-center">
                {lang === 'ta' ? 'பங்குகள் இல்லை' : 'No roles configured yet'}
              </p>
            )}
            <div className="portal-wt-tree">
              {roles.map((role: any, roleIdx: number) => {
                const isOpen = Boolean(openRoleRows[role.id]);
                const tone = ROLE_TONES[roleIdx % ROLE_TONES.length];
                const assignedUsers = users.filter((u: any) => u.roleId === role.id).length;
                const pageIds = getRolePermissions(role.id);
                const scopeFlags: string[] = Array.isArray(role.permissions) ? role.permissions : [];
                const permissionLabel = (p: string) => {
                  if (p === 'all') return lang === 'ta' ? 'அனைத்து அனுமதிகளும்' : 'Super Admin';
                  if (p === 'zone_control') return lang === 'ta' ? 'மண்டல கட்டுப்பாடு' : 'Zone control';
                  if (p === 'tp_control') return lang === 'ta' ? 'பேரூராட்சி கட்டுப்பாடு' : 'Town Panchayat control';
                  return p.replace(/_/g, ' ');
                };
                return (
                  <div
                    key={role.id}
                    className={`portal-wt-node${isOpen ? ' is-open' : ''}`}
                    style={{ ['--wt-tone' as string]: tone }}
                  >
                    <div className="portal-wt-node-head">
                      <button
                        type="button"
                        className="portal-wt-toggle"
                        onClick={() => setOpenRoleRows((prev) => ({ ...prev, [role.id]: !prev[role.id] }))}
                        aria-expanded={isOpen}
                      >
                        <ChevronRight className={`portal-wt-caret${isOpen ? ' is-open' : ''}`} />
                        <div className="portal-wt-copy">
                          <div className="portal-wt-title">
                            <span>{tObj(role)}</span>
                            <span className="portal-wt-count">{role.id}</span>
                            <span className="portal-wt-count">
                              {assignedUsers} {lang === 'ta' ? 'பயனர்' : 'users'}
                            </span>
                          </div>
                        </div>
                      </button>
                      <div className="portal-wt-actions">
                        <button
                          type="button"
                          className="portal-fis-icon-btn"
                          title={lang === 'ta' ? 'பக்க அனுமதி மேலாண்மை' : 'Manage page access'}
                          onClick={() => {
                            setSelectedRoleForAccess(role.id);
                            setAccessMode('role_wise');
                            setActiveTab('page_access');
                            setPageAccessFeedback(null);
                          }}
                        >
                          <Key className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    {isOpen && (
                      <div className="portal-wt-fields">
                        <div className="portal-wt-field">
                          <div className="portal-wt-field-main">
                            <div className="portal-wt-field-name">{t('assignPermissions')}</div>
                            <div className="portal-wt-chips">
                              {scopeFlags.length === 0 && (
                                <span className="portal-wt-meta">
                                  {lang === 'ta' ? 'அணுகல் வரம்பு இல்லை' : 'No access scope flags'}
                                </span>
                              )}
                              {scopeFlags.map((p: string) => (
                                <span key={p} className="portal-wt-chip">{permissionLabel(p)}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="portal-wt-field">
                          <div className="portal-wt-field-main">
                            <div className="portal-wt-field-name">
                              <span>{lang === 'ta' ? 'பக்க அனுமதி' : 'Page access'}</span>
                              <span className="portal-wt-count">{pageIds.length}</span>
                            </div>
                            <div className="portal-wt-chips">
                              {pageIds.length === 0 && (
                                <span className="portal-wt-meta">
                                  {lang === 'ta' ? 'பக்கங்கள் இல்லை' : 'No pages enabled'}
                                </span>
                              )}
                              {pageIds.map((pageId: string) => {
                                const page = SYSTEM_PAGES.find((x) => x.id === pageId);
                                return (
                                  <span key={pageId} className="portal-wt-chip">
                                    {page ? (lang === 'ta' ? page.nameTa : page.nameEn) : pageId}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="portal-modal-overlay">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="portal-modal w-full max-w-md"
          >
            <div className="portal-modal-head">
              <h3 className="flex items-center gap-2">
                <span className="portal-dash-icon"><Edit className="h-3.5 w-3.5" /></span>
                {lang === 'ta' ? 'பயனர் விபரங்களை திருத்துக' : 'Edit User Details'}
              </h3>
              <button 
                type="button"
                onClick={() => setEditingUser(null)} 
                className="portal-modal-close"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateUserSubmit} className="portal-modal-body portal-wt-form">
              <div>
                <label>{t('userFullNameEn')}</label>
                <input
                  type="text"
                  value={editFullNameEn}
                  onChange={(e) => setEditFullNameEn(e.target.value)}
                  required
                />
              </div>
              <div>
                <label>{t('userFullNameTa')}</label>
                <input
                  type="text"
                  value={editFullNameTa}
                  onChange={(e) => setEditFullNameTa(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label>{t('usernameLabel')}</label>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label>{t('passwordLabel')}</label>
                  <input
                    type="text"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div>
                <label>{t('role')}</label>
                <select
                  value={editRoleId}
                  onChange={(e) => setEditRoleId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Role --</option>
                  {roles.map((r: any) => (
                    <option key={r.id} value={r.id}>{tObj(r)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>{t('scopeType')}</label>
                <select
                  value={editScopeType}
                  onChange={(e) => {
                    const val = e.target.value as 'HOD' | 'Zone' | 'TownPanchayat';
                    setEditScopeType(val);
                    setEditScopeId(val === 'HOD' ? 'all' : '');
                  }}
                  required
                >
                  <option value="HOD">{t('hodScope')}</option>
                  <option value="Zone">{t('zoneScope')}</option>
                  <option value="TownPanchayat">{t('tpScope')}</option>
                </select>
              </div>

              {editScopeType === 'Zone' && (
                <div>
                  <label>{t('selectZone')}</label>
                  <select
                    value={editScopeId}
                    onChange={(e) => setEditScopeId(e.target.value)}
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
                  <label>{t('selectTP')}</label>
                  <select
                    value={editScopeId}
                    onChange={(e) => setEditScopeId(e.target.value)}
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
                  className="portal-wt-link"
                >
                  {lang === 'ta' ? 'ரத்துசெய்' : 'Cancel'}
                </button>
                <button type="submit">
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
