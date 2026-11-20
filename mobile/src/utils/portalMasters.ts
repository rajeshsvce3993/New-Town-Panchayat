import type { PortalState, UserScopeData } from '../types/models';

/** Merge inspection masters from live userScope into portal (fields, categories, subjects, streets). */
export function mergeScopeMastersIntoPortal(portal: PortalState, scope?: UserScopeData | null): PortalState {
  if (!scope) return portal;
  const fields = scope.fields?.length ? scope.fields : portal.inspectionFields?.length ? portal.inspectionFields : portal.fields;
  return {
    ...portal,
    districts: scope.districts?.length ? scope.districts : portal.districts,
    townPanchayats: scope.townPanchayats?.length ? scope.townPanchayats : portal.townPanchayats,
    zones: scope.zones?.length ? scope.zones : portal.zones,
    inspectionSubjects: scope.subjects?.length ? scope.subjects : portal.inspectionSubjects,
    inspectionCategories: scope.categories?.length ? scope.categories : portal.inspectionCategories,
    inspectionFields: fields || [],
    subjects: scope.subjects?.length ? scope.subjects : portal.subjects,
    categories: scope.categories?.length ? scope.categories : portal.categories,
    fields: fields || [],
    wardsAndStreets: scope.wardsAndStreets?.length ? scope.wardsAndStreets : portal.wardsAndStreets,
    validationRules: scope.validationRules || portal.validationRules,
    scopeKind: scope.scopeKind || portal.scopeKind,
  };
}