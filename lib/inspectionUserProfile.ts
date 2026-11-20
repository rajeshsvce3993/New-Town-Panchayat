import type { Db } from 'mongodb';

const PROJ = { projection: { _id: 0, id: 1, nameEn: 1, nameTa: 1, code: 1 }, maxTimeMS: 4000 };

export type ResolvedInspectorProfile = {
  designationId: string;
  designation: string;
  designationNameEn: string;
  designationNameTa: string;
  roleId: string;
  role: string;
  roleNameTa: string;
  name: string;
  nameEn: string;
  nameTa: string;
};

function norm(v: unknown): string {
  return String(v ?? '').trim();
}

export async function resolveInspectorProfileFromDb(db: Db, user: any): Promise<ResolvedInspectorProfile> {
  const designationId = norm(user?.designationId || user?.designation);
  const roleId = norm(user?.roleId || user?.role);

  let designationNameEn = norm(user?.designationNameEn);
  let designationNameTa = norm(user?.designationNameTa);
  let designation = norm(user?.designation);

  if (designationId && !designationNameEn) {
    if (designation && designation !== designationId) designationNameEn = designation;
  }

  if (db && designationId) {
    try {
      const desig = await db.collection('inspectionDesignations').findOne(
        {
          $or: [
            { id: designationId },
            { code: designationId },
            { nameEn: designationId },
            { nameTa: designationId },
          ],
        },
        PROJ,
      );
      if (desig) {
        designationNameEn = norm(desig.nameEn) || designationNameEn;
        designationNameTa = norm(desig.nameTa) || designationNameTa;
      }
    } catch {
      /* ignore */
    }
  }

  if (!designationNameEn && designation && designation !== designationId) {
    designationNameEn = designation;
  }
  if (!designationNameTa) designationNameTa = designationNameEn;

  let roleNameEn = norm(user?.role);
  let roleNameTa = norm(user?.roleNameTa);

  if (db && roleId) {
    try {
      const role = await db.collection('inspectionRoles').findOne(
        {
          $or: [{ id: roleId }, { code: roleId }, { nameEn: roleId }, { nameTa: roleId }],
        },
        PROJ,
      );
      if (role) {
        roleNameEn = norm(role.nameEn) || roleNameEn;
        roleNameTa = norm(role.nameTa) || roleNameTa;
      }
    } catch {
      /* ignore */
    }
  }

  if (roleNameEn && /^role_|^desig_/i.test(roleNameEn)) {
    roleNameEn = roleNameTa || 'Inspection Officer';
  }

  const name = norm(user?.name || user?.nameEn || user?.employeeName || user?.username) || 'Officer';
  const nameEn = norm(user?.nameEn || user?.employeeNameEn || user?.name || user?.username) || name;
  const nameTa = norm(user?.nameTa || user?.employeeNameTa || user?.name || nameEn);

  return {
    designationId: designationId || '',
    designation: designationNameEn || designation || designationId,
    designationNameEn: designationNameEn || designation || '',
    designationNameTa: designationNameTa || designationNameEn || '',
    roleId: roleId || '',
    role: roleNameEn || 'Inspection Officer',
    roleNameTa: roleNameTa || 'அதிகாரி',
    name,
    nameEn,
    nameTa,
  };
}

export function applyResolvedProfileToUser(user: any, profile: ResolvedInspectorProfile): any {
  return {
    ...user,
    designationId: profile.designationId || user.designationId,
    designation: profile.designation,
    designationNameEn: profile.designationNameEn,
    designationNameTa: profile.designationNameTa,
    roleId: profile.roleId || user.roleId,
    role: profile.role,
    roleNameTa: profile.roleNameTa,
    name: profile.name,
    nameEn: profile.nameEn,
    nameTa: profile.nameTa,
  };
}