import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { AdminPanel } from '@/components/AdminPanel';
import { ADMIN_COOKIE_NAME, isAdminConfigured } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

function checkServerCookie(cookieVal: string | undefined): boolean {
  const secret = process.env.ADMIN_PASSWORD?.trim();
  if (!secret || !cookieVal) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update('norma-admin-authenticated')
    .digest('hex');
  const bufA = Buffer.from(cookieVal);
  const bufB = Buffer.from(expected);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export default async function AdminPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const authenticated = checkServerCookie(token);

  return (
    <AdminPanel
      initialAuthenticated={authenticated}
      initialConfigured={isAdminConfigured()}
    />
  );
}
