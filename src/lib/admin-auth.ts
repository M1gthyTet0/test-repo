import crypto from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';

export const ADMIN_COOKIE_NAME = 'norma_admin_session';
const SESSION_PAYLOAD = 'norma-admin-authenticated';

function getAdminSecret(): string | null {
  const password = process.env.ADMIN_PASSWORD?.trim();
  return password || null;
}

export function isAdminConfigured(): boolean {
  return getAdminSecret() !== null;
}

function signToken(secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(SESSION_PAYLOAD)
    .digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyAdminPassword(candidate: string): boolean {
  const secret = getAdminSecret();
  if (!secret) return false;
  return safeEqual(candidate.trim(), secret);
}

export function isAdminAuthenticated(request: NextRequest): boolean {
  const secret = getAdminSecret();
  if (!secret) return false;
  const cookieValue = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!cookieValue) return false;
  return safeEqual(cookieValue, signToken(secret));
}

export function setAdminSessionCookie(response: NextResponse): void {
  const secret = getAdminSecret();
  if (!secret) return;
  response.cookies.set(ADMIN_COOKIE_NAME, signToken(secret), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearAdminSessionCookie(response: NextResponse): void {
  response.cookies.set(ADMIN_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}
