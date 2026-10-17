'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Layers, 
  Settings, 
  Plus, 
  Trash2, 
  Check, 
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
  AlertTriangle
} from 'lucide-react';
import { Language, translations } from './translations';

interface ModuleManagementViewProps {
  state: any;
  lang: Language;
  onSaveCollection: (key: string, data: any[]) => Promise<void>;
}

export default function ModuleManagementView({ state, lang, onSaveCollection }: ModuleManagementViewProps) {
  const [activeTab, setActiveTab] = useState<'modules' | 'fields' | 'issueCategories'>('modules');

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
    <div id="module-management-container" className="space-y-6">
      {/* Tab bar */}
      <div className="flex justify-start sm:justify-center overflow-x-auto scrollbar-custom whitespace-nowrap border-b border-gray-100 bg-white px-6 pt-4 rounded-t-2xl shadow-xs">
        <button
          onClick={() => setActiveTab('modules')}
          className={`pb-4 px-6 text-sm font-semibold border-b-2 transition shrink-0 ${activeTab === 'modules' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          {t('moduleCategoryTab')}
        </button>
        <button
          onClick={() => setActiveTab('fields')}
          className={`pb-4 px-6 text-sm font-semibold border-b-2 transition shrink-0 ${activeTab === 'fields' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          {t('fieldManagementTab')}
        </button>
        <button
          onClick={() => setActiveTab('issueCategories')}
          className={`pb-4 px-6 text-sm font-semibold border-b-2 transition shrink-0 ${activeTab === 'issueCategories' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          {lang === 'ta' ? 'பிரச்சினை வகை & பிரிவு உருவாக்கம்' : 'Issue Categories & Subcategories'}
        </button>
      </div>

      {/* Bulk Upload CSV Widget */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-50 pb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
            <div>
              <h3 className="font-bold text-gray-800 text-sm">Bulk Import Modules & Custom Fields</h3>
              <p className="text-[11px] text-gray-400">Upload a single CSV to setup module schemes and dynamic fields instantly</p>
            </div>
          </div>
          <button
            type="button"
            onClick={downloadCSVTemplate}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl transition"
          >
            <Download className="w-3.5 h-3.5" />
            Download Model Template CSV
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <div className="text-xs text-gray-500 leading-normal space-y-1.5">
            <p className="font-semibold text-gray-700">How it works:</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Fill out the columns for module categories and field validation definitions.</li>
              <li>Multiple fields under the same module should be grouped in consecutive rows.</li>
              <li>Leave the ModuleNameEn empty in succeeding rows to inherit the previous module.</li>
            </ul>
          </div>
          <div>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 hover:border-indigo-400 hover:bg-indigo-50/20 rounded-2xl p-5 cursor-pointer transition text-center group">
              <Upload className="w-6 h-6 text-gray-400 group-hover:text-indigo-500 mb-2 animate-pulse" />
              <span className="text-xs font-bold text-gray-600 group-hover:text-indigo-700">Choose CSV File</span>
              <span className="text-[10px] text-gray-400 mt-1">Accepts .csv encoded files</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Feedback Messages */}
        {csvFeedback && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${csvFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
            {csvFeedback.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
            <div>
              <p className="font-bold">{csvFeedback.type === 'success' ? 'Import Succeeded!' : 'Import Failed'}</p>
              <p className="mt-0.5 font-medium">{csvFeedback.message}</p>
            </div>
          </div>
        )}
      </div>

      {activeTab === 'modules' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Create Module side */}
          <div className="lg:col-span-5">
            <form onSubmit={handleAddModule} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
              <h3 className="font-semibold text-gray-800 text-md flex items-center gap-2 border-b border-gray-50 pb-2">
                <Layers className="w-5 h-5 text-indigo-500" />
                {lang === 'ta' ? 'புதிய தொகுதி வகை' : 'Create Module Category'}
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('moduleNameEn')}</label>
                  <input
                    type="text"
                    value={moduleEn}
                    onChange={(e) => setModuleEn(e.target.value)}
                    placeholder="e.g. Probation Details"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('moduleNameTa')}</label>
                  <input
                    type="text"
                    value={moduleTa}
                    onChange={(e) => setModuleTa(e.target.value)}
                    placeholder="எ.கா. தகுதிகாண் பருவம் விவரங்கள்"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none"
                    required
                  />
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-50">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-800">{t('applicablePosts')}</span>
                    <button
                      type="button"
                      onClick={handleSelectAllPosts}
                      className="text-[10px] font-bold text-indigo-600 uppercase hover:underline"
                    >
                      {selectedPosts.length === posts.length ? 'Clear All' : 'Select All'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                    {posts.map((p: any) => {
                      const active = selectedPosts.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleTogglePost(p.id)}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-left text-xs font-medium transition truncate ${
                            active ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-150 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            active ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300'
                          }`}>
                            {active && <Check className="w-3 h-3" />}
                          </div>
                          <span className="truncate">{tObj(p)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition mt-2 shadow-xs">
                {lang === 'ta' ? 'தொகுதியை சேர்' : 'Save Module Category'}
              </button>
            </form>
          </div>

          {/* Module List side */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
            <h4 className="font-semibold text-gray-800 text-sm border-b border-gray-50 pb-2">{lang === 'ta' ? 'செயலில் உள்ள தொகுதிகள்' : 'Active Module Category Schemes'}</h4>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {/* Core System Module: Provident Fund */}
              <div className="p-4 bg-indigo-50/55 border border-indigo-100 rounded-xl space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg uppercase tracking-wide">
                  Core Module
                </div>
                <div className="flex justify-between items-start">
                  <div>
                    <h5 className="font-bold text-indigo-900 text-sm">
                      {lang === 'ta' ? 'வருங்கால வைப்பு நிதி (PF) மேலாண்மை' : 'Provident Fund (PF) Management'}
                    </h5>
                    <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wide mt-0.5">
                      {lang === 'ta' ? 'அமைப்பு சார்ந்த தொகுதி' : 'Integrated System Module'}
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {lang === 'ta' ? 'ஊழியர்களின் சேமநலநிதி சந்தாக்கள், வட்டி கணக்கீடுகள், திரும்பப் பெறுதல்கள் மற்றும் கணக்கு சீட்டுகளை நிர்வகிப்பதற்கான முழுமையான தொகுதி.' : 'Manages subscriber PF ledgers, monthly subscriptions, withdrawal posts, interest auto-accruals (compounded annually), and printable account slip generation.'}
                </p>
                <div className="space-y-2 pt-2 border-t border-indigo-100/50 text-[10px]">
                  <div className="flex justify-between text-indigo-800 font-bold">
                    <span>{lang === 'ta' ? 'செயல்பாடுகள்:' : 'Functions:'}</span>
                    <span className="text-emerald-700">{lang === 'ta' ? 'செயலில் உள்ளது' : 'Enabled & Live'}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span className="bg-white border border-indigo-150 text-[9px] font-semibold text-indigo-800 px-2 py-0.5 rounded">
                      {lang === 'ta' ? 'ஆண்டு வட்டி விகிதங்கள்' : 'Yearly Interest Rate Timeline'}
                    </span>
                    <span className="bg-white border border-indigo-150 text-[9px] font-semibold text-indigo-800 px-2 py-0.5 rounded">
                      {lang === 'ta' ? 'சந்தா கணக்குகள்' : 'Subscriber Ledgers'}
                    </span>
                    <span className="bg-white border border-indigo-150 text-[9px] font-semibold text-indigo-800 px-2 py-0.5 rounded">
                      {lang === 'ta' ? 'கணக்கு சீட்டுகள்' : 'Printable Account Slips'}
                    </span>
                  </div>
                </div>
              </div>

              {modules.map((m: any) => {
                const activeFields = fields.filter((f: any) => f.moduleId === m.id);
                return (
                  <div key={m.id} className="p-4 bg-gray-50 border border-gray-100 rounded-xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="font-bold text-gray-900 text-sm">{tObj(m)}</h5>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">ID: {m.id}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteModule(m.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-gray-150">
                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">{lang === 'ta' ? 'பொருந்தும் பதவிகள்' : 'Applicable Posts'}</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {m.applicablePosts?.map((postId: string) => {
                            const p = posts.find((x: any) => x.id === postId);
                            return (
                              <span key={postId} className="bg-white border border-gray-150 text-[10px] font-medium text-gray-600 px-2 py-0.5 rounded">
                                {p ? tObj(p) : postId}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">{lang === 'ta' ? 'தனிப்பயன் புலங்கள்' : 'Dynamic Fields'} ({activeFields.length})</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {activeFields.map((f: any) => (
                            <span key={f.id} className="bg-indigo-50/50 border border-indigo-100 text-[10px] font-semibold text-indigo-700 px-2.5 py-0.5 rounded">
                              {tObj(f)}
                            </span>
                          ))}
                          {activeFields.length === 0 && (
                            <span className="text-[10px] text-gray-400 italic pl-1">{lang === 'ta' ? 'புலங்கள் இன்னும் உருவாக்கப்படவில்லை' : 'No fields added yet.'}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {modules.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-sm text-gray-400 italic">{lang === 'ta' ? 'தொகுதிகள் எதுவும் உருவாக்கப்படவில்லை.' : 'No modules created yet.'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'fields' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Create Field side */}
          <div className="lg:col-span-5">
            <form onSubmit={handleAddField} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
              <h3 className="font-semibold text-gray-800 text-md flex items-center gap-2 border-b border-gray-50 pb-2">
                <Settings className="w-5 h-5 text-indigo-500" />
                {lang === 'ta' ? 'புதிய தனிப்பயன் களம் உருவாக்கு' : 'Add Dynamic Custom Field'}
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('selectModule')}</label>
                  <select
                    value={selectedModuleId}
                    onChange={(e) => setSelectedModuleId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none bg-white"
                    required
                  >
                    <option value="">-- Choose Module Category --</option>
                    {modules.map((m: any) => (
                      <option key={m.id} value={m.id}>{tObj(m)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('fieldNameEn')}</label>
                  <input
                    type="text"
                    value={fieldEn}
                    onChange={(e) => setFieldEn(e.target.value)}
                    placeholder="e.g. Passport Number"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('fieldNameTa')}</label>
                  <input
                    type="text"
                    value={fieldTa}
                    onChange={(e) => setFieldTa(e.target.value)}
                    placeholder="எ.கா. கடவுச்சீட்டு எண்"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-gray-500">{t('fieldType')}</label>
                    <select
                      value={fieldType}
                      onChange={(e) => setFieldType(e.target.value as any)}
                      className="w-full border border-gray-200 rounded-xl p-2.5 text-xs mt-1 outline-none bg-white"
                    >
                      <option value="text">Text (உரை)</option>
                      <option value="number">Number (எண்)</option>
                      <option value="date">Date (தேதி)</option>
                      <option value="select">Dropdown Select (பட்டியல்)</option>
                      <option value="file">File Upload (கோப்புப் பதிவேற்றம்)</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-6 pl-2">
                    <input
                      type="checkbox"
                      id="isRequired"
                      checked={isRequired}
                      onChange={(e) => setIsRequired(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 border-gray-300"
                    />
                    <label htmlFor="isRequired" className="text-xs font-semibold text-gray-600 cursor-pointer">{t('isRequired')}</label>
                  </div>
                </div>

                {fieldType === 'file' && (
                  <div className="space-y-3 p-3 bg-indigo-50/30 rounded-xl border border-indigo-50 mt-2">
                    <span className="text-xs font-bold text-indigo-900 block flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-indigo-600" />
                      File Upload Restrictions
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500">Allowed Formats</label>
                        <select
                          value={fileAllowedTypes}
                          onChange={(e) => setFileAllowedTypes(e.target.value as any)}
                          className="w-full border border-gray-200 rounded-lg p-2 text-xs mt-1 outline-none bg-white"
                        >
                          <option value="both">PDF & Images</option>
                          <option value="pdf">PDF Only</option>
                          <option value="image">Images Only</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500">Max File Size (MB)</label>
                        <input
                          type="number"
                          value={fileMaxSizeMb}
                          onChange={(e) => setFileMaxSizeMb(e.target.value)}
                          placeholder="e.g. 5"
                          className="w-full border border-gray-200 rounded-lg p-2 text-xs mt-1 outline-none bg-white"
                          min="1"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="fileMultiple"
                        checked={fileMultiple}
                        onChange={(e) => setFileMultiple(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 border-gray-300"
                      />
                      <label htmlFor="fileMultiple" className="text-xs font-semibold text-gray-600 cursor-pointer">Allow Multiple Files</label>
                    </div>
                  </div>
                )}

                {fieldType === 'select' && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500">Dropdown Selection Options (Comma separated En)</label>
                    <input
                      type="text"
                      value={selectOptions}
                      onChange={(e) => setSelectOptions(e.target.value)}
                      placeholder="e.g. Married, Unmarried, Divorced"
                      className="w-full border border-gray-200 rounded-xl p-3 text-xs mt-1 outline-none"
                      required
                    />
                  </div>
                )}

                {fieldType === 'number' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-500">{t('minLimit')}</label>
                      <input
                        type="number"
                        value={minLimit}
                        onChange={(e) => setNewIssueSubEn(e.target.value)}
                        placeholder="e.g. 0"
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs mt-1 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">{t('maxLimit')}</label>
                      <input
                        type="number"
                        value={maxLimit}
                        onChange={(e) => setMaxLimit(e.target.value)}
                        placeholder="e.g. 100"
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs mt-1 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition mt-2 shadow-xs">
                {lang === 'ta' ? 'புலத்தை சேர்' : 'Save Dynamic Field'}
              </button>
            </form>
          </div>

          {/* Fields List side */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
            <h4 className="font-semibold text-gray-800 text-sm border-b border-gray-50 pb-2">{lang === 'ta' ? 'அனைத்து தனிப்பயன் புலங்கள்' : 'Active Dynamic Fields Matrix'}</h4>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {fields.map((f: any) => {
                const mod = modules.find((m: any) => m.id === f.moduleId);
                return (
                  <div key={f.id} className="flex justify-between items-center p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs hover:border-gray-200 transition">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm">{tObj(f)}</span>
                        <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded">
                          {f.type.toUpperCase()}
                        </span>
                        {f.validations?.required && (
                          <span className="text-[9px] bg-rose-50 text-rose-600 border border-rose-100 px-1 py-0.5 rounded font-semibold font-mono">
                            REQUIRED
                          </span>
                        )}
                        {f.type === 'file' && (
                          <span className="text-[9px] bg-sky-50 border border-sky-100 text-sky-700 px-1.5 py-0.5 rounded font-mono font-medium">
                            {f.validations?.allowedTypes?.toUpperCase() || 'BOTH'} | Max: {f.validations?.maxSizeMb || 5}MB {f.validations?.multiple ? '(MULTIPLE)' : '(SINGLE)'}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">
                        {lang === 'ta' ? 'தொகுதி:' : 'Module:'} <span className="font-semibold text-gray-500">{mod ? tObj(mod) : f.moduleId}</span>
                      </p>
                      {f.validations?.options && (
                        <p className="text-[10px] text-gray-400 italic">
                          Options: {f.validations.options.join(', ')}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteField(f.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
              {fields.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-sm text-gray-400 italic">{lang === 'ta' ? 'புலங்கள் எதுவும் உருவாக்கப்படவில்லை.' : 'No custom fields created yet.'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Issue categories and subcategories layout workspace */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Create Issue Category Side */}
          <div className="lg:col-span-5 space-y-6">
            <form onSubmit={handleAddIssueCategory} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
              <h3 className="font-semibold text-gray-800 text-md flex items-center gap-2 border-b border-gray-50 pb-2">
                <Layers className="w-5 h-5 text-indigo-500" />
                {lang === 'ta' ? 'புதிய பிரச்சினை வகை உருவாக்கு' : 'Create Issue Category'}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500">Category Name (English)</label>
                  <input
                    type="text"
                    value={newIssueCatEn}
                    onChange={(e) => setNewIssueCatEn(e.target.value)}
                    placeholder="e.g. Water Supply"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Category Name (Tamil)</label>
                  <input
                    type="text"
                    value={newIssueCatTa}
                    onChange={(e) => setNewIssueCatTa(e.target.value)}
                    placeholder="எ.கா. குடிநீர் விநியோகம்"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 outline-none"
                    required
                  />
                </div>
              </div>
              <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition mt-2 shadow-xs">
                {lang === 'ta' ? 'வகை சேர்' : 'Save Issue Category'}
              </button>
            </form>

            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
              <h4 className="font-semibold text-gray-800 text-sm border-b border-gray-50 pb-2">
                {lang === 'ta' ? 'செயலில் உள்ள பிரிவுகள்' : 'Active Categories'}
              </h4>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {currentIssueCategories.map((cat: any) => {
                  const active = selectedIssueCatId === cat.id;
                  return (
                    <div 
                      key={cat.id} 
                      className={`flex justify-between items-center p-3 rounded-xl border text-xs cursor-pointer transition ${
                        active ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900 font-bold' : 'bg-gray-50 border-gray-100 text-gray-600 hover:bg-gray-100'
                      }`}
                      onClick={() => setSelectedIssueCatId(cat.id)}
                    >
                      <div>
                        <p className="text-sm">{lang === 'ta' ? (cat.nameTa || cat.nameEn) : (cat.nameEn || cat.nameTa)}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">Subcategories: {cat.subcategories?.length || 0}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteIssueCategory(cat.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Subcategories Management Side */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-6">
            {selectedIssueCatId ? (() => {
              const selectedCat = currentIssueCategories.find((c: any) => c.id === selectedIssueCatId);
              if (!selectedCat) return <p className="text-gray-400 italic text-center py-10">Select a category to manage subcategories</p>;
              return (
                <>
                  <div className="border-b border-gray-100 pb-3">
                    <h3 className="font-bold text-gray-800 text-sm">
                      {lang === 'ta' ? `வகை: ${selectedCat.nameTa || selectedCat.nameEn}` : `Category: ${selectedCat.nameEn || selectedCat.nameTa}`}
                    </h3>
                    <p className="text-[10px] text-gray-400">Add or remove subcategories for this issue area</p>
                  </div>

                  <form onSubmit={handleAddIssueSubcategory} className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-4">
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      {lang === 'ta' ? 'புதிய துணைப்பிரிவு சேர்க்கவும்' : 'Add New Subcategory'}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500">Subcategory Name (English)</label>
                        <input
                          type="text"
                          value={newIssueSubEn}
                          onChange={(e) => setNewIssueSubEn(e.target.value)}
                          placeholder="e.g. Pipeline Leakage"
                          className="w-full border border-gray-200 rounded-xl p-2.5 text-xs mt-1 outline-none bg-white"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-gray-500">Subcategory Name (Tamil)</label>
                        <input
                          type="text"
                          value={newIssueSubTa}
                          onChange={(e) => setNewIssueSubTa(e.target.value)}
                          placeholder="எ.கா. குழாய் கசிவு"
                          className="w-full border border-gray-200 rounded-xl p-2.5 text-xs mt-1 outline-none bg-white"
                          required
                        />
                      </div>
                    </div>
                    <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-xs flex items-center gap-1">
                      <Plus className="w-3.5 h-3.5" />
                      {lang === 'ta' ? 'சேர்' : 'Add Subcategory'}
                    </button>
                  </form>

                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                      {lang === 'ta' ? 'துணைப்பிரிவுகள் பட்டியல்' : 'Subcategories'} ({selectedCat.subcategories?.length || 0})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2">
                      {selectedCat.subcategories?.map((sub: any) => (
                        <div key={sub.id} className="flex justify-between items-center p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs hover:border-gray-200 transition">
                          <div>
                            <p className="font-bold text-gray-800">{lang === 'ta' ? (sub.nameTa || sub.nameEn) : (sub.nameEn || sub.nameTa)}</p>
                            <p className="text-[9px] text-gray-400 mt-0.5 font-mono">ID: {sub.id}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteIssueSubcategory(selectedCat.id, sub.id)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {(!selectedCat.subcategories || selectedCat.subcategories.length === 0) && (
                        <p className="col-span-2 text-xs text-gray-400 italic text-center py-8 bg-gray-50/50 rounded-xl border border-dashed border-gray-150">
                          {lang === 'ta' ? 'துணைப்பிரிவுகள் எதுவும் சேர்க்கப்படவில்லை' : 'No subcategories added yet.'}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              );
            })() : (
              <p className="text-gray-400 italic text-center py-20">Select a category on the left side to manage its subcategories</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
