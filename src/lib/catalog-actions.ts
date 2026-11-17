import { revalidatePath } from 'next/cache';
import {
  createProduct,
  enforceProductCap,
  isDatabaseConfigured,
  markOutOfStock,
  updateProductByTitleOrId,
} from '@/db/products';
import type { AgentAction } from '@/lib/gemini-agent';

export const DEFAULT_WORKSHOP_IMAGE = '/images/cuenco-gres.svg';

function safeRevalidateHome(): void {
  try {
    revalidatePath('/');
  } catch {
    // Ignored outside Next.js request lifecycle (e.g. unit tests).
  }
}

/**
 * Applies a structured Gemini agent action to the catalog database and returns
 * the user-facing confirmation or clarification message.
 */
export async function applyAgentAction(
  action: AgentAction,
  uploadedImageUrl?: string
): Promise<string> {
  if (action.intent !== 'UNKNOWN' && !isDatabaseConfigured()) {
    return `${action.reply_to_norma} (Nota: falta configurar POSTGRES_URL para guardar cambios en la base de datos.)`;
  }

  let catalogChanged = false;

  if (action.intent === 'CREATE') {
    if (!action.title || action.price === null) {
      return 'Norma, para publicar la pieza necesito el nombre y el precio en pesos. ¿Me los pasás?';
    }

    await createProduct({
      title: action.title,
      description: action.description,
      price: action.price,
      image_url: uploadedImageUrl ?? DEFAULT_WORKSHOP_IMAGE,
      in_stock: true,
    });
    await enforceProductCap(15);
    catalogChanged = true;
  } else if (action.intent === 'UPDATE_PRICE') {
    const target = action.target_product_id ?? action.title;
    if (!target || action.price === null) {
      return 'Norma, decime qué pieza querés actualizar y cuál es el nuevo precio.';
    }

    const updated = await updateProductByTitleOrId(target, { price: action.price });
    if (!updated) {
      return 'No encontré esa pieza en el catálogo. ¿Me decís el nombre exacto?';
    }
    catalogChanged = true;
  } else if (action.intent === 'UPDATE_IMAGE') {
    const target = action.target_product_id ?? action.title;
    if (!target || !uploadedImageUrl) {
      return 'Norma, mandame la foto nueva junto con el nombre de la pieza que querés cambiar.';
    }

    const updated = await updateProductByTitleOrId(target, {
      image_url: uploadedImageUrl,
    });
    if (!updated) {
      return 'No encontré esa pieza en el catálogo para cambiarle la foto.';
    }
    catalogChanged = true;
  } else if (action.intent === 'MARK_SOLD') {
    const target = action.target_product_id ?? action.title;
    if (!target) {
      return 'Norma, ¿qué pieza se vendió? Decime el nombre así la marco.';
    }

    const updated = await markOutOfStock(target);
    if (!updated) {
      return 'No encontré esa pieza en el catálogo. ¿Me repetís el nombre?';
    }
    catalogChanged = true;
  }

  let finalReply = action.reply_to_norma;
  if (catalogChanged) {
    safeRevalidateHome();
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (siteUrl) {
      finalReply = `${finalReply}\nPodés verlo en: ${siteUrl}`;
    }
  }

  return finalReply;
}
