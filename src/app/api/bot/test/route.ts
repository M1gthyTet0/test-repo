import { NextRequest, NextResponse } from 'next/server';
import { getAllProducts } from '@/db/products';
import { isAdminAuthenticated, verifyAdminPassword } from '@/lib/admin-auth';
import { applyAgentAction } from '@/lib/catalog-actions';
import { analyzeNormaMessage } from '@/lib/gemini-agent';
import { uploadImageToBlob } from '@/lib/twilio-media';

export const maxDuration = 60;

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
    let imageUrlInput = '';
    let media: { buffer: Buffer; mimeType: string } | undefined;
    const extraMedia: Array<{ buffer: Buffer; mimeType: string }> = [];
    let blobUrl: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const rawText = formData.get('text');
      text = typeof rawText === 'string' ? rawText.trim() : '';
      const rawImageUrl = formData.get('imageUrl');
      imageUrlInput = typeof rawImageUrl === 'string' ? rawImageUrl.trim() : '';

      const imageField = formData.get('image') ?? formData.get('file');
      if (imageField instanceof File && imageField.size > 0) {
        const buffer = Buffer.from(await imageField.arrayBuffer());
        const mimeType = imageField.type || 'application/octet-stream';
        media = { buffer, mimeType };
        if (mimeType.startsWith('image/')) {
          blobUrl = await uploadImageToBlob(buffer, mimeType);
        }
      }

      const audioField = formData.get('audio');
      if (audioField instanceof File && audioField.size > 0) {
        const buffer = Buffer.from(await audioField.arrayBuffer());
        const mimeType = audioField.type || 'audio/webm';
        if (!media) {
          media = { buffer, mimeType };
        } else {
          extraMedia.push({ buffer, mimeType });
        }
      }
    } else {
      const body = (await request.json()) as { text?: string; imageUrl?: string };
      text = typeof body.text === 'string' ? body.text.trim() : '';
      imageUrlInput = typeof body.imageUrl === 'string' ? body.imageUrl.trim() : '';
    }

    if (!blobUrl && imageUrlInput.startsWith('https://')) {
      const imgRes = await fetch(imageUrlInput);
      if (imgRes.ok) {
        const buffer = Buffer.from(await imgRes.arrayBuffer());
        const mimeType =
          imgRes.headers.get('content-type')?.split(';')[0].trim() || 'image/jpeg';
        if (mimeType.startsWith('image/')) {
          if (!media) {
            media = { buffer, mimeType };
          } else {
            extraMedia.push({ buffer, mimeType });
          }
          blobUrl = imageUrlInput;
        }
      }
    }

    const existingProducts = await getAllProducts();
    const action = await analyzeNormaMessage({
      text,
      media,
      extraMedia: extraMedia.length > 0 ? extraMedia : undefined,
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
    console.error('Bot test error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Test endpoint error' },
      { status: 500 }
    );
  }
}
