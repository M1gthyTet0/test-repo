import { NextRequest, NextResponse } from 'next/server';
import {
  clearAdminSessionCookie,
  isAdminAuthenticated,
  isAdminConfigured,
  setAdminSessionCookie,
  verifyAdminPassword,
} from '@/lib/admin-auth';

export async function GET(request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({
    configured: isAdminConfigured(),
    authenticated: isAdminAuthenticated(request),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: 'ADMIN_PASSWORD no está configurado en el servidor.' },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as { password?: string };
    const password = typeof body.password === 'string' ? body.password : '';

    if (!verifyAdminPassword(password)) {
      return NextResponse.json(
        { error: 'Contraseña incorrecta.' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ ok: true });
    setAdminSessionCookie(response);
    return response;
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }
}

export async function DELETE(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true });
  clearAdminSessionCookie(response);
  return response;
}
