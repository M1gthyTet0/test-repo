import { NextRequest, NextResponse } from 'next/server';
import { getAllProducts } from '@/db/products';
import { applyAgentAction } from '@/lib/catalog-actions';
import { analyzeNormaMessage } from '@/lib/gemini-agent';
import { processIncomingMedia } from '@/lib/twilio-media';
import { buildTwimlResponse, checkAuthorization } from '@/lib/whatsapp-helpers';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const rawBody = await request.text();
    const params = new URLSearchParams(rawBody);

    const from = params.get('From') ?? '';
    const bodyText = params.get('Body') ?? '';
    const mediaUrl = params.get('MediaUrl0')?.trim() || '';
    const mediaContentType = params.get('MediaContentType0')?.trim() || undefined;

    const auth = checkAuthorization(from, bodyText);
    if (!auth.authorized) {
      return buildTwimlResponse(
        'Hola. Este número no está autorizado. Si estás probando el taller, empezá tu mensaje con la palabra DEMO.',
        403
      );
    }

    let processedMedia;
    if (mediaUrl) {
      try {
        processedMedia = await processIncomingMedia(mediaUrl, mediaContentType);
      } catch (mediaError) {
        console.warn('Twilio media download failed, continuing without media:', mediaError);
      }
    }

    const existingProducts = await getAllProducts();
    const action = await analyzeNormaMessage({
      text: auth.cleanedBody,
      media: processedMedia
        ? { buffer: processedMedia.buffer, mimeType: processedMedia.mimeType }
        : undefined,
      existingProducts: existingProducts.map((p) => ({
        id: p.id,
        title: p.title,
        price: p.price,
        in_stock: p.in_stock,
      })),
    });

    const finalReply = await applyAgentAction(action, processedMedia?.blobUrl);
    return buildTwimlResponse(finalReply);
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return buildTwimlResponse(
      'Hubo un problemita técnico en el taller. Intentá de nuevo en un ratito.',
      500
    );
  }
}
