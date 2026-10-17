import type { FieldDefinition } from '../types/models';

export function fieldKey(f: FieldDefinition): string {
  return (f.fieldName && f.fieldName.length ? f.fieldName : f.nameEn || f.id || '').toString();
}

function fieldSortRank(f: FieldDefinition): number {
  if (typeof f.order === 'number' && Number.isFinite(f.order)) return f.order;
  if (typeof f.sequence === 'number' && Number.isFinite(f.sequence)) return f.sequence;
  return Number.MAX_SAFE_INTEGER;
}

/** Same order as Add Work: category fields, then master `order`/`sequence`. */
export function orderedCategoryFields(fields: FieldDefinition[], categoryId?: string): FieldDefinition[] {
  const wanted = String(categoryId || '').trim();
  const inCat = wanted ? fields.filter((f) => String(f.categoryId || '').trim() === wanted) : fields;
  const pool = inCat.length ? inCat : fields;
  return pool
    .map((f, index) => ({ f, index }))
    .sort((a, b) => {
      const rank = fieldSortRank(a.f) - fieldSortRank(b.f);
      return rank !== 0 ? rank : a.index - b.index;
    })
    .map((x) => x.f);
}

export function fieldOrderIndex(fields: FieldDefinition[], key: string, categoryId?: string): number {
  const k = String(key || '').trim().toLowerCase();
  if (!k) return Number.MAX_SAFE_INTEGER;
  const ordered = orderedCategoryFields(fields, categoryId);
  const i = ordered.findIndex((f) =>
    [f.id, f.fieldName, f.nameEn, f.nameTa, f.fieldNameTa, fieldKey(f)].some(
      (x) => String(x || '').trim().toLowerCase() === k,
    ),
  );
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
}

export function isCameraField(f: FieldDefinition): boolean {
  return (f.fieldType || '').toLowerCase() === 'camera' || (f.type || '').toLowerCase() === 'camera';
}

function yesNoMatch(currentVal: string, triggerVal: string): boolean {
  if (currentVal.toLowerCase() === triggerVal.toLowerCase()) return true;
  if (triggerVal.toLowerCase() === 'yes' && (currentVal === 'ஆம்' || currentVal.toLowerCase() === 'yes')) return true;
  if (triggerVal.toLowerCase() === 'no' && (currentVal === 'இல்லை' || currentVal.toLowerCase() === 'no')) return true;
  return false;
}

export function visibleDynamicFields(
  dynamicFields: FieldDefinition[],
  fieldValues: Record<string, string>
): FieldDefinition[] {
  const skipToCameraActive = dynamicFields.some((f) => {
    const key = fieldKey(f);
    const currentVal = (fieldValues[key] || '').trim();
    const triggerVal = (f.conditionalTriggerValue?.trim() || 'Yes') || 'Yes';
    const isAction = f.conditionalAction === 'skip_to_camera' || f.conditionalAction === 'hide_remaining';
    return isAction && yesNoMatch(currentVal, triggerVal);
  });

  return dynamicFields.filter((f) => {
    const cam = isCameraField(f);
    if (skipToCameraActive) {
      const isTrigger = f.conditionalAction === 'skip_to_camera' || f.conditionalAction === 'hide_remaining';
      if (!cam && !isTrigger) return false;
    }
    const parentId = f.dependsOnFieldId;
    if (parentId) {
      const parentField = dynamicFields.find(
        (p) => p.id === parentId || p.fieldName === parentId || p.nameEn === parentId
      );
      const parentKey = parentField ? fieldKey(parentField) : parentId;
      const parentVal = (fieldValues[parentKey] || '').trim();
      const targetVal = (f.dependsOnValue || '').trim();
      const matches = yesNoMatch(parentVal, targetVal);
      const isHideIf = (f.conditionType || '').toLowerCase() === 'hide_if';
      if (isHideIf) {
        if (matches) return false;
      } else if (!matches) {
        return false;
      }
    }
    return true;
  });
}
