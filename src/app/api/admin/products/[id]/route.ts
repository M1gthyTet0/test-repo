import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  deleteProductById,
  isDatabaseConfigured,
  updateProductByTitleOrId,
} from '@/db/products';
import { isAdminAuthenticated } from '@/lib/admin-auth';

function safeRevalidateHome(): void {
  try {
    revalidatePath('/');
  } catch {
    // Ignored outside Next.js request lifecycle.
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'POSTGRES_URL no está configurado.' }, { status: 503 });
  }

  const { id } = await context.params;
  try {
    const body = (await request.json()) as {
      title?: string;
      description?: string | null;
      price?: number;
      image_url?: string;
      in_stock?: boolean;
    };

    const updates: {
      title?: string;
      description?: string | null;
      price?: number;
      image_url?: string;
      in_stock?: boolean;
    } = {};

    if (body.title !== undefined) {
      if (!String(body.title).trim()) {
        return NextResponse.json({ error: 'El nombre no puede estar vacío.' }, { status: 400 });
      }
      updates.title = String(body.title).trim();
    }
    if (body.description !== undefined) {
      updates.description =
        body.description === null ? null : String(body.description).trim() || null;
    }
    if (body.price !== undefined) {
      const price = Number(body.price);
      if (!Number.isFinite(price) || price < 0) {
        return NextResponse.json({ error: 'Precio inválido.' }, { status: 400 });
      }
      updates.price = Math.round(price);
    }
    if (body.image_url !== undefined && String(body.image_url).trim()) {
      updates.image_url = String(body.image_url).trim();
    }
    if (body.in_stock !== undefined) {
      updates.in_stock = Boolean(body.in_stock);
    }

    const updated = await updateProductByTitleOrId(id, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Pieza no encontrada.' }, { status: 404 });
    }

    safeRevalidateHome();
    return NextResponse.json({ product: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error actualizando pieza.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'POSTGRES_URL no está configurado.' }, { status: 503 });
  }

  const { id } = await context.params;
  const deleted = await deleteProductById(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Pieza no encontrada.' }, { status: 404 });
  }

  safeRevalidateHome();
  return NextResponse.json({ ok: true });
}
