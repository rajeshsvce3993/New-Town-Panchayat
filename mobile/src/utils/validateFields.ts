import type { FieldDefinition, InspectionWork, ValidationRule } from '../types/models';
import { fieldKey, isCameraField } from './fieldVisibility';

export function validateVisibleFields(opts: {
  fields: FieldDefinition[];
  values: Record<string, string>;
  rules?: Record<string, ValidationRule> | null;
  isTamil: boolean;
  works: InspectionWork[];
  categoryId: string;
}): string | null {
  const { fields, values, rules, isTamil, works, categoryId } = opts;
  for (const field of fields) {
    const key = fieldKey(field);
    const enteredValue = (values[key] || '').trim();
    const serverRule = rules?.[field.id || ''] || rules?.[key];
    const rawLabel = isTamil
      ? field.fieldNameTa || field.nameTa || key
      : field.nameEn || key;
    const label = rawLabel.replace(/\s*\*\s*$/, '');
    const isMandatory =
      !!field.isRequired ||
      field.isMandatory === true ||
      serverRule?.required === true ||
      serverRule?.mandatory === true ||
      (field.fieldName || '').toLowerCase().includes('required') ||
      (field.fieldName || '').toLowerCase().includes('mandatory') ||
      label.includes('*');

    if (isMandatory && !enteredValue && !isCameraField(field)) {
      return isTamil
        ? serverRule?.errorMessageTa || `பிழை: ${label} கட்டாய புலமாகும்!`
        : serverRule?.errorMessageEn || `Error: ${label} is a mandatory field!`;
    }
    if (isMandatory && isCameraField(field) && !enteredValue) {
      return isTamil
        ? serverRule?.errorMessageTa || `பிழை: ${label} கட்டாய புலமாகும்!`
        : serverRule?.errorMessageEn || `Error: ${label} is a mandatory field!`;
    }

    const minLen =
      serverRule?.minLength ??
      ((field.fieldType || '').toLowerCase().includes('mobile') || label.toLowerCase().includes('mobile') ? 10 : 0);
    if (minLen > 0 && enteredValue && enteredValue.length < minLen) {
      return isTamil
        ? `${label} குறைந்தபட்சம் ${minLen} எழுத்துக்களை/இலக்கங்களை கொண்டிருக்க வேண்டும்!`
        : `${label} must be at least ${minLen} characters!`;
    }
    const maxLen =
      serverRule?.maxLength ??
      ((field.fieldType || '').toLowerCase().includes('mobile') || label.toLowerCase().includes('mobile') ? 10 : 0);
    if (maxLen > 0 && enteredValue && enteredValue.length > maxLen) {
      return isTamil
        ? `${label} அதிகபட்சம் ${maxLen} எழுத்துக்களை மட்டுமே கொண்டிருக்க முடியும்!`
        : `${label} cannot exceed ${maxLen} characters!`;
    }
    if (serverRule?.pattern && enteredValue) {
      try {
        if (!new RegExp(serverRule.pattern).test(enteredValue)) {
          return isTamil ? `${label} சரியான வடிவத்தில் இல்லை!` : `Error: ${label} format is invalid!`;
        }
      } catch {
        /* ignore bad regex */
      }
    }
    const unique =
      serverRule?.unique === true ||
      (field.fieldName || '').toLowerCase().includes('unique') ||
      (field.fieldNameTa || '').toLowerCase().includes('unique') ||
      (field.nameEn || '').toLowerCase().includes('unique') ||
      label.toLowerCase().includes('unique');
    if (unique && enteredValue) {
      const exists = works.some(
        (w) =>
          w.categoryId === categoryId &&
          String(w.fieldsData[key] ?? '')
            .trim()
            .toLowerCase() === enteredValue.toLowerCase()
      );
      if (exists) {
        return isTamil
          ? `பிழை: இந்த தனித்துவமான மதிப்பு (${enteredValue}) ஏற்கனவே உள்ளது!`
          : `Error: This unique value (${enteredValue}) already exists in this subject!`;
      }
    }
  }
  return null;
}
