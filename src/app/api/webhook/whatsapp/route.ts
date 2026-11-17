import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  createProduct,
  enforceProductCap,
  getAllProducts,
  isDatabaseConfigured,
  markOutOfStock,
  updateProductByTitleOrId,
} from '@/db/products';
import { analyzeNormaMessage } from '@/lib/gemini-agent';
import { processIncomingMedia } from '@/lib/twilio-media';
import { buildTwimlResponse, checkAuthorization } from '@/lib/whatsapp-helpers';

const DEFAULT_WORKSHOP_IMAGE = '/images/cuenco-gres.svg';

function safeRevalidateHome(): void {
  try {
    revalidatePath('/');
  } catch {
    // Ignorado fuera del ciclo de request de Next.js (ej. tests unitarios).
  }
}

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

    const processedMedia = mediaUrl
      ? await processIncomingMedia(mediaUrl, mediaContentType)
      : undefined;

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

    let catalogChanged = false;
    let finalReply = action.reply_to_norma;

    if (action.intent !== 'UNKNOWN' && !isDatabaseConfigured()) {
      return buildTwimlResponse(
        `${action.reply_to_norma} (Nota: falta configurar POSTGRES_URL para guardar cambios en la base de datos.)`
      );
    }

    if (action.intent === 'CREATE') {
      if (!action.title || action.price === null) {
        return buildTwimlResponse(
          'Norma, para publicar la pieza necesito el nombre y el precio en pesos. ¿Me los pasás?'
        );
      }

      await createProduct({
        title: action.title,
        description: action.description,
        price: action.price,
        image_url: processedMedia?.blobUrl ?? DEFAULT_WORKSHOP_IMAGE,
        in_stock: true,
      });
      await enforceProductCap(15);
      catalogChanged = true;
    } else if (action.intent === 'UPDATE_PRICE') {
      const target = action.target_product_id ?? action.title;
      if (!target || action.price === null) {
        return buildTwimlResponse(
          'Norma, decime qué pieza querés actualizar y cuál es el nuevo precio.'
        );
      }

      const updated = await updateProductByTitleOrId(target, { price: action.price });
      if (!updated) {
        return buildTwimlResponse(
          'No encontré esa pieza en el catálogo. ¿Me decís el nombre exacto?'
        );
      }
      catalogChanged = true;
    } else if (action.intent === 'UPDATE_IMAGE') {
      const target = action.target_product_id ?? action.title;
      if (!target || !processedMedia?.blobUrl) {
        return buildTwimlResponse(
          'Norma, mandame la foto nueva junto con el nombre de la pieza que querés cambiar.'
        );
      }

      const updated = await updateProductByTitleOrId(target, {
        image_url: processedMedia.blobUrl,
      });
      if (!updated) {
        return buildTwimlResponse(
          'No encontré esa pieza en el catálogo para cambiarle la foto.'
        );
      }
      catalogChanged = true;
    } else if (action.intent === 'MARK_SOLD') {
      const target = action.target_product_id ?? action.title;
      if (!target) {
        return buildTwimlResponse(
          'Norma, ¿qué pieza se vendió? Decime el nombre así la marco.'
        );
      }

      const updated = await markOutOfStock(target);
      if (!updated) {
        return buildTwimlResponse(
          'No encontré esa pieza en el catálogo. ¿Me repetís el nombre?'
        );
      }
      catalogChanged = true;
    }

    if (catalogChanged) {
      safeRevalidateHome();
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
      if (siteUrl) {
        finalReply = `${finalReply}\nPodés verlo en: ${siteUrl}`;
      }
    }

    return buildTwimlResponse(finalReply);
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return buildTwimlResponse(
      'Hubo un problemita técnico en el taller. Intentá de nuevo en un ratito.',
      500
    );
  }
}
