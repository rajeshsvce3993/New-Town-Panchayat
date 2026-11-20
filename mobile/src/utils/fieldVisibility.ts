import type { Category, FieldDefinition } from '../types/models';

export function fieldKey(f: FieldDefinition): string {
  const fk = (f as { fieldKey?: string }).fieldKey;
  if (fk?.trim()) return fk.trim();
  if (f.id?.trim()) return f.id.trim();
  if (f.fieldName?.trim()) return f.fieldName.trim();
  const name = (f.nameEn || f.nameTa || '').toString().replace(/\s*\*\s*$/, '').trim();
  return name;
}

/** React list key — always unique even when several fields share the same display name. */
export function stableFieldListKey(f: FieldDefinition, index: number): string {
  const id = String(f.id || (f as { fieldKey?: string }).fieldKey || '').trim();
  if (id) return id;
  const k = fieldKey(f);
  return k ? `${k}__${index}` : `field_${index}`;
}

function fieldSortRank(f: FieldDefinition): number {
  if (typeof f.order === 'number' && Number.isFinite(f.order)) return f.order;
  if (typeof f.sequence === 'number' && Number.isFinite(f.sequence)) return f.sequence;
  return Number.MAX_SAFE_INTEGER;
}

function normCatToken(v: unknown): string {
  return String(v ?? '').trim().toLowerCase();
}

function fieldCategoryTokens(f: FieldDefinition): string[] {
  const raw = f as FieldDefinition & {
    category_id?: string;
    inspectionCategoryId?: string;
    category?: string | { id?: string };
  };
  const tokens = [
    f.categoryId,
    raw.category_id,
    raw.inspectionCategoryId,
    raw.category && typeof raw.category === 'object' ? raw.category.id : raw.category,
  ];
  return [...new Set(tokens.map(normCatToken).filter(Boolean))];
}

/** Align with web `fieldMatchesCategory` / `workMatchesCategory` (id, code, English/Tamil names). */
export function fieldMatchesCategory(
  f: FieldDefinition,
  categoryId: string,
  categories: Category[] = [],
): boolean {
  const wanted = String(categoryId || '').trim();
  if (!wanted) return false;

  const wantedLower = normCatToken(wanted);
  const matchedCat =
    categories.find(
      (c) =>
        c.id === wanted ||
        normCatToken(c.id) === wantedLower ||
        normCatToken(c.code) === wantedLower ||
        normCatToken(c.nameEn) === wantedLower ||
        normCatToken(c.nameTa) === wantedLower,
    ) || null;

  const aliasSet = new Set<string>([wantedLower]);
  const addAlias = (v: unknown) => {
    const t = normCatToken(v);
    if (t) aliasSet.add(t);
  };
  addAlias(matchedCat?.id);
  addAlias(matchedCat?.code);
  addAlias(matchedCat?.nameEn);
  addAlias(matchedCat?.nameTa);

  const fieldTokens = fieldCategoryTokens(f);
  if (!fieldTokens.length) return false;
  if (fieldTokens.some((t) => aliasSet.has(t))) return true;

  for (const t of fieldTokens) {
    const ref = categories.find(
      (c) =>
        normCatToken(c.id) === t ||
        normCatToken(c.code) === t ||
        normCatToken(c.nameEn) === t ||
        normCatToken(c.nameTa) === t,
    );
    if (ref && aliasSet.has(normCatToken(ref.id))) return true;
  }
  return false;
}

/** Same order as Add Work: category fields, then master `order`/`sequence`. */
export function orderedCategoryFields(
  fields: FieldDefinition[],
  categoryId?: string,
  categories?: Category[],
): FieldDefinition[] {
  const wanted = String(categoryId || '').trim();
  if (!wanted || !fields.length) return [];

  const pool = categories?.length ? categories : [];
  const inCat = fields.filter((f) => fieldMatchesCategory(f, wanted, pool));
  return inCat
    .map((f, index) => ({ f, index }))
    .sort((a, b) => {
      const rank = fieldSortRank(a.f) - fieldSortRank(b.f);
      return rank !== 0 ? rank : a.index - b.index;
    })
    .map((x) => x.f);
}

export function fieldOrderIndex(fields: FieldDefinition[], key: string, categoryId?: string, categories?: Category[]): number {
  const k = String(key || '').trim().toLowerCase();
  if (!k) return Number.MAX_SAFE_INTEGER;
  const ordered = orderedCategoryFields(fields, categoryId, categories);
  const i = ordered.findIndex((f) =>
    [f.id, f.fieldName, f.nameEn, f.nameTa, f.fieldNameTa, fieldKey(f)].some(
      (x) => String(x || '').trim().toLowerCase() === k,
    ),
  );
  return i < 0 ? Number.MAX_SAFE_INTEGER : i;
}

export function fieldTypeNorm(f: FieldDefinition): string {
  return String(f.fieldType || f.type || '').trim().toLowerCase();
}

export function isCameraGalleryField(f: FieldDefinition): boolean {
  const t = fieldTypeNorm(f);
  return t === 'camera_gallery' || t === 'camera_or_gallery' || t === 'camera_and_gallery';
}

export function isCameraField(f: FieldDefinition): boolean {
  const t = fieldTypeNorm(f);
  return t === 'camera' || isCameraGalleryField(f);
}

export function isImageUploadField(f: FieldDefinition): boolean {
  const t = fieldTypeNorm(f);
  return (t === 'image' || t === 'image_upload' || t === 'gallery') && !isCameraGalleryField(f);
}

export function isPhotoInputField(f: FieldDefinition): boolean {
  return isCameraField(f) || isImageUploadField(f);
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