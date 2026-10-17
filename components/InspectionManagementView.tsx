'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  ClipboardCheck, 
  FolderTree, 
  ListFilter, 
  Plus, 
  Trash2, 
  Upload, 
  Download, 
  CheckCircle, 
  AlertCircle,
  FileSpreadsheet,
  Camera,
  FileUp,
  Calendar,
  Hash,
  Type,
  Phone,
  CheckSquare,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  Pencil,
  Edit3,
  X,
  Save,
  ArrowUp,
  ArrowDown,
  Zap,
  SlidersHorizontal
} from 'lucide-react';
import { Language, translations } from './translations';

interface InspectionManagementViewProps {
  state: any;
  lang: Language;
  onSaveCollection: (key: string, data: any[]) => Promise<void>;
}

export default function InspectionManagementView({ state, lang, onSaveCollection }: InspectionManagementViewProps) {
  const [activeTab, setActiveTab] = useState<'subjects' | 'categories' | 'fields'>('subjects');
  const [viewMode, setViewMode] = useState<'tree' | 'table'>('tree');

  const {
    inspectionSubjects = [],
    inspectionCategories = [],
    inspectionFields = []
  } = state || {};

  const handleMoveSubject = async (index: number, direction: 'up' | 'down') => {
    const updated = [...inspectionSubjects];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= updated.length) return;
    
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    
    await onSaveCollection('inspectionSubjects', updated);
  };

  const handleMoveCategory = async (subjectId: string, indexInSubj: number, direction: 'up' | 'down') => {
    const subjectCats = inspectionCategories.filter((c: any) => c.subjectId === subjectId);
    const targetIndexInSubj = direction === 'up' ? indexInSubj - 1 : indexInSubj + 1;
    if (targetIndexInSubj < 0 || targetIndexInSubj >= subjectCats.length) return;
    
    const cat1 = subjectCats[indexInSubj];
    const cat2 = subjectCats[targetIndexInSubj];
    
    const updated = inspectionCategories.map((c: any) => {
      if (c.id === cat1.id) return cat2;
      if (c.id === cat2.id) return cat1;
      return c;
    });
    
    await onSaveCollection('inspectionCategories', updated);
  };

  const handleMoveField = async (categoryId: string, indexInCat: number, direction: 'up' | 'down') => {
    const categoryFields = inspectionFields.filter((f: any) => f.categoryId === categoryId);
    const targetIndexInCat = direction === 'up' ? indexInCat - 1 : indexInCat + 1;
    if (targetIndexInCat < 0 || targetIndexInCat >= categoryFields.length) return;
    
    const fld1 = categoryFields[indexInCat];
    const fld2 = categoryFields[targetIndexInCat];
    
    const updated = inspectionFields.map((f: any) => {
      if (f.id === fld1.id) return fld2;
      if (f.id === fld2.id) return fld1;
      return f;
    });
    
    await onSaveCollection('inspectionFields', updated);
  };

  const handleExportExcel = () => {
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <style>
          table { border-collapse: collapse; }
          th { background-color: #002B49; color: white; font-weight: bold; padding: 6px; }
          td { padding: 6px; border: 1px solid #ccc; }
        </style>
      </head>
      <body>
        <table border="1">
          <thead>
            <tr>
              <th>S.No</th>
              <th>Subject Name (EN)</th>
              <th>Subject Name (TA)</th>
              <th>Category Name (EN)</th>
              <th>Category Name (TA)</th>
              <th>Field Name (EN)</th>
              <th>Field Name (TA)</th>
              <th>Field Type</th>
              <th>Mandatory</th>
              <th>Unique</th>
              <th>Dropdown Options</th>
            </tr>
          </thead>
          <tbody>
    `;
    
    let index = 1;
    inspectionSubjects.forEach((subj: any) => {
      const cats = inspectionCategories.filter((c: any) => c.subjectId === subj.id);
      cats.forEach((cat: any) => {
        const flds = inspectionFields.filter((f: any) => f.categoryId === cat.id);
        flds.forEach((fld: any) => {
          html += `
            <tr>
              <td>${index++}</td>
              <td>${subj.nameEn || ''}</td>
              <td>${subj.nameTa || ''}</td>
              <td>${cat.nameEn || ''}</td>
              <td>${cat.nameTa || ''}</td>
              <td>${fld.nameEn || fld.fieldName || ''}</td>
              <td>${fld.nameTa || fld.fieldNameTa || ''}</td>
              <td>${fld.type || fld.fieldType || ''}</td>
              <td>${fld.isMandatory ? 'Yes' : 'No'}</td>
              <td>${fld.isUnique ? 'Yes' : 'No'}</td>
              <td>${fld.options ? fld.options.join(', ') : ''}</td>
            </tr>
          `;
        });
        if (flds.length === 0) {
          html += `
            <tr>
              <td>${index++}</td>
              <td>${subj.nameEn || ''}</td>
              <td>${subj.nameTa || ''}</td>
              <td>${cat.nameEn || ''}</td>
              <td>${cat.nameTa || ''}</td>
              <td colspan="5" style="color: gray; font-style: italic;">No fields configured</td>
            </tr>
          `;
        }
      });
      if (cats.length === 0) {
        html += `
          <tr>
            <td>${index++}</td>
            <td>${subj.nameEn || ''}</td>
            <td>${subj.nameTa || ''}</td>
            <td colspan="8" style="color: gray; font-style: italic;">No categories configured</td>
          </tr>
        `;
      }
    });
    
    html += `
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Configured_Inspection_Structure_${lang === 'ta' ? 'தமிழ்' : 'English'}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Edit modal states
  const [editingSubject, setEditingSubject] = useState<any | null>(null);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [editingField, setEditingField] = useState<any | null>(null);

  // Form states - Subjects
  const [subjectEn, setSubjectEn] = useState('');
  const [subjectTa, setSubjectTa] = useState('');
  const [subjectDesc, setSubjectDesc] = useState('');

  // Form states - Categories
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [categoryEn, setCategoryEn] = useState('');
  const [categoryTa, setCategoryTa] = useState('');

  // Form states - Fields
  const [fieldSubjectId, setFieldSubjectId] = useState('');
  const [fieldCategoryId, setFieldCategoryId] = useState('');
  const [fieldNameEn, setFieldNameEn] = useState('');
  const [fieldNameTa, setFieldNameTa] = useState('');
  const [fieldType, setFieldType] = useState<string>('text');
  const [isMandatory, setIsMandatory] = useState(false);
  const [isUnique, setIsUnique] = useState(false);
  const [dropdownOptions, setDropdownOptions] = useState('');
  const [fieldPlaceholderEn, setFieldPlaceholderEn] = useState('');
  const [fieldPlaceholderTa, setFieldPlaceholderTa] = useState('');
  // Conditional dynamic field states
  const [conditionalAction, setConditionalAction] = useState<'none' | 'skip_to_camera' | 'hide_remaining'>('none');
  const [conditionalTriggerValue, setConditionalTriggerValue] = useState<string>('Yes');
  const [isConditional, setIsConditional] = useState<boolean>(false);
  const [dependsOnFieldId, setDependsOnFieldId] = useState<string>('');
  const [dependsOnValue, setDependsOnValue] = useState<string>('');
  const [conditionType, setConditionType] = useState<'show_if' | 'hide_if'>('show_if');

  const [csvFeedback, setCsvFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = (key: keyof typeof translations['en']) => {
    return translations[lang][key] || translations['en'][key] || key;
  };

  const tObj = (obj: any) => {
    if (!obj) return '';
    return lang === 'ta' ? (obj.nameTa || obj.nameEn) : (obj.nameEn || obj.nameTa);
  };

  // Add Subject Handler
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectEn || !subjectTa) return;

    const newSubject = {
      id: 'subj_' + subjectEn.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.random().toString(36).substr(2, 4),
      nameEn: subjectEn.trim(),
      nameTa: subjectTa.trim(),
      description: subjectDesc.trim(),
      createdAt: new Date().toISOString()
    };

    await onSaveCollection('inspectionSubjects', [...inspectionSubjects, newSubject]);
    setSubjectEn('');
    setSubjectTa('');
    setSubjectDesc('');
  };

  // Add Category Handler
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId || !categoryEn || !categoryTa) return;

    const newCategory = {
      id: 'cat_' + categoryEn.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.random().toString(36).substr(2, 4),
      subjectId: selectedSubjectId,
      nameEn: categoryEn.trim(),
      nameTa: categoryTa.trim(),
      createdAt: new Date().toISOString()
    };

    await onSaveCollection('inspectionCategories', [...inspectionCategories, newCategory]);
    setCategoryEn('');
    setCategoryTa('');
  };

  // Add Field Handler
  const handleAddField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldCategoryId || !fieldNameEn || !fieldNameTa) return;

    const newField = {
      id: 'fld_' + fieldNameEn.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.random().toString(36).substr(2, 4),
      categoryId: fieldCategoryId,
      nameEn: fieldNameEn.trim(),
      nameTa: fieldNameTa.trim(),
      fieldName: fieldNameEn.trim(),
      fieldNameTa: fieldNameTa.trim(),
      type: fieldType,
      fieldType: fieldType,
      isMandatory: Boolean(isMandatory),
      isRequired: Boolean(isMandatory),
      isUnique: Boolean(isUnique),
      options: fieldType === 'dropdown' ? dropdownOptions.split(',').map(o => o.trim()).filter(Boolean) : undefined,
      placeholderEn: fieldPlaceholderEn || undefined,
      placeholderTa: fieldPlaceholderTa || undefined,
      conditionalAction: (fieldType === 'yes_no' || fieldType === 'dropdown') ? conditionalAction : undefined,
      conditionalTriggerValue: (fieldType === 'yes_no' || fieldType === 'dropdown') && conditionalAction !== 'none' ? conditionalTriggerValue : undefined,
      dependsOnFieldId: isConditional && dependsOnFieldId ? dependsOnFieldId : undefined,
      dependsOnValue: isConditional && dependsOnFieldId ? dependsOnValue : undefined,
      conditionType: isConditional && dependsOnFieldId ? conditionType : undefined,
      createdAt: new Date().toISOString()
    };

    await onSaveCollection('inspectionFields', [...inspectionFields, newField]);
    setFieldNameEn('');
    setFieldNameTa('');
    setFieldType('text');
    setIsMandatory(false);
    setIsUnique(false);
    setDropdownOptions('');
    setFieldPlaceholderEn('');
    setFieldPlaceholderTa('');
    setConditionalAction('none');
    setConditionalTriggerValue('Yes');
    setIsConditional(false);
    setDependsOnFieldId('');
    setDependsOnValue('');
    setConditionType('show_if');
  };

  // Delete Handlers
  const handleDeleteSubject = async (subjectId: string) => {
    const updated = inspectionSubjects.filter((s: any) => s.id !== subjectId);
    await onSaveCollection('inspectionSubjects', updated);
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const updated = inspectionCategories.filter((c: any) => c.id !== categoryId);
    await onSaveCollection('inspectionCategories', updated);
  };

  const handleDeleteField = async (fieldId: string) => {
    const updated = inspectionFields.filter((f: any) => f.id !== fieldId);
    await onSaveCollection('inspectionFields', updated);
  };

  // Edit Handlers
  const handleSaveEditSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject) return;

    const updated = inspectionSubjects.map((s: any) => 
      s.id === editingSubject.id 
        ? { ...s, nameEn: editingSubject.nameEn.trim(), nameTa: editingSubject.nameTa.trim(), description: (editingSubject.description || '').trim(), updatedAt: new Date().toISOString() } 
        : s
    );
    await onSaveCollection('inspectionSubjects', updated);
    setEditingSubject(null);
  };

  const handleSaveEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;

    const updated = inspectionCategories.map((c: any) =>
      c.id === editingCategory.id
        ? { ...c, nameEn: editingCategory.nameEn.trim(), nameTa: editingCategory.nameTa.trim(), subjectId: editingCategory.subjectId, updatedAt: new Date().toISOString() }
        : c
    );
    await onSaveCollection('inspectionCategories', updated);
    setEditingCategory(null);
  };

  const handleSaveEditField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingField) return;

    const optionsList = typeof editingField.options === 'string'
      ? editingField.options.split(',').map((o: string) => o.trim()).filter(Boolean)
      : (Array.isArray(editingField.options) ? editingField.options : undefined);

    const updated = inspectionFields.map((f: any) =>
      f.id === editingField.id
        ? {
            ...f,
            nameEn: editingField.nameEn.trim(),
            nameTa: editingField.nameTa.trim(),
            fieldName: editingField.nameEn.trim(),
            fieldNameTa: editingField.nameTa.trim(),
            type: editingField.type,
            fieldType: editingField.type,
            isMandatory: Boolean(editingField.isMandatory),
            isRequired: Boolean(editingField.isMandatory),
            isUnique: Boolean(editingField.isUnique),
            options: editingField.type === 'dropdown' ? optionsList : undefined,
            placeholderEn: editingField.placeholderEn || undefined,
            placeholderTa: editingField.placeholderTa || undefined,
            categoryId: editingField.categoryId,
            conditionalAction: (editingField.type === 'yes_no' || editingField.type === 'dropdown') ? editingField.conditionalAction : undefined,
            conditionalTriggerValue: (editingField.type === 'yes_no' || editingField.type === 'dropdown') ? editingField.conditionalTriggerValue : undefined,
            dependsOnFieldId: editingField.dependsOnFieldId || undefined,
            dependsOnValue: editingField.dependsOnValue || undefined,
            conditionType: editingField.conditionType || undefined,
            updatedAt: new Date().toISOString()
          }
        : f
    );
    await onSaveCollection('inspectionFields', updated);
    setEditingField(null);
  };

  // Download Bulk CSV Template (Tamil & English with Model Template)
  const downloadInspectionCSVTemplate = () => {
    const csvContent = "\uFEFFSubjectNameEn,SubjectNameTa,CategoryNameEn,CategoryNameTa,FieldNameEn,FieldNameTa,FieldType,IsMandatory,IsUnique,DropdownOptions\n" +
      "SWM Management,திடக்கழிவு மேலாண்மை,Door to Door Survey,வீடு வீடாக ஆய்வு,Resident Name,குடியிருப்பாளர் பெயர்,text,true,false,\n" +
      "SWM Management,திடக்கழிவு மேலாண்மை,Door to Door Survey,வீடு வீடாக ஆய்வு,Contact Mobile Number,தொடர்பு கைபேசி எண்,mobile,true,true,\n" +
      "SWM Management,திடக்கழிவு மேலாண்மை,Door to Door Survey,வீடு வீடாக ஆய்வு,Waste Segregated at Source,மூலத்திலேயே தரம் பிரிக்கப்பட்டதா,yes_no,true,false,\n" +
      "SWM Management,திடக்கழிவு மேலாண்மை,Door to Door Survey,வீடு வீடாக ஆய்வு,Daily Waste Generation (KG),தினசரி கழிவு உற்பத்தி (கிலோ),number,false,false,\n" +
      "SWM Management,திடக்கழிவு மேலாண்மை,Door to Door Survey,வீடு வீடாக ஆய்வு,Waste Category Type,கழிவு வகை,dropdown,true,false,\"Wet Waste,Dry Waste,Hazardous Waste\"\n" +
      "SWM Management,திடக்கழிவு மேலாண்மை,Door to Door Survey,வீடு வீடாக ஆய்வு,Premise Photo Evidence,வளாக புகைப்பட சான்று,camera,true,false,\n" +
      "SWM Management,திடக்கழிவு மேலாண்மை,Door to Door Survey,வீடு வீடாக ஆய்வு,Inspection Date,ஆய்வு தேதி,date,true,false,\n" +
      "Water Supply Management,குடிநீர் விநியோக மேலாண்மை,Chlorination Level Check,குளோரினேஷன் அளவு பரிசோதனை,PPM Level,பிபிஎம் அளவு,number,true,false,\n" +
      "Water Supply Management,குடிநீர் விநியோக மேலாண்மை,Chlorination Level Check,குளோரினேஷன் அளவு பரிசோதனை,Lab Test Report,ஆய்வக சோதனை அறிக்கை,file,false,false,";

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "Inspection_Module_Hierarchy_Fields_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // CSV Bulk Upload Parsing
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

        // Robust CSV line parser
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

        const uploadedSubjects = [...inspectionSubjects];
        const uploadedCategories = [...inspectionCategories];
        const uploadedFields = [...inspectionFields];

        for (let i = 1; i < lines.length; i++) {
          const values = parseCsvLine(lines[i]);
          if (values.length < 4) continue;

          const [subjEn, subjTa, catEn, catTa, fldEn, fldTa, fldType, isMand, isUniq, dropOpts] = values;

          // Find or create subject
          let subjObj = uploadedSubjects.find(s => s.nameEn.toLowerCase() === subjEn.toLowerCase());
          if (!subjObj && subjEn) {
            subjObj = {
              id: 'subj_' + subjEn.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.random().toString(36).substr(2, 4),
              nameEn: subjEn,
              nameTa: subjTa || subjEn,
              description: 'Imported via CSV template',
              createdAt: new Date().toISOString()
            };
            uploadedSubjects.push(subjObj);
          }

          // Find or create category
          let catObj = null;
          if (subjObj && catEn) {
            catObj = uploadedCategories.find(c => c.subjectId === subjObj!.id && c.nameEn.toLowerCase() === catEn.toLowerCase());
            if (!catObj) {
              catObj = {
                id: 'cat_' + catEn.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.random().toString(36).substr(2, 4),
                subjectId: subjObj.id,
                nameEn: catEn,
                nameTa: catTa || catEn,
                createdAt: new Date().toISOString()
              };
              uploadedCategories.push(catObj);
            }
          }

          // Create field if provided
          if (catObj && fldEn) {
            const existingField = uploadedFields.find(f => f.categoryId === catObj!.id && f.nameEn.toLowerCase() === fldEn.toLowerCase());
            if (!existingField) {
              const validTypes = ['text', 'number', 'mobile', 'dropdown', 'yes_no', 'camera', 'file', 'date'];
              const normalizedType = validTypes.includes(fldType?.toLowerCase()) ? fldType.toLowerCase() : 'text';

              uploadedFields.push({
                id: 'fld_' + fldEn.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Math.random().toString(36).substr(2, 4),
                categoryId: catObj.id,
                nameEn: fldEn,
                nameTa: fldTa || fldEn,
                type: normalizedType,
                isMandatory: isMand?.toLowerCase() === 'true' || isMand === '1',
                isUnique: isUniq?.toLowerCase() === 'true' || isUniq === '1',
                options: normalizedType === 'dropdown' && dropOpts ? dropOpts.split(',').map(o => o.trim()).filter(Boolean) : undefined,
                createdAt: new Date().toISOString()
              });
            }
          }
        }

        await onSaveCollection('inspectionSubjects', uploadedSubjects);
        await onSaveCollection('inspectionCategories', uploadedCategories);
        await onSaveCollection('inspectionFields', uploadedFields);
        setCsvFeedback({ 
          type: 'success', 
          message: lang === 'ta' 
            ? 'CSV கோப்பு வெற்றிகரமாக பதிவேற்றப்பட்டது! ஆய்வுப் பிரிவுகள், வகைகள் மற்றும் புலங்கள் சேர்க்கப்பட்டன.' 
            : 'Inspection hierarchy CSV imported successfully! Created Subjects, Categories, and Dynamic Fields.' 
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

  const getFieldTypeIcon = (type: string) => {
    switch (type) {
      case 'number': return <Hash className="w-3.5 h-3.5 text-blue-500" />;
      case 'mobile': return <Phone className="w-3.5 h-3.5 text-emerald-500" />;
      case 'dropdown': return <ListFilter className="w-3.5 h-3.5 text-purple-500" />;
      case 'yes_no': return <CheckSquare className="w-3.5 h-3.5 text-amber-500" />;
      case 'camera': return <Camera className="w-3.5 h-3.5 text-rose-500" />;
      case 'file': return <FileUp className="w-3.5 h-3.5 text-indigo-500" />;
      case 'date': return <Calendar className="w-3.5 h-3.5 text-teal-500" />;
      default: return <Type className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const getFieldTypeLabel = (type: string) => {
    switch (type) {
      case 'number': return t('fieldTypeNumber');
      case 'mobile': return t('fieldTypeMobile');
      case 'dropdown': return t('fieldTypeDropdown');
      case 'yes_no': return t('fieldTypeYesNo');
      case 'camera': return t('fieldTypeCamera');
      case 'file': return t('fieldTypeFile');
      case 'date': return t('fieldTypeDate');
      default: return t('fieldTypeText');
    }
  };

  return (
    <div id="inspection-module-management-container" className="space-y-6">
      {/* Top Banner & Bulk Upload Controls */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <ClipboardCheck className="w-6 h-6 text-indigo-600" />
              {t('inspectionModuleManagement')}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {lang === 'ta' 
                ? 'கள ஆய்வுப் பிரிவுகள் (SWM மேலாண்மை போன்றவை), ஆய்வு வகைகள் (வீடு வீடாக ஆய்வு) மற்றும் டைனமிக் புலங்களை நிர்வகிக்கவும்.' 
                : 'Configure inspection subjects, category hierarchies, and custom inspection form fields (Camera, Mobile, Yes/No, etc.).'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={downloadInspectionCSVTemplate}
              className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-200 transition shadow-2xs"
            >
              <Download className="w-3.5 h-3.5" />
              {lang === 'ta' ? 'மாதிரி மாதிரி படிவம் பதிவிறக்கு (CSV)' : 'Download Bulk Model Template (CSV)'}
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

        {csvFeedback && (
          <div className={`p-4 rounded-xl border flex items-start gap-3 ${csvFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
            {csvFeedback.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> : <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
            <p className="text-xs font-medium">{csvFeedback.message}</p>
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-gray-100 bg-white px-6 pt-4 rounded-t-2xl shadow-xs gap-2">
        <button
          onClick={() => setActiveTab('subjects')}
          className={`pb-4 px-6 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${activeTab === 'subjects' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <FolderTree className="w-4 h-4" />
          {t('inspectionSubjects')} ({inspectionSubjects.length})
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`pb-4 px-6 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${activeTab === 'categories' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <ListFilter className="w-4 h-4" />
          {t('inspectionCategories')} ({inspectionCategories.length})
        </button>
        <button
          onClick={() => setActiveTab('fields')}
          className={`pb-4 px-6 text-sm font-semibold border-b-2 transition flex items-center gap-2 ${activeTab === 'fields' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Sparkles className="w-4 h-4" />
          {t('inspectionFields')} ({inspectionFields.length})
        </button>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Creation Forms */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
          {activeTab === 'subjects' && (
            <form onSubmit={handleAddSubject} className="space-y-4">
              <h4 className="font-semibold text-gray-900 text-sm border-b border-gray-100 pb-2">
                {t('addInspectionSubject')}
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('subjectNameEn')}</label>
                  <input
                    type="text"
                    value={subjectEn}
                    onChange={(e) => setSubjectEn(e.target.value)}
                    placeholder="e.g. SWM Management"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('subjectNameTa')}</label>
                  <input
                    type="text"
                    value={subjectTa}
                    onChange={(e) => setSubjectTa(e.target.value)}
                    placeholder="எ.கா. திடக்கழிவு மேலாண்மை"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">{lang === 'ta' ? 'விளக்கம்' : 'Description / Scope'}</label>
                  <textarea
                    value={subjectDesc}
                    onChange={(e) => setSubjectDesc(e.target.value)}
                    placeholder="Inspection subject scope & guidelines"
                    rows={2}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                {t('addInspectionSubject')}
              </button>
            </form>
          )}

          {activeTab === 'categories' && (
            <form onSubmit={handleAddCategory} className="space-y-4">
              <h4 className="font-semibold text-gray-900 text-sm border-b border-gray-100 pb-2">
                {t('addInspectionCategory')}
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('inspectionSubjects')}</label>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white"
                    required
                  >
                    <option value="">-- Choose Subject --</option>
                    {inspectionSubjects.map((s: any) => (
                      <option key={s.id} value={s.id}>{tObj(s)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('categoryNameEn')}</label>
                  <input
                    type="text"
                    value={categoryEn}
                    onChange={(e) => setCategoryEn(e.target.value)}
                    placeholder="e.g. Door to Door Survey"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('categoryNameTa')}</label>
                  <input
                    type="text"
                    value={categoryTa}
                    onChange={(e) => setCategoryTa(e.target.value)}
                    placeholder="எ.கா. வீடு வீடாக ஆய்வு"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                    required
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                {t('addInspectionCategory')}
              </button>
            </form>
          )}

          {activeTab === 'fields' && (
            <form onSubmit={handleAddField} className="space-y-4">
              <h4 className="font-semibold text-gray-900 text-sm border-b border-gray-100 pb-2">
                {t('addInspectionField')}
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('inspectionSubjects')}</label>
                  <select
                    value={fieldSubjectId}
                    onChange={(e) => {
                      setFieldSubjectId(e.target.value);
                      setFieldCategoryId('');
                    }}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white"
                    required
                  >
                    <option value="">-- Choose Subject --</option>
                    {inspectionSubjects.map((s: any) => (
                      <option key={s.id} value={s.id}>{tObj(s)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('inspectionCategories')}</label>
                  <select
                    value={fieldCategoryId}
                    onChange={(e) => setFieldCategoryId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white"
                    required
                  >
                    <option value="">-- Choose Category --</option>
                    {inspectionCategories
                      .filter((c: any) => !fieldSubjectId || c.subjectId === fieldSubjectId)
                      .map((c: any) => (
                        <option key={c.id} value={c.id}>{tObj(c)}</option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('fieldNameEn')}</label>
                  <input
                    type="text"
                    value={fieldNameEn}
                    onChange={(e) => setFieldNameEn(e.target.value)}
                    placeholder="e.g. Contact Mobile Number"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('fieldNameTa')}</label>
                  <input
                    type="text"
                    value={fieldNameTa}
                    onChange={(e) => setFieldNameTa(e.target.value)}
                    placeholder="எ.கா. தொடர்பு கைபேசி எண்"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('fieldType')}</label>
                  <select
                    value={fieldType}
                    onChange={(e) => setFieldType(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white"
                  >
                    <option value="text">{t('fieldTypeText')}</option>
                    <option value="number">{t('fieldTypeNumber')}</option>
                    <option value="mobile">{t('fieldTypeMobile')}</option>
                    <option value="dropdown">{t('fieldTypeDropdown')}</option>
                    <option value="yes_no">{t('fieldTypeYesNo')}</option>
                    <option value="camera">{t('fieldTypeCamera')}</option>
                    <option value="file">{t('fieldTypeFile')}</option>
                    <option value="date">{t('fieldTypeDate')}</option>
                  </select>
                </div>

                {fieldType === 'dropdown' && (
                  <div>
                    <label className="text-xs font-semibold text-gray-500">{t('fieldTypeDropdown')} (Comma-separated)</label>
                    <input
                      type="text"
                      value={dropdownOptions}
                      onChange={(e) => setDropdownOptions(e.target.value)}
                      placeholder={t('dropdownOptionsPlaceholder')}
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                      required
                    />
                  </div>
                )}

                <div className="pt-2 grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isMandatory}
                      onChange={(e) => setIsMandatory(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span className="text-xs font-semibold text-gray-700">{t('isMandatory')}</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isUnique}
                      onChange={(e) => setIsUnique(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span className="text-xs font-semibold text-gray-700">{t('isUnique')}</span>
                  </label>
                </div>

                {/* Conditional Quick Trigger (Skip to Camera for yes_no / dropdown) */}
                {(fieldType === 'yes_no' || fieldType === 'dropdown') && (
                  <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                      <Zap className="w-3.5 h-3.5 text-amber-600" />
                      <span>{lang === 'ta' ? 'நிபந்தனை விரைவு செயல்முறை (Conditional Action)' : 'Conditional Quick Action'}</span>
                    </div>
                    <p className="text-[11px] text-amber-700 leading-relaxed">
                      {lang === 'ta' 
                        ? 'மதிப்பு பொருந்தினால் மற்ற அனைத்து புலங்களையும் தவிர்த்து கேமராவை மட்டும் இயக்கலாம் (எ.கா: கதவு பூட்டப்பட்டுள்ளது = Yes)' 
                        : 'If this value is selected, skip text/mobile inputs and enable only Camera photo (e.g. Door Locked = Yes)'}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-amber-800">{lang === 'ta' ? 'செயல்முறை வகை' : 'Action Type'}</label>
                        <select
                          value={conditionalAction}
                          onChange={(e: any) => setConditionalAction(e.target.value)}
                          className="w-full border border-amber-300 rounded-lg p-2 text-xs mt-1 bg-white outline-none font-medium"
                        >
                          <option value="none">{lang === 'ta' ? 'எதுவுமில்லை (சாதாரண புலம்)' : 'None (Normal Field)'}</option>
                          <option value="skip_to_camera">{lang === 'ta' ? 'கேமரா மட்டும் இயக்கு (Skip to Camera)' : 'Skip to Camera Only'}</option>
                        </select>
                      </div>
                      {conditionalAction !== 'none' && (
                        <div>
                          <label className="text-[11px] font-semibold text-amber-800">{lang === 'ta' ? 'இயக்கும் மதிப்பு' : 'Trigger Value'}</label>
                          {fieldType === 'yes_no' ? (
                            <select
                              value={conditionalTriggerValue}
                              onChange={(e) => setConditionalTriggerValue(e.target.value)}
                              className="w-full border border-amber-300 rounded-lg p-2 text-xs mt-1 bg-white outline-none font-medium"
                            >
                              <option value="Yes">Yes / ஆம்</option>
                              <option value="No">No / இல்லை</option>
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={conditionalTriggerValue}
                              onChange={(e) => setConditionalTriggerValue(e.target.value)}
                              placeholder="e.g. Locked / ஆம்"
                              className="w-full border border-amber-300 rounded-lg p-2 text-xs mt-1 bg-white outline-none font-medium"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Conditional visibility based on parent field */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isConditional}
                      onChange={(e) => {
                        setIsConditional(e.target.checked);
                        if (!e.target.checked) {
                          setDependsOnFieldId('');
                          setDependsOnValue('');
                        }
                      }}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{lang === 'ta' ? 'மற்றொரு புலத்தின் அடிப்படையில் காட்டு (Conditional Visibility)' : 'Show conditionally based on another field'}</span>
                    </span>
                  </label>

                  {isConditional && (
                    <div className="space-y-2 pt-1 border-t border-slate-200">
                      <div>
                        <label className="text-[11px] font-semibold text-gray-600">{lang === 'ta' ? 'சார்ந்திருக்கும் தாய் புலம் (Parent Field)' : 'Parent Field in Category'}</label>
                        <select
                          value={dependsOnFieldId}
                          onChange={(e) => setDependsOnFieldId(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg p-2 text-xs mt-1 bg-white outline-none font-medium"
                          required={isConditional}
                        >
                          <option value="">-- Choose Parent Field --</option>
                          {inspectionFields
                            .filter((f: any) => f.categoryId === fieldCategoryId && (f.type === 'yes_no' || f.type === 'dropdown' || f.fieldType === 'yes_no' || f.fieldType === 'dropdown'))
                            .map((f: any) => (
                              <option key={f.id} value={f.id}>
                                {tObj(f)} ({getFieldTypeLabel(f.type)})
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-gray-600">{lang === 'ta' ? 'நிபந்தனை' : 'Condition'}</label>
                          <select
                            value={conditionType}
                            onChange={(e: any) => setConditionType(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-2 text-xs mt-1 bg-white outline-none font-medium"
                          >
                            <option value="show_if">{lang === 'ta' ? 'மதிப்பு சமமாக இருந்தால் காட்டு (Show if =)' : 'Show if equals'}</option>
                            <option value="hide_if">{lang === 'ta' ? 'மதிப்பு சமமாக இருந்தால் மறை (Hide if =)' : 'Hide if equals'}</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-gray-600">{lang === 'ta' ? 'இயக்கும் மதிப்பு' : 'Trigger Value'}</label>
                          <input
                            type="text"
                            value={dependsOnValue}
                            onChange={(e) => setDependsOnValue(e.target.value)}
                            placeholder="e.g. Yes or No"
                            className="w-full border border-gray-300 rounded-lg p-2 text-xs mt-1 bg-white outline-none font-medium"
                            required={isConditional}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                {t('addInspectionField')}
              </button>
            </form>
          )}
        </div>

        {/* Right Side: Hierarchical Overview and Lists */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div className="space-y-1">
              <h4 className="font-semibold text-gray-800 text-md flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-indigo-500" />
                {lang === 'ta' ? 'ஆய்வு படிநிலை & புலங்கள்' : 'Configured Inspection Structure'}
              </h4>
              <p className="text-xs text-gray-400">
                {inspectionSubjects.length} {lang === 'ta' ? 'பிரிவுகள்' : 'Subjects'} / {inspectionCategories.length} {lang === 'ta' ? 'வகைகள்' : 'Categories'} / {inspectionFields.length} {lang === 'ta' ? 'புலங்கள்' : 'Fields'}
              </p>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              {/* View toggle switcher buttons */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewMode('tree')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${viewMode === 'tree' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  {lang === 'ta' ? 'படிநிலை வடிவம்' : 'Tree View'}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${viewMode === 'table' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  {lang === 'ta' ? 'அட்டவணை வடிவம்' : 'Table View'}
                </button>
              </div>

              {/* Download Excel button */}
              <button
                type="button"
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-2 border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 font-semibold text-xs rounded-xl transition cursor-pointer"
                title={lang === 'ta' ? 'எக்செல் ஆக பதிவிறக்கு' : 'Download as Excel'}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{lang === 'ta' ? 'எக்செல்' : 'Excel'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-4 max-h-[580px] overflow-y-auto pr-2">
            {viewMode === 'tree' ? (
              <div className="space-y-4">
                {inspectionSubjects.map((subject: any, sIdx: number) => {
                  const subjectCats = inspectionCategories.filter((c: any) => c.subjectId === subject.id);

                  return (
                    <div key={subject.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50/70 space-y-3">
                      <div className="flex items-center justify-between bg-slate-200/50 p-2 rounded-lg">
                        <div>
                          <h5 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                            {tObj(subject)}
                          </h5>
                          {subject.description && (
                            <p className="text-[11px] text-gray-500 pl-4 mt-0.5">{subject.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {/* Subject move buttons */}
                          <button
                            type="button"
                            onClick={() => handleMoveSubject(sIdx, 'up')}
                            disabled={sIdx === 0}
                            className="p-1 hover:bg-white text-gray-500 hover:text-indigo-600 rounded disabled:opacity-30 disabled:pointer-events-none transition"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveSubject(sIdx, 'down')}
                            disabled={sIdx === inspectionSubjects.length - 1}
                            className="p-1 hover:bg-white text-gray-500 hover:text-indigo-600 rounded disabled:opacity-30 disabled:pointer-events-none transition"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-px h-4 bg-gray-300 mx-1"></span>
                          <button
                            onClick={() => setEditingSubject({ ...subject })}
                            className="p-1 hover:bg-white hover:text-indigo-600 text-gray-400 rounded transition"
                            title={lang === 'ta' ? 'திருத்து' : 'Edit Subject'}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSubject(subject.id)}
                            className="p-1 hover:bg-white hover:text-red-600 text-gray-400 rounded transition"
                            title="Delete Subject"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Categories under Subject */}
                      <div className="pl-4 space-y-2">
                        {subjectCats.map((cat: any, cIdx: number) => {
                          const catFields = inspectionFields.filter((f: any) => f.categoryId === cat.id);

                          return (
                            <div key={cat.id} className="bg-white border border-gray-100 rounded-xl p-3 space-y-2 shadow-2xs">
                              <div className="flex items-center justify-between bg-emerald-50/40 p-1.5 rounded-lg">
                                <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  {tObj(cat)}
                                  <span className="text-[10px] font-normal text-gray-400">
                                    ({catFields.length} {lang === 'ta' ? 'புலங்கள்' : 'fields'})
                                  </span>
                                </span>
                                <div className="flex items-center gap-1">
                                  {/* Category move buttons */}
                                  <button
                                    type="button"
                                    onClick={() => handleMoveCategory(subject.id, cIdx, 'up')}
                                    disabled={cIdx === 0}
                                    className="p-1 hover:bg-gray-100 text-gray-500 hover:text-emerald-600 rounded disabled:opacity-30 disabled:pointer-events-none transition"
                                    title="Move Up"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveCategory(subject.id, cIdx, 'down')}
                                    disabled={cIdx === subjectCats.length - 1}
                                    className="p-1 hover:bg-gray-100 text-gray-500 hover:text-emerald-600 rounded disabled:opacity-30 disabled:pointer-events-none transition"
                                    title="Move Down"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                  <span className="w-px h-3 bg-gray-200 mx-1"></span>
                                  <button
                                    onClick={() => setEditingCategory({ ...cat })}
                                    className="p-1 hover:bg-gray-100 hover:text-indigo-600 text-gray-400 rounded transition"
                                    title={lang === 'ta' ? 'திருத்து' : 'Edit Category'}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCategory(cat.id)}
                                    className="p-1 hover:bg-gray-100 hover:text-red-500 text-gray-400 rounded transition"
                                    title="Delete Category"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Fields inside Category */}
                              {catFields.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-gray-50">
                                  {catFields.map((field: any, fIdx: number) => (
                                    <div key={field.id} className="flex items-start justify-between p-2 bg-slate-50 border border-slate-100 rounded-lg">
                                      <div className="space-y-1">
                                        <div className="flex items-center gap-1.5">
                                          {getFieldTypeIcon(field.type)}
                                          <span className="text-xs font-semibold text-gray-800">{tObj(field)}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px]">
                                          <span className="bg-white px-1.5 py-0.5 rounded border border-gray-200 text-gray-600 font-medium">
                                            {getFieldTypeLabel(field.type)}
                                          </span>
                                          {field.isMandatory && (
                                            <span className="bg-rose-50 border border-rose-100 text-rose-600 px-1 py-0.5 rounded font-bold">
                                              *Req
                                            </span>
                                          )}
                                          {field.isUnique && (
                                            <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-1 py-0.5 rounded font-bold">
                                              Unique
                                            </span>
                                          )}
                                          {field.conditionalAction === 'skip_to_camera' && (
                                            <span className="bg-amber-100 border border-amber-300 text-amber-900 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                                              ⚡ {lang === 'ta' ? `கேமரா (${field.conditionalTriggerValue || 'Yes'})` : `Camera only (${field.conditionalTriggerValue || 'Yes'})`}
                                            </span>
                                          )}
                                          {field.dependsOnFieldId && (
                                            <span className="bg-blue-100 border border-blue-300 text-blue-900 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                                              🔗 {lang === 'ta' ? `நிபந்தனை: = ${field.dependsOnValue || ''}` : `Condition: = ${field.dependsOnValue || ''}`}
                                            </span>
                                          )}
                                        </div>
                                        {field.options && field.options.length > 0 && (
                                          <p className="text-[9px] text-gray-400 truncate max-w-[180px]">
                                            {field.options.join(', ')}
                                          </p>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        {/* Field move buttons */}
                                        <button
                                          type="button"
                                          onClick={() => handleMoveField(cat.id, fIdx, 'up')}
                                          disabled={fIdx === 0}
                                          className="p-1 hover:bg-white text-gray-500 hover:text-indigo-600 rounded disabled:opacity-30 disabled:pointer-events-none transition"
                                          title="Move Up"
                                        >
                                          <ArrowUp className="w-3 h-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleMoveField(cat.id, fIdx, 'down')}
                                          disabled={fIdx === catFields.length - 1}
                                          className="p-1 hover:bg-white text-gray-500 hover:text-indigo-600 rounded disabled:opacity-30 disabled:pointer-events-none transition"
                                          title="Move Down"
                                        >
                                          <ArrowDown className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => setEditingField({ 
                                            ...field, 
                                            options: Array.isArray(field.options) ? field.options.join(', ') : (field.options || ''),
                                            conditionalAction: field.conditionalAction || 'none',
                                            conditionalTriggerValue: field.conditionalTriggerValue || 'Yes',
                                            dependsOnFieldId: field.dependsOnFieldId || undefined,
                                            dependsOnValue: field.dependsOnValue || '',
                                            conditionType: field.conditionType || 'show_if'
                                          })}
                                          className="p-1 hover:bg-white hover:text-indigo-600 text-gray-400 rounded transition"
                                          title={lang === 'ta' ? 'திருத்து' : 'Edit Field'}
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteField(field.id)}
                                          className="p-1 hover:bg-white hover:text-red-600 text-gray-400 rounded transition"
                                          title="Delete Field"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[10px] text-gray-400 italic">
                                  {lang === 'ta' ? 'புலங்கள் இன்னும் சேர்க்கப்படவில்லை' : 'No dynamic fields added yet'}
                                </p>
                              )}
                            </div>
                          );
                        })}

                        {subjectCats.length === 0 && (
                          <p className="text-[11px] text-gray-400 italic pl-2">
                            {lang === 'ta' ? 'ஆய்வு துணைப்பிரிவுகள் எதுவும் இல்லை' : 'No categories configured under this subject'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Flat/Nested Table View of all configured fields */
              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-gray-700 font-bold border-b border-gray-200">
                      <th className="p-3">{lang === 'ta' ? 'வ.எண்' : 'S.No'}</th>
                      <th className="p-3">{lang === 'ta' ? 'ஆய்வுப் பிரிவு' : 'Subject'}</th>
                      <th className="p-3">{lang === 'ta' ? 'ஆய்வு வகை' : 'Category'}</th>
                      <th className="p-3">{lang === 'ta' ? 'புலத்தின் பெயர் (EN/TA)' : 'Field Name (EN/TA)'}</th>
                      <th className="p-3">{lang === 'ta' ? 'வகை' : 'Type'}</th>
                      <th className="p-3">{lang === 'ta' ? 'கட்டாயம்' : 'Required'}</th>
                      <th className="p-3">{lang === 'ta' ? 'செயல்பாடுகள்' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => {
                      let sNo = 1;
                      const rows: React.ReactNode[] = [];
                      inspectionSubjects.forEach((subject: any) => {
                        const subjectCats = inspectionCategories.filter((c: any) => c.subjectId === subject.id);
                        subjectCats.forEach((cat: any) => {
                          const catFields = inspectionFields.filter((f: any) => f.categoryId === cat.id);
                          catFields.forEach((field: any, fIdx: number) => {
                            rows.push(
                              <tr key={field.id} className="hover:bg-slate-50 transition">
                                <td className="p-3 font-mono tabular-nums text-gray-500">{sNo++}</td>
                                <td className="p-3 font-medium text-indigo-700">{tObj(subject)}</td>
                                <td className="p-3 font-medium text-emerald-700">{tObj(cat)}</td>
                                <td className="p-3">
                                  <div className="font-semibold text-gray-950">{field.nameEn || field.fieldName}</div>
                                  <div className="text-[10px] text-gray-500">{field.nameTa || field.fieldNameTa}</div>
                                  {field.conditionalAction === 'skip_to_camera' && (
                                    <div className="text-[10px] text-amber-800 font-bold flex items-center gap-1 mt-0.5">
                                      ⚡ {lang === 'ta' ? `கேமரா மட்டும் (${field.conditionalTriggerValue || 'Yes'})` : `Skip to Camera on ${field.conditionalTriggerValue || 'Yes'}`}
                                    </div>
                                  )}
                                  {field.dependsOnFieldId && (
                                    <div className="text-[10px] text-blue-800 font-bold flex items-center gap-1 mt-0.5">
                                      🔗 {lang === 'ta' ? `நிபந்தனை: = ${field.dependsOnValue || ''}` : `Condition: = ${field.dependsOnValue || ''}`}
                                    </div>
                                  )}
                                </td>
                                <td className="p-3">
                                  <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 font-medium">
                                    {getFieldTypeLabel(field.type)}
                                  </span>
                                </td>
                                <td className="p-3">
                                  {field.isMandatory ? (
                                    <span className="text-red-600 font-bold">{lang === 'ta' ? 'ஆம்' : 'Yes'}</span>
                                  ) : (
                                    <span className="text-gray-400">{lang === 'ta' ? 'இல்லை' : 'No'}</span>
                                  )}
                                </td>
                                <td className="p-3 flex items-center gap-1.5">
                                  {/* Move field triggers */}
                                  <button
                                    type="button"
                                    onClick={() => handleMoveField(cat.id, fIdx, 'up')}
                                    disabled={fIdx === 0}
                                    className="p-1 hover:bg-gray-100 text-gray-500 hover:text-indigo-600 rounded disabled:opacity-30 disabled:pointer-events-none transition"
                                    title="Move Up"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveField(cat.id, fIdx, 'down')}
                                    disabled={fIdx === catFields.length - 1}
                                    className="p-1 hover:bg-gray-100 text-gray-500 hover:text-indigo-600 rounded disabled:opacity-30 disabled:pointer-events-none transition"
                                    title="Move Down"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => setEditingField({ 
                                      ...field, 
                                      options: Array.isArray(field.options) ? field.options.join(', ') : (field.options || ''),
                                      conditionalAction: field.conditionalAction || 'none',
                                      conditionalTriggerValue: field.conditionalTriggerValue || 'Yes',
                                      dependsOnFieldId: field.dependsOnFieldId || undefined,
                                      dependsOnValue: field.dependsOnValue || '',
                                      conditionType: field.conditionType || 'show_if'
                                    })}
                                    className="p-1 hover:bg-gray-100 hover:text-indigo-600 text-gray-400 rounded transition"
                                    title={lang === 'ta' ? 'திருத்து' : 'Edit Field'}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteField(field.id)}
                                    className="p-1 hover:bg-gray-100 hover:text-red-600 text-gray-400 rounded transition"
                                    title="Delete Field"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </td>
                              </tr>
                            );
                          });
                        });
                      });
                      if (rows.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} className="p-6 text-center text-gray-400 italic">
                              {lang === 'ta' ? 'புலங்கள் இன்னும் சேர்க்கப்படவில்லை' : 'No dynamic fields configured yet'}
                            </td>
                          </tr>
                        );
                      }
                      return rows;
                    })()}
                  </tbody>
                </table>
              </div>
            )}

            {inspectionSubjects.length === 0 && (
              <div className="text-center py-12">
                <ClipboardCheck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400 italic">
                  {lang === 'ta' 
                    ? 'ஆய்வுப் பிரிவுகள் எதுவும் இல்லை. புதிய ஆய்வுப் பிரிவை உருவாக்கவும் அல்லது மாதிரி CSV கோப்பைப் பதிவேற்றவும்.' 
                    : 'No inspection subjects created yet. Add one above or use Bulk CSV Upload.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* EDIT SUBJECT MODAL */}
      {editingSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-600" />
                {lang === 'ta' ? 'ஆய்வுப் பிரிவை திருத்து (Edit Subject)' : 'Edit Inspection Subject'}
              </h3>
              <button onClick={() => setEditingSubject(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEditSubject} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600">{t('subjectNameEn')}</label>
                <input
                  type="text"
                  value={editingSubject.nameEn || ''}
                  onChange={(e) => setEditingSubject({ ...editingSubject, nameEn: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">{t('subjectNameTa')}</label>
                <input
                  type="text"
                  value={editingSubject.nameTa || ''}
                  onChange={(e) => setEditingSubject({ ...editingSubject, nameTa: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">{lang === 'ta' ? 'விளக்கம்' : 'Description'}</label>
                <textarea
                  value={editingSubject.description || ''}
                  onChange={(e) => setEditingSubject({ ...editingSubject, description: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingSubject(null)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT CATEGORY MODAL */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Pencil className="w-4 h-4 text-emerald-600" />
                {lang === 'ta' ? 'ஆய்வு வகையை திருத்து (Edit Category)' : 'Edit Inspection Category'}
              </h3>
              <button onClick={() => setEditingCategory(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEditCategory} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600">{t('inspectionSubjects')}</label>
                <select
                  value={editingCategory.subjectId || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, subjectId: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white"
                  required
                >
                  {inspectionSubjects.map((s: any) => (
                    <option key={s.id} value={s.id}>{tObj(s)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">{t('categoryNameEn')}</label>
                <input
                  type="text"
                  value={editingCategory.nameEn || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, nameEn: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">{t('categoryNameTa')}</label>
                <input
                  type="text"
                  value={editingCategory.nameTa || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, nameTa: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                  required
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT FIELD MODAL */}
      {editingField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-600" />
                {lang === 'ta' ? 'ஆய்வு புலத்தை திருத்து (Edit Field)' : 'Edit Inspection Field'}
              </h3>
              <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEditField} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600">{t('inspectionCategories')}</label>
                <select
                  value={editingField.categoryId || ''}
                  onChange={(e) => setEditingField({ ...editingField, categoryId: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white"
                  required
                >
                  {inspectionCategories.map((c: any) => (
                    <option key={c.id} value={c.id}>{tObj(c)}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600">{t('fieldNameEn')}</label>
                  <input
                    type="text"
                    value={editingField.nameEn || ''}
                    onChange={(e) => setEditingField({ ...editingField, nameEn: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600">{t('fieldNameTa')}</label>
                  <input
                    type="text"
                    value={editingField.nameTa || ''}
                    onChange={(e) => setEditingField({ ...editingField, nameTa: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">{t('fieldType')}</label>
                <select
                  value={editingField.type || 'text'}
                  onChange={(e) => setEditingField({ ...editingField, type: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white"
                >
                  <option value="text">{t('fieldTypeText')}</option>
                  <option value="number">{t('fieldTypeNumber')}</option>
                  <option value="mobile">{t('fieldTypeMobile')}</option>
                  <option value="dropdown">{t('fieldTypeDropdown')}</option>
                  <option value="yes_no">{t('fieldTypeYesNo')}</option>
                  <option value="camera">{t('fieldTypeCamera')}</option>
                  <option value="file">{t('fieldTypeFile')}</option>
                  <option value="date">{t('fieldTypeDate')}</option>
                </select>
              </div>
              {editingField.type === 'dropdown' && (
                <div>
                  <label className="text-xs font-semibold text-gray-600">{t('fieldTypeDropdown')} (Comma-separated)</label>
                  <input
                    type="text"
                    value={editingField.options || ''}
                    onChange={(e) => setEditingField({ ...editingField, options: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none"
                    placeholder="Wet Waste, Dry Waste, Hazardous Waste"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingField.isMandatory)}
                    onChange={(e) => setEditingField({ ...editingField, isMandatory: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-xs font-semibold text-gray-700">{t('isMandatory')}</span>
                </label>
                <label className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingField.isUnique)}
                    onChange={(e) => setEditingField({ ...editingField, isUnique: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-xs font-semibold text-gray-700">{t('isUnique')}</span>
                </label>
              </div>

              {/* Conditional Quick Trigger (Skip to Camera for yes_no / dropdown) */}
              {(editingField.type === 'yes_no' || editingField.type === 'dropdown') && (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <Zap className="w-3.5 h-3.5 text-amber-600" />
                    <span>{lang === 'ta' ? 'நிபந்தனை விரைவு செயல்முறை (Conditional Action)' : 'Conditional Quick Action'}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-semibold text-amber-800">{lang === 'ta' ? 'செயல்முறை வகை' : 'Action Type'}</label>
                      <select
                        value={editingField.conditionalAction || 'none'}
                        onChange={(e) => setEditingField({ ...editingField, conditionalAction: e.target.value })}
                        className="w-full border border-amber-300 rounded-lg p-2 text-xs mt-1 bg-white outline-none font-medium"
                      >
                        <option value="none">{lang === 'ta' ? 'எதுவுமில்லை' : 'None'}</option>
                        <option value="skip_to_camera">{lang === 'ta' ? 'கேமரா மட்டும் இயக்கு (Skip to Camera)' : 'Skip to Camera Only'}</option>
                      </select>
                    </div>
                    {editingField.conditionalAction && editingField.conditionalAction !== 'none' && (
                      <div>
                        <label className="text-[11px] font-semibold text-amber-800">{lang === 'ta' ? 'இயக்கும் மதிப்பு' : 'Trigger Value'}</label>
                        {editingField.type === 'yes_no' ? (
                          <select
                            value={editingField.conditionalTriggerValue || 'Yes'}
                            onChange={(e) => setEditingField({ ...editingField, conditionalTriggerValue: e.target.value })}
                            className="w-full border border-amber-300 rounded-lg p-2 text-xs mt-1 bg-white outline-none font-medium"
                          >
                            <option value="Yes">Yes / ஆம்</option>
                            <option value="No">No / இல்லை</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={editingField.conditionalTriggerValue || ''}
                            onChange={(e) => setEditingField({ ...editingField, conditionalTriggerValue: e.target.value })}
                            placeholder="e.g. Locked / ஆம்"
                            className="w-full border border-amber-300 rounded-lg p-2 text-xs mt-1 bg-white outline-none font-medium"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Conditional visibility based on parent field */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingField.dependsOnFieldId)}
                    onChange={(e) => {
                      if (!e.target.checked) {
                        setEditingField({ ...editingField, dependsOnFieldId: undefined, dependsOnValue: undefined, conditionType: undefined });
                      } else {
                        setEditingField({ ...editingField, dependsOnFieldId: '', dependsOnValue: 'Yes', conditionType: 'show_if' });
                      }
                    }}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <span className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{lang === 'ta' ? 'மற்றொரு புலத்தின் அடிப்படையில் காட்டு' : 'Show conditionally based on another field'}</span>
                  </span>
                </label>

                {editingField.dependsOnFieldId !== undefined && (
                  <div className="space-y-2 pt-1 border-t border-slate-200">
                    <div>
                      <label className="text-[11px] font-semibold text-gray-600">{lang === 'ta' ? 'சார்ந்திருக்கும் தாய் புலம்' : 'Parent Field in Category'}</label>
                      <select
                        value={editingField.dependsOnFieldId || ''}
                        onChange={(e) => setEditingField({ ...editingField, dependsOnFieldId: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2 text-xs mt-1 bg-white outline-none font-medium"
                      >
                        <option value="">-- Choose Parent Field --</option>
                        {inspectionFields
                          .filter((f: any) => f.categoryId === editingField.categoryId && f.id !== editingField.id && (f.type === 'yes_no' || f.type === 'dropdown' || f.fieldType === 'yes_no' || f.fieldType === 'dropdown'))
                          .map((f: any) => (
                            <option key={f.id} value={f.id}>
                              {tObj(f)} ({getFieldTypeLabel(f.type)})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-gray-600">{lang === 'ta' ? 'நிபந்தனை' : 'Condition'}</label>
                        <select
                          value={editingField.conditionType || 'show_if'}
                          onChange={(e) => setEditingField({ ...editingField, conditionType: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg p-2 text-xs mt-1 bg-white outline-none font-medium"
                        >
                          <option value="show_if">{lang === 'ta' ? 'மதிப்பு சமமாக இருந்தால் காட்டு' : 'Show if equals'}</option>
                          <option value="hide_if">{lang === 'ta' ? 'மதிப்பு சமமாக இருந்தால் மறை' : 'Hide if equals'}</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-gray-600">{lang === 'ta' ? 'இயக்கும் மதிப்பு' : 'Trigger Value'}</label>
                        <input
                          type="text"
                          value={editingField.dependsOnValue || ''}
                          onChange={(e) => setEditingField({ ...editingField, dependsOnValue: e.target.value })}
                          placeholder="e.g. Yes or No"
                          className="w-full border border-gray-300 rounded-lg p-2 text-xs mt-1 bg-white outline-none font-medium"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingField(null)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
                >
                  <Save className="w-3.5 h-3.5" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
