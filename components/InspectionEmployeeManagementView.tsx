'use client';

import React, { useState, useRef } from 'react';
import { jsPDF } from 'jspdf';
import { motion } from 'motion/react';
import { 
  Users, 
  ShieldCheck, 
  Briefcase, 
  UserPlus, 
  Plus, 
  Trash2, 
  Upload, 
  Download, 
  CheckCircle, 
  AlertCircle,
  FileSpreadsheet,
  Info,
  MapPin,
  ClipboardList,
  Building2,
  Phone,
  Search,
  Check,
  Key,
  Pencil,
  X,
  Eye,
  EyeOff,
  UserCheck,
  ShieldAlert,
  RefreshCw,
  Calendar
} from 'lucide-react';
import {
  applyUserPasswordFields,
  buildUserCredentialIndex,
  getUserStoredPassword,
  resolvePasswordFromIndex,
} from '@/lib/userCredentials';
// Pure client-safe calendar date extractor in Asia/Kolkata timezone
function extractCalendarDateYMD(dateVal: any): string | null {
  if (!dateVal) return null;
  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return null;
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(dateVal);
  }
  if (typeof dateVal === 'number' || /^\d{10,13}$/.test(String(dateVal).trim())) {
    try {
      const num = typeof dateVal === 'number' ? dateVal : parseInt(String(dateVal).trim(), 10);
      const ms = num < 1e11 ? num * 1000 : num;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) {
        return new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(d);
      }
    } catch (_) {}
  }
  const str = String(dateVal).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(d);
    }
  } catch (_) {}
  return null;
}
import { Language, translations } from './translations';

interface InspectionEmployeeManagementViewProps {
  state: any;
  lang: Language;
  onSaveCollection: (key: string, data: any[]) => Promise<void>;
}

