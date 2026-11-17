import { NextResponse } from 'next/server';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildTwimlResponse(message: string, status = 200): NextResponse {
  const disableReply = process.env.DISABLE_WHATSAPP_REPLY?.trim().toLowerCase() === 'true';
  const xml = disableReply
    ? '<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>'
    : `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Message>${escapeXml(message)}</Message></Response>`;
  return new NextResponse(xml, {
    status,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
    },
  });
}

function normalizePhone(phone: string): string {
  return phone.trim().toLowerCase();
}

export function checkAuthorization(
  from: string,
  body: string
): { authorized: boolean; isDemo: boolean; cleanedBody: string } {
  const whitelistRaw = process.env.NORMA_PHONE_WHITELIST ?? '';
  const whitelist = whitelistRaw
    .split(',')
    .map(normalizePhone)
    .filter(Boolean);

  const normalizedFrom = normalizePhone(from);
  if (normalizedFrom && whitelist.includes(normalizedFrom)) {
    return { authorized: true, isDemo: false, cleanedBody: body.trim() };
  }

  const keyword = (process.env.SANDBOX_KEYWORD ?? 'DEMO').trim();
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const demoRegex = new RegExp(`^${escapedKeyword}(?:\\s*[:\\-]\\s*|\\s+|$)`, 'i');

  if (keyword && demoRegex.test(body.trim())) {
    const cleanedBody = body.trim().replace(demoRegex, '').trim();
    return { authorized: true, isDemo: true, cleanedBody };
  }

  return { authorized: false, isDemo: false, cleanedBody: body.trim() };
}
