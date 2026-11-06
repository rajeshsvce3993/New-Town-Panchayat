'use client';
import ThemeSelect from './ThemeSelect';

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
  SlidersHorizontal,
  ChevronRight
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
  const [openSubjects, setOpenSubjects] = useState<Record<string, boolean>>({});
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

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

  const fieldTypeOf = (field: any) => field?.type || field?.fieldType || 'text';
  const nameEnOf = (obj: any) => obj?.nameEn || obj?.fieldName || '';
  const nameTaOf = (obj: any) => obj?.nameTa || obj?.fieldNameTa || '';
  const descOf = (obj: any) =>
    lang === 'ta'
      ? (obj?.descriptionTa || obj?.description || obj?.descriptionEn || '')
      : (obj?.descriptionEn || obj?.description || obj?.descriptionTa || '');
  const optionsOf = (field: any) =>
    Array.isArray(field?.options) ? field.options.filter(Boolean) : [];

  const SUBJECT_TONES = ['#1d4ed8', '#7c3aed', '#c2410c', '#0f766e', '#be185d', '#0369a1', '#b45309', '#4f46e5'];
  const CATEGORY_TONES = ['#0d9488', '#2563eb', '#d97706', '#db2777', '#059669', '#7c3aed', '#ea580c', '#0284c7'];

  const toggleSubject = (id: string) => {
    setOpenSubjects((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleCategory = (id: string) => {
    setOpenCategories((prev) => ({ ...prev, [id]: !prev[id] }));
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
    <div id="inspection-module-management-container" className="portal-studio">
      {/* Top Banner & Bulk Upload Controls */}
      <div className="portal-fis-hero">
        <div className="relative z-[1] flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/20">
            <ClipboardCheck className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 leading-tight">
            <h3 className="text-[14px] font-semibold tracking-tight text-white">
              {t('inspectionModuleManagement')}
            </h3>
            <p className="text-[10px] text-white/70">
              {lang === 'ta' 
                ? 'கள ஆய்வுப் பிரிவுகள், ஆய்வு வகைகள் மற்றும் டைனமிக் புலங்களை நிர்வகிக்கவும்.' 
                : 'Configure inspection subjects, categories, and custom form fields.'}
            </p>
          </div>
        </div>

          <div className="relative z-[1] flex shrink-0 items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={downloadInspectionCSVTemplate}
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

      <div className="portal-fis-body portal-page">
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
            onClick={() => setActiveTab('subjects')}
            className={`portal-dash-pill ${activeTab === 'subjects' ? 'is-active' : ''}`}
          >
            <FolderTree className="h-3.5 w-3.5" />
            <span>{t('inspectionSubjects')}</span>
            <span className="portal-fis-count">{inspectionSubjects.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`portal-dash-pill ${activeTab === 'categories' ? 'is-active' : ''}`}
          >
            <ListFilter className="h-3.5 w-3.5" />
            <span>{t('inspectionCategories')}</span>
            <span className="portal-fis-count">{inspectionCategories.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fields')}
            className={`portal-dash-pill ${activeTab === 'fields' ? 'is-active' : ''}`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t('inspectionFields')}</span>
            <span className="portal-fis-count">{inspectionFields.length}</span>
          </button>
        </div>
      </div>

      <div className="portal-wt-grid">
        <div className="portal-dashboard-panel">
          <div className="portal-dash-head">
            <div>
              <h3>
                <span className="portal-dash-icon">
                  <Plus className="h-3 w-3" />
                </span>
                {activeTab === 'subjects'
                  ? t('addInspectionSubject')
                  : activeTab === 'categories'
                    ? t('addInspectionCategory')
                    : t('addInspectionField')}
              </h3>
            </div>
          </div>
          <div className="portal-dash-body portal-wt-form">
          {activeTab === 'subjects' && (
            <form onSubmit={handleAddSubject} className="space-y-4">
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
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('inspectionSubjects')}</label>
                  <ThemeSelect
                    value={selectedSubjectId}
                    onChange={(e) => setSelectedSubjectId(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white"
                    required
                  >
                    <option value="">-- Choose Subject --</option>
                    {inspectionSubjects.map((s: any) => (
                      <option key={s.id} value={s.id}>{tObj(s)}</option>
                    ))}
                  </ThemeSelect>
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
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('inspectionSubjects')}</label>
                  <ThemeSelect
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
                  </ThemeSelect>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500">{t('inspectionCategories')}</label>
                  <ThemeSelect
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
                  </ThemeSelect>
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
                  <ThemeSelect
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
                  </ThemeSelect>
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
                        <ThemeSelect
                          value={conditionalAction}
                          onChange={(e: any) => setConditionalAction(e.target.value)}
                          className="w-full border border-amber-300 rounded-lg p-2 text-xs mt-1 bg-white outline-none font-medium"
                        >
                          <option value="none">{lang === 'ta' ? 'எதுவுமில்லை (சாதாரண புலம்)' : 'None (Normal Field)'}</option>
                          <option value="skip_to_camera">{lang === 'ta' ? 'கேமரா மட்டும் இயக்கு (Skip to Camera)' : 'Skip to Camera Only'}</option>
                        </ThemeSelect>
                      </div>
                      {conditionalAction !== 'none' && (
                        <div>
                          <label className="text-[11px] font-semibold text-amber-800">{lang === 'ta' ? 'இயக்கும் மதிப்பு' : 'Trigger Value'}</label>
                          {fieldType === 'yes_no' ? (
                            <ThemeSelect
                              value={conditionalTriggerValue}
                              onChange={(e) => setConditionalTriggerValue(e.target.value)}
                              className="w-full border border-amber-300 rounded-lg p-2 text-xs mt-1 bg-white outline-none font-medium"
                            >
                              <option value="Yes">Yes / ஆம்</option>
                              <option value="No">No / இல்லை</option>
                            </ThemeSelect>
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
                        <ThemeSelect
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
                                {tObj(f)} ({getFieldTypeLabel(fieldTypeOf(f))})
                              </option>
                            ))}
                        </ThemeSelect>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-gray-600">{lang === 'ta' ? 'நிபந்தனை' : 'Condition'}</label>
                          <ThemeSelect
                            value={conditionType}
                            onChange={(e: any) => setConditionType(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-2 text-xs mt-1 bg-white outline-none font-medium"
                          >
                            <option value="show_if">{lang === 'ta' ? 'மதிப்பு சமமாக இருந்தால் காட்டு (Show if =)' : 'Show if equals'}</option>
                            <option value="hide_if">{lang === 'ta' ? 'மதிப்பு சமமாக இருந்தால் மறை (Hide if =)' : 'Hide if equals'}</option>
                          </ThemeSelect>
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
        </div>

        <div className="portal-dashboard-panel">
          <div className="portal-dash-head">
            <div>
              <h3>
                <span className="portal-dash-icon">
                  <ClipboardCheck className="h-3 w-3" />
                </span>
                {lang === 'ta' ? 'ஆய்வு படிநிலை & புலங்கள்' : 'Configured Inspection Structure'}
              </h3>
              <p>
                {inspectionSubjects.length} {lang === 'ta' ? 'பிரிவுகள்' : 'Subjects'} / {inspectionCategories.length} {lang === 'ta' ? 'வகைகள்' : 'Categories'} / {inspectionFields.length} {lang === 'ta' ? 'புலங்கள்' : 'Fields'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="portal-dash-pills">
                <button
                  type="button"
                  onClick={() => setViewMode('tree')}
                  className={`portal-dash-pill ${viewMode === 'tree' ? 'is-active' : ''}`}
                >
                  {lang === 'ta' ? 'படிநிலை' : 'Tree'}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`portal-dash-pill ${viewMode === 'table' ? 'is-active' : ''}`}
                >
                  {lang === 'ta' ? 'அட்டவணை' : 'Table'}
                </button>
              </div>
              <button
                type="button"
                onClick={handleExportExcel}
                className="portal-dash-head-action"
                title={lang === 'ta' ? 'எக்செல் ஆக பதிவிறக்கு' : 'Download as Excel'}
              >
                <FileSpreadsheet className="h-3 w-3" />
                <span>{lang === 'ta' ? 'எக்செல்' : 'Excel'}</span>
              </button>
            </div>
          </div>

          <div className="portal-dash-body">
            {viewMode === 'tree' ? (
              <div className="portal-wt-tree">
                {inspectionSubjects.map((subject: any, sIdx: number) => {
                  const subjectCats = inspectionCategories.filter((c: any) => c.subjectId === subject.id);
                  const subjectOpen = Boolean(openSubjects[subject.id]);
                  const subjectTone = SUBJECT_TONES[sIdx % SUBJECT_TONES.length];

                  return (
                    <div
                      key={subject.id}
                      className={`portal-wt-node${subjectOpen ? ' is-open' : ''}`}
                      style={{ ['--wt-tone' as string]: subjectTone }}
                    >
                      <div className="portal-wt-node-head">
                        <button
                          type="button"
                          className="portal-wt-toggle"
                          onClick={() => toggleSubject(subject.id)}
                          aria-expanded={subjectOpen}
                        >
                          <ChevronRight className={`portal-wt-caret${subjectOpen ? ' is-open' : ''}`} />
                          <div className="portal-wt-copy">
                            <div className="portal-wt-title">
                              <span>{nameEnOf(subject) || tObj(subject)}</span>
                              <span className="portal-wt-count">
                                {subjectCats.length} {lang === 'ta' ? 'வகைகள்' : 'categories'}
                              </span>
                            </div>
                          </div>
                        </button>
                        <div className="portal-wt-actions">
                          <button
                            type="button"
                            onClick={() => handleMoveSubject(sIdx, 'up')}
                            disabled={sIdx === 0}
                            className="portal-fis-icon-btn is-muted"
                            title="Move Up"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveSubject(sIdx, 'down')}
                            disabled={sIdx === inspectionSubjects.length - 1}
                            className="portal-fis-icon-btn is-muted"
                            title="Move Down"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSubject({ ...subject })}
                            className="portal-fis-icon-btn"
                            title={lang === 'ta' ? 'திருத்து' : 'Edit Subject'}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSubject(subject.id)}
                            className="portal-fis-icon-btn is-danger"
                            title="Delete Subject"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {subjectOpen && (
                      <div className="portal-wt-cats">
                        {subjectCats.map((cat: any, cIdx: number) => {
                          const catFields = inspectionFields.filter((f: any) => f.categoryId === cat.id);
                          const categoryOpen = Boolean(openCategories[cat.id]);
                          const categoryTone = CATEGORY_TONES[cIdx % CATEGORY_TONES.length];

                          return (
                            <div
                              key={cat.id}
                              className={`portal-wt-cat${categoryOpen ? ' is-open' : ''}`}
                              style={{ ['--wt-tone' as string]: categoryTone }}
                            >
                              <div className="portal-wt-cat-head">
                                <button
                                  type="button"
                                  className="portal-wt-toggle"
                                  onClick={() => toggleCategory(cat.id)}
                                  aria-expanded={categoryOpen}
                                >
                                  <ChevronRight className={`portal-wt-caret${categoryOpen ? ' is-open' : ''}`} />
                                  <div className="portal-wt-copy">
                                    <div className="portal-wt-title">
                                      <span>{nameEnOf(cat) || tObj(cat)}</span>
                                      <span className="portal-wt-count">
                                        {catFields.length} {lang === 'ta' ? 'புலங்கள்' : 'fields'}
                                      </span>
                                    </div>
                                  </div>
                                </button>
                                <div className="portal-wt-actions">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveCategory(subject.id, cIdx, 'up')}
                                    disabled={cIdx === 0}
                                    className="portal-fis-icon-btn is-muted"
                                    title="Move Up"
                                  >
                                    <ArrowUp className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveCategory(subject.id, cIdx, 'down')}
                                    disabled={cIdx === subjectCats.length - 1}
                                    className="portal-fis-icon-btn is-muted"
                                    title="Move Down"
                                  >
                                    <ArrowDown className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingCategory({ ...cat })}
                                    className="portal-fis-icon-btn"
                                    title={lang === 'ta' ? 'திருத்து' : 'Edit Category'}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCategory(cat.id)}
                                    className="portal-fis-icon-btn is-danger"
                                    title="Delete Category"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>

                              {categoryOpen && (catFields.length > 0 ? (
                                <div className="portal-wt-fields">
                                  {catFields.map((field: any, fIdx: number) => (
                                    <div key={field.id} className="portal-wt-field">
                                      <div className="portal-wt-field-main">
                                        <div className="portal-wt-field-name">
                                          {getFieldTypeIcon(fieldTypeOf(field))}
                                          <span>{nameEnOf(field) || tObj(field)}</span>
                                        </div>
                                        {nameTaOf(field) && nameTaOf(field) !== nameEnOf(field) && (
                                          <p className="portal-wt-sub">{nameTaOf(field)}</p>
                                        )}
                                        <div className="portal-wt-flags">
                                          <span className="portal-dash-status is-progress">
                                            {getFieldTypeLabel(fieldTypeOf(field))}
                                          </span>
                                          {field.isMandatory && (
                                            <span className="portal-dash-status is-pending">
                                              {lang === 'ta' ? 'கட்டாயம்' : 'Required'}
                                            </span>
                                          )}
                                          {field.isUnique && (
                                            <span className="portal-dash-status is-progress">
                                              {lang === 'ta' ? 'தனித்துவம்' : 'Unique'}
                                            </span>
                                          )}
                                          {field.conditionalAction === 'skip_to_camera' && (
                                            <span className="portal-dash-status is-pending">
                                              {lang === 'ta' ? `கேமரா (${field.conditionalTriggerValue || 'Yes'})` : `Camera (${field.conditionalTriggerValue || 'Yes'})`}
                                            </span>
                                          )}
                                          {field.dependsOnFieldId && (
                                            <span className="portal-dash-status is-progress">
                                              {lang === 'ta' ? `நிபந்தனை = ${field.dependsOnValue || ''}` : `Condition = ${field.dependsOnValue || ''}`}
                                            </span>
                                          )}
                                        </div>
                                        {optionsOf(field).length > 0 && (
                                          <p className="portal-wt-options">
                                            {lang === 'ta' ? 'விருப்பங்கள்: ' : 'Options: '}
                                            {optionsOf(field).join(', ')}
                                          </p>
                                        )}
                                      </div>
                                      <div className="portal-wt-actions">
                                        <button
                                          type="button"
                                          onClick={() => handleMoveField(cat.id, fIdx, 'up')}
                                          disabled={fIdx === 0}
                                          className="portal-fis-icon-btn is-muted"
                                          title="Move Up"
                                        >
                                          <ArrowUp className="h-3 w-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleMoveField(cat.id, fIdx, 'down')}
                                          disabled={fIdx === catFields.length - 1}
                                          className="portal-fis-icon-btn is-muted"
                                          title="Move Down"
                                        >
                                          <ArrowDown className="h-3 w-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setEditingField({ 
                                            ...field, 
                                            options: Array.isArray(field.options) ? field.options.join(', ') : (field.options || ''),
                                            conditionalAction: field.conditionalAction || 'none',
                                            conditionalTriggerValue: field.conditionalTriggerValue || 'Yes',
                                            dependsOnFieldId: field.dependsOnFieldId || undefined,
                                            dependsOnValue: field.dependsOnValue || '',
                                            conditionType: field.conditionType || 'show_if'
                                          })}
                                          className="portal-fis-icon-btn"
                                          title={lang === 'ta' ? 'திருத்து' : 'Edit Field'}
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteField(field.id)}
                                          className="portal-fis-icon-btn is-danger"
                                          title="Delete Field"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="portal-wt-empty">
                                  {lang === 'ta' ? 'புலங்கள் இன்னும் சேர்க்கப்படவில்லை' : 'No dynamic fields added yet'}
                                </p>
                              ))}
                            </div>
                          );
                        })}

                        {subjectCats.length === 0 && (
                          <p className="portal-wt-empty">
                            {lang === 'ta' ? 'ஆய்வு துணைப்பிரிவுகள் எதுவும் இல்லை' : 'No categories configured under this subject'}
                          </p>
                        )}
                      </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="portal-dash-table">
                <table>
                  <thead>
                    <tr>
                      <th>{lang === 'ta' ? 'வ.எண்' : 'S.No'}</th>
                      <th>{lang === 'ta' ? 'ஆய்வுப் பிரிவு' : 'Subject'}</th>
                      <th>{lang === 'ta' ? 'ஆய்வு வகை' : 'Category'}</th>
                      <th>{lang === 'ta' ? 'புலத்தின் பெயர்' : 'Field Name'}</th>
                      <th>{lang === 'ta' ? 'வகை' : 'Type'}</th>
                      <th>{lang === 'ta' ? 'கட்டாயம்' : 'Required'}</th>
                      <th>{lang === 'ta' ? 'செயல்பாடுகள்' : 'Actions'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let sNo = 1;
                      const rows: React.ReactNode[] = [];
                      inspectionSubjects.forEach((subject: any) => {
                        const subjectCats = inspectionCategories.filter((c: any) => c.subjectId === subject.id);
                        subjectCats.forEach((cat: any) => {
                          const catFields = inspectionFields.filter((f: any) => f.categoryId === cat.id);
                          catFields.forEach((field: any, fIdx: number) => {
                            rows.push(
                              <tr key={field.id}>
                                <td className="portal-dash-id">{sNo++}</td>
                                <td>{tObj(subject)}</td>
                                <td>{tObj(cat)}</td>
                                <td>
                                  <div className="font-semibold text-slate-900">{nameEnOf(field)}</div>
                                  {nameTaOf(field) && (
                                    <div className="text-[11px] text-slate-500">{nameTaOf(field)}</div>
                                  )}
                                  {optionsOf(field).length > 0 && (
                                    <div className="text-[10px] text-slate-500 mt-0.5">
                                      {optionsOf(field).join(', ')}
                                    </div>
                                  )}
                                  {field.conditionalAction === 'skip_to_camera' && (
                                    <div className="text-[10px] text-amber-800 font-semibold mt-0.5">
                                      {lang === 'ta' ? `கேமரா மட்டும் (${field.conditionalTriggerValue || 'Yes'})` : `Skip to Camera on ${field.conditionalTriggerValue || 'Yes'}`}
                                    </div>
                                  )}
                                  {field.dependsOnFieldId && (
                                    <div className="text-[10px] text-slate-600 font-semibold mt-0.5">
                                      {lang === 'ta' ? `நிபந்தனை: = ${field.dependsOnValue || ''}` : `Condition: = ${field.dependsOnValue || ''}`}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <span className="portal-dash-status is-progress">
                                    {getFieldTypeLabel(fieldTypeOf(field))}
                                  </span>
                                </td>
                                <td>
                                  {field.isMandatory ? (
                                    <span className="portal-dash-num is-pending">{lang === 'ta' ? 'ஆம்' : 'Yes'}</span>
                                  ) : (
                                    <span className="text-slate-400">{lang === 'ta' ? 'இல்லை' : 'No'}</span>
                                  )}
                                </td>
                                <td>
                                  <div className="portal-wt-actions">
                                    <button
                                      type="button"
                                      onClick={() => handleMoveField(cat.id, fIdx, 'up')}
                                      disabled={fIdx === 0}
                                      className="portal-fis-icon-btn is-muted"
                                      title="Move Up"
                                    >
                                      <ArrowUp className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMoveField(cat.id, fIdx, 'down')}
                                      disabled={fIdx === catFields.length - 1}
                                      className="portal-fis-icon-btn is-muted"
                                      title="Move Down"
                                    >
                                      <ArrowDown className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingField({ 
                                        ...field, 
                                        options: Array.isArray(field.options) ? field.options.join(', ') : (field.options || ''),
                                        conditionalAction: field.conditionalAction || 'none',
                                        conditionalTriggerValue: field.conditionalTriggerValue || 'Yes',
                                        dependsOnFieldId: field.dependsOnFieldId || undefined,
                                        dependsOnValue: field.dependsOnValue || '',
                                        conditionType: field.conditionType || 'show_if'
                                      })}
                                      className="portal-fis-icon-btn"
                                      title={lang === 'ta' ? 'திருத்து' : 'Edit Field'}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteField(field.id)}
                                      className="portal-fis-icon-btn is-danger"
                                      title="Delete Field"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          });
                        });
                      });
                      if (rows.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} className="portal-wt-empty is-center">
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
              <div className="portal-wt-empty is-center">
                <ClipboardCheck className="mx-auto mb-1.5 h-8 w-8 text-slate-300" />
                <p>
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
        <div className="portal-modal-overlay">
          <div className="portal-modal p-6 w-full max-w-md">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-600" />
                {lang === 'ta' ? 'ஆய்வுப் பிரிவை திருத்து (Edit Subject)' : 'Edit Inspection Subject'}
              </h3>
              <button type="button" onClick={() => setEditingSubject(null)} className="portal-modal-close" aria-label="Close">
                <X className="w-4 h-4" />
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
        <div className="portal-modal-overlay">
          <div className="portal-modal p-6 w-full max-w-md">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Pencil className="w-4 h-4 text-emerald-600" />
                {lang === 'ta' ? 'ஆய்வு வகையை திருத்து (Edit Category)' : 'Edit Inspection Category'}
              </h3>
              <button type="button" onClick={() => setEditingCategory(null)} className="portal-modal-close" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEditCategory} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600">{t('inspectionSubjects')}</label>
                <ThemeSelect
                  value={editingCategory.subjectId || ''}
                  onChange={(e) => setEditingCategory({ ...editingCategory, subjectId: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white"
                  required
                >
                  {inspectionSubjects.map((s: any) => (
                    <option key={s.id} value={s.id}>{tObj(s)}</option>
                  ))}
                </ThemeSelect>
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
        <div className="portal-modal-overlay">
          <div className="portal-modal p-6 w-full max-w-lg overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Pencil className="w-4 h-4 text-indigo-600" />
                {lang === 'ta' ? 'ஆய்வு புலத்தை திருத்து (Edit Field)' : 'Edit Inspection Field'}
              </h3>
              <button type="button" onClick={() => setEditingField(null)} className="portal-modal-close" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEditField} className="mt-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600">{t('inspectionCategories')}</label>
                <ThemeSelect
                  value={editingField.categoryId || ''}
                  onChange={(e) => setEditingField({ ...editingField, categoryId: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm mt-1 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 outline-none bg-white"
                  required
                >
                  {inspectionCategories.map((c: any) => (
                    <option key={c.id} value={c.id}>{tObj(c)}</option>
                  ))}
                </ThemeSelect>
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
                <ThemeSelect
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
                </ThemeSelect>
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
                      <ThemeSelect
                        value={editingField.conditionalAction || 'none'}
                        onChange={(e) => setEditingField({ ...editingField, conditionalAction: e.target.value })}
                        className="w-full border border-amber-300 rounded-lg p-2 text-xs mt-1 bg-white outline-none font-medium"
                      >
                        <option value="none">{lang === 'ta' ? 'எதுவுமில்லை' : 'None'}</option>
                        <option value="skip_to_camera">{lang === 'ta' ? 'கேமரா மட்டும் இயக்கு (Skip to Camera)' : 'Skip to Camera Only'}</option>
                      </ThemeSelect>
                    </div>
                    {editingField.conditionalAction && editingField.conditionalAction !== 'none' && (
                      <div>
                        <label className="text-[11px] font-semibold text-amber-800">{lang === 'ta' ? 'இயக்கும் மதிப்பு' : 'Trigger Value'}</label>
                        {editingField.type === 'yes_no' ? (
                          <ThemeSelect
                            value={editingField.conditionalTriggerValue || 'Yes'}
                            onChange={(e) => setEditingField({ ...editingField, conditionalTriggerValue: e.target.value })}
                            className="w-full border border-amber-300 rounded-lg p-2 text-xs mt-1 bg-white outline-none font-medium"
                          >
                            <option value="Yes">Yes / ஆம்</option>
                            <option value="No">No / இல்லை</option>
                          </ThemeSelect>
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
                      <ThemeSelect
                        value={editingField.dependsOnFieldId || ''}
                        onChange={(e) => setEditingField({ ...editingField, dependsOnFieldId: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg p-2 text-xs mt-1 bg-white outline-none font-medium"
                      >
                        <option value="">-- Choose Parent Field --</option>
                        {inspectionFields
                          .filter((f: any) => f.categoryId === editingField.categoryId && f.id !== editingField.id && (f.type === 'yes_no' || f.type === 'dropdown' || f.fieldType === 'yes_no' || f.fieldType === 'dropdown'))
                          .map((f: any) => (
                            <option key={f.id} value={f.id}>
                              {tObj(f)} ({getFieldTypeLabel(fieldTypeOf(f))})
                            </option>
                          ))}
                      </ThemeSelect>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-semibold text-gray-600">{lang === 'ta' ? 'நிபந்தனை' : 'Condition'}</label>
                        <ThemeSelect
                          value={editingField.conditionType || 'show_if'}
                          onChange={(e) => setEditingField({ ...editingField, conditionType: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg p-2 text-xs mt-1 bg-white outline-none font-medium"
                        >
                          <option value="show_if">{lang === 'ta' ? 'மதிப்பு சமமாக இருந்தால் காட்டு' : 'Show if equals'}</option>
                          <option value="hide_if">{lang === 'ta' ? 'மதிப்பு சமமாக இருந்தால் மறை' : 'Hide if equals'}</option>
                        </ThemeSelect>
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
    </div>
  );
}
