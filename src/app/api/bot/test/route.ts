import { NextRequest, NextResponse } from 'next/server';
import { getAllProducts } from '@/db/products';
import { isAdminAuthenticated, verifyAdminPassword } from '@/lib/admin-auth';
import { applyAgentAction } from '@/lib/catalog-actions';
import { analyzeNormaMessage } from '@/lib/gemini-agent';
import { uploadImageToBlob } from '@/lib/twilio-media';

function isAuthorized(request: NextRequest): boolean {
  if (isAdminAuthenticated(request)) return true;
  const authHeader = request.headers.get('authorization')?.trim() ?? '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    return verifyAdminPassword(token);
  }
  return false;
}

/**
 * Direct curl-friendly endpoint to test the multimodal Gemini + DB + Blob flow
 * with text, image, and/or audio without going through Telegram or Twilio.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: 'Unauthorized. Pass Authorization: Bearer <ADMIN_PASSWORD> or admin cookie.' },
      { status: 401 }
    );
  }

  try {
    const contentType = request.headers.get('content-type') ?? '';
    let text = '';
    let media: { buffer: Buffer; mimeType: string } | undefined;
    let blobUrl: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const rawText = formData.get('text');
      text = typeof rawText === 'string' ? rawText.trim() : '';

      const file = formData.get('file');
      if (file instanceof File && file.size > 0) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const mimeType = file.type || 'application/octet-stream';
        media = { buffer, mimeType };
        if (mimeType.startsWith('image/')) {
          blobUrl = await uploadImageToBlob(buffer, mimeType);
        }
      }
    } else {
      const body = (await request.json()) as { text?: string };
      text = typeof body.text === 'string' ? body.text.trim() : '';
    }

    const existingProducts = await getAllProducts();
    const action = await analyzeNormaMessage({
      text,
      media,
      existingProducts: existingProducts.map((p) => ({
        id: p.id,
        title: p.title,
        price: p.price,
        in_stock: p.in_stock,
      })),
    });

    const reply = await applyAgentAction(action, blobUrl);
    return NextResponse.json({
      ok: true,
      action,
      reply,
      imageUrl: blobUrl ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Test endpoint error' },
      { status: 500 }
    );
  }
}
