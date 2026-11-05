'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Layers, 
  Settings, 
  Plus, 
  Trash2, 
  Hash, 
  Calendar, 
  Type, 
  CheckSquare, 
  List,
  Upload,
  Download,
  AlertCircle,
  CheckCircle,
  FileText,
  FileSpreadsheet,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { Language, translations } from './translations';

interface ModuleManagementViewProps {
  state: any;
  lang: Language;
  onSaveCollection: (key: string, data: any[]) => Promise<void>;
}

export default function ModuleManagementView({ state, lang, onSaveCollection }: ModuleManagementViewProps) {
  const [activeTab, setActiveTab] = useState<'modules' | 'fields' | 'issueCategories'>('modules');
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});
  const [openFieldGroups, setOpenFieldGroups] = useState<Record<string, boolean>>({});
  const MODULE_TONES = ['#1d4ed8', '#0f766e', '#c2410c', '#7c3aed', '#be185d', '#0369a1', '#b45309', '#4f46e5'];

  const {
    posts = [],
    modules = [],
    fields = [],
    issueCategories = []
  } = state || {};

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

  const currentIssueCategories = issueCategories.length > 0 ? issueCategories : DEFAULT_ISSUE_CATEGORIES;

  // Form states for Issue Categories
  const [newIssueCatEn, setNewIssueCatEn] = useState('');
  const [newIssueCatTa, setNewIssueCatTa] = useState('');
  const [selectedIssueCatId, setSelectedIssueCatId] = useState(currentIssueCategories[0]?.id || '');

  // Form states for Issue Subcategories
  const [newIssueSubEn, setNewIssueSubEn] = useState('');
  const [newIssueSubTa, setNewIssueSubTa] = useState('');

  // Form states for Module Categories
  const [moduleEn, setModuleEn] = useState('');
  const [moduleTa, setModuleTa] = useState('');
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);

  // Form states for Field Management
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [fieldEn, setFieldEn] = useState('');
  const [fieldTa, setFieldTa] = useState('');
  const [fieldType, setFieldType] = useState<'text' | 'number' | 'date' | 'select' | 'file'>('text');
  const [isRequired, setIsRequired] = useState(false);
  const [minLimit, setMinLimit] = useState('');
  const [maxLimit, setMaxLimit] = useState('');
  const [selectOptions, setSelectOptions] = useState(''); // comma separated

  // File specific validation options
  const [fileAllowedTypes, setFileAllowedTypes] = useState<'both' | 'pdf' | 'image'>('both');
  const [fileMaxSizeMb, setFileMaxSizeMb] = useState('5');
  const [fileMultiple, setFileMultiple] = useState(false);

  // Bulk CSV states
  const [csvFeedback, setCsvFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = (key: keyof typeof translations['en']) => {
    return translations[lang][key] || translations['en'][key] || key;
  };

  const tObj = (obj: any) => {
    if (!obj) return '';
    return lang === 'ta' ? (obj.nameTa || obj.nameEn) : (obj.nameEn || obj.nameTa);
  };

  // Toggle post selection
  const handleTogglePost = (postId: string) => {
    if (selectedPosts.includes(postId)) {
      setSelectedPosts(prev => prev.filter(id => id !== postId));
    } else {
      setSelectedPosts(prev => [...prev, postId]);
    }
  };

  const handleSelectAllPosts = () => {
    if (selectedPosts.length === posts.length) {
      setSelectedPosts([]);
    } else {
      setSelectedPosts(posts.map((p: any) => p.id));
    }
  };

  // Add Module category
  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleEn || !moduleTa || selectedPosts.length === 0) return;

    const newModule = {
      id: 'm_' + Math.random().toString(36).substr(2, 4),
      nameEn: moduleEn,
      nameTa: moduleTa,
      applicablePosts: [...selectedPosts]
    };

    await onSaveCollection('modules', [...modules, newModule]);
    setModuleEn('');
    setModuleTa('');
    setSelectedPosts([]);
  };

  // Add Dynamic Field
  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedModuleId || !fieldEn || !fieldTa) return;

    const newField = {
      id: 'f_' + Math.random().toString(36).substr(2, 4),
      moduleId: selectedModuleId,
      nameEn: fieldEn,
      nameTa: fieldTa,
      type: fieldType,
      validations: {
        required: isRequired,
        min: minLimit ? parseInt(minLimit) : undefined,
        max: maxLimit ? parseInt(maxLimit) : undefined,
        options: fieldType === 'select' && selectOptions ? selectOptions.split(',').map(o => o.trim()) : undefined,
        allowedTypes: fieldType === 'file' ? fileAllowedTypes : undefined,
        maxSizeMb: fieldType === 'file' ? (fileMaxSizeMb ? parseInt(fileMaxSizeMb) : 5) : undefined,
        multiple: fieldType === 'file' ? fileMultiple : undefined,
      }
    };

    await onSaveCollection('fields', [...fields, newField]);
    setFieldEn('');
    setFieldTa('');
    setMinLimit('');
    setMaxLimit('');
    setSelectOptions('');
    setIsRequired(false);
    setFileAllowedTypes('both');
    setFileMaxSizeMb('5');
    setFileMultiple(false);
  };

  // CSV Template Generation
  const downloadCSVTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,ModuleNameEn,ModuleNameTa,ApplicablePosts,FieldNameEn,FieldNameTa,FieldType,FieldRequired,NumberMin,NumberMax,DropdownOptions,FileAllowedTypes,FileMaxSizeMb,FileMultiple\n" +
      "Probation Details,தகுதிகாண் பருவம் விவரங்கள்,\"eo,ja,bc\",Probation Declaration Date,தகுதிகாண் பருவம் அறிவிக்கப்பட்ட தேதி,date,true,,,,,,,\n" +
      "Probation Details,தகுதிகாண் பருவம் விவரங்கள்,\"eo,ja,bc\",Declaration Order Reference,ஆணை குறிப்பு எண்,text,true,,,,,,,\n" +
      "Probation Details,தகுதிகாண் பருவம் விவரங்கள்,\"eo,ja,bc\",Declaration Certificate,தகுதிகாண் சான்றிதழ்,file,false,,,,,pdf,5,false\n" +
      "Leave Details,விடுப்பு விவரங்கள்,\"director,ad,eo,ja,bc,oa\",Earned Leave Balance,ஈட்டிய விடுப்பு இருப்பு,number,true,0,100,,,,,\n" +
      "Basic Employee Details,அடிப்படை ஊழியர் விவரங்கள்,\"director,ad,eo,ja,bc,oa\",Passport Photo,கடவுச்சீட்டு புகைப்படம்,file,true,,,,,image,2,true";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Modules_And_Fields_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Bulk Upload Parsing and Creation
  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          setCsvFeedback({ type: 'error', message: 'The uploaded file is empty.' });
          return;
        }

        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length <= 1) {
          setCsvFeedback({ type: 'error', message: 'The uploaded CSV file contains no data rows.' });
          return;
        }

        // Robust CSV Parser line splitting
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

        const headers = parseCsvLine(lines[0]);
        // Map headers to indices
        const headerMap = headers.reduce((acc, h, idx) => {
          acc[h.toLowerCase().trim().replace(/[^a-z0-9]/g, '')] = idx;
          return acc;
        }, {} as { [key: string]: number });

        const importedModules: any[] = [...modules];
        const importedFields: any[] = [...fields];

        let currentModuleId = '';
        let lastModuleNameEn = '';
        let lastModuleNameTa = '';
        let lastApplicablePosts: string[] = [];

        let modulesCreatedCount = 0;
        let fieldsCreatedCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const columns = parseCsvLine(lines[i]);
          if (columns.length === 0 || columns.every(col => col === '')) continue;

          // Get values by header map
          const getValue = (key: string) => {
            const idx = headerMap[key];
            return idx !== undefined && columns[idx] !== undefined ? columns[idx] : '';
          };

          const modEn = getValue('modulenameen');
          const modTa = getValue('modulenameen') ? getValue('modulenameta') : '';
          const appPostsRaw = getValue('applicableposts');

          let modId = '';

          if (modEn) {
            lastModuleNameEn = modEn;
            lastModuleNameTa = modTa || modEn;
            lastApplicablePosts = appPostsRaw ? appPostsRaw.split(',').map(p => p.trim()).filter(Boolean) : [];

            // Find or create module
            let existingModule = importedModules.find(m => m.nameEn.toLowerCase() === lastModuleNameEn.toLowerCase());
            if (existingModule) {
              modId = existingModule.id;
            } else {
              modId = 'm_csv_' + Math.random().toString(36).substr(2, 4);
              const newMod = {
                id: modId,
                nameEn: lastModuleNameEn,
                nameTa: lastModuleNameTa,
                applicablePosts: lastApplicablePosts
              };
              importedModules.push(newMod);
              modulesCreatedCount++;
            }
            currentModuleId = modId;
          } else {
            if (currentModuleId) {
              modId = currentModuleId;
            } else {
              continue;
            }
          }

          const fieldEn = getValue('fieldnameen');
          const fieldTa = getValue('fieldnameta') || fieldEn;
          const fieldTypeRaw = getValue('fieldtype').toLowerCase() || 'text';
          const fieldRequired = getValue('fieldrequired').toLowerCase();
          const numMin = getValue('numbermin');
          const numMax = getValue('numbermax');
          const dropdownOpts = getValue('dropdownoptions');
          const fileAllowedTypes = getValue('fileallowedtypes').toLowerCase() || 'both';
          const fileMaxSize = getValue('filemaxsizemb');
          const fileMultiple = getValue('filemultiple').toLowerCase();

          if (fieldEn) {
            const fieldExists = importedFields.some(f => f.moduleId === modId && f.nameEn.toLowerCase() === fieldEn.toLowerCase());
            if (!fieldExists) {
              const newField = {
                id: 'f_csv_' + Math.random().toString(36).substr(2, 4),
                moduleId: modId,
                nameEn: fieldEn,
                nameTa: fieldTa,
                type: ['text', 'number', 'date', 'select', 'file'].includes(fieldTypeRaw) ? fieldTypeRaw : 'text',
                validations: {
                  required: ['true', 'yes', 'y', '1'].includes(fieldRequired),
                  min: numMin ? parseInt(numMin) : undefined,
                  max: numMax ? parseInt(numMax) : undefined,
                  options: fieldTypeRaw === 'select' && dropdownOpts ? dropdownOpts.split(',').map(o => o.trim()).filter(Boolean) : undefined,
                  allowedTypes: fieldTypeRaw === 'file' ? (['pdf', 'image', 'both'].includes(fileAllowedTypes) ? fileAllowedTypes : 'both') : undefined,
                  maxSizeMb: fieldTypeRaw === 'file' ? (fileMaxSize ? parseInt(fileMaxSize) : 5) : undefined,
                  multiple: fieldTypeRaw === 'file' ? ['true', 'yes', 'y', '1'].includes(fileMultiple) : undefined
                }
              };
              importedFields.push(newField);
              fieldsCreatedCount++;
            }
          }
        }

        await onSaveCollection('modules', importedModules);
        await onSaveCollection('fields', importedFields);

        setCsvFeedback({
          type: 'success',
          message: `Imported successfully! Created/updated ${modulesCreatedCount} module categories and ${fieldsCreatedCount} custom fields.`
        });
      } catch (err: any) {
        console.error('CSV Parsing error:', err);
        setCsvFeedback({
          type: 'error',
          message: 'Error parsing CSV file: ' + (err.message || 'Check columns or formats.')
        });
      }
    };
    reader.readAsText(file);
  };

  // Deletion helpers
  const handleDeleteModule = async (moduleId: string) => {
    const updatedModules = modules.filter((m: any) => m.id !== moduleId);
    const updatedFields = fields.filter((f: any) => f.moduleId !== moduleId);
    await onSaveCollection('modules', updatedModules);
    await onSaveCollection('fields', updatedFields);
  };

  const handleDeleteField = async (fieldId: string) => {
    const updatedFields = fields.filter((f: any) => f.id !== fieldId);
    await onSaveCollection('fields', updatedFields);
  };

  // Issue category & subcategory helpers
  const handleAddIssueCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIssueCatEn || !newIssueCatTa) return;
    const newCat = {
      id: 'cat_' + Math.random().toString(36).substr(2, 5),
      nameEn: newIssueCatEn,
      nameTa: newIssueCatTa,
      subcategories: []
    };
    const updated = [...currentIssueCategories, newCat];
    await onSaveCollection('issueCategories', updated);
    setNewIssueCatEn('');
    setNewIssueCatTa('');
    setSelectedIssueCatId(newCat.id);
  };

  const handleDeleteIssueCategory = async (catId: string) => {
    const updated = currentIssueCategories.filter((c: any) => c.id !== catId);
    await onSaveCollection('issueCategories', updated);
    if (selectedIssueCatId === catId && updated.length > 0) {
      setSelectedIssueCatId(updated[0].id);
    }
  };

  const handleAddIssueSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIssueCatId || !newIssueSubEn || !newIssueSubTa) return;
    const updated = currentIssueCategories.map((cat: any) => {
      if (cat.id === selectedIssueCatId) {
        const subId = 'sub_' + Math.random().toString(36).substr(2, 5);
        return {
          ...cat,
          subcategories: [
            ...(cat.subcategories || []),
            { id: subId, nameEn: newIssueSubEn, nameTa: newIssueSubTa }
          ]
        };
      }
      return cat;
    });
    await onSaveCollection('issueCategories', updated);
    setNewIssueSubEn('');
    setNewIssueSubTa('');
  };

  const handleDeleteIssueSubcategory = async (catId: string, subId: string) => {
    const updated = currentIssueCategories.map((cat: any) => {
      if (cat.id === catId) {
        return {
          ...cat,
          subcategories: (cat.subcategories || []).filter((s: any) => s.id !== subId)
        };
      }
      return cat;
    });
    await onSaveCollection('issueCategories', updated);
  };

  return (
    <div id="module-management-container" className="portal-studio portal-page">
      <div className="portal-fis-hero">
        <div className="relative z-[1] flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/20">
            <Layers className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 leading-tight">
            <h3 className="text-[14px] font-semibold tracking-tight text-white">
              {t('moduleManagement')}
            </h3>
            <p className="text-[10px] text-white/70">
              {lang === 'ta'
                ? 'தொகுதி வகைகள், தனிப்பயன் புலங்கள் மற்றும் பிரச்சினை வகைகளை நிர்வகிக்கவும்.'
                : 'Configure module categories, custom fields, and issue categories.'}
            </p>
          </div>
        </div>

        <div className="relative z-[1] flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={downloadCSVTemplate}
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
            onChange={handleCsvUpload}
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
            onClick={() => setActiveTab('modules')}
            className={`portal-dash-pill ${activeTab === 'modules' ? 'is-active' : ''}`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>{t('moduleCategoryTab')}</span>
            <span className="portal-fis-count">{modules.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fields')}
            className={`portal-dash-pill ${activeTab === 'fields' ? 'is-active' : ''}`}
          >
            <Settings className="h-3.5 w-3.5" />
            <span>{t('fieldManagementTab')}</span>
            <span className="portal-fis-count">{fields.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('issueCategories')}
            className={`portal-dash-pill ${activeTab === 'issueCategories' ? 'is-active' : ''}`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>{lang === 'ta' ? 'பிரச்சினை வகை & பிரிவு உருவாக்கம்' : 'Issue Categories & Subcategories'}</span>
            <span className="portal-fis-count">{currentIssueCategories.length}</span>
          </button>
        </div>
      </div>

      {activeTab === 'modules' ? (
        <div className="portal-wt-grid">
          <div className="portal-dashboard-panel">
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <Plus className="h-3 w-3" />
                  </span>
                  {lang === 'ta' ? 'புதிய தொகுதி வகை' : 'Create Module Category'}
                </h3>
              </div>
            </div>
            <div className="portal-dash-body portal-wt-form">
            <form onSubmit={handleAddModule} className="space-y-3">
              <div>
                <label>{t('moduleNameEn')}</label>
                <input
                  type="text"
                  value={moduleEn}
                  onChange={(e) => setModuleEn(e.target.value)}
                  placeholder="e.g. Probation Details"
                  required
                />
              </div>
              <div>
                <label>{t('moduleNameTa')}</label>
                <input
                  type="text"
                  value={moduleTa}
                  onChange={(e) => setModuleTa(e.target.value)}
                  placeholder="எ.கா. தகுதிகாண் பருவம் விவரங்கள்"
                  required
                />
              </div>

              <div className="portal-wt-section">
                <div className="portal-wt-section-title">
                  <span>{t('applicablePosts')}</span>
                  <button
                    type="button"
                    onClick={handleSelectAllPosts}
                    className="portal-wt-link"
                  >
                    {selectedPosts.length === posts.length
                      ? (lang === 'ta' ? 'அனைத்தையும் நீக்கு' : 'Clear All')
                      : (lang === 'ta' ? 'அனைத்தையும் தேர்வு' : 'Select All')}
                  </button>
                </div>
                <div className="portal-post-picks">
                  {posts.length === 0 && (
                    <span className="portal-wt-meta">{lang === 'ta' ? 'பதவிகள் இல்லை' : 'No posts available'}</span>
                  )}
                  {posts.map((p: any) => {
                    const active = selectedPosts.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`portal-post-pick${active ? ' is-on' : ''}`}
                        onClick={() => handleTogglePost(p.id)}
                        aria-pressed={active}
                      >
                        {tObj(p)}
                      </button>
                    );
                  })}
                </div>
                <p className="portal-switch-hint" style={{ marginTop: '0.35rem' }}>
                  {selectedPosts.length} {lang === 'ta' ? 'பதவிகள் தேர்வு' : 'posts selected'}
                </p>
              </div>

              <button type="submit">
                {lang === 'ta' ? 'தொகுதியை சேர்' : 'Save Module Category'}
              </button>
            </form>
            </div>
          </div>

          <div className="portal-dashboard-panel">
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <Layers className="h-3 w-3" />
                  </span>
                  {lang === 'ta' ? 'செயலில் உள்ள தொகுதிகள்' : 'Active Module Category Schemes'}
                </h3>
              </div>
            </div>
            <div className="portal-dash-body">
              <div className="portal-wt-note" style={{ marginBottom: '0.55rem' }}>
                <span>
                  <strong>{lang === 'ta' ? 'வருங்கால வைப்பு நிதி (PF) மேலாண்மை' : 'Provident Fund (PF) Management'}</strong>
                  {' — '}
                  {lang === 'ta' ? 'அமைப்பு சார்ந்த தொகுதி. சந்தாக்கள், வட்டி, திரும்பப் பெறுதல்கள் மற்றும் கணக்கு சீட்டுகள்.' : 'Integrated system module for subscriber ledgers, interest, withdrawals, and account slips.'}
                </span>
              </div>
              <div className="portal-wt-tree">
                {modules.length === 0 && (
                  <p className="portal-wt-empty is-center">
                    {lang === 'ta' ? 'தொகுதிகள் எதுவும் உருவாக்கப்படவில்லை.' : 'No modules created yet.'}
                  </p>
                )}
                {modules.map((m: any, mIdx: number) => {
                  const activeFields = fields.filter((f: any) => f.moduleId === m.id);
                  const moduleOpen = Boolean(openModules[m.id]);
                  const moduleTone = MODULE_TONES[mIdx % MODULE_TONES.length];
                  return (
                    <div
                      key={m.id}
                      className={`portal-wt-node${moduleOpen ? ' is-open' : ''}`}
                      style={{ ['--wt-tone' as string]: moduleTone }}
                    >
                      <div className="portal-wt-node-head">
                        <button
                          type="button"
                          className="portal-wt-toggle"
                          onClick={() => setOpenModules((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
                          aria-expanded={moduleOpen}
                        >
                          <ChevronRight className={`portal-wt-caret${moduleOpen ? ' is-open' : ''}`} />
                          <div className="portal-wt-copy">
                            <div className="portal-wt-title">
                              <span>{tObj(m)}</span>
                              <span className="portal-wt-count">
                                {activeFields.length} {lang === 'ta' ? 'புலங்கள்' : 'fields'}
                              </span>
                            </div>
                          </div>
                        </button>
                        <div className="portal-wt-actions">
                          <button
                            type="button"
                            onClick={() => handleDeleteModule(m.id)}
                            className="portal-fis-icon-btn is-danger"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      {moduleOpen && (
                        <div className="portal-wt-fields">
                          <div className="portal-wt-field">
                            <div className="portal-wt-field-main">
                              <div className="portal-wt-field-name">
                                {lang === 'ta' ? 'பொருந்தும் பதவிகள்' : 'Applicable posts'}
                              </div>
                              <div className="portal-wt-chips">
                                {(m.applicablePosts || []).length === 0 && (
                                  <span className="portal-wt-meta">{lang === 'ta' ? 'பதவிகள் இல்லை' : 'No posts mapped'}</span>
                                )}
                                {(m.applicablePosts || []).map((postId: string) => {
                                  const p = posts.find((x: any) => x.id === postId);
                                  return (
                                    <span key={postId} className="portal-wt-chip">
                                      {p ? tObj(p) : postId}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          {activeFields.length === 0 ? (
                            <p className="portal-wt-empty">{lang === 'ta' ? 'புலங்கள் இன்னும் உருவாக்கப்படவில்லை' : 'No fields added yet.'}</p>
                          ) : (
                            activeFields.map((f: any) => (
                              <div key={f.id} className="portal-wt-field">
                                <div className="portal-wt-field-main">
                                  <div className="portal-wt-field-name">
                                    <span>{tObj(f)}</span>
                                    <span className="portal-dash-id">{f.type?.toUpperCase()}</span>
                                  </div>
                                  <p className="portal-wt-meta">
                                    {f.validations?.required ? (lang === 'ta' ? 'கட்டாயம்' : 'Required') : (lang === 'ta' ? 'விருப்பம்' : 'Optional')}
                                    {f.validations?.options ? ` · ${f.validations.options.join(', ')}` : ''}
                                  </p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'fields' ? (
        <div className="portal-wt-grid">
          <div className="portal-dashboard-panel">
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <Plus className="h-3 w-3" />
                  </span>
                  {lang === 'ta' ? 'புதிய தனிப்பயன் களம் உருவாக்கு' : 'Add Dynamic Custom Field'}
                </h3>
              </div>
            </div>
            <div className="portal-dash-body portal-wt-form">
            <form onSubmit={handleAddField} className="space-y-3">
              <div>
                <label>{t('selectModule')}</label>
                <select
                  value={selectedModuleId}
                  onChange={(e) => setSelectedModuleId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Module Category --</option>
                  {modules.map((m: any) => (
                    <option key={m.id} value={m.id}>{tObj(m)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>{t('fieldNameEn')}</label>
                <input
                  type="text"
                  value={fieldEn}
                  onChange={(e) => setFieldEn(e.target.value)}
                  placeholder="e.g. Passport Number"
                  required
                />
              </div>

              <div>
                <label>{t('fieldNameTa')}</label>
                <input
                  type="text"
                  value={fieldTa}
                  onChange={(e) => setFieldTa(e.target.value)}
                  placeholder="எ.கா. கடவுச்சீட்டு எண்"
                  required
                />
              </div>

              <div>
                <label>{t('fieldType')}</label>
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value as any)}
                >
                  <option value="text">Text (உரை)</option>
                  <option value="number">Number (எண்)</option>
                  <option value="date">Date (தேதி)</option>
                  <option value="select">Dropdown Select (பட்டியல்)</option>
                  <option value="file">File Upload (கோப்புப் பதிவேற்றம்)</option>
                </select>
              </div>

              <div className="portal-wt-section">
                <div className="portal-wt-section-title">
                  {lang === 'ta' ? 'கள சரிபார்ப்பு' : 'Field validation'}
                </div>
                <div className="portal-switch-row">
                  <div className="portal-switch-copy">
                    <p className="portal-switch-label" id="isRequired-label">{t('isRequired')}</p>
                    <p className="portal-switch-hint">
                      {lang === 'ta' ? 'இந்தக் களத்தை நிரப்புவது கட்டாயம்' : 'This field must be completed when entering data'}
                    </p>
                  </div>
                  <button
                    type="button"
                    id="isRequired"
                    className={`portal-switch${isRequired ? ' is-on' : ''}`}
                    aria-labelledby="isRequired-label"
                    aria-pressed={isRequired}
                    onClick={() => setIsRequired((v) => !v)}
                  >
                    <span />
                  </button>
                </div>
              </div>

              {fieldType === 'file' && (
                <div className="portal-wt-section">
                  <div className="portal-wt-section-title">File Upload Restrictions</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label>Allowed Formats</label>
                      <select
                        value={fileAllowedTypes}
                        onChange={(e) => setFileAllowedTypes(e.target.value as any)}
                      >
                        <option value="both">PDF & Images</option>
                        <option value="pdf">PDF Only</option>
                        <option value="image">Images Only</option>
                      </select>
                    </div>
                    <div>
                      <label>Max File Size (MB)</label>
                      <input
                        type="number"
                        value={fileMaxSizeMb}
                        onChange={(e) => setFileMaxSizeMb(e.target.value)}
                        placeholder="e.g. 5"
                        min="1"
                      />
                    </div>
                  </div>
                  <div className="portal-switch-row" style={{ marginTop: '0.4rem' }}>
                    <div className="portal-switch-copy">
                      <p className="portal-switch-label">{lang === 'ta' ? 'பல கோப்புகள்' : 'Allow multiple files'}</p>
                    </div>
                    <button
                      type="button"
                      id="fileMultiple"
                      className={`portal-switch${fileMultiple ? ' is-on' : ''}`}
                      aria-pressed={fileMultiple}
                      onClick={() => setFileMultiple((v) => !v)}
                    >
                      <span />
                    </button>
                  </div>
                </div>
              )}

              {fieldType === 'select' && (
                <div>
                  <label>Dropdown Selection Options (Comma separated En)</label>
                  <input
                    type="text"
                    value={selectOptions}
                    onChange={(e) => setSelectOptions(e.target.value)}
                    placeholder="e.g. Married, Unmarried, Divorced"
                    required
                  />
                </div>
              )}

              {fieldType === 'number' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label>{t('minLimit')}</label>
                    <input
                      type="number"
                      value={minLimit}
                      onChange={(e) => setNewIssueSubEn(e.target.value)}
                      placeholder="e.g. 0"
                    />
                  </div>
                  <div>
                    <label>{t('maxLimit')}</label>
                    <input
                      type="number"
                      value={maxLimit}
                      onChange={(e) => setMaxLimit(e.target.value)}
                      placeholder="e.g. 100"
                    />
                  </div>
                </div>
              )}

              <button type="submit">
                {lang === 'ta' ? 'புலத்தை சேர்' : 'Save Dynamic Field'}
              </button>
            </form>
            </div>
          </div>

          <div className="portal-dashboard-panel">
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <Settings className="h-3 w-3" />
                  </span>
                  {lang === 'ta' ? 'அனைத்து தனிப்பயன் புலங்கள்' : 'Active Dynamic Fields Matrix'}
                </h3>
                <p>{fields.length} {lang === 'ta' ? 'புலங்கள்' : 'fields'}</p>
              </div>
            </div>
            <div className="portal-dash-body">
              {fields.length === 0 && (
                <p className="portal-wt-empty is-center">
                  {lang === 'ta' ? 'புலங்கள் எதுவும் உருவாக்கப்படவில்லை.' : 'No custom fields created yet.'}
                </p>
              )}
              <div className="portal-wt-tree">
                {modules.map((m: any, mIdx: number) => {
                  const moduleFields = fields.filter((f: any) => f.moduleId === m.id);
                  if (moduleFields.length === 0) return null;
                  const isOpen = Boolean(openFieldGroups[m.id]);
                  const tone = MODULE_TONES[mIdx % MODULE_TONES.length];
                  return (
                    <div
                      key={m.id}
                      className={`portal-wt-node${isOpen ? ' is-open' : ''}`}
                      style={{ ['--wt-tone' as string]: tone }}
                    >
                      <div className="portal-wt-node-head">
                        <button
                          type="button"
                          className="portal-wt-toggle"
                          onClick={() => setOpenFieldGroups((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
                          aria-expanded={isOpen}
                        >
                          <ChevronRight className={`portal-wt-caret${isOpen ? ' is-open' : ''}`} />
                          <div className="portal-wt-copy">
                            <div className="portal-wt-title">
                              <span>{tObj(m)}</span>
                              <span className="portal-wt-count">{moduleFields.length}</span>
                            </div>
                          </div>
                        </button>
                      </div>
                      {isOpen && (
                        <div className="portal-wt-fields">
                          {moduleFields.map((f: any) => (
                            <div key={f.id} className="portal-wt-field">
                              <div className="portal-wt-field-main">
                                <div className="portal-wt-field-name">
                                  <span>{tObj(f)}</span>
                                  <span className="portal-dash-id">{f.type?.toUpperCase()}</span>
                                </div>
                                <div className="portal-wt-chips">
                                  <span className="portal-wt-chip">
                                    {f.validations?.required ? (lang === 'ta' ? 'கட்டாயம்' : 'Required') : (lang === 'ta' ? 'விருப்பம்' : 'Optional')}
                                  </span>
                                  {f.type === 'file' && (
                                    <span className="portal-wt-chip">
                                      {(f.validations?.allowedTypes || 'both').toUpperCase()} · {f.validations?.maxSizeMb || 5}MB · {f.validations?.multiple ? (lang === 'ta' ? 'பல' : 'Multiple') : (lang === 'ta' ? 'ஒன்று' : 'Single')}
                                    </span>
                                  )}
                                  {(f.validations?.options || []).map((opt: string) => (
                                    <span key={opt} className="portal-wt-chip">{opt}</span>
                                  ))}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteField(f.id)}
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
      ) : (
        <div className="portal-wt-grid">
          <div className="portal-dashboard-panel">
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <Plus className="h-3 w-3" />
                  </span>
                  {lang === 'ta' ? 'புதிய பிரச்சினை வகை உருவாக்கு' : 'Create Issue Category'}
                </h3>
              </div>
            </div>
            <div className="portal-dash-body portal-wt-form">
              <form onSubmit={handleAddIssueCategory} className="space-y-3">
                <div>
                  <label>{lang === 'ta' ? 'வகை பெயர் (ஆங்கிலம்)' : 'Category Name (English)'}</label>
                  <input
                    type="text"
                    value={newIssueCatEn}
                    onChange={(e) => setNewIssueCatEn(e.target.value)}
                    placeholder="e.g. Water Supply"
                    required
                  />
                </div>
                <div>
                  <label>{lang === 'ta' ? 'வகை பெயர் (தமிழ்)' : 'Category Name (Tamil)'}</label>
                  <input
                    type="text"
                    value={newIssueCatTa}
                    onChange={(e) => setNewIssueCatTa(e.target.value)}
                    placeholder="எ.கா. குடிநீர் விநியோகம்"
                    required
                  />
                </div>
                <button type="submit">
                  {lang === 'ta' ? 'வகை சேர்' : 'Save Issue Category'}
                </button>
              </form>

              <div className="portal-wt-tree" style={{ marginTop: '0.55rem' }}>
                {currentIssueCategories.length === 0 && (
                  <p className="portal-wt-empty is-center">
                    {lang === 'ta' ? 'வகைகள் இல்லை' : 'No issue categories yet'}
                  </p>
                )}
                {currentIssueCategories.map((cat: any, catIdx: number) => {
                  const active = selectedIssueCatId === cat.id;
                  const tone = MODULE_TONES[catIdx % MODULE_TONES.length];
                  return (
                    <div
                      key={cat.id}
                      className={`portal-wt-node${active ? ' is-open' : ''}`}
                      style={{ ['--wt-tone' as string]: tone }}
                    >
                      <div className="portal-wt-node-head">
                        <button
                          type="button"
                          className="portal-wt-toggle"
                          onClick={() => setSelectedIssueCatId(active ? '' : cat.id)}
                          aria-pressed={active}
                        >
                          <ChevronRight className={`portal-wt-caret${active ? ' is-open' : ''}`} />
                          <div className="portal-wt-copy">
                            <div className="portal-wt-title">
                              <span>{lang === 'ta' ? (cat.nameTa || cat.nameEn) : (cat.nameEn || cat.nameTa)}</span>
                              <span className="portal-wt-count">{cat.subcategories?.length || 0}</span>
                            </div>
                          </div>
                        </button>
                        <div className="portal-wt-actions">
                          <button
                            type="button"
                            onClick={() => handleDeleteIssueCategory(cat.id)}
                            className="portal-fis-icon-btn is-danger"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="portal-dashboard-panel">
            {selectedIssueCatId ? (() => {
              const selectedCat = currentIssueCategories.find((c: any) => c.id === selectedIssueCatId);
              if (!selectedCat) {
                return (
                  <>
                    <div className="portal-dash-head">
                      <div>
                        <h3>
                          <span className="portal-dash-icon">
                            <AlertTriangle className="h-3 w-3" />
                          </span>
                          {lang === 'ta' ? 'துணைப்பிரிவுகள்' : 'Subcategories'}
                        </h3>
                      </div>
                    </div>
                    <div className="portal-dash-body">
                      <p className="portal-wt-note">{lang === 'ta' ? 'துணைப்பிரிவுகளை நிர்வகிக்க ஒரு வகையைத் தேர்ந்தெடுக்கவும்' : 'Select a category to manage subcategories'}</p>
                    </div>
                  </>
                );
              }
              return (
                <>
                  <div className="portal-dash-head">
                    <div>
                      <h3>
                        <span className="portal-dash-icon">
                          <AlertTriangle className="h-3 w-3" />
                        </span>
                        {lang === 'ta' ? `வகை: ${selectedCat.nameTa || selectedCat.nameEn}` : `Category: ${selectedCat.nameEn || selectedCat.nameTa}`}
                      </h3>
                      <p>{lang === 'ta' ? 'இந்த பிரச்சினை பகுதிக்கு துணைப்பிரிவுகளை சேர்க்கவும் அல்லது நீக்கவும்' : 'Add or remove subcategories for this issue area'}</p>
                    </div>
                  </div>
                  <div className="portal-dash-body portal-wt-form">
                    <form onSubmit={handleAddIssueSubcategory} className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label>{lang === 'ta' ? 'துணைப்பிரிவு பெயர் (ஆங்கிலம்)' : 'Subcategory Name (English)'}</label>
                          <input
                            type="text"
                            value={newIssueSubEn}
                            onChange={(e) => setNewIssueSubEn(e.target.value)}
                            placeholder="e.g. Pipeline Leakage"
                            required
                          />
                        </div>
                        <div>
                          <label>{lang === 'ta' ? 'துணைப்பிரிவு பெயர் (தமிழ்)' : 'Subcategory Name (Tamil)'}</label>
                          <input
                            type="text"
                            value={newIssueSubTa}
                            onChange={(e) => setNewIssueSubTa(e.target.value)}
                            placeholder="எ.கா. குழாய் கசிவு"
                            required
                          />
                        </div>
                      </div>
                      <button type="submit">
                        {lang === 'ta' ? 'சேர்' : 'Add Subcategory'}
                      </button>
                    </form>

                    <div className="portal-wt-fields" style={{ marginTop: '0.55rem' }}>
                      {(!selectedCat.subcategories || selectedCat.subcategories.length === 0) && (
                        <p className="portal-wt-empty">
                          {lang === 'ta' ? 'துணைப்பிரிவுகள் எதுவும் சேர்க்கப்படவில்லை' : 'No subcategories added yet.'}
                        </p>
                      )}
                      {(selectedCat.subcategories || []).map((sub: any) => (
                        <div key={sub.id} className="portal-wt-field">
                          <div className="portal-wt-field-main">
                            <div className="portal-wt-field-name">
                              <span>{lang === 'ta' ? (sub.nameTa || sub.nameEn) : (sub.nameEn || sub.nameTa)}</span>
                              <span className="portal-dash-id">{sub.id}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteIssueSubcategory(selectedCat.id, sub.id)}
                            className="portal-fis-icon-btn is-danger"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })() : (
              <>
                <div className="portal-dash-head">
                  <div>
                    <h3>
                      <span className="portal-dash-icon">
                        <AlertTriangle className="h-3 w-3" />
                      </span>
                      {lang === 'ta' ? 'துணைப்பிரிவுகள்' : 'Subcategories'}
                    </h3>
                  </div>
                </div>
                <div className="portal-dash-body">
                  <p className="portal-wt-note">
                    {lang === 'ta' ? 'துணைப்பிரிவுகளை நிர்வகிக்க இடது பக்கத்தில் ஒரு வகையைத் தேர்ந்தெடுக்கவும்' : 'Select a category on the left side to manage its subcategories'}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