export default function InspectionEmployeeManagementView({ state, lang, onSaveCollection }: InspectionEmployeeManagementViewProps) {
  const [activeTab, setActiveTab] = useState<'employees' | 'roles' | 'designations' | 'sessions' | 'server_logs'>('employees');
  const [employeeViewMode, setEmployeeViewMode] = useState<'tree' | 'table'>('tree');
  const [mobileTab, setMobileTab] = useState<'list' | 'form'>('list');
  const [serverLogsText, setServerLogsText] = useState<string>('');
  const [isLoadingServerLogs, setIsLoadingServerLogs] = useState<boolean>(false);
  const [serverLogSearch, setServerLogSearch] = useState<string>('');
  const [serverLogCategory, setServerLogCategory] = useState<string>('all');
  const [bulkRole, setBulkRole] = useState<string>('all');
  const [bulkDesig, setBulkDesig] = useState<string>('all');
  const [bulkTp, setBulkTp] = useState<string>('all');
  const [isBulkOperating, setIsBulkOperating] = useState<boolean>(false);
  const [bulkActionMessage, setBulkActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const getTodayYmd = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [credentialIndex, setCredentialIndex] = useState<Record<string, string>>({});
  const [listPasswordVisible, setListPasswordVisible] = useState<Record<string, boolean>>({});

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

  const resolveInspectionUserPassword = (user: any) =>
    resolvePasswordFromIndex(user, credentialIndex);

  const refreshInspectionUserCredentials = async () => {
    try {
      const res = await fetch('/api/state?key=inspectionUsers', { cache: 'no-store' });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setCredentialIndex(buildUserCredentialIndex(json.data));
      }
    } catch {
      /* ignore */
    }
  };

  // Real-time activity list filter states & Date selection
  const [actDateFilter, setActDateFilter] = useState<string>(() => getTodayYmd());
  const [userWorkStats, setUserWorkStats] = useState<Record<string, { firstWorkEntry: string | null; lastWorkEntry: string | null; count: number }>>({});
  const [actZoneFilter, setActZoneFilter] = useState('all');
  const [actDistrictFilter, setActDistrictFilter] = useState('all');
  const [actTpFilter, setActTpFilter] = useState('all');
  const [actDesigFilter, setActDesigFilter] = useState('all');
  const [actSearchQuery, setActSearchQuery] = useState('');

  // Local real-time refreshed state for User Activities & Login Log
  const [localActivities, setLocalActivities] = useState<any[]>(state.userActivities || []);
  const [localUsers, setLocalUsers] = useState<any[]>(state.users || []);
  const [localInspectionUsers, setLocalInspectionUsers] = useState<any[]>(state.inspectionUsers || []);
  const [localSessions, setLocalSessions] = useState<any[]>(state.userSessions || []);

  // Synchronize local state with props state initially
  React.useEffect(() => {
    setLocalActivities(state.userActivities || []);
    setLocalUsers(state.users || []);
    setLocalInspectionUsers(state.inspectionUsers || []);
    setLocalSessions(state.userSessions || []);
  }, [state.userActivities, state.users, state.inspectionUsers, state.userSessions]);

  React.useEffect(() => {
    if (activeTab !== 'employees') return;
    setCredentialIndex((prev) => ({
      ...buildUserCredentialIndex(state.inspectionUsers || []),
      ...prev,
    }));
    void refreshInspectionUserCredentials();
  }, [activeTab, state.inspectionUsers]);

  // Polling Auto-refresh every 5 seconds when activeTab is 'sessions' or date changes
  React.useEffect(() => {
    if (activeTab !== 'sessions') return;

    const fetchLatestActivities = async () => {
      try {
        const [stateRes, actRes] = await Promise.all([
          fetch('/api/state').then(r => r.json()).catch(() => null),
          fetch(`/api/users/user-activity?date=${actDateFilter}`).then(r => r.json()).catch(() => null)
        ]);

        if (actRes && actRes.success) {
          if (Array.isArray(actRes.recentActivities)) {
            setLocalActivities(actRes.recentActivities);
          }
          if (actRes.userWorkStats) {
            setUserWorkStats(actRes.userWorkStats);
          }
        } else if (stateRes && stateRes.success && stateRes.data?.userActivities) {
          setLocalActivities(stateRes.data.userActivities);
        }

        if (stateRes && stateRes.success && stateRes.data) {
          if (stateRes.data.users) setLocalUsers(stateRes.data.users);
          if (stateRes.data.inspectionUsers) setLocalInspectionUsers(stateRes.data.inspectionUsers);
          if (stateRes.data.userSessions) setLocalSessions(stateRes.data.userSessions);
        }
      } catch (err) {
        console.error('Error auto-refreshing user activities:', err);
      }
    };

    fetchLatestActivities();
    const interval = setInterval(fetchLatestActivities, 5000);

    return () => clearInterval(interval);
  }, [activeTab, actDateFilter]);

  const {
    zones = [],
    districts = [],
    townPanchayats = [],
    wardsAndStreets = [],
    inspectionSubjects = [],
    inspectionCategories = [],
    inspectionRoles = [],
    inspectionDesignations = [],
    inspectionUsers = []
  } = state || {};

  // Form states - Roles
  const [roleCode, setRoleCode] = useState('');
  const [roleNameEn, setRoleNameEn] = useState('');
  const [roleNameTa, setRoleNameTa] = useState('');
  const [roleScope, setRoleScope] = useState<'single_tp' | 'multi_tp' | 'zonal' | 'field_worker'>('single_tp');

  // Form states - Designations
  const [desigNameEn, setDesigNameEn] = useState('');
  const [desigNameTa, setDesigNameTa] = useState('');
  const [desigRoleId, setDesigRoleId] = useState('');
  const [desigSubjectIds, setDesigSubjectIds] = useState<string[]>([]);

  // Form states - Users (Inspection Field Users)
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userUsername, setUserUsername] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [userNameEn, setUserNameEn] = useState('');
  const [userNameTa, setUserNameTa] = useState('');
  const [userMobile, setUserMobile] = useState('');
  const [userRoleId, setUserRoleId] = useState('');
  const [userDesigId, setUserDesigId] = useState('');
  const [userZoneId, setUserZoneId] = useState('');
  const [userDistrictId, setUserDistrictId] = useState('');
  const [userTpId, setUserTpId] = useState('');
  const [userSelectedTpIds, setUserSelectedTpIds] = useState<string[]>([]);
  const [userSelectedWards, setUserSelectedWards] = useState<string[]>([]);
  const [userSubjectIds, setUserSubjectIds] = useState<string[]>([]);
  const [userCategoryIds, setUserCategoryIds] = useState<string[]>([]);
  const [customWardInput, setCustomWardInput] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');

  const [csvFeedback, setCsvFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchServerLogs = async () => {
    setIsLoadingServerLogs(true);
    try {
      const res = await fetch('/api/logs/server-process?lines=1000');
      const data = await res.json();
      setServerLogsText(data.logs || 'No logs available');
    } catch (e: any) {
      setServerLogsText('Error loading server logs: ' + e.message);
    } finally {
      setIsLoadingServerLogs(false);
    }
  };

  const handleClearServerLogs = async () => {
    const confirmMsg = lang === 'ta'
      ? 'சேவையக பதிவுக் கோப்பை அழிக்க விரும்புகிறீர்களா? (Clear server_process.log)'
      : 'Are you sure you want to clear server_process.log?';
    if (!window.confirm(confirmMsg)) return;

    try {
      await fetch('/api/logs/server-process', { method: 'DELETE' });
      await fetchServerLogs();
    } catch (err: any) {
      alert(err.message || 'Error clearing logs');
    }
  };

  const handleBulkAction = async (action: 'disable_and_logout' | 'logout_only' | 'enable') => {
    const actionLabel = action === 'disable_and_logout' 
      ? (lang === 'ta' ? 'தேர்ந்தெடுத்த அனைவரையும் முடக்கி வெளியேற்றவா?' : 'Are you sure you want to disable and force logout all selected users?')
      : action === 'logout_only'
      ? (lang === 'ta' ? 'தேர்ந்தெடுத்த அனைவரையும் வெளியேற்றவா?' : 'Are you sure you want to force logout all selected users?')
      : (lang === 'ta' ? 'தேர்ந்தெடுத்த அனைவரையும் செயல்படுத்தவா?' : 'Are you sure you want to enable all selected users?');

    if (!window.confirm(actionLabel)) return;

    setIsBulkOperating(true);
    setBulkActionMessage(null);
    try {
      const res = await fetch('/api/users/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          roleId: bulkRole,
          designation: bulkDesig,
          tpId: bulkTp,
          adminUsername: 'admin'
        })
      });
      const data = await res.json();
      if (data.success) {
        setBulkActionMessage({ type: 'success', text: data.message });
        const statusVal = action === 'disable_and_logout' ? 'Inactive' : action === 'enable' ? 'Active' : undefined;
        if (statusVal) {
          const updated = inspectionUsers.map((u: any) => {
            const matchesRole = bulkRole === 'all' || u.roleId === bulkRole;
            const matchesDesig = bulkDesig === 'all' || u.designationId === bulkDesig;
            const matchesTp = bulkTp === 'all' || u.tpId === bulkTp || u.townPanchayatId === bulkTp;
            if (matchesRole && matchesDesig && matchesTp) {
              return { ...u, status: statusVal };
            }
            return u;
          });
          await onSaveCollection('inspectionUsers', updated);
        }
      } else {
        setBulkActionMessage({ type: 'error', text: data.message || 'Bulk operation failed' });
      }
    } catch (err: any) {
      setBulkActionMessage({ type: 'error', text: err.message || 'Network error' });
    } finally {
      setIsBulkOperating(false);
    }
  };

  const t = (key: keyof typeof translations['en']) => {
    return translations[lang][key] || translations['en'][key] || key;
  };

  const tObj = (obj: any) => {
    if (!obj) return '';
    return lang === 'ta' ? (obj.nameTa || obj.nameEn) : (obj.nameEn || obj.nameTa);
  };

  // Deduplicated unique districts and town panchayats to prevent duplicates in UI
  const uniqueDistricts = React.useMemo(() => {
    const seen = new Set<string>();
    return (districts || []).filter((d: any) => {
      const key = (d.nameEn || '').trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [districts]);

  const uniqueTownPanchayats = React.useMemo(() => {
    const seen = new Set<string>();
    return (townPanchayats || []).filter((tp: any) => {
      const key = `${tp.districtId || ''}::${(tp.nameEn || '').trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [townPanchayats]);

  // Add Inspection Role
  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleNameEn || !roleNameTa) return;

    const newRole = {
      id: 'ir_' + (roleCode || roleNameEn).toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.random().toString(36).substr(2, 4),
      code: roleCode || roleNameEn.toLowerCase().replace(/\s+/g, '_'),
      nameEn: roleNameEn.trim(),
      nameTa: roleNameTa.trim(),
      scope: roleScope,
      createdAt: new Date().toISOString()
    };

    await onSaveCollection('inspectionRoles', [...inspectionRoles, newRole]);
    setRoleCode('');
    setRoleNameEn('');
    setRoleNameTa('');
    setRoleScope('single_tp');
  };

  // Add Inspection Designation
  const handleAddDesignation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!desigNameEn || !desigNameTa || !desigRoleId) return;

    const newDesig = {
      id: 'id_' + desigNameEn.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.random().toString(36).substr(2, 4),
      roleId: desigRoleId,
      nameEn: desigNameEn.trim(),
      nameTa: desigNameTa.trim(),
      applicableSubjectIds: desigSubjectIds,
      createdAt: new Date().toISOString()
    };

    await onSaveCollection('inspectionDesignations', [...inspectionDesignations, newDesig]);
    setDesigNameEn('');
    setDesigNameTa('');
    setDesigRoleId('');
    setDesigSubjectIds([]);
  };

  // Reset User Form
  const resetUserForm = () => {
    setEditingUserId(null);
    setUserUsername('');
    setUserPassword('');
    setShowPassword(false);
    setUserNameEn('');
    setUserNameTa('');
    setUserMobile('');
    setUserRoleId('');
    setUserDesigId('');
    setUserZoneId('');
    setUserDistrictId('');
    setUserTpId('');
    setUserSelectedTpIds([]);
    setUserSelectedWards([]);
    setUserSubjectIds([]);
    setUserCategoryIds([]);
    setCustomWardInput('');
    setMobileTab('list');
  };

  // Start Editing User
  const startEditUser = (user: any) => {
    setEditingUserId(user.id);
    setUserUsername(user.username || user.mobile || '');
    setUserPassword(getUserStoredPassword(user));
    setUserNameEn(user.nameEn || '');
    setUserNameTa(user.nameTa || '');
    setUserMobile(user.mobile || '');
    setUserRoleId(user.roleId || '');
    setUserDesigId(user.designationId || '');
    setUserZoneId(user.zoneId || '');
    setUserDistrictId(user.districtId || '');
    setUserTpId(user.tpId || (user.townPanchayatIds?.[0] || ''));
    setUserSelectedTpIds(user.townPanchayatIds || user.selectedTpIds || (user.tpId ? [user.tpId] : []));
    setUserSelectedWards(user.assignedWards || user.selectedWards || []);
    setUserSubjectIds(user.subjectIds || user.assignedSubjects || []);
    setUserCategoryIds(user.categoryIds || user.assignedCategories || []);
    setActiveTab('employees');
    setMobileTab('form');
  };

  // Add or Update Inspection User
  const handleAddOrUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userNameEn || !userNameTa || !userMobile || !userRoleId || !userDesigId || !userUsername || !userPassword) {
      alert(lang === 'ta' 
        ? 'அனைத்து தேவையான புலங்களையும் பூர்த்தி செய்யவும் (பயனர்பெயர் மற்றும் கடவுச்சொல் உட்பட).' 
        : 'Please fill all required fields including Username and Password.');
      return;
    }

    // Mobile Validation (10 digits)
    if (!/^\d{10}$/.test(userMobile)) {
      alert(lang === 'ta' ? 'சரியான 10 இலக்க கைபேசி எண்ணை உள்ளிடவும்!' : 'Please enter a valid 10-digit mobile number!');
      return;
    }

    // Role Scope validation
    const currentRole = inspectionRoles.find((r: any) => r.id === userRoleId);
    const rawScope = currentRole?.scope || currentRole?.scopeType || 'single_tp';
    const scopeType = rawScope === 'field_workers' ? 'field_worker' : rawScope;

    if (scopeType === 'zonal' && !userZoneId) {
      alert(lang === 'ta' ? 'மண்டலப் பயனருக்கு மண்டலத்தைத் தேர்வு செய்யவும்.' : 'Please select a Zone for Zonal user.');
      return;
    }
    if (scopeType === 'single_tp' && (!userZoneId || !userDistrictId || !userTpId)) {
      alert(lang === 'ta' ? 'ஒற்றை பேரூராட்சி பயனருக்கு மண்டலம், மாவட்டம் மற்றும் பேரூராட்சியைத் தேர்வு செய்யவும்.' : 'Please select Zone, District, and Town Panchayat for Single TP user.');
      return;
    }
    if (scopeType === 'multi_tp' && (!userZoneId || !userDistrictId || userSelectedTpIds.length === 0)) {
      alert(lang === 'ta' ? 'பல பேரூராட்சிகள் பயனருக்கு மண்டலம், மாவட்டம் மற்றும் குறைந்தபட்சம் ஒரு பேரூராட்சியைத் தேர்வு செய்யவும்.' : 'Please select Zone, District, and at least one Town Panchayat for Multi-TP user.');
      return;
    }
    if (scopeType === 'field_worker' && (!userZoneId || !userDistrictId || !userTpId || userSelectedWards.length === 0)) {
      alert(lang === 'ta' ? 'வார்டு களப்பணியாளருக்கு மண்டலம், மாவட்டம், பேரூராட்சி மற்றும் ஒதுக்கப்பட்ட வார்டுகளை தேர்வு செய்யவும்.' : 'Please select Zone, District, Town Panchayat, and assigned Wards for Field Worker.');
      return;
    }

    // Check unique username (if not current user being edited)
    const usernameTaken = inspectionUsers.some((u: any) => 
      u.id !== editingUserId && u.username?.toLowerCase() === userUsername.trim().toLowerCase()
    );
    if (usernameTaken) {
      alert(lang === 'ta' ? 'இந்த பயனர்பெயர் ஏற்கனவே பயன்பாட்டில் உள்ளது. வேறு பெயரை தேர்வு செய்யவும்.' : 'This username is already taken. Please choose another.');
      return;
    }

    // Resolved town panchayat IDs based on scope
    let resolvedTpIds: string[] = [];
    if (scopeType === 'zonal') {
      const zoneDistricts = districts.filter((d: any) => d.zoneId === userZoneId).map((d: any) => d.id);
      resolvedTpIds = townPanchayats.filter((tp: any) => zoneDistricts.includes(tp.districtId)).map((tp: any) => tp.id);
    } else if (scopeType === 'single_tp') {
      resolvedTpIds = userTpId ? [userTpId] : [];
    } else if (scopeType === 'multi_tp') {
      resolvedTpIds = userSelectedTpIds;
    } else if (scopeType === 'field_worker') {
      resolvedTpIds = userTpId ? [userTpId] : [];
    }

    if (editingUserId) {
      // Update existing user
      const updated = inspectionUsers.map((u: any) => {
        if (u.id === editingUserId) {
          return applyUserPasswordFields({
            ...u,
            username: userUsername.trim(),
            nameEn: userNameEn.trim(),
            nameTa: userNameTa.trim(),
            mobile: userMobile.trim(),
            roleId: userRoleId,
            designationId: userDesigId,
            scopeType: scopeType,
            zoneId: userZoneId,
            districtId: userDistrictId,
            tpId: userTpId || (resolvedTpIds[0] || ''),
            townPanchayatIds: resolvedTpIds,
            selectedTpIds: resolvedTpIds,
            assignedWards: userSelectedWards.length > 0 ? userSelectedWards : (u.assignedWards || []),
            selectedWards: userSelectedWards.length > 0 ? userSelectedWards : (u.selectedWards || []),
            subjectIds: userSubjectIds,
            assignedSubjects: userSubjectIds,
            categoryIds: userCategoryIds,
            assignedCategories: userCategoryIds,
            updatedAt: new Date().toISOString()
          }, userPassword.trim());
        }
        return u;
      });

      await onSaveCollection('inspectionUsers', updated);
      rememberUserCredential({ id: editingUserId, username: userUsername.trim() }, userPassword.trim());
      resetUserForm();
    } else {
      // Create new user
      const newUser = applyUserPasswordFields({
        id: 'iu_' + Math.random().toString(36).substr(2, 6),
        username: userUsername.trim(),
        nameEn: userNameEn.trim(),
        nameTa: userNameTa.trim(),
        mobile: userMobile.trim(),
        roleId: userRoleId,
        designationId: userDesigId,
        scopeType: scopeType,
        zoneId: userZoneId,
        districtId: userDistrictId,
        tpId: userTpId || (resolvedTpIds[0] || ''),
        townPanchayatIds: resolvedTpIds,
        selectedTpIds: resolvedTpIds,
        assignedWards: userSelectedWards,
        selectedWards: userSelectedWards,
        subjectIds: userSubjectIds,
        assignedSubjects: userSubjectIds,
        categoryIds: userCategoryIds,
        assignedCategories: userCategoryIds,
        status: 'Active',
        createdAt: new Date().toISOString()
      }, userPassword.trim());

      await onSaveCollection('inspectionUsers', [...inspectionUsers, newUser]);
      rememberUserCredential(newUser, userPassword.trim());
      resetUserForm();
    }
  };

  // Delete Handlers
  const handleDeleteRole = async (roleId: string) => {
    const lowerId = roleId.toLowerCase();
    if (
      lowerId.includes('admin') || 
      lowerId.includes('ad') || 
      lowerId.includes('eo') || 
      lowerId.includes('zonal') ||
      lowerId.includes('single_tp') ||
      lowerId.includes('multi_tp') ||
      lowerId.includes('field_worker')
    ) {
      alert(lang === 'ta' 
        ? 'இயல்புநிலை பயனர் பொறுப்புகளை (admin, ad, eo, zonal) நீக்க முடியாது!' 
        : 'Cannot delete core default roles (admin, ad, eo, zonal)!'
      );
      return;
    }

    const updated = inspectionRoles.filter((r: any) => r.id !== roleId);
    await onSaveCollection('inspectionRoles', updated);
  };

  const handleDeleteDesignation = async (desigId: string) => {
    const updated = inspectionDesignations.filter((d: any) => d.id !== desigId);
    await onSaveCollection('inspectionDesignations', updated);
  };

  const handleDeleteUser = async (userId: string) => {
    const updated = inspectionUsers.filter((u: any) => u.id !== userId);
    await onSaveCollection('inspectionUsers', updated);
  };

  // Download Bulk CSV Template pre-filled with ACTUAL details from the system
  const downloadInspectionEmployeeTemplate = () => {
    const rows: string[] = [
      "Username,Password,EmployeeNameEn,EmployeeNameTa,MobileNumber,RoleNameEn,RoleNameTa,RoleScope,ZoneNameEn,DistrictNameEn,TownPanchayatNameEn,AssignedWards,DesignationNameEn,DesignationNameTa,InspectionSubjects"
    ];

    const actualZone = zones[0]?.nameEn || 'Kanchipuram';
    const actualDist = districts[0]?.nameEn || 'Thiruvallur';
    const actualTps = (townPanchayats && townPanchayats.length > 0) ? townPanchayats : [{ nameEn: 'Thirumazhisai' }, { nameEn: 'Arani' }];
    const tp1 = actualTps[0]?.nameEn || 'Thirumazhisai';
    const tp2 = actualTps[1]?.nameEn || actualTps[0]?.nameEn || 'Arani';

    const desigAnimator = inspectionDesignations.find((d: any) => d.nameEn?.toLowerCase().includes('animator')) || inspectionDesignations[1] || { nameEn: 'Animators', nameTa: 'அனிமேட்டர்கள்' };
    const desigDbc = inspectionDesignations.find((d: any) => d.nameEn?.toLowerCase().includes('dbc')) || inspectionDesignations[2] || { nameEn: 'DBC Workers', nameTa: 'டெங்கு கொசுப்புழு தடுப்பு பணியாளர்கள்' };
    const desigSi = inspectionDesignations.find((d: any) => d.nameEn?.toLowerCase().includes('sanitary') || d.nameEn?.toLowerCase().includes('field officer')) || inspectionDesignations[0] || { nameEn: 'Sanitary Inspector / Field Officer', nameTa: 'துப்புரவு ஆய்வாளர் / கள அலுவலர்' };
    const desigWater = inspectionDesignations.find((d: any) => d.nameEn?.toLowerCase().includes('water')) || { nameEn: 'Water Supply Workers', nameTa: 'குடிநீர் பணியாளர்' };

    const subjSwm = inspectionSubjects.find((s: any) => s.code === 'SWM' || s.nameEn?.toLowerCase().includes('swm') || s.nameEn?.toLowerCase().includes('solid'))?.nameEn || 'SWM Management';
    const subjWater = inspectionSubjects.find((s: any) => s.code === 'WSM' || s.nameEn?.toLowerCase().includes('water'))?.nameEn || 'Water Supply Management';
    const subjPhs = inspectionSubjects.find((s: any) => s.code === 'PHS' || s.nameEn?.toLowerCase().includes('public'))?.nameEn || 'Public Health & Sanitation';

    const actualWardsTp1 = Array.from<string>(new Set(
      (wardsAndStreets || [])
        .filter((ws: any) => ws.tpId === actualTps[0]?.id || ws.townPanchayatId === actualTps[0]?.id)
        .map((ws: any) => String(ws.wardNo || '1').trim().replace(/^0+/, ''))
        .filter(Boolean)
    )).sort((a: any, b: any) => Number(a) - Number(b));
    const sampleWards1 = actualWardsTp1.slice(0, 2).join(', ') || '1, 2';
    const sampleWards2 = actualWardsTp1.slice(1, 3).join(', ') || actualWardsTp1[0] || '1';

    rows.push(`insp_animator_01,pass123,Kavitha R,கவிதா ரா,9876543210,Ward Field Worker,வார்டு களப்பணியாளர்,field_worker,"${actualZone}","${actualDist}","${tp1}","${sampleWards1}","${desigAnimator.nameEn}","${desigAnimator.nameTa}","${subjSwm}"`);
    rows.push(`insp_dbc_01,pass123,Murugan S,முருகன் சு,9840123456,Ward Field Worker,வார்டு களப்பணியாளர்,field_worker,"${actualZone}","${actualDist}","${tp1}","${sampleWards2}","${desigDbc.nameEn}","${desigDbc.nameTa}","${subjPhs}"`);
    rows.push(`insp_officer_01,pass123,Ramesh K,ரமேஷ் கு,9444567890,Single TP Worker,ஒற்றை பேரூராட்சி பணியாளர்,single_tp,"${actualZone}","${actualDist}","${tp1}",,"${desigSi.nameEn}","${desigSi.nameTa}","${subjSwm}, ${subjWater}"`);
    rows.push(`insp_water_01,pass123,Senthamizh P,செந்தமிழ் பா,9123456780,Single TP Worker,ஒற்றை பேரூராட்சி பணியாளர்,single_tp,"${actualZone}","${actualDist}","${tp1}",,"${desigWater.nameEn}","${desigWater.nameTa}","${subjWater}"`);
    rows.push(`insp_supervisor_01,pass123,Ganesan K,கணேசன் கே,9000123456,Multi TP Supervisor,பல பேரூராட்சி மேற்பார்வையாளர்,multi_tp,"${actualZone}","${actualDist}","${tp1}, ${tp2}",,"${desigSi.nameEn}","${desigSi.nameTa}","${subjSwm}, ${subjWater}, ${subjPhs}"`);
    rows.push(`insp_zonal_01,pass123,Vasanth N,வசந்த் நா,9888123456,Zonal Inspector,மண்டல ஆய்வாளர்,zonal,"${actualZone}",,,,Zonal Sanitation Officer,மண்டல சுகாதார அலுவலர்,"${subjSwm}, ${subjWater}, ${subjPhs}"`);

    const csvContent = "\uFEFF" + rows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Inspection_User_Management_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Parse Bulk CSV Upload
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

        const parseCsvLine = (line: string) => {
          const result = [];
          let current = '';
          let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
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

        const headerLine = lines[0].toLowerCase();
        const hasUsernameHeader = headerLine.includes('username');

        const uploadedRoles = [...inspectionRoles];
        const uploadedDesignations = [...inspectionDesignations];
        const uploadedUsers = [...inspectionUsers];

        for (let i = 1; i < lines.length; i++) {
          const values = parseCsvLine(lines[i]);
          if (values.length < 5) continue;

          let username = '';
          let password = '';
          let empEn = '';
          let empTa = '';
          let mobile = '';
          let rEn = '';
          let rTa = '';
          let rScope = '';
          let zoneEn = '';
          let distEn = '';
          let tpNames = '';
          let wards = '';
          let dEn = '';
          let dTa = '';
          let subjs = '';

          if (hasUsernameHeader) {
            [username, password, empEn, empTa, mobile, rEn, rTa, rScope, zoneEn, distEn, tpNames, wards, dEn, dTa, subjs] = values;
          } else {
            [empEn, empTa, mobile, rEn, rTa, rScope, dEn, dTa, subjs, tpNames, wards] = values;
            username = 'insp_' + (mobile ? mobile.slice(-4) : Math.random().toString(36).substr(2, 4));
            password = mobile ? `pass${mobile.slice(-4)}` : '';
          }

          if (!empEn || !mobile) continue;

          // Find or create role
          let roleObj = uploadedRoles.find(r => r.nameEn.toLowerCase() === rEn.toLowerCase());
          if (!roleObj && rEn) {
            roleObj = {
              id: 'ir_' + rEn.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.random().toString(36).substr(2, 4),
              code: rEn.toLowerCase().replace(/\s+/g, '_'),
              nameEn: rEn,
              nameTa: rTa || rEn,
              scope: (rScope as any) || 'single_tp',
              createdAt: new Date().toISOString()
            };
            uploadedRoles.push(roleObj);
          }

          // Find or create designation
          let desigObj = null;
          if (roleObj && dEn) {
            desigObj = uploadedDesignations.find(d => d.roleId === roleObj!.id && d.nameEn.toLowerCase() === dEn.toLowerCase());
            if (!desigObj) {
              desigObj = {
                id: 'id_' + dEn.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.random().toString(36).substr(2, 4),
                roleId: roleObj.id,
                nameEn: dEn,
                nameTa: dTa || dEn,
                applicableSubjectIds: [],
                createdAt: new Date().toISOString()
              };
              uploadedDesignations.push(desigObj);
            }
          }

          // Resolve Zone
          const zoneObj = zones.find((z: any) => zoneEn && (z.nameEn?.toLowerCase() === zoneEn.toLowerCase() || z.nameTa?.toLowerCase() === zoneEn.toLowerCase()));
          const resolvedZoneId = zoneObj ? zoneObj.id : (zones[0]?.id || '');

          // Resolve District
          const distObj = districts.find((d: any) => distEn && (d.nameEn?.toLowerCase() === distEn.toLowerCase() || d.nameTa?.toLowerCase() === distEn.toLowerCase()));
          const resolvedDistrictId = distObj ? distObj.id : (districts.find((d: any) => d.zoneId === resolvedZoneId)?.id || '');

          // Resolve TP IDs: Match by name AND district to avoid duplicate mapping across districts!
          let resolvedTpIds: string[] = [];
          if (tpNames) {
            const names = tpNames.split(',').map(n => n.trim().toLowerCase());
            townPanchayats.forEach((tp: any) => {
              const tpNameEnLower = String(tp.nameEn || '').toLowerCase();
              const tpNameTaLower = String(tp.nameTa || '').toLowerCase();
              const matchesName = names.includes(tpNameEnLower) || names.includes(tpNameTaLower);
              const matchesDistrict = !resolvedDistrictId || String(tp.districtId || '').toLowerCase() === String(resolvedDistrictId).toLowerCase();
              
              if (matchesName && matchesDistrict) {
                resolvedTpIds.push(tp.id);
              }
            });
            resolvedTpIds = Array.from(new Set(resolvedTpIds));
          }

          // Resolve Subject IDs
          const resolvedSubjIds: string[] = [];
          if (subjs) {
            const sNames = subjs.split(',').map(s => s.trim().toLowerCase());
            inspectionSubjects.forEach((subj: any) => {
              if (sNames.includes(subj.nameEn.toLowerCase()) || sNames.includes(subj.nameTa.toLowerCase())) {
                resolvedSubjIds.push(subj.id);
              }
            });
          }

          const resolvedWards = wards ? wards.split(',').map(w => w.trim()).filter(Boolean) : [];

          // Create or Bulk Update User
          const existingUserIndex = uploadedUsers.findIndex(u => 
            (username && u.username?.toLowerCase() === username.toLowerCase()) || u.mobile === mobile
          );

          if (existingUserIndex >= 0) {
            uploadedUsers[existingUserIndex] = applyUserPasswordFields({
              ...uploadedUsers[existingUserIndex],
              username: username || uploadedUsers[existingUserIndex].username || ('insp_' + mobile.slice(-4)),
              nameEn: empEn,
              nameTa: empTa || empEn,
              mobile: mobile,
              roleId: roleObj?.id || uploadedUsers[existingUserIndex].roleId,
              designationId: desigObj?.id || uploadedUsers[existingUserIndex].designationId,
              scopeType: roleObj?.scope || uploadedUsers[existingUserIndex].scopeType || 'single_tp',
              zoneId: resolvedZoneId || uploadedUsers[existingUserIndex].zoneId,
              districtId: resolvedDistrictId || uploadedUsers[existingUserIndex].districtId,
              tpId: resolvedTpIds[0] || uploadedUsers[existingUserIndex].tpId || '',
              townPanchayatIds: resolvedTpIds.length > 0 ? resolvedTpIds : uploadedUsers[existingUserIndex].townPanchayatIds,
              selectedTpIds: resolvedTpIds.length > 0 ? resolvedTpIds : uploadedUsers[existingUserIndex].selectedTpIds,
              assignedWards: resolvedWards.length > 0 ? resolvedWards : uploadedUsers[existingUserIndex].assignedWards,
              selectedWards: resolvedWards.length > 0 ? resolvedWards : uploadedUsers[existingUserIndex].selectedWards,
              subjectIds: resolvedSubjIds.length > 0 ? resolvedSubjIds : uploadedUsers[existingUserIndex].subjectIds,
              status: 'Active',
              updatedAt: new Date().toISOString()
            }, password || getUserStoredPassword(uploadedUsers[existingUserIndex]));
          } else {
            uploadedUsers.push(applyUserPasswordFields({
              id: 'iu_' + Math.random().toString(36).substr(2, 6),
              username: username || ('insp_' + mobile.slice(-4)),
              nameEn: empEn,
              nameTa: empTa || empEn,
              mobile: mobile,
              roleId: roleObj?.id || '',
              designationId: desigObj?.id || '',
              scopeType: roleObj?.scope || 'single_tp',
              zoneId: resolvedZoneId,
              districtId: resolvedDistrictId,
              tpId: resolvedTpIds[0] || '',
              townPanchayatIds: resolvedTpIds,
              selectedTpIds: resolvedTpIds,
              assignedWards: resolvedWards,
              selectedWards: resolvedWards,
              subjectIds: resolvedSubjIds,
              status: 'Active',
              createdAt: new Date().toISOString()
            }, password || undefined));
          }
        }

        await onSaveCollection('inspectionRoles', uploadedRoles);
        await onSaveCollection('inspectionDesignations', uploadedDesignations);
        await onSaveCollection('inspectionUsers', uploadedUsers);

        setCsvFeedback({ 
          type: 'success', 
          message: lang === 'ta' 
            ? 'CSV வெற்றிகரமாக பதிவேற்றப்பட்டது! தற்காலிக ஆய்வு ஊழியர்கள் மற்றும் உள்நுழைவு விபரங்கள் புதுப்பிக்கப்பட்டன.' 
            : 'Inspection users, credentials, and jurisdictions successfully imported/updated from CSV!' 
        });
      } catch (err: any) {
        setCsvFeedback({ 
          type: 'error', 
          message: lang === 'ta' ? 'CSV கோப்பை வாசிப்பதில் பிழை ஏற்பட்டது!' : 'Error parsing CSV file format.' 
        });
      }
    };
    reader.readAsText(file, 'UTF-8');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Filtered users for search
  const filteredUsers = inspectionUsers.filter((user: any) => {
    if (!userSearchQuery) return true;
    const q = userSearchQuery.toLowerCase();
    const nameMatch = user.nameEn?.toLowerCase().includes(q) || user.nameTa?.toLowerCase().includes(q);
    const mobileMatch = user.mobile?.includes(q);
    return nameMatch || mobileMatch;
  });

  const handleExportEmployeesExcel = async () => {
    let credIndex = { ...credentialIndex };
    try {
      const res = await fetch('/api/state?key=inspectionUsers', { cache: 'no-store' });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        credIndex = { ...buildUserCredentialIndex(json.data), ...credIndex };
      }
    } catch {
      /* use in-memory index */
    }

    const usersToExport =
      userSearchQuery && userSearchQuery.trim() && filteredUsers.length > 0
        ? filteredUsers
        : inspectionUsers;

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <style>
          table { border-collapse: collapse; font-family: sans-serif; }
          th { background-color: #002B49; color: white; font-weight: bold; padding: 8px; text-align: left; }
          td { padding: 6px 8px; border: 1px solid #cbd5e1; }
        </style>
      </head>
      <body>
        <table border="1">
          <thead>
            <tr>
              <th colspan="13" style="background-color: #002B49; color: #ffffff; font-size: 14pt; padding: 10px; text-align: center;">
                ${lang === 'ta' ? 'தமிழ்நாடு பேரூராட்சிகள் இயக்ககம் • கள ஆய்வு பணியாளர்கள் பட்டியல் (கடவுச்சொற்களுடன்)' : 'Directorate of Town Panchayats • Inspection Employee Management List (With Passwords)'}
              </th>
            </tr>
            <tr>
              <th colspan="13" style="background-color: #f1f5f9; color: #334155; font-size: 10pt; padding: 6px; text-align: center;">
                ${lang === 'ta' ? `பதிவிறக்கப்பட்ட தேதி: ${new Date().toLocaleDateString('ta-IN')} | மொத்த பணியாளர்கள்: ${usersToExport.length}` : `Downloaded on: ${new Date().toLocaleDateString()} | Total Employees: ${usersToExport.length}`}
              </th>
            </tr>
            <tr>
              <th>${lang === 'ta' ? 'வ.எண்' : 'S.No'}</th>
              <th>${lang === 'ta' ? 'பணியாளர் பெயர் (ஆங்கிலம்)' : 'Employee Name (EN)'}</th>
              <th>${lang === 'ta' ? 'பணியாளர் பெயர் (தமிழ்)' : 'Employee Name (TA)'}</th>
              <th>${lang === 'ta' ? 'பயனர் அடையாளம் (Username)' : 'Username'}</th>
              <th style="background-color: #1e3a8a; color: #ffffff;">${lang === 'ta' ? 'கடவுச்சொல் (Password)' : 'Password'}</th>
              <th>${lang === 'ta' ? 'கைபேசி எண்' : 'Mobile'}</th>
              <th>${lang === 'ta' ? 'பொறுப்பு (Role)' : 'Role'}</th>
              <th>${lang === 'ta' ? 'பதவி (Designation)' : 'Designation'}</th>
              <th>${lang === 'ta' ? 'மண்டலம்' : 'Assigned Zone'}</th>
              <th>${lang === 'ta' ? 'மாவட்டம்' : 'Assigned District'}</th>
              <th>${lang === 'ta' ? 'பேரூராட்சி(கள்)' : 'Assigned Town Panchayat(s)'}</th>
              <th>${lang === 'ta' ? 'வார்டுகள்' : 'Assigned Wards'}</th>
              <th>${lang === 'ta' ? 'நிலை' : 'Status'}</th>
            </tr>
          </thead>
          <tbody>
    `;

    usersToExport.forEach((user: any, index: number) => {
      const roleObj = inspectionRoles.find((r: any) => r.id === user.roleId);
      const desigObj = inspectionDesignations.find((d: any) => d.id === user.designationId);
      const zoneObj = zones.find((z: any) => z.id === user.zoneId);
      const distObj = districts.find((d: any) => d.id === user.districtId);
      const tps = townPanchayats.filter((tp: any) =>
        (user.townPanchayatIds || user.selectedTpIds || (user.tpId ? [user.tpId] : []))?.includes(tp.id)
      );
      const userWards = user.assignedWards || user.selectedWards || [];
      const userPassword = resolvePasswordFromIndex(user, credIndex) || '';

      const roleName = lang === 'ta' ? (roleObj?.nameTa || roleObj?.nameEn || '') : (roleObj?.nameEn || '');
      const desigName = lang === 'ta' ? (desigObj?.nameTa || desigObj?.nameEn || '') : (desigObj?.nameEn || '');
      const zoneName = lang === 'ta' ? (zoneObj?.nameTa || zoneObj?.nameEn || '') : (zoneObj?.nameEn || '');
      const distName = lang === 'ta' ? (distObj?.nameTa || distObj?.nameEn || '') : (distObj?.nameEn || '');
      const tpNames = Array.from(
        new Set(tps.map((tp: any) => (lang === 'ta' ? (tp.nameTa || tp.nameEn) : (tp.nameEn || tp.nameTa || ''))))
      )
        .filter(Boolean)
        .join(', ');

      html += `
        <tr>
          <td>${index + 1}</td>
          <td>${user.nameEn || ''}</td>
          <td>${user.nameTa || ''}</td>
          <td>${user.username || ''}</td>
          <td style="font-family: monospace; font-weight: bold; color: #1e3a8a; background-color: #f0fdf4; mso-number-format: '\\@';">${userPassword}</td>
          <td>${user.mobile || ''}</td>
          <td>${roleName}</td>
          <td>${desigName}</td>
          <td>${zoneName}</td>
          <td>${distName}</td>
          <td>${tpNames}</td>
          <td>${userWards.join(', ')}</td>
          <td>${user.status || 'Active'}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Inspection_Employee_Management_List_With_Passwords_${lang === 'ta' ? 'தமிழ்' : 'English'}_${getTodayYmd()}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div id="inspection-employee-management-container" className="space-y-6">
      {/* Top Banner & Notices */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-600" />
              {t('inspectionEmployeeManagement')}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {t('temporaryStaffNotice')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={downloadInspectionEmployeeTemplate}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              {lang === 'ta' ? 'மாதிரி மாதிரி படிவம் பதிவிறக்கு (CSV)' : 'Model Template (CSV)'}
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition shadow-2xs"
            >
              <Upload className="w-3.5 h-3.5" />
              {lang === 'ta' ? 'பல்க் பதிவேற்றம் (Bulk Upload)' : 'Bulk CSV Upload'}
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

        {/* Notice alert */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-amber-800 text-xs">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            {lang === 'ta' 
              ? 'கள ஆய்வு பணியாளர்கள் (Animators, DBC Workers, Water Supply Workers) திட்ட அடிப்படையிலான தற்காலிக ஊழியர்கள். இவர்களின் நிர்வாகம் நிரந்தர துறை ஊழியர்களிலிருந்து பிரிக்கப்பட்டுள்ளது.' 
              : 'Inspection Field Staff (Animators, DBC Workers, Water Supply Workers) are contract/temporary workers scoped strictly to inspection tasks.'}
          </span>
        </div>

        {csvFeedback && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${csvFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
            {csvFeedback.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
            <p className="text-xs font-medium">{csvFeedback.message}</p>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-gray-100 bg-white px-3 sm:px-6 pt-3 sm:pt-4 rounded-t-2xl shadow-xs gap-1.5 sm:gap-2 overflow-x-auto whitespace-nowrap scrollbar-none">
        <button
          onClick={() => setActiveTab('employees')}
          className={`pb-3 sm:pb-4 px-3 sm:px-6 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-2 shrink-0 ${activeTab === 'employees' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Users className="w-4 h-4" />
          {t('inspectionUsers')} ({inspectionUsers.length})
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`pb-3 sm:pb-4 px-3 sm:px-6 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-2 shrink-0 ${activeTab === 'roles' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <ShieldCheck className="w-4 h-4" />
          {t('inspectionRoles')} ({inspectionRoles.length})
        </button>
        <button
          onClick={() => setActiveTab('designations')}
          className={`pb-3 sm:pb-4 px-3 sm:px-6 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-2 shrink-0 ${activeTab === 'designations' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Briefcase className="w-4 h-4" />
          {t('inspectionDesignations')} ({inspectionDesignations.length})
        </button>
        <button
          onClick={() => setActiveTab('sessions')}
          className={`pb-3 sm:pb-4 px-3 sm:px-6 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-2 shrink-0 ${activeTab === 'sessions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <ClipboardList className="w-4 h-4" />
          {lang === 'ta' ? 'பயனர் செயல்பாடுகள் & அமர்வு' : 'User Sessions & Activities'}
        </button>
        <button
          onClick={() => {
            setActiveTab('server_logs');
            fetchServerLogs();
          }}
          className={`pb-3 sm:pb-4 px-3 sm:px-6 text-xs sm:text-sm font-semibold border-b-2 transition flex items-center gap-2 shrink-0 ${activeTab === 'server_logs' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          {lang === 'ta' ? 'சேவையக பதிவு (Notepad Log)' : 'Server Process Log (Notepad)'}
        </button>
      </div>

      {/* Mobile Tab Switcher for Employees Tab */}
      {activeTab === 'employees' && (
        <div className="flex lg:hidden bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setMobileTab('list')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              mobileTab === 'list' 
                ? 'bg-white text-indigo-700 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            👥 {lang === 'ta' ? 'பணியாளர்கள் பட்டியல்' : 'Staff List'} ({filteredUsers.length})
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('form')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
              mobileTab === 'form' 
                ? 'bg-white text-indigo-700 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {editingUserId 
              ? `✏️ ${lang === 'ta' ? 'திருத்துதல்' : 'Edit User'}` 
              : `➕ ${lang === 'ta' ? 'புதிய பணியாளர் சேர்க்க' : 'Add User'}`}
          </button>
        </div>
      )}

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form Side */}
        <div className={`lg:col-span-5 bg-white p-4 sm:p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4 ${activeTab === 'employees' && mobileTab !== 'form' ? 'hidden lg:block' : 'block'}`}>
          {activeTab === 'roles' && (
            <form onSubmit={handleAddRole} className="space-y-4">
              <h4 className="font-semibold text-gray-900 text-sm border-b border-gray-100 pb-2">
                {t('addInspectionRole')}
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500">{lang === 'ta' ? 'பொறுப்பு குறியீடு' : 'Role Identifier Code'}</label>
                  <input
                    type="text"
                    value={roleCode}
                    onChange={(e) => setRoleCode(e.target.value)}
                    placeholder="e.g. single_tp, multi_tp, zonal, field_worker"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">{lang === 'ta' ? 'பொறுப்பு பெயர் (ஆங்கிலம்)' : 'Role Name (English)'}</label>
                  <input
                    type="text"
                    value={roleNameEn}
                    onChange={(e) => setRoleNameEn(e.target.value)}
                    placeholder="e.g. Field Workers (Ward Level)"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">{lang === 'ta' ? 'பொறுப்பு பெயர் (தமிழ்)' : 'Role Name (Tamil)'}</label>
                  <input
                    type="text"
                    value={roleNameTa}
                    onChange={(e) => setRoleNameTa(e.target.value)}
                    placeholder="எ.கா. வார்டு களப்பணியாளர்கள்"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">{lang === 'ta' ? 'அதிகார வரம்பு / வகை' : 'Operational Scope'}</label>
                  <select
                    value={roleScope}
                    onChange={(e) => setRoleScope(e.target.value as any)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white"
                  >
                    <option value="single_tp">{t('roleSingleTp')}</option>
                    <option value="multi_tp">{t('roleMultiTp')}</option>
                    <option value="zonal">{t('roleZonal')}</option>
                    <option value="field_worker">{t('roleFieldWorker')}</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                {t('addInspectionRole')}
              </button>
            </form>
          )}

          {activeTab === 'designations' && (
            <form onSubmit={handleAddDesignation} className="space-y-4">
              <h4 className="font-semibold text-gray-900 text-sm border-b border-gray-100 pb-2">
                {t('addInspectionDesignation')}
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('selectInspectionRole')}</label>
                  <select
                    value={desigRoleId}
                    onChange={(e) => setDesigRoleId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white"
                    required
                  >
                    <option value="">-- Choose Role --</option>
                    {inspectionRoles.map((r: any) => (
                      <option key={r.id} value={r.id}>{tObj(r)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">{lang === 'ta' ? 'பதவி பெயர் (ஆங்கிலம்)' : 'Designation Name (English)'}</label>
                  <input
                    type="text"
                    value={desigNameEn}
                    onChange={(e) => setDesigNameEn(e.target.value)}
                    placeholder="e.g. Animators, DBC Workers, Water Supply Workers"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">{lang === 'ta' ? 'பதவி பெயர் (தமிழ்)' : 'Designation Name (Tamil)'}</label>
                  <input
                    type="text"
                    value={desigNameTa}
                    onChange={(e) => setDesigNameTa(e.target.value)}
                    placeholder="எ.கா. அனிமேட்டர்கள், டெங்கு கொசு ஒழிப்பு பணியாளர்கள்"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('selectInspectionSubjects')}</label>
                  <div className="grid grid-cols-1 gap-1.5 mt-1 max-h-32 overflow-y-auto border border-gray-200 rounded-xl p-2 bg-gray-50">
                    {inspectionSubjects.map((s: any) => {
                      const checked = desigSubjectIds.includes(s.id);
                      return (
                        <label key={s.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setDesigSubjectIds([...desigSubjectIds, s.id]);
                              } else {
                                setDesigSubjectIds(desigSubjectIds.filter(id => id !== s.id));
                              }
                            }}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          <span className="font-medium text-gray-700">{tObj(s)}</span>
                        </label>
                      );
                    })}
                    {inspectionSubjects.length === 0 && (
                      <p className="text-[11px] text-gray-400 italic">No inspection subjects available yet.</p>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                {t('addInspectionDesignation')}
              </button>
            </form>
          )}

          {activeTab === 'sessions' && (
            <div className="space-y-6">
              <div>
                <h4 className="font-bold text-gray-900 text-sm border-b border-gray-100 pb-2">
                  {lang === 'ta' ? 'அலைபேசி நேரடி கண்காணிப்பு' : 'Live Mobile Session Tracker'}
                </h4>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  {lang === 'ta' 
                    ? 'பேரூராட்சி ஆய்வு ஊழியர்களின் நடப்பு அமர்வுகள் மற்றும் உள்நுழைவு/வெளியேறு நேரங்களை இங்கே கண்காணிக்கலாம்.' 
                    : 'Monitor current active sessions, last active heartbeat, and login/logout times of your field inspection officers here.'}
                </p>
              </div>

              {/* Stats Card */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
                  <span className="text-[10px] text-emerald-600 font-bold block mb-1">
                    {lang === 'ta' ? 'நேரடி பயனர்கள்' : 'Live Users'}
                  </span>
                  <span className="text-2xl font-black text-emerald-700">
                    {state.userSessions?.filter((s: any) => s.status === 'Active').length || 0}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-center">
                  <span className="text-[10px] text-slate-500 font-bold block mb-1">
                    {lang === 'ta' ? 'மொத்த அமர்வுகள்' : 'Total Logs'}
                  </span>
                  <span className="text-2xl font-black text-slate-700">
                    {state.userSessions?.length || 0}
                  </span>
                </div>
              </div>

              {/* Security Tips */}
              <div className="bg-indigo-50/50 border border-indigo-100/60 p-4 rounded-xl space-y-2 text-xs text-indigo-950">
                <h5 className="font-bold flex items-center gap-1.5 text-indigo-700">
                  <Info className="w-3.5 h-3.5 text-indigo-600" />
                  {lang === 'ta' ? 'பாதுகாப்பு கட்டுப்பாடுகள்' : 'Security Admin Controls:'}
                </h5>
                <ul className="list-disc list-inside space-y-1 text-[10px] leading-relaxed text-indigo-900">
                  <li>
                    {lang === 'ta'
                      ? 'வெளியேற்று (Force Logout) பொத்தானை அழுத்தினால் அந்த ஊழியர் உடனடியாக செயலியில் இருந்து வெளியேற்றப்படுவார்.'
                      : 'Force Logout button instantly logs out that specific user from the mobile app on their next heartbeat.'}
                  </li>
                  <li>
                    {lang === 'ta'
                      ? 'வெளியேற்றி முடக்கு (Logout & Deactivate) என்பது பயனரின் கணக்கை முழுமையாக தற்காலிகமாக நீக்கும் (Inactive).'
                      : 'Force Logout & Deactivate also marks the user account as Inactive so they cannot login again.'}
                  </li>
                  <li>
                    {lang === 'ta'
                      ? 'செயலற்ற பயனர்கள் 1 மணி நேரத்திற்குப் பின் தானாகவே வெளியேற்றப்படுவார்கள்.'
                      : 'Users inactive for over 1 hour or when the day ends will be automatically logged out by the app.'}
                  </li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'server_logs' && (
            <div className="space-y-5">
              <div>
                <h4 className="font-bold text-gray-900 text-sm border-b border-gray-100 pb-2 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                  {lang === 'ta' ? 'சேவையக பதிவுக் கோப்பு (Server Log File)' : 'Server Log File Info'}
                </h4>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  {lang === 'ta'
                    ? 'சேவையகத்தின் அனைத்து நிகழ்வுகளும் (உள்நுழைவு, வெளியேற்றம், பணி பதிவுகள், முதன்மை மாற்றங்கள்) நேரடியாக server_process.log கோப்பில் எழுதப்படுகின்றன.'
                    : 'All server process events (logins, logouts, work entries, master updates, sync) are written in real-time to server_process.log.'}
                </p>
              </div>

              {/* Notepad File Spec Card */}
              <div className="bg-slate-900 text-white rounded-xl p-4 space-y-2.5 font-mono text-xs shadow-sm border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-amber-400 font-bold flex items-center gap-1.5">
                    📝 server_process.log
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Active / Live
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 space-y-1">
                  <div><span className="text-slate-500">Path:</span> logs/server_process.log</div>
                  <div><span className="text-slate-500">Format:</span> UTF-8 Plain Text (Notepad compatible)</div>
                  <div><span className="text-slate-500">Timezone:</span> Indian Standard Time (IST)</div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                <a
                  href="/api/logs/server-process?download=true"
                  download="server_process.log"
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {lang === 'ta' ? 'Notepad-ல் திறக்க பதிவிறக்கு (.log)' : 'Download for Notepad (.log)'}
                </a>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={fetchServerLogs}
                    disabled={isLoadingServerLogs}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingServerLogs ? 'animate-spin' : ''}`} />
                    {lang === 'ta' ? 'புதுப்பி (Refresh)' : 'Refresh Log'}
                  </button>

                  <button
                    type="button"
                    onClick={handleClearServerLogs}
                    className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {lang === 'ta' ? 'அழி' : 'Clear'}
                  </button>
                </div>
              </div>

              {/* Server Machine Notepad Instructions */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs space-y-2 text-amber-900">
                <h5 className="font-bold flex items-center gap-1.5 text-amber-800">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  {lang === 'ta' ? 'சேவையக கணினியில் Notepad-ல் பார்ப்பது எப்படி:' : 'How to view via Notepad on Server Machine:'}
                </h5>
                <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-amber-950">
                  <li>
                    {lang === 'ta'
                      ? 'விண்டோஸ் சேவையகத்தில் Win + R அழுத்தி Run திறக்கவும்.'
                      : 'On Windows server machine, press Win + R to open Run dialog.'}
                  </li>
                  <li>
                    <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[10px]">notepad logs\server_process.log</code>
                  </li>
                  <li>
                    {lang === 'ta'
                      ? 'அல்லது File Explorer வழியே logs அடைவுக்கு சென்று Notepad அல்லது Notepad++ மூலம் நேரடியாக பார்க்கலாம்.'
                      : 'Or navigate to project logs folder and double-click to open in Notepad or Notepad++.'}
                  </li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'employees' && (() => {
            const currentRole = inspectionRoles.find((r: any) => r.id === userRoleId);
            const rawScope = currentRole?.scope || currentRole?.scopeType || 'single_tp';
            const scopeType = rawScope === 'field_workers' ? 'field_worker' : rawScope;

            // Calculate known wards for selected TP - only show created wards for selected TP
            const targetTp = townPanchayats.find((tp: any) => tp.id === userTpId);
            const matchingWards = (wardsAndStreets || []).filter((ws: any) => 
              (ws.tpId && ws.tpId === userTpId) || 
              (ws.townPanchayatId && ws.townPanchayatId === userTpId) ||
              (targetTp && (
                String(ws.tpId || '').toLowerCase() === String(targetTp.id || '').toLowerCase() ||
                String(ws.tpNameEn || '').toLowerCase() === String(targetTp.nameEn || '').toLowerCase() ||
                String(ws.tpId || '').toLowerCase() === String(targetTp.nameEn || '').toLowerCase()
              ))
            );
            const knownWardsForTp: string[] = Array.from<string>(
              new Set(
                matchingWards
                  .map((ws: any) => String(ws.wardNo || ws.wardNumber))
                  .filter((w: string) => w && w !== 'undefined' && w !== 'null')
              )
            ).sort((a: any, b: any) => Number(a) - Number(b));

            return (
              <form onSubmit={handleAddOrUpdateUser} className="space-y-4">
                {/* Form Header */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                    {editingUserId ? (
                      <>
                        <Pencil className="w-4 h-4 text-amber-600" />
                        <span className="text-amber-800">
                          {lang === 'ta' ? 'ஆய்வுப் பணியாளரை திருத்துக' : 'Edit Inspection User'}
                        </span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 text-indigo-600" />
                        <span>{t('addInspectionUser')}</span>
                      </>
                    )}
                  </h4>

                  {editingUserId && (
                    <button
                      type="button"
                      onClick={resetUserForm}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center gap-1 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                      {lang === 'ta' ? 'ரத்து' : 'Cancel'}
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {/* USERNAME & PASSWORD CREDENTIALS */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                        <Key className="w-3.5 h-3.5 text-indigo-600" />
                        {lang === 'ta' ? 'மொபைல் உள்நுழைவு விபரங்கள் *' : 'Mobile Login Credentials *'}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {lang === 'ta' ? 'பயனர் அடையாள எண் & கடவுச்சொல்' : 'User ID & Password'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          {lang === 'ta' ? 'பயனர்பெயர் (User ID) *' : 'User ID / Username *'}
                        </label>
                        <input
                          type="text"
                          value={userUsername}
                          onChange={(e) => setUserUsername(e.target.value.replace(/\s+/g, '_').toLowerCase())}
                          placeholder="e.g. insp_kavitha_01"
                          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                          required
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                          {lang === 'ta' ? 'கடவுச்சொல் (Password) *' : 'Password *'}
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={userPassword}
                            onChange={(e) => setUserPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-xs bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* FULL NAME */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500">{t('userFullNameEn')} *</label>
                      <input
                        type="text"
                        value={userNameEn}
                        onChange={(e) => setUserNameEn(e.target.value)}
                        placeholder="e.g. Kavitha R"
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">{t('userFullNameTa')} *</label>
                      <input
                        type="text"
                        value={userNameTa}
                        onChange={(e) => setUserNameTa(e.target.value)}
                        placeholder="எ.கா. கவிதா ரா"
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                        required
                      />
                    </div>
                  </div>

                  {/* MOBILE NUMBER */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500">{t('fieldTypeMobile')} *</label>
                    <input
                      type="tel"
                      maxLength={10}
                      value={userMobile}
                      onChange={(e) => setUserMobile(e.target.value.replace(/\D/g, ''))}
                      placeholder="9876543210 (10 digits)"
                      className="w-full border border-gray-200 rounded-xl p-2.5 text-xs mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none font-mono"
                      required
                    />
                  </div>

                  {/* ROLE & DESIGNATION */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500">{t('selectInspectionRole')} *</label>
                      <select
                        value={userRoleId}
                        onChange={(e) => {
                          setUserRoleId(e.target.value);
                          setUserDesigId('');
                        }}
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white font-medium"
                        required
                      >
                        <option value="">-- Role --</option>
                        {inspectionRoles.map((r: any) => (
                          <option key={r.id} value={r.id}>
                            {tObj(r)} ({r.scope})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-500">{t('selectInspectionDesignation')} *</label>
                      <select
                        value={userDesigId}
                        onChange={(e) => setUserDesigId(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white font-medium"
                        required
                      >
                        <option value="">-- Designation --</option>
                        {inspectionDesignations
                          .filter((d: any) => !userRoleId || d.roleId === userRoleId)
                          .map((d: any) => (
                            <option key={d.id} value={d.id}>{tObj(d)}</option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* JURISDICTIONAL DROPDOWNS BASED ON ROLE SCOPE */}
                  <div className="bg-indigo-50/40 border border-indigo-100 rounded-xl p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-indigo-950 flex items-center gap-1.5 uppercase tracking-wider">
                        <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                        {lang === 'ta' ? 'அதிகார வரம்பு தேர்வு (Jurisdiction)' : 'Jurisdiction Configuration'}
                      </span>
                      {currentRole && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-indigo-700 border border-indigo-200">
                          {scopeType === 'zonal' ? (lang === 'ta' ? 'மண்டலப் பணி' : 'Zonal') :
                           scopeType === 'single_tp' ? (lang === 'ta' ? 'ஒற்றை பேரூராட்சி' : 'Single TP') :
                           scopeType === 'multi_tp' ? (lang === 'ta' ? 'பல பேரூராட்சிகள்' : 'Multi-TP') :
                           (lang === 'ta' ? 'வார்டு களப்பணியாளர்' : 'Ward Field Worker')}
                        </span>
                      )}
                    </div>

                    {!userRoleId ? (
                      <p className="text-xs text-slate-400 italic py-2">
                        {lang === 'ta' 
                          ? 'முதலில் மேலே ஆய்வுப் பொறுப்பைத் (Role) தேர்வு செய்யவும். அதன் அடிப்படையில் மண்டலம்/பேரூராட்சி வரம்புகள் தோன்றும்.' 
                          : 'Please select an Inspection Role first. The relevant jurisdictional dropdowns will appear based on that role.'}
                      </p>
                    ) : scopeType === 'zonal' ? (
                      // 1. ZONAL: Show Zone dropdown only
                      <div className="space-y-2">
                        <div>
                          <label className="text-xs font-semibold text-gray-700 block mb-1">
                            {lang === 'ta' ? 'மண்டலத்தை தேர்ந்தெடுக்கவும் *' : 'Select Zone *'}
                          </label>
                          <select
                            value={userZoneId}
                            onChange={(e) => setUserZoneId(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                            required
                          >
                            <option value="">{lang === 'ta' ? '-- மண்டலம் தேர்வு --' : '-- Select Zone --'}</option>
                            {zones.map((z: any) => (
                              <option key={z.id} value={z.id}>{tObj(z)}</option>
                            ))}
                          </select>
                        </div>

                        <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 flex items-start gap-2">
                          <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>
                            {lang === 'ta'
                              ? 'மண்டல ஆய்வாளர்: இந்த மண்டலத்திற்கு உட்பட்ட அனைத்து மாவட்டங்கள், பேரூராட்சிகள் மற்றும் வார்டுகளில் பணிகள் பதிவு செய்ய அனுமதி உண்டு.'
                              : 'Zonal Inspector: In their selected zone, user can enter works across all districts, town panchayats, and wards.'}
                          </span>
                        </div>
                      </div>
                    ) : scopeType === 'single_tp' ? (
                      // 2. SINGLE TP: Select Zone -> Select District -> Select TP
                      <div className="space-y-2.5">
                        <div>
                          <label className="text-xs font-semibold text-gray-700 block mb-1">
                            {lang === 'ta' ? 'மண்டலத்தைத் தேர்ந்தெடுக்கவும் *' : 'Select Zone *'}
                          </label>
                          <select
                            value={userZoneId}
                            onChange={(e) => {
                              setUserZoneId(e.target.value);
                              setUserDistrictId('');
                              setUserTpId('');
                            }}
                            className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                            required
                          >
                            <option value="">{lang === 'ta' ? '-- மண்டலம் தேர்வு --' : '-- Select Zone --'}</option>
                            {zones.map((z: any) => (
                              <option key={z.id} value={z.id}>{tObj(z)}</option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs font-semibold text-gray-700 block mb-1">
                              {lang === 'ta' ? 'மாவட்டம் தேர்வு *' : 'Select District *'}
                            </label>
                            <select
                              value={userDistrictId}
                              onChange={(e) => {
                                setUserDistrictId(e.target.value);
                                setUserTpId('');
                              }}
                              className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                              required
                              disabled={!userZoneId}
                            >
                              <option value="">{lang === 'ta' ? '-- மாவட்டம் தேர்வு --' : '-- Select District --'}</option>
                              {uniqueDistricts
                                .filter((d: any) => !userZoneId || d.zoneId === userZoneId || d.id === userDistrictId)
                                .map((d: any) => (
                                  <option key={d.id} value={d.id}>{tObj(d)}</option>
                                ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-gray-700 block mb-1">
                              {lang === 'ta' ? 'பேரூராட்சி தேர்வு *' : 'Select Town Panchayat *'}
                            </label>
                            <select
                              value={userTpId}
                              onChange={(e) => setUserTpId(e.target.value)}
                              className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                              required
                              disabled={!userDistrictId}
                            >
                              <option value="">{lang === 'ta' ? '-- பேரூராட்சி தேர்வு --' : '-- Select Town Panchayat --'}</option>
                              {uniqueTownPanchayats
                                .filter((tp: any) => !userDistrictId || tp.districtId === userDistrictId || tp.id === userTpId)
                                .map((tp: any) => (
                                  <option key={tp.id} value={tp.id}>{tObj(tp)}</option>
                                ))}
                            </select>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-200 text-[11px] text-blue-800 flex items-start gap-2">
                          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          <span>
                            {lang === 'ta'
                              ? 'ஒற்றை பேரூராட்சி: இந்த பேரூராட்சியில் உள்ள அனைத்து வார்டுகளிலும் பணிகள் பதிவு செய்யலாம்.'
                              : 'Single TP: In this town panchayat, all wards user can enter works.'}
                          </span>
                        </div>
                      </div>
                    ) : scopeType === 'multi_tp' ? (
                      // 3. MULTIPLE TP: Select Zone -> Select District -> Select Multiple TPs
                      <div className="space-y-2.5">
                        <div>
                          <label className="text-xs font-semibold text-gray-700 block mb-1">
                            {lang === 'ta' ? 'மண்டலத்தைத் தேர்ந்தெடுக்கவும் *' : 'Select Zone *'}
                          </label>
                          <select
                            value={userZoneId}
                            onChange={(e) => {
                              setUserZoneId(e.target.value);
                              setUserDistrictId('');
                              setUserSelectedTpIds([]);
                            }}
                            className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                            required
                          >
                            <option value="">{lang === 'ta' ? '-- மண்டலம் தேர்வு --' : '-- Select Zone --'}</option>
                            {zones.map((z: any) => (
                              <option key={z.id} value={z.id}>{tObj(z)}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-gray-700 block mb-1">
                            {lang === 'ta' ? 'மாவட்டம் தேர்வு *' : 'Select District *'}
                          </label>
                          <select
                            value={userDistrictId}
                            onChange={(e) => {
                              setUserDistrictId(e.target.value);
                              setUserSelectedTpIds([]);
                            }}
                            className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                            required
                            disabled={!userZoneId}
                          >
                            <option value="">{lang === 'ta' ? '-- மாவட்டம் தேர்வு --' : '-- Select District --'}</option>
                            {uniqueDistricts
                              .filter((d: any) => !userZoneId || d.zoneId === userZoneId || d.id === userDistrictId)
                              .map((d: any) => (
                                <option key={d.id} value={d.id}>{tObj(d)} {d.code ? `[Code: ${d.code}]` : ''}</option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-gray-700 flex items-center justify-between mb-1">
                            <span>{lang === 'ta' ? 'பல பேரூராட்சிகளைத் தேர்வு செய்க *' : 'Select Multiple Town Panchayats *'}</span>
                            <span className="text-[10px] text-indigo-600 font-bold">
                              ({userSelectedTpIds.length} {lang === 'ta' ? 'தேர்வு' : 'selected'})
                            </span>
                          </label>
                          <div className="border border-gray-200 rounded-xl p-2 bg-white max-h-36 overflow-y-auto space-y-1">
                            {uniqueTownPanchayats
                              .filter((tp: any) => !userDistrictId || tp.districtId === userDistrictId || userSelectedTpIds.includes(tp.id))
                              .map((tp: any) => {
                                const isChecked = userSelectedTpIds.includes(tp.id);
                                return (
                                  <label key={tp.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer text-xs">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setUserSelectedTpIds([...userSelectedTpIds, tp.id]);
                                        } else {
                                          setUserSelectedTpIds(userSelectedTpIds.filter(id => id !== tp.id));
                                        }
                                      }}
                                      className="w-4 h-4 text-indigo-600 rounded"
                                    />
                                    <span className="font-medium text-slate-800">{tObj(tp)} {tp.code ? `[Code: ${tp.code}]` : ''}</span>
                                  </label>
                                );
                              })}
                            {uniqueTownPanchayats.filter((tp: any) => !userDistrictId || tp.districtId === userDistrictId || userSelectedTpIds.includes(tp.id)).length === 0 && (
                              <p className="text-[11px] text-gray-400 italic p-1">
                                {lang === 'ta' ? 'பேரூராட்சிகள் காணப்படவில்லை. மாவட்டத்தை தேர்ந்தெடுக்கவும்.' : 'No town panchayats found. Please select a district.'}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-indigo-50 border border-indigo-200 text-[11px] text-indigo-800 flex items-start gap-2">
                          <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                          <span>
                            {lang === 'ta'
                              ? 'பல பேரூராட்சிகள்: தேர்வு செய்யப்பட்ட பேரூராட்சிகளின் அனைத்து வார்டுகளிலும் பணிகள் பதிவு செய்யலாம்.'
                              : 'Multiple TP: In their selected town panchayats, all wards user can enter works.'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      // 4. WARD FIELD WORKER: Select Zone -> Select District -> Select TP -> Select Multiple Wards
                      <div className="space-y-2.5">
                        <div>
                          <label className="text-xs font-semibold text-gray-700 block mb-1">
                            {lang === 'ta' ? 'மண்டலத்தைத் தேர்ந்தெடுக்கவும் *' : 'Select Zone *'}
                          </label>
                          <select
                            value={userZoneId}
                            onChange={(e) => {
                              setUserZoneId(e.target.value);
                              setUserDistrictId('');
                              setUserTpId('');
                              setUserSelectedWards([]);
                            }}
                            className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                            required
                          >
                            <option value="">{lang === 'ta' ? '-- மண்டலம் தேர்வு --' : '-- Select Zone --'}</option>
                            {zones.map((z: any) => (
                              <option key={z.id} value={z.id}>{tObj(z)}</option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs font-semibold text-gray-700 block mb-1">
                              {lang === 'ta' ? 'மாவட்டம் தேர்வு *' : 'Select District *'}
                            </label>
                            <select
                              value={userDistrictId}
                              onChange={(e) => {
                                setUserDistrictId(e.target.value);
                                setUserTpId('');
                                setUserSelectedWards([]);
                              }}
                              className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                              required
                              disabled={!userZoneId}
                            >
                              <option value="">{lang === 'ta' ? '-- மாவட்டம் தேர்வு --' : '-- Select District --'}</option>
                              {uniqueDistricts
                                .filter((d: any) => !userZoneId || d.zoneId === userZoneId || d.id === userDistrictId)
                                .map((d: any) => (
                                  <option key={d.id} value={d.id}>{tObj(d)} {d.code ? `[Code: ${d.code}]` : ''}</option>
                                ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-semibold text-gray-700 block mb-1">
                              {lang === 'ta' ? 'பேரூராட்சி தேர்வு *' : 'Select Town Panchayat *'}
                            </label>
                            <select
                              value={userTpId}
                              onChange={(e) => {
                                setUserTpId(e.target.value);
                                setUserSelectedWards([]);
                              }}
                              className="w-full border border-gray-200 rounded-xl p-2.5 text-xs bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                              required
                              disabled={!userDistrictId}
                            >
                              <option value="">{lang === 'ta' ? '-- பேரூராட்சி தேர்வு --' : '-- Select Town Panchayat --'}</option>
                              {uniqueTownPanchayats
                                .filter((tp: any) => !userDistrictId || tp.districtId === userDistrictId || tp.id === userTpId)
                                .map((tp: any) => (
                                  <option key={tp.id} value={tp.id}>{tObj(tp)} {tp.code ? `[Code: ${tp.code}]` : ''}</option>
                                ))}
                            </select>
                          </div>
                        </div>

                        {/* Multiple Wards Selector */}
                        <div>
                          <label className="text-xs font-semibold text-gray-700 flex items-center justify-between mb-1">
                            <span>{lang === 'ta' ? 'ஒதுக்கப்பட்ட வார்டுகளை தேர்வு செய்க *' : 'Select Assigned Wards *'}</span>
                            <span className="text-[10px] text-amber-700 font-bold">
                              ({userSelectedWards.length} {lang === 'ta' ? 'வார்டுகள்' : 'wards'})
                            </span>
                          </label>

                          {/* Only show created wards for selected town panchayat */}
                          {knownWardsForTp.length === 0 ? (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-xs mb-2">
                              {userTpId 
                                ? (lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்ட பேரூராட்சியில் வார்டுகள் எதுவும் உருவாக்கப்படவில்லை. வார்டு மற்றும் தெரு மாஸ்டர் மேலாண்மை பிரிவில் வார்டுகளை உருவாக்கவும்.' : 'No wards have been created yet for this Town Panchayat. Please create wards in Ward & Street Master Management.')
                                : (lang === 'ta' ? 'முதலில் பேரூராட்சியை தேர்வு செய்யவும்.' : 'Please select a Town Panchayat first.')}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-1.5 p-2 bg-white border border-gray-200 rounded-lg max-h-36 overflow-y-auto">
                                {knownWardsForTp.map((wardNum: string) => {
                                  const isAssigned = userSelectedWards.includes(wardNum);
                                  return (
                                    <button
                                      key={wardNum}
                                      type="button"
                                      onClick={() => {
                                        if (isAssigned) {
                                          setUserSelectedWards(userSelectedWards.filter(w => w !== wardNum));
                                        } else {
                                          setUserSelectedWards([...userSelectedWards, wardNum]);
                                        }
                                      }}
                                      className={`px-3 py-1.5 text-xs rounded-md font-bold border transition ${
                                        isAssigned 
                                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                      }`}
                                    >
                                      {lang === 'ta' ? `வார்டு ${wardNum}` : `Ward ${wardNum}`}
                                    </button>
                                  );
                                })}
                              </div>
                              <div className="flex justify-between items-center text-[10px] text-slate-500">
                                <span>{lang === 'ta' ? 'தேர்வு செய்யப்பட்ட பேரூராட்சியில் உள்ள வார்டுகள் மட்டுமே' : 'Only created wards for selected Town Panchayat'}</span>
                                <div className="space-x-2">
                                  <button
                                    type="button"
                                    onClick={() => setUserSelectedWards(knownWardsForTp)}
                                    className="text-indigo-600 font-semibold hover:underline"
                                  >
                                    {lang === 'ta' ? 'அனைத்தையும் தேர்வு செய்' : 'Select All'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setUserSelectedWards([])}
                                    className="text-slate-500 hover:underline"
                                  >
                                    {lang === 'ta' ? 'அனைத்தையும் நீக்கு' : 'Clear'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <span>
                            {lang === 'ta'
                              ? 'வார்டு களப்பணியாளர்: ஒதுக்கப்பட்ட குறிப்பிட்ட வார்டுகளில் மட்டும் கள ஆய்வு பணிகளைப் பதிவு செய்ய முடியும்.'
                              : 'Ward Field Worker: In their assigned wards, user can enter works.'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Assigned Inspection Subjects */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-500">{t('selectInspectionSubjects')}</label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setUserSubjectIds(inspectionSubjects.map((s: any) => s.id))}
                          className="text-[10px] text-indigo-600 hover:underline font-semibold"
                        >
                          {lang === 'ta' ? 'அனைத்தும்' : 'Select All'}
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                          type="button"
                          onClick={() => setUserSubjectIds([])}
                          className="text-[10px] text-gray-500 hover:underline"
                        >
                          {lang === 'ta' ? 'நீக்கு' : 'Clear'}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 border border-gray-200 rounded-xl p-2 bg-gray-50 max-h-28 overflow-y-auto">
                      {inspectionSubjects.map((s: any) => {
                        const checked = userSubjectIds.includes(s.id);
                        return (
                          <label key={s.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setUserSubjectIds([...userSubjectIds, s.id]);
                                } else {
                                  setUserSubjectIds(userSubjectIds.filter(id => id !== s.id));
                                }
                              }}
                              className="w-3.5 h-3.5 text-indigo-600 rounded"
                            />
                            <span className="truncate">{tObj(s)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Assigned Inspection Categories */}
                  {(() => {
                    const relevantCats = inspectionCategories.filter((c: any) =>
                      userSubjectIds.length === 0 ||
                      userSubjectIds.includes(c.subjectId) ||
                      userSubjectIds.includes(c.subject_id)
                    );
                    return (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-gray-500">
                            {lang === 'ta' ? 'ஒதுக்கப்பட்ட ஆய்வு பிரிவுகள் (Categories)' : 'Assigned Inspection Categories'}
                            {userCategoryIds.length > 0 && ` (${userCategoryIds.length})`}
                          </label>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setUserCategoryIds(relevantCats.map((c: any) => c.id))}
                              className="text-[10px] text-indigo-600 hover:underline font-semibold"
                            >
                              {lang === 'ta' ? 'அனைத்தும்' : 'Select All'}
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              type="button"
                              onClick={() => setUserCategoryIds([])}
                              className="text-[10px] text-gray-500 hover:underline"
                            >
                              {lang === 'ta' ? 'நீக்கு' : 'Clear'}
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 border border-gray-200 rounded-xl p-2 bg-gray-50 max-h-28 overflow-y-auto">
                          {relevantCats.length === 0 ? (
                            <div className="col-span-2 text-[11px] text-gray-400 py-1 text-center">
                              {lang === 'ta' ? 'பிரிவுகள் எதுவும் இல்லை' : 'No categories available for selected subjects'}
                            </div>
                          ) : (
                            relevantCats.map((c: any) => {
                              const checked = userCategoryIds.includes(c.id);
                              return (
                                <label key={c.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setUserCategoryIds([...userCategoryIds, c.id]);
                                      } else {
                                        setUserCategoryIds(userCategoryIds.filter(id => id !== c.id));
                                      }
                                    }}
                                    className="w-3.5 h-3.5 text-indigo-600 rounded"
                                  />
                                  <span className="truncate">{tObj(c)}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <button
                  type="submit"
                  className={`w-full py-3 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs ${
                    editingUserId 
                      ? 'bg-amber-600 hover:bg-amber-700' 
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {editingUserId ? (
                    <>
                      <Check className="w-4 h-4" />
                      {lang === 'ta' ? 'பயனர் விபரங்களை புதுப்பிக்கவும்' : 'Update Inspection User'}
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      {t('addInspectionUser')}
                    </>
                  )}
                </button>
              </form>
            );
          })()}
        </div>

        {/* Right Overview and Listings */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
          {activeTab === 'employees' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                <div className="space-y-1">
                  <h4 className="font-semibold text-gray-800 text-md flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-500" />
                    {t('inspectionEmployees')} ({filteredUsers.length})
                  </h4>
                  <p className="text-xs text-gray-400">
                    {lang === 'ta' ? 'கள ஆய்வு ஊழியர்களின் படிநிலை & பட்டியல் விபரங்கள்' : 'Inspection Employee Hierarchy & Assignments'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Tree/Table Selector */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setEmployeeViewMode('tree')}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${employeeViewMode === 'tree' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      {lang === 'ta' ? 'படிநிலை வடிவம்' : 'Tree View'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEmployeeViewMode('table')}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition ${employeeViewMode === 'table' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      {lang === 'ta' ? 'அட்டவணை வடிவம்' : 'Table View'}
                    </button>
                  </div>

                  {/* Excel Export with Passwords */}
                  <button
                    type="button"
                    onClick={handleExportEmployeesExcel}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 font-semibold text-xs rounded-xl transition cursor-pointer shadow-3xs"
                    title={lang === 'ta' ? 'பணியாளர் பட்டியலை கடவுச்சொல்லுடன் எக்செல் வடிவில் பதிவிறக்கு' : 'Download Inspection Employees List with Passwords as Excel'}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>{lang === 'ta' ? 'கடவுச்சொல்லுடன் எக்செல்' : 'Excel (With Passwords)'}</span>
                  </button>

                  {/* Search query */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                      placeholder={lang === 'ta' ? 'பெயர்...' : 'Search...'}
                      className="pl-8 pr-2 py-1 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none w-36"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 max-h-[585px] overflow-y-auto pr-1">
                {employeeViewMode === 'tree' ? (
                  /* Collapsible/Grouped Hierarchical Tree View of Employees */
                  <div className="space-y-4">
                    {zones.map((zone: any) => {
                      const zoneDists = districts.filter((d: any) => d.zoneId === zone.id);
                      const zoneUsers = filteredUsers.filter((u: any) => u.zoneId === zone.id);
                      if (zoneUsers.length === 0) return null; // Only show zones with active employees

                      return (
                        <div key={zone.id} className="border border-slate-100 bg-slate-50/50 rounded-xl p-3 space-y-3">
                          <div className="flex items-center gap-2 bg-slate-100 p-2 rounded-lg">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                              {tObj(zone)} {lang === 'ta' ? 'மண்டலம்' : 'Zone'} ({zoneUsers.length})
                            </span>
                          </div>

                          <div className="pl-3 space-y-3">
                            {zoneDists.map((dist: any) => {
                              const distTps = townPanchayats.filter((tp: any) => tp.districtId === dist.id);
                              const distUsers = zoneUsers.filter((u: any) => u.districtId === dist.id);
                              if (distUsers.length === 0) return null;

                              return (
                                <div key={dist.id} className="border-l-2 border-indigo-100 pl-3 space-y-2">
                                  <div className="text-[11px] font-bold text-indigo-700 bg-indigo-50/50 p-1.5 rounded">
                                    {tObj(dist)} {lang === 'ta' ? 'மாவட்டம்' : 'District'} ({distUsers.length})
                                  </div>

                                  <div className="pl-2 space-y-2">
                                    {distTps.map((tp: any) => {
                                      const tpUsers = distUsers.filter((u: any) => 
                                        (u.townPanchayatIds || u.selectedTpIds || (u.tpId ? [u.tpId] : []))?.includes(tp.id)
                                      );
                                      if (tpUsers.length === 0) return null;

                                      return (
                                        <div key={tp.id} className="bg-white border border-gray-100 rounded-lg p-2.5 space-y-2 shadow-2xs">
                                          <div className="text-[10px] font-bold text-emerald-800 bg-emerald-50/50 px-2 py-1 rounded-sm flex items-center gap-1.5">
                                            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                                            {tObj(tp)} ({tpUsers.length} {lang === 'ta' ? 'பணியாளர்கள்' : 'employees'})
                                          </div>

                                          <div className="space-y-1.5 pl-2">
                                            {tpUsers.map((user: any) => {
                                              const roleObj = inspectionRoles.find((r: any) => r.id === user.roleId);
                                              const desigObj = inspectionDesignations.find((d: any) => d.id === user.designationId);
                                              const userWards = user.assignedWards || user.selectedWards || [];
                                              const subjs = inspectionSubjects.filter((s: any) => (user.subjectIds || [])?.includes(s.id));
                                              const isBeingEdited = editingUserId === user.id;

                                              return (
                                                <div 
                                                  key={user.id} 
                                                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-lg border text-xs gap-2 transition ${
                                                    isBeingEdited 
                                                      ? 'border-amber-300 bg-amber-50' 
                                                      : 'border-slate-50 bg-slate-50/50 hover:bg-slate-50'
                                                  }`}
                                                >
                                                  <div className="space-y-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                      <span className="font-bold text-gray-950">{tObj(user)}</span>
                                                      <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                                                        @{user.username}
                                                      </span>
                                                    </div>
                                                    <div className="text-[10px] text-gray-500 space-y-0.5">
                                                      <div>{lang === 'ta' ? 'பதவி' : 'Desig'}: <span className="font-semibold text-gray-700">{desigObj ? tObj(desigObj) : '—'}</span> ({roleObj ? tObj(roleObj) : '—'})</div>
                                                      <div>{lang === 'ta' ? 'கைபேசி' : 'Mobile'}: <span className="font-medium text-indigo-700">{user.mobile}</span></div>
                                                      {userWards?.length > 0 && (
                                                        <div className="text-indigo-800 font-bold">
                                                          {lang === 'ta' ? 'ஒதுக்கப்பட்ட வார்டுகள்' : 'Assigned Wards'}: {userWards.join(', ')}
                                                        </div>
                                                      )}
                                                      {subjs.length > 0 && (
                                                        <div className="text-purple-700">
                                                          {lang === 'ta' ? 'பிரிவுகள்' : 'Subjects'}: {subjs.map(s => tObj(s)).join(', ')}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>

                                                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                                                    <button
                                                      onClick={() => startEditUser(user)}
                                                      className="p-1 hover:text-amber-700 hover:bg-amber-100 text-amber-600 rounded transition"
                                                      title="Edit"
                                                    >
                                                      <Pencil className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                      onClick={() => handleDeleteUser(user.id)}
                                                      className="p-1 hover:text-red-600 hover:bg-red-50 text-gray-400 rounded transition"
                                                      title="Delete"
                                                    >
                                                      <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Standard Modern Table view of employees */
                  <div className="overflow-x-auto border border-gray-100 rounded-xl bg-white">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-gray-700 font-bold border-b border-gray-200">
                          <th className="p-3">{lang === 'ta' ? 'வ.எண்' : 'S.No'}</th>
                          <th className="p-3">{lang === 'ta' ? 'பெயர் / பயனர் பெயர்' : 'Name / Username'}</th>
                          <th className="p-3">{lang === 'ta' ? 'கைபேசி' : 'Contact'}</th>
                          <th className="p-3">{lang === 'ta' ? 'கடவுச்சொல்' : 'Password'}</th>
                          <th className="p-3">{lang === 'ta' ? 'பதவி / பொறுப்பு' : 'Designation / Role'}</th>
                          <th className="p-3">{lang === 'ta' ? 'வட்டார எல்லைகள்' : 'Jurisdictions'}</th>
                          <th className="p-3 text-right">{lang === 'ta' ? 'செயல்பாடுகள்' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredUsers.map((user: any, index: number) => {
                          const roleObj = inspectionRoles.find((r: any) => r.id === user.roleId);
                          const desigObj = inspectionDesignations.find((d: any) => d.id === user.designationId);
                          const zoneObj = zones.find((z: any) => z.id === user.zoneId);
                          const distObj = districts.find((d: any) => d.id === user.districtId);
                          const tps = townPanchayats.filter((tp: any) => (user.townPanchayatIds || user.selectedTpIds || (user.tpId ? [user.tpId] : []))?.includes(tp.id));
                          const userWards = user.assignedWards || user.selectedWards || [];

                          return (
                            <tr key={user.id} className="hover:bg-slate-50 transition">
                              <td className="p-3 text-gray-500 font-mono tabular-nums">{index + 1}</td>
                              <td className="p-3">
                                <div className="font-bold text-gray-950">{tObj(user)}</div>
                                <div className="text-[10px] text-gray-500 font-mono">@{user.username}</div>
                              </td>
                              <td className="p-3 text-indigo-700 font-semibold">{user.mobile}</td>
                              <td className="p-3 font-mono text-[11px]">
                                <div className="flex items-center gap-1.5">
                                  <span>
                                    {listPasswordVisible[user.id]
                                      ? (resolveInspectionUserPassword(user) || '—')
                                      : '••••••••'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setListPasswordVisible((prev) => ({
                                        ...prev,
                                        [user.id]: !prev[user.id],
                                      }))
                                    }
                                    className="text-gray-400 hover:text-gray-600"
                                  >
                                    {listPasswordVisible[user.id] ? (
                                      <EyeOff className="w-3.5 h-3.5" />
                                    ) : (
                                      <Eye className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </td>
                              <td className="p-3">
                                <div className="font-semibold text-gray-800">{desigObj ? tObj(desigObj) : '—'}</div>
                                <div className="text-[10px] text-gray-400">{roleObj ? tObj(roleObj) : '—'}</div>
                              </td>
                              <td className="p-3 max-w-[200px] truncate">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap gap-1">
                                    {zoneObj && <span className="bg-amber-50 text-amber-800 border border-amber-100 text-[9px] px-1.5 py-0.5 rounded-sm">{tObj(zoneObj)}</span>}
                                    {distObj && <span className="bg-blue-50 text-blue-800 border border-blue-100 text-[9px] px-1.5 py-0.5 rounded-sm">{tObj(distObj)}</span>}
                                  </div>
                                  <div className="text-[10px] text-slate-600 truncate">
                                    {Array.from(new Set(tps.map((tp: any) => tObj(tp)))).join(', ')}
                                    {userWards?.length > 0 && ` (Wards: ${userWards.join(', ')})`}
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => startEditUser(user)}
                                    className="p-1 hover:text-amber-700 hover:bg-amber-100 text-amber-600 rounded transition"
                                    title="Edit"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteUser(user.id)}
                                    className="p-1 hover:text-red-600 hover:bg-red-50 text-gray-400 rounded transition"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {filteredUsers.length === 0 && (
                  <div className="text-center py-12">
                    <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400 italic">
                      {lang === 'ta' 
                        ? 'கள ஆய்வு ஊழியர்கள் யாரும் இல்லை. புதிய ஊழியரை சேர்க்கவும் அல்லது மாதிரி CSV கோப்பை பதிவேற்றவும்.' 
                        : 'No inspection employees created yet.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800 text-md flex items-center gap-2 border-b border-gray-100 pb-3">
                <ShieldCheck className="w-5 h-5 text-indigo-500" />
                {t('inspectionRoles')} ({inspectionRoles.length})
              </h4>

              <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                {inspectionRoles.map((role: any) => {
                  const roleUsers = inspectionUsers.filter((u: any) => u.roleId === role.id);
                  const desigs = inspectionDesignations.filter((d: any) => d.roleId === role.id);

                  return (
                    <div key={role.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50/70 space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                            {tObj(role)}
                            <span className="text-[10px] font-normal px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
                              {role.scope}
                            </span>
                          </h5>
                          <p className="text-[11px] text-gray-500 pl-4 mt-0.5">
                            {desigs.length} {lang === 'ta' ? 'பதவிகள்' : 'designations'} • {roleUsers.length} {lang === 'ta' ? 'பயனர்கள்' : 'active users'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteRole(role.id)}
                          className="p-1 hover:text-red-600 text-gray-400 rounded transition"
                          title="Delete Role"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="pl-4 flex flex-wrap gap-1.5 pt-1">
                        {desigs.map((d: any) => (
                          <span key={d.id} className="bg-white border border-gray-200 text-[10px] font-medium text-gray-700 px-2 py-0.5 rounded-md">
                            {tObj(d)}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'designations' && (
            <div className="space-y-4">
              <h4 className="font-semibold text-gray-800 text-md flex items-center gap-2 border-b border-gray-100 pb-3">
                <Briefcase className="w-5 h-5 text-indigo-500" />
                {t('inspectionDesignations')} ({inspectionDesignations.length})
              </h4>

              <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1">
                {inspectionDesignations.map((desig: any) => {
                  const roleObj = inspectionRoles.find((r: any) => r.id === desig.roleId);
                  const desigUsers = inspectionUsers.filter((u: any) => u.designationId === desig.id);
                  const subjs = inspectionSubjects.filter((s: any) => desig.applicableSubjectIds?.includes(s.id));

                  return (
                    <div key={desig.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50/70 space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                            {tObj(desig)}
                          </h5>
                          <p className="text-[11px] text-gray-500 pl-4 mt-0.5">
                            {lang === 'ta' ? 'பொறுப்பு' : 'Under Role'}: <span className="font-semibold">{roleObj ? tObj(roleObj) : '—'}</span> • {desigUsers.length} {lang === 'ta' ? 'பணியாளர்கள்' : 'users'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteDesignation(desig.id)}
                          className="p-1 hover:text-red-600 text-gray-400 rounded transition"
                          title="Delete Designation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {subjs.length > 0 && (
                        <div className="pl-4 flex flex-wrap gap-1.5 pt-1">
                          {subjs.map((s: any) => (
                            <span key={s.id} className="bg-purple-50 border border-purple-100 text-[10px] font-medium text-purple-700 px-2 py-0.5 rounded-md">
                              {tObj(s)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'sessions' && (() => {
            const userActivities = localActivities || [];
            const usersList = localUsers || [];
            const inspectionUsersList = localInspectionUsers || [];
            const userSessionsList = localSessions || [];

            const handleForceLogout = async (user: any) => {
              const newActivity = {
                id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                userId: user.id,
                username: user.username,
                name: user.name,
                role: user.role,
                designation: user.designation,
                action: 'logged_out',
                status: 'logged_out',
                loginTime: null,
                logoutTime: new Date().toISOString(),
                zone: user.zone,
                district: user.district,
                tp: user.tp,
                timestamp: new Date().toISOString()
              };
              
              const updatedActivities = [...userActivities, newActivity];
              await onSaveCollection('userActivities', updatedActivities);

              if (userSessionsList.length > 0) {
                const updatedSessions = userSessionsList.map((s: any) => {
                  if (s.userId === user.id && s.status === 'Active') {
                    return { ...s, status: 'LoggedOut', logoutTime: new Date().toISOString() };
                  }
                  return s;
                });
                await onSaveCollection('userSessions', updatedSessions);
              }
            };

            const handleToggleUserActiveState = async (user: any) => {
              const isInspUser = inspectionUsersList.some((u: any) => u.id === user.id);
              if (isInspUser) {
                const updatedInspUsers = inspectionUsersList.map((u: any) => {
                  if (u.id === user.id) {
                    const newStatus = u.status === 'Inactive' ? 'Active' : 'Inactive';
                    return { ...u, status: newStatus };
                  }
                  return u;
                });
                await onSaveCollection('inspectionUsers', updatedInspUsers);
              } else {
                const isPortalAdmin = usersList.some((u: any) => u.id === user.id);
                if (isPortalAdmin) {
                  const updatedUsers = usersList.map((u: any) => {
                    if (u.id === user.id) {
                      const newStatus = u.status === 'Inactive' ? 'Active' : 'Inactive';
                      return { ...u, status: newStatus };
                    }
                    return u;
                  });
                  await onSaveCollection('users', updatedUsers);
                }
              }
            };

            const handleInstantDisableAndLogout = async (user: any) => {
              const confirmMsg = lang === 'ta'
                ? `பயனர் '${user.name || user.username}' கணக்கை உடனடியாக வெளியேற்றி முடக்கவா? (Force Logout & Disable)`
                : `Strict sequence: Force logout '${user.name || user.username}' immediately, then disable account?`;
              if (!window.confirm(confirmMsg)) return;

              try {
                const res = await fetch('/api/users/user-activity', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'disable_and_logout',
                    username: user.username,
                    userId: user.id,
                    adminUsername: 'admin'
                  })
                });
                const data = await res.json();
                alert(data.message || 'Done');
                const updatedInsp = inspectionUsersList.map((u: any) => {
                  if (u.id === user.id || u.username === user.username) {
                    return { ...u, status: 'Inactive', isLoggedIn: false, forceLoggedOut: true };
                  }
                  return u;
                });
                await onSaveCollection('inspectionUsers', updatedInsp);
              } catch (e: any) {
                alert(e.message || 'Error occurred');
              }
            };

            const handleInstantLogoutOnly = async (user: any) => {
              try {
                const res = await fetch('/api/users/user-activity', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'force_logout',
                    username: user.username,
                    userId: user.id,
                    adminUsername: 'admin'
                  })
                });
                const data = await res.json();
                alert(data.message || 'User logged out');
                handleForceLogout(user);
              } catch (e: any) {
                alert(e.message || 'Error occurred');
              }
            };

            // 1. Compile a master list of ALL users in the database
            const allUsers = [
              ...inspectionUsersList.map((u: any) => {
                const desigObj = inspectionDesignations.find((d: any) => d.id === u.designationId);
                const roleObj = inspectionRoles.find((r: any) => r.id === u.roleId);
                const tpObj = townPanchayats.find((t: any) => t.id === u.tpId || t.id === u.townPanchayatId);
                const distObj = districts.find((d: any) => d.id === u.districtId || d.id === tpObj?.districtId);
                const zoneObj = zones.find((z: any) => z.id === u.zoneId || z.id === distObj?.zoneId);

                return {
                  id: u.id,
                  username: u.username || u.mobile || '',
                  name: u.nameEn || u.nameTa || u.username || '',
                  nameEn: u.nameEn || '',
                  nameTa: u.nameTa || '',
                  role: roleObj?.nameEn || 'Inspection Officer',
                  designation: desigObj?.nameEn || 'Field Inspector',
                  zone: zoneObj?.nameEn || 'Kanchipuram Zone',
                  zoneTa: zoneObj?.nameTa || 'காஞ்சிபுரம் மண்டலம்',
                  district: distObj?.nameEn || 'Chengalpattu',
                  districtTa: distObj?.nameTa || 'செங்கல்பட்டு',
                  tp: tpObj?.nameEn || 'Thiruporur',
                  tpTa: tpObj?.nameTa || 'திருப்போரூர்',
                  mobile: u.mobile || '—',
                  accountStatus: u.status || 'Active'
                };
              }),
              ...usersList.map((u: any) => {
                const roleObj = (state.roles || []).find((r: any) => r.id === u.roleId);
                const tpObj = townPanchayats.find((t: any) => t.id === u.scopeId);
                const distObj = districts.find((d: any) => d.id === tpObj?.districtId);
                const zoneObj = zones.find((z: any) => z.id === u.scopeId || z.id === distObj?.zoneId);

                return {
                  id: u.id,
                  username: u.username || '',
                  name: u.nameEn || u.nameTa || u.username || '',
                  nameEn: u.nameEn || '',
                  nameTa: u.nameTa || '',
                  role: roleObj?.nameEn || u.roleId || 'Administrator',
                  designation: roleObj?.nameEn || 'HOD / Administrator',
                  zone: zoneObj?.nameEn || 'Kanchipuram Zone',
                  zoneTa: zoneObj?.nameTa || 'காஞ்சிபுரம் மண்டலம்',
                  district: distObj?.nameEn || 'Chengalpattu',
                  districtTa: distObj?.nameTa || 'செங்கல்பட்டு',
                  tp: tpObj?.nameEn || 'Head Office',
                  tpTa: tpObj?.nameTa || 'தலைமையகம்',
                  mobile: '—',
                  accountStatus: u.status || 'Active'
                };
              })
            ];

            // 2. Correlate with real-time activities from MongoDB userActivities logs
            const allUsersWithActivities = allUsers.map((user: any) => {
              const uId = String(user.id || '').trim().toLowerCase();
              const uName = String(user.username || '').trim().toLowerCase();
              
              const userActs = userActivities.filter((act: any) => {
                const actId = String(act.userId || '').trim().toLowerCase();
                const actName = String(act.username || '').trim().toLowerCase();
                return (uId && actId === uId) || (uName && actName === uName);
              });

              // Sort newest first by loginTime / timestamp / createdAt
              userActs.sort((a: any, b: any) => {
                const tA = new Date(a.loginTime || a.createdAt || a.timestamp || 0).getTime();
                const tB = new Date(b.loginTime || b.createdAt || b.timestamp || 0).getTime();
                return tB - tA;
              });

              const latestAct = userActs.length > 0 ? userActs[0] : null;

              // Backward compatibility check with active web sessions
              const hasActiveSession = userSessionsList.some((s: any) => 
                (uId && String(s.userId || '').toLowerCase() === uId) && s.status === 'Active'
              );

              let status = (user.isLoggedIn || user.isActiveSession) ? 'Online' : 'Offline';
              let loginTime = latestAct?.loginTime || user.lastLoginAt || null;
              let logoutTime = latestAct?.logoutTime || user.lastLogoutAt || null;

              if (latestAct) {
                const actStatus = String(latestAct.status || '').trim().toUpperCase();
                if (actStatus === 'LOGGED_IN' || latestAct.isLoggedIn === true) {
                  status = 'Online';
                } else if (actStatus === 'LOGGED_OUT' || actStatus === 'FORCED_LOGOUT' || actStatus === 'DISABLED' || latestAct.isLoggedIn === false) {
                  status = 'Offline';
                }
              }

              if (hasActiveSession) {
                status = 'Online';
                const activeSess = userSessionsList.find((s: any) => String(s.userId || '').toLowerCase() === uId && s.status === 'Active');
                if (activeSess && !loginTime) {
                  loginTime = activeSess.loginTime;
                }
              }

              // Correlate with inspection work entries for the selected date
              const stats = userWorkStats[uName] || 
                userWorkStats[uId] || 
                (user.nameEn ? userWorkStats[String(user.nameEn).trim().toLowerCase()] : null) || 
                (user.nameTa ? userWorkStats[String(user.nameTa).trim().toLowerCase()] : null) || 
                (user.name ? userWorkStats[String(user.name).trim().toLowerCase()] : null) || 
                (user.mobile ? userWorkStats[String(user.mobile).trim().toLowerCase()] : null) || 
                null;

              // Also check client-side state.inspectionWorks as immediate live fallback
              const clientWorksOnDate = (state.inspectionWorks || []).filter((w: any) => {
                const wName = String(w.submittedByUserName || w.username || '').trim().toLowerCase();
                const wSubName = String(w.submittedByName || '').trim().toLowerCase();
                const wId = String(w.submittedByUserId || w.userId || '').trim().toLowerCase();
                const rawTime = w.submittedAt || w.createdAt || w.date || w.inspectionDate;
                if (!rawTime) return false;
                const matchesUser = (uName && wName === uName) || 
                  (uId && wId === uId) || 
                  (user.nameEn && (wSubName === String(user.nameEn).trim().toLowerCase() || wName === String(user.nameEn).trim().toLowerCase())) ||
                  (user.name && (wSubName === String(user.name).trim().toLowerCase() || wName === String(user.name).trim().toLowerCase())) ||
                  (user.mobile && (wName === user.mobile || wSubName === user.mobile));
                if (!matchesUser) return false;
                const ymd = extractCalendarDateYMD(rawTime) || String(rawTime).slice(0, 10);
                return ymd === actDateFilter;
              });

              let firstWorkEntry = stats?.firstWorkEntry || null;
              let lastWorkEntry = stats?.lastWorkEntry || null;
              let workCount = stats?.count || 0;

              if (clientWorksOnDate.length > 0) {
                const times = clientWorksOnDate
                  .map((w: any) => new Date(w.submittedAt || w.createdAt || w.date).getTime())
                  .filter((t: number) => !isNaN(t));
                if (times.length > 0) {
                  times.sort((a: number, b: number) => a - b);
                  const earliestIso = new Date(times[0]).toISOString();
                  const latestIso = new Date(times[times.length - 1]).toISOString();
                  if (!firstWorkEntry || times[0] < new Date(firstWorkEntry).getTime()) {
                    firstWorkEntry = earliestIso;
                  }
                  if (!lastWorkEntry || times[times.length - 1] > new Date(lastWorkEntry).getTime()) {
                    lastWorkEntry = latestIso;
                  }
                  workCount = Math.max(workCount, clientWorksOnDate.length);
                }
              }

              return {
                ...user,
                status,
                loginTime,
                logoutTime,
                firstWorkEntry,
                lastWorkEntry,
                workCount
              };
            });

            // 3. Apply selected filtering criteria
            const filteredAllUsers = allUsersWithActivities.filter((u: any) => {
              const matchesZone = actZoneFilter === 'all' || u.zone.toLowerCase() === actZoneFilter.toLowerCase();
              const matchesDist = actDistrictFilter === 'all' || u.district.toLowerCase() === actDistrictFilter.toLowerCase();
              const matchesTp = actTpFilter === 'all' || u.tp.toLowerCase() === actTpFilter.toLowerCase();
              const matchesDesig = actDesigFilter === 'all' || u.designation.toLowerCase() === actDesigFilter.toLowerCase();
              
              const q = actSearchQuery.toLowerCase().trim();
              const matchesSearch = q === '' ||
                u.name.toLowerCase().includes(q) ||
                u.nameEn.toLowerCase().includes(q) ||
                u.nameTa.toLowerCase().includes(q) ||
                u.username.toLowerCase().includes(q) ||
                u.mobile.toLowerCase().includes(q);

              return matchesZone && matchesDist && matchesTp && matchesDesig && matchesSearch;
            });

            // 4. Group totals
            const totalCount = filteredAllUsers.length;
            const onlineCount = filteredAllUsers.filter(u => u.status === 'Online').length;
            const offlineCount = totalCount - onlineCount;

            // 5. Filter option arrays
            const uniqueZones = Array.from(new Set(allUsersWithActivities.map((u: any) => u.zone))).filter(Boolean);
            const uniqueDistricts = Array.from(new Set(allUsersWithActivities.map((u: any) => u.district))).filter(Boolean);
            const uniqueTps = Array.from(new Set(allUsersWithActivities.map((u: any) => u.tp))).filter(Boolean);
            const uniqueDesignations = Array.from(new Set(allUsersWithActivities.map((u: any) => u.designation))).filter(Boolean);

            const formatTime = (isoString?: string) => {
              if (!isoString) return '—';
              try {
                const d = new Date(isoString);
                return d.toLocaleString(lang === 'ta' ? 'ta-IN' : 'en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });
              } catch (e) {
                return isoString;
              }
            };

            const formatTimeOnly = (isoString?: string) => {
              if (!isoString) return '—';
              try {
                const d = new Date(isoString);
                return d.toLocaleTimeString(lang === 'ta' ? 'ta-IN' : 'en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true
                });
              } catch (e) {
                return isoString;
              }
            };

            // 6. Excel Exporter
            const handleExportExcel = () => {
              let rowsHtml = '';
              filteredAllUsers.forEach((u) => {
                rowsHtml += `
                  <tr>
                    <td>${u.name}</td>
                    <td>@${u.username}</td>
                    <td>${u.role}</td>
                    <td>${u.designation}</td>
                    <td>${lang === 'ta' ? u.zoneTa : u.zone}</td>
                    <td>${lang === 'ta' ? u.districtTa : u.district}</td>
                    <td>${lang === 'ta' ? u.tpTa : u.tp}</td>
                    <td>${u.mobile}</td>
                    <td style="color: ${u.status === 'Online' ? '#16A34A' : '#64748B'}; font-weight: bold;">
                      ${u.status === 'Online' ? (lang === 'ta' ? 'ஆன்லைன்' : 'Online') : (lang === 'ta' ? 'ஆஃப்லைன்' : 'Offline')}
                    </td>
                    <td>${u.loginTime ? formatTime(u.loginTime) : '—'}</td>
                    <td>${u.logoutTime ? formatTime(u.logoutTime) : '—'}</td>
                    <td style="font-weight: bold; color: #4338ca;">${u.firstWorkEntry ? formatTime(u.firstWorkEntry) : '—'}</td>
                    <td style="font-weight: bold; color: #4338ca;">${u.lastWorkEntry ? formatTime(u.lastWorkEntry) : '—'}</td>
                  </tr>
                `;
              });

              const template = `
                <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
                <head>
                  <meta charset="utf-8">
                  <style>
                    table { border-collapse: collapse; width: 100%; font-family: sans-serif; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 11px; text-align: left; }
                    th { background-color: #f1f5f9; font-weight: bold; }
                  </style>
                </head>
                <body>
                  <h3>${lang === 'ta' ? 'பயனர் செயல்பாட்டு அறிக்கை (User Activity Report)' : 'User Activity & Status Report'}</h3>
                  <p>${lang === 'ta' ? 'ஆய்வுத் தேதி:' : 'Inspection Date:'} <b>${actDateFilter}</b> | ${lang === 'ta' ? 'உருவாக்கப்பட்ட தேதி:' : 'Generated on:'} ${new Date().toLocaleString()}</p>
                  <table>
                    <thead>
                      <tr>
                        <th>${lang === 'ta' ? 'பெயர்' : 'Name'}</th>
                        <th>${lang === 'ta' ? 'பயனர் அடையாளம்' : 'Username'}</th>
                        <th>${lang === 'ta' ? 'பொறுப்பு' : 'Role'}</th>
                        <th>${lang === 'ta' ? 'பதவி' : 'Designation'}</th>
                        <th>${lang === 'ta' ? 'மண்டலம்' : 'Zone'}</th>
                        <th>${lang === 'ta' ? 'மாவட்டம்' : 'District'}</th>
                        <th>${lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat'}</th>
                        <th>${lang === 'ta' ? 'கைபேசி' : 'Mobile'}</th>
                        <th>${lang === 'ta' ? 'நிலை' : 'Status'}</th>
                        <th>${lang === 'ta' ? 'கடைசி உள்நுழைவு' : 'Last Login Time'}</th>
                        <th>${lang === 'ta' ? 'கடைசி வெளியேற்றம்' : 'Last Logout Time'}</th>
                        <th>${lang === 'ta' ? 'முதல் பணிப் பதிவு' : 'First Work Entry'} (${actDateFilter})</th>
                        <th>${lang === 'ta' ? 'கடைசி பணிப் பதிவு' : 'Last Work Entry'} (${actDateFilter})</th>
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
              link.download = `User_Activity_Report_${actDateFilter}.xls`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            };

            // 7. PDF Exporter
            const handleExportPDF = () => {
              const doc = new jsPDF('l', 'mm', 'a4');
              
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(13);
              doc.setTextColor(79, 70, 229);
              doc.text(lang === 'ta' ? 'பயனர் செயல்பாட்டு அறிக்கை (User Activity & Work Entries Report)' : 'User Activity & Work Entries Report', 14, 14);
              
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8.5);
              doc.setTextColor(71, 85, 105);
              doc.text(`Inspection Date: ${actDateFilter} | Generated on: ${new Date().toLocaleString()}`, 14, 20);

              const startY = 25;
              doc.setFillColor(241, 245, 249);
              doc.rect(14, startY, 269, 8, 'F');
              
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(7.5);
              doc.setTextColor(15, 23, 42);
              
              doc.text('User Name', 16, startY + 5.5);
              doc.text('Role', 52, startY + 5.5);
              doc.text('Designation', 84, startY + 5.5);
              doc.text('Location (Zone/TP)', 118, startY + 5.5);
              doc.text('Status', 162, startY + 5.5);
              doc.text('Last Login', 178, startY + 5.5);
              doc.text('Last Logout', 205, startY + 5.5);
              doc.text(`First Entry (${actDateFilter})`, 232, startY + 5.5);
              doc.text(`Last Entry (${actDateFilter})`, 258, startY + 5.5);
              
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(7);
              doc.setTextColor(51, 65, 85);
              
              let currentY = startY + 8;
              filteredAllUsers.forEach((u) => {
                if (currentY > 185) {
                  doc.addPage();
                  currentY = 18;
                  
                  doc.setFillColor(241, 245, 249);
                  doc.rect(14, currentY, 269, 8, 'F');
                  doc.setFont('helvetica', 'bold');
                  doc.setFontSize(7.5);
                  doc.setTextColor(15, 23, 42);
                  doc.text('User Name', 16, currentY + 5.5);
                  doc.text('Role', 52, currentY + 5.5);
                  doc.text('Designation', 84, currentY + 5.5);
                  doc.text('Location (Zone/TP)', 118, currentY + 5.5);
                  doc.text('Status', 162, currentY + 5.5);
                  doc.text('Last Login', 178, currentY + 5.5);
                  doc.text('Last Logout', 205, currentY + 5.5);
                  doc.text(`First Entry (${actDateFilter})`, 232, currentY + 5.5);
                  doc.text(`Last Entry (${actDateFilter})`, 258, currentY + 5.5);
                  
                  doc.setFont('helvetica', 'normal');
                  doc.setFontSize(7);
                  currentY += 8;
                }
                
                doc.setDrawColor(241, 245, 249);
                doc.line(14, currentY, 283, currentY);
                
                doc.text(u.name.substring(0, 20), 16, currentY + 5);
                doc.text(u.role.substring(0, 18), 52, currentY + 5);
                doc.text(u.designation.substring(0, 18), 84, currentY + 5);
                
                const locStr = `${u.zone} / ${u.tp}`;
                doc.text(locStr.substring(0, 26), 118, currentY + 5);
                
                if (u.status === 'Online') {
                  doc.setTextColor(22, 163, 74);
                  doc.text('Online', 162, currentY + 5);
                } else {
                  doc.setTextColor(100, 116, 139);
                  doc.text('Offline', 162, currentY + 5);
                }
                doc.setTextColor(51, 65, 85);
                
                doc.text(u.loginTime ? formatTime(u.loginTime).substring(0, 14) : '—', 178, currentY + 5);
                doc.text(u.logoutTime ? formatTime(u.logoutTime).substring(0, 14) : '—', 205, currentY + 5);
                doc.text(u.firstWorkEntry ? formatTimeOnly(u.firstWorkEntry) : '—', 232, currentY + 5);
                doc.text(u.lastWorkEntry ? formatTimeOnly(u.lastWorkEntry) : '—', 258, currentY + 5);
                
                currentY += 7;
              });
              
              doc.save(`User_Activity_Report_${actDateFilter}.pdf`);
            };

            return (
              <div className="space-y-6">
                {/* Dashboard Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-4">
                  <div>
                    <h4 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                      <ClipboardList className="w-5.5 h-5.5 text-indigo-600" />
                      {lang === 'ta' ? 'பயனர் செயல்பாட்டுப் பதிவு' : 'User Activity & Login Log'}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {lang === 'ta' ? 'மொபைல் மற்றும் இணையதளப் பயனர்களின் தற்போதைய ஆன்லைன்/ஆஃப்லைன் செயல்பாட்டு விவரங்கள்.' : 'Real-time online/offline monitoring and audit trails for all mobile & web users.'}
                    </p>
                  </div>
                  
                  {/* Export Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportExcel}
                      className="px-3.5 py-2 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      {lang === 'ta' ? 'Excel பதிவிறக்கு' : 'Download Excel'}
                    </button>
                    <button
                      onClick={handleExportPDF}
                      className="px-3.5 py-2 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      {lang === 'ta' ? 'PDF பதிவிறக்கு' : 'Download PDF'}
                    </button>
                  </div>
                </div>

                {/* KPI Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center justify-between shadow-2xs">
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'மொத்தப் பயனர்கள்' : 'Total Registered Users'}</span>
                      <h3 className="text-2xl font-black text-slate-800 mt-0.5">{totalCount}</h3>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold">@</div>
                  </div>
                  <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-4 flex items-center justify-between shadow-2xs">
                    <div>
                      <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">{lang === 'ta' ? 'ஆன்லைனில் உள்ளவர்கள்' : 'Currently Online'}</span>
                      <h3 className="text-2xl font-black text-emerald-700 mt-0.5">{onlineCount}</h3>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-emerald-100/60 text-emerald-600 flex items-center justify-center relative">
                      <span className="absolute w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
                      <span className="w-2.5 h-2.5 bg-emerald-600 rounded-full"></span>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-center justify-between shadow-2xs">
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'ஆஃப்லைனில் உள்ளவர்கள்' : 'Offline Users'}</span>
                      <h3 className="text-2xl font-black text-slate-700 mt-0.5">{offlineCount}</h3>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">●</div>
                  </div>
                </div>

                {/* Bulk Status & Session Action Card */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 text-white shadow-md border border-indigo-900 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h5 className="font-bold text-sm flex items-center gap-2 text-indigo-200">
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                        {lang === 'ta' ? 'பயனர் ஒட்டுமொத்த கட்டுப்பாட்டு மேலாண்மை (Bulk Session & Deactivation Control)' : 'Bulk User Session & Deactivation Control'}
                      </h5>
                      <p className="text-[11px] text-indigo-300 mt-0.5">
                        {lang === 'ta' ? 'பதவி, பொறுப்பு, மற்றும் பேரூராட்சி வாரியாக பயனர்களை தேர்வு செய்து ஒரே கிளிக்கில் முடக்கி உடனடியாக வெளியேற்றலாம்.' : 'Bulk disable and force logout by selecting role, designation, and town panchayat.'}
                      </p>
                    </div>

                    {bulkActionMessage && (
                      <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${bulkActionMessage.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>
                        {bulkActionMessage.text}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-indigo-300 uppercase mb-1">
                        {lang === 'ta' ? '1. பொறுப்பு தேர்வு செய்க (Role)' : '1. Select Role'}
                      </label>
                      <select
                        value={bulkRole}
                        onChange={(e) => setBulkRole(e.target.value)}
                        className="w-full text-xs font-medium px-3 py-2 bg-slate-800 text-white rounded-xl border border-indigo-800 focus:outline-none"
                      >
                        <option value="all">{lang === 'ta' ? 'அனைத்து பொறுப்புகள் (All Roles)' : 'All Roles'}</option>
                        {inspectionRoles.map((r: any) => (
                          <option key={r.id} value={r.id}>{tObj(r)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-indigo-300 uppercase mb-1">
                        {lang === 'ta' ? '2. பதவி தேர்வு செய்க (Designation)' : '2. Select Designation'}
                      </label>
                      <select
                        value={bulkDesig}
                        onChange={(e) => setBulkDesig(e.target.value)}
                        className="w-full text-xs font-medium px-3 py-2 bg-slate-800 text-white rounded-xl border border-indigo-800 focus:outline-none"
                      >
                        <option value="all">{lang === 'ta' ? 'அனைத்து பதவிகள் (All Designations)' : 'All Designations'}</option>
                        {inspectionDesignations.map((d: any) => (
                          <option key={d.id} value={d.id}>{tObj(d)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-indigo-300 uppercase mb-1">
                        {lang === 'ta' ? '3. பேரூராட்சி தேர்வு செய்க (Town Panchayat)' : '3. Select Town Panchayat'}
                      </label>
                      <select
                        value={bulkTp}
                        onChange={(e) => setBulkTp(e.target.value)}
                        className="w-full text-xs font-medium px-3 py-2 bg-slate-800 text-white rounded-xl border border-indigo-800 focus:outline-none"
                      >
                        <option value="all">{lang === 'ta' ? 'அனைத்து பேரூராட்சிகள் (All TPs)' : 'All Town Panchayats'}</option>
                        {uniqueTownPanchayats.map((tp: any) => (
                          <option key={tp.id} value={tp.id}>{tp.nameEn} ({tp.nameTa || tp.nameEn})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-indigo-900/60">
                    <button
                      disabled={isBulkOperating}
                      onClick={() => handleBulkAction('disable_and_logout')}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      {lang === 'ta' ? 'அனைவரையும் முடக்கி வெளியேற்று (Disable All & Logout)' : 'Disable All & Logout All'}
                    </button>

                    <button
                      disabled={isBulkOperating}
                      onClick={() => handleBulkAction('logout_only')}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {lang === 'ta' ? 'அனைவரையும் வெளியேற்று (Logout All Only)' : 'Logout All Only'}
                    </button>

                    <button
                      disabled={isBulkOperating}
                      onClick={() => handleBulkAction('enable')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      {lang === 'ta' ? 'அனைவரையும் செயல்படுத்து (Enable All)' : 'Enable All Selected'}
                    </button>
                  </div>
                </div>

                {/* Filter Panels Row */}
                <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-3xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3.5">
                  {/* Date Selection */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-indigo-600" />
                        {lang === 'ta' ? 'தேதி (Date)' : 'Date'}
                      </span>
                      {actDateFilter !== getTodayYmd() && (
                        <button
                          type="button"
                          onClick={() => setActDateFilter(getTodayYmd())}
                          className="text-[9px] text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
                        >
                          {lang === 'ta' ? 'இன்று' : 'Today'}
                        </button>
                      )}
                    </label>
                    <input
                      type="date"
                      value={actDateFilter}
                      onChange={(e) => setActDateFilter(e.target.value)}
                      className="w-full text-xs font-semibold px-2 py-1.5 bg-indigo-50/50 dark:bg-slate-800 border border-indigo-200 dark:border-indigo-900 rounded-lg text-indigo-900 dark:text-indigo-200 focus:outline-hidden focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{lang === 'ta' ? 'மண்டலம்' : 'Zone'}</label>
                    <select
                      value={actZoneFilter}
                      onChange={(e) => setActZoneFilter(e.target.value)}
                      className="w-full text-xs font-semibold px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-hidden focus:border-indigo-500"
                    >
                      <option value="all">{lang === 'ta' ? 'அனைத்து மண்டலம்' : 'All Zones'}</option>
                      {uniqueZones.map((z: string) => (
                        <option key={z} value={z}>{z}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{lang === 'ta' ? 'மாவட்டம்' : 'District'}</label>
                    <select
                      value={actDistrictFilter}
                      onChange={(e) => setActDistrictFilter(e.target.value)}
                      className="w-full text-xs font-semibold px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-hidden focus:border-indigo-500"
                    >
                      <option value="all">{lang === 'ta' ? 'அனைத்து மாவட்டம்' : 'All Districts'}</option>
                      {uniqueDistricts.map((d: string) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat'}</label>
                    <select
                      value={actTpFilter}
                      onChange={(e) => setActTpFilter(e.target.value)}
                      className="w-full text-xs font-semibold px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-hidden focus:border-indigo-500"
                    >
                      <option value="all">{lang === 'ta' ? 'அனைத்து பேரூராட்சி' : 'All Town Panchayats'}</option>
                      {uniqueTps.map((tp: string) => (
                        <option key={tp} value={tp}>{tp}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{lang === 'ta' ? 'பதவி' : 'Designation'}</label>
                    <select
                      value={actDesigFilter}
                      onChange={(e) => setActDesigFilter(e.target.value)}
                      className="w-full text-xs font-semibold px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-hidden focus:border-indigo-500"
                    >
                      <option value="all">{lang === 'ta' ? 'அனைத்துப் பதவிகள்' : 'All Designations'}</option>
                      {uniqueDesignations.map((d: string) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{lang === 'ta' ? 'தேடு' : 'Search user'}</label>
                    <div className="relative">
                      <Search className="absolute w-3.5 h-3.5 text-gray-400 left-3 top-2.5" />
                      <input
                        type="text"
                        placeholder={lang === 'ta' ? 'பயனர் அல்லது அலைபேசி...' : 'Search name or @username...'}
                        value={actSearchQuery}
                        onChange={(e) => setActSearchQuery(e.target.value)}
                        className="w-full text-xs font-semibold pl-9 pr-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Activity List Container */}
                <div className="border border-slate-100 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 font-bold text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-100">
                        <tr>
                          <th className="py-3 px-4">{lang === 'ta' ? 'பயனர் பெயர்' : 'User Name'}</th>
                          <th className="py-3 px-4">{lang === 'ta' ? 'பதவி & பொறுப்பு' : 'Designation & Role'}</th>
                          <th className="py-3 px-4">{lang === 'ta' ? 'இடம்' : 'Location'}</th>
                          <th className="py-3 px-4">{lang === 'ta' ? 'நிலை' : 'Status'}</th>
                          <th className="py-3 px-4">{lang === 'ta' ? 'கடைசி உள்நுழைவு' : 'Last Login Time'}</th>
                          <th className="py-3 px-4">{lang === 'ta' ? 'கடைசி வெளியேற்றம்' : 'Last Logout Time'}</th>
                          <th className="py-3 px-4 bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300 font-bold">
                            {lang === 'ta' ? `முதல் பணிப் பதிவு (${actDateFilter})` : `First Work Entry (${actDateFilter})`}
                          </th>
                          <th className="py-3 px-4 bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-300 font-bold">
                            {lang === 'ta' ? `கடைசி பணிப் பதிவு (${actDateFilter})` : `Last Work Entry (${actDateFilter})`}
                          </th>
                          <th className="py-3 px-4 text-right pr-6">{lang === 'ta' ? 'செயல்பாடுகள்' : 'Actions'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredAllUsers.map((u: any) => {
                          const isOnline = u.status === 'Online';
                          const isInactive = u.accountStatus === 'Inactive';
                          return (
                            <tr key={u.id} className="hover:bg-slate-50/50 transition">
                              <td className="py-3.5 px-4 font-bold text-slate-900">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{u.name}</span>
                                  {isInactive && (
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-100">
                                      {lang === 'ta' ? 'முடக்கப்பட்டுள்ளது' : 'Deactivated'}
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">@{u.username} • {u.mobile}</div>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="font-semibold text-slate-800">{u.designation}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">{u.role}</div>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="text-slate-500">{lang === 'ta' ? u.tpTa : u.tp}</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">{lang === 'ta' ? u.districtTa : u.district} • {lang === 'ta' ? u.zoneTa : u.zone}</div>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-bold text-[9px] border ${
                                  isOnline
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`}></span>
                                  {isOnline ? (lang === 'ta' ? 'ஆன்லைன்' : 'Online') : (lang === 'ta' ? 'ஆஃப்லைன்' : 'Offline')}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-slate-500 font-mono text-[10px]">{formatTime(u.loginTime)}</td>
                              <td className="py-3.5 px-4 text-slate-500 font-mono text-[10px]">{formatTime(u.logoutTime)}</td>
                              <td className="py-3.5 px-4 font-mono text-[10px]">
                                {u.firstWorkEntry ? (
                                  <div className="flex flex-col">
                                    <span className="font-bold text-indigo-700 dark:text-indigo-400">
                                      {formatTimeOnly(u.firstWorkEntry)}
                                    </span>
                                    <span className="text-[9px] text-slate-400">
                                      {new Date(u.firstWorkEntry).toLocaleDateString()}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic text-[10px]">
                                    {lang === 'ta' ? 'பதிவு இல்லை' : 'No entry'}
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 font-mono text-[10px]">
                                {u.lastWorkEntry ? (
                                  <div className="flex flex-col">
                                    <span className="font-bold text-indigo-700 dark:text-indigo-400">
                                      {formatTimeOnly(u.lastWorkEntry)}
                                    </span>
                                    <span className="text-[9px] text-slate-400">
                                      {new Date(u.lastWorkEntry).toLocaleDateString()}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic text-[10px]">
                                    {lang === 'ta' ? 'பதிவு இல்லை' : 'No entry'}
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right pr-6">
                                <div className="flex justify-end items-center gap-1.5">
                                  {/* Toggle Active/Inactive state */}
                                  <button
                                    onClick={() => handleToggleUserActiveState(u)}
                                    className={`px-2 py-1 text-[9px] font-bold rounded-lg border transition shadow-3xs cursor-pointer ${
                                      isInactive
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                        : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                    }`}
                                    title={isInactive ? (lang === 'ta' ? 'செயல்படுத்துக' : 'Activate Account') : (lang === 'ta' ? 'முடக்குக' : 'Deactivate Account')}
                                  >
                                    {isInactive
                                      ? (lang === 'ta' ? 'செயல்படுத்து' : 'Activate')
                                      : (lang === 'ta' ? 'முடக்கு' : 'Deactivate')
                                    }
                                  </button>

                                  {/* Manual logout trigger */}
                                  {isOnline && (
                                    <button
                                      onClick={() => handleForceLogout(u)}
                                      className="px-2 py-1 text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded-lg hover:bg-rose-100 transition shadow-3xs cursor-pointer"
                                      title={lang === 'ta' ? 'வெளியேற்று' : 'Force Logout'}
                                    >
                                      {lang === 'ta' ? 'வெளியேற்று' : 'Force Logout'}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                        {filteredAllUsers.length === 0 && (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                              <ClipboardList className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                              {lang === 'ta' ? 'பயனர்கள் எவரும் கண்டறியப்படவில்லை.' : 'No users match your filtering criteria.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {activeTab === 'server_logs' && (() => {
            const rawLines = serverLogsText ? serverLogsText.split('\n').filter(Boolean) : [];
            const filteredLines = rawLines.filter((line) => {
              const matchesSearch = !serverLogSearch || line.toLowerCase().includes(serverLogSearch.toLowerCase());
              const matchesCat = serverLogCategory === 'all' || line.includes(`[${serverLogCategory}]`);
              return matchesSearch && matchesCat;
            });

            return (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                      {lang === 'ta' ? 'சேவையக செயல்முறை நேரடிப் பதிவு (Live Notepad Viewer)' : 'Live Server Process Log (Notepad Style)'}
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {lang === 'ta'
                        ? 'உள்நுழைவு, பணி பதிவுகள், முதன்மை மாற்றங்கள் மற்றும் வரிசை நிகழ்வுகள் உண்மையான நேரத்தில் சேமிக்கப்படுகின்றன.'
                        : 'Real-time audit log of user logins, work entries, master updates, and queue events.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 font-mono">
                      {filteredLines.length} / {rawLines.length} {lang === 'ta' ? 'வரிகள்' : 'lines'}
                    </span>
                    <button
                      type="button"
                      onClick={fetchServerLogs}
                      disabled={isLoadingServerLogs}
                      className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition cursor-pointer"
                      title="Refresh"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoadingServerLogs ? 'animate-spin text-indigo-600' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2 relative">
                    <Search className="absolute w-3.5 h-3.5 text-gray-400 left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder={lang === 'ta' ? 'பதிவில் தேடு (பயனர், பணி ID, ஊர்)...' : 'Search in log (username, work ID, TP)...'}
                      value={serverLogSearch}
                      onChange={(e) => setServerLogSearch(e.target.value)}
                      className="w-full text-xs font-mono pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <select
                      value={serverLogCategory}
                      onChange={(e) => setServerLogCategory(e.target.value)}
                      className="w-full text-xs font-semibold px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 focus:outline-hidden focus:border-indigo-500"
                    >
                      <option value="all">{lang === 'ta' ? 'அனைத்து பிரிவுகள் (All Categories)' : 'All Categories'}</option>
                      <option value="LOGIN">LOGIN</option>
                      <option value="LOGOUT">LOGOUT</option>
                      <option value="WORK_ENTRY">WORK_ENTRY</option>
                      <option value="QUEUE_PROCESS">QUEUE_PROCESS</option>
                      <option value="MASTER_UPDATE">MASTER_UPDATE</option>
                      <option value="USER_STATUS_CHANGE">USER_STATUS_CHANGE</option>
                      <option value="BULK_ACTION">BULK_ACTION</option>
                      <option value="SCOPE_SYNC">SCOPE_SYNC</option>
                    </select>
                  </div>
                </div>

                {/* Notepad style terminal box */}
                <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-md">
                  {/* Notepad title bar */}
                  <div className="bg-slate-900 px-3.5 py-1.5 flex items-center justify-between border-b border-slate-800 text-[11px] text-slate-300 font-mono">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                      <span className="ml-1 text-slate-400">server_process.log — Notepad</span>
                    </span>
                    <span className="text-[10px] text-slate-500">UTF-8 • CR LF</span>
                  </div>

                  {/* Notepad content */}
                  <div className="p-3 max-h-[520px] overflow-y-auto overflow-x-auto font-mono text-[11px] leading-relaxed text-slate-200 space-y-1 select-text">
                    {filteredLines.length > 0 ? (
                      filteredLines.map((line, idx) => {
                        const isSuccess = line.includes('[SUCCESS]');
                        const isFailed = line.includes('[FAILED]');
                        const isWarning = line.includes('[WARNING]');
                        const isLogin = line.includes('[LOGIN]');
                        const isLogout = line.includes('[LOGOUT]');
                        const isWork = line.includes('[WORK_ENTRY]') || line.includes('[QUEUE_PROCESS]');
                        const isBulk = line.includes('[BULK_ACTION]') || line.includes('[USER_STATUS_CHANGE]');

                        let colorClass = 'text-slate-300';
                        if (isFailed) colorClass = 'text-rose-400 font-bold';
                        else if (isWarning) colorClass = 'text-amber-300';
                        else if (isLogin) colorClass = 'text-cyan-300';
                        else if (isLogout) colorClass = 'text-purple-300';
                        else if (isWork) colorClass = 'text-emerald-300';
                        else if (isBulk) colorClass = 'text-amber-400';

                        return (
                          <div key={idx} className="flex items-start gap-3 hover:bg-slate-900/60 px-1 py-0.5 rounded">
                            <span className="text-slate-600 select-none text-[10px] w-8 text-right shrink-0">
                              {idx + 1}
                            </span>
                            <span className={`break-all ${colorClass}`}>
                              {line}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-10 text-slate-500 italic">
                        {isLoadingServerLogs
                          ? (lang === 'ta' ? 'பதிவுகள் வாசிக்கப்படுகின்றன...' : 'Loading server logs...')
                          : (lang === 'ta' ? 'பொருத்தமான பதிவுகள் எதுவும் இல்லை.' : 'No matching log entries found.')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
