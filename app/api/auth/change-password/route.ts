import { NextRequest, NextResponse } from 'next/server';
import { getCollectionData, saveCollectionData, getEmployees, saveEmployee } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { username, currentPassword, newPassword } = await req.json();

    if (!username || !currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, message: 'Username, current password, and new password are required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, message: 'New password must be at least 6 characters long' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // 1. Check administrative users
    const users = (await getCollectionData('users')) as any[];
    const userIndex = users.findIndex(
      (u: any) =>
        (u.username && u.username.toLowerCase() === username.toLowerCase()) ||
        (u.id && u.id.toLowerCase() === username.toLowerCase()) ||
        (u.email && u.email.toLowerCase() === username.toLowerCase())
    );

    if (userIndex >= 0) {
      const user = users[userIndex];
      if (user.passwordHash !== currentPassword && user.password !== currentPassword) {
        return NextResponse.json(
          { success: false, message: 'Current password does not match' },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      users[userIndex].passwordHash = newPassword;
      users[userIndex].password = newPassword;
      await saveCollectionData('users', users);

      return NextResponse.json(
        { success: true, message: 'Password updated successfully' },
        { headers: CORS_HEADERS }
      );
    }

    // 2. Check employees
    const employees = (await getEmployees()) as any[];
    const emp = employees.find(
      (e: any) =>
        (e.employeeId && e.employeeId.toLowerCase() === username.toLowerCase()) ||
        (e.id && e.id.toLowerCase() === username.toLowerCase()) ||
        (e.username && e.username.toLowerCase() === username.toLowerCase()) ||
        (e.phone && e.phone === username)
    );

    if (emp) {
      if (emp.passwordHash !== currentPassword && emp.password !== currentPassword) {
        return NextResponse.json(
          { success: false, message: 'Current password does not match' },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      emp.passwordHash = newPassword;
      emp.password = newPassword;
      await saveEmployee(emp);

      return NextResponse.json(
        { success: true, message: 'Password updated successfully' },
        { headers: CORS_HEADERS }
      );
    }

    // 3. Check inspection users (mobile field inspection workers)
    const inspectionUsers = (await getCollectionData('inspectionUsers')) as any[];
    const inspIndex = inspectionUsers.findIndex(
      (u: any) =>
        (u.username && u.username.toLowerCase() === username.toLowerCase()) ||
        (u.mobile && u.mobile === username) ||
        (u.id && u.id.toLowerCase() === username.toLowerCase())
    );

    if (inspIndex >= 0) {
      const inspUser = inspectionUsers[inspIndex];
      const validCurrent =
        inspUser.password === currentPassword ||
        inspUser.passwordHash === currentPassword ||
        (!inspUser.password && !inspUser.passwordHash && currentPassword === 'pass123');

      if (!validCurrent) {
        return NextResponse.json(
          { success: false, message: 'Current password does not match' },
          { status: 400, headers: CORS_HEADERS }
        );
      }

      inspUser.password = newPassword;
      inspUser.passwordHash = newPassword;
      await saveCollectionData('inspectionUsers', inspectionUsers);

      return NextResponse.json(
        { success: true, message: 'Password updated successfully' },
        { headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { success: false, message: 'User not found' },
      { status: 404, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('Password change error:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to change password' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
