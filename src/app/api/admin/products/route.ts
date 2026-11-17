import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import {
  createProduct,
  enforceProductCap,
  getAllProducts,
  isDatabaseConfigured,
  MAX_CATALOG_PRODUCTS,
} from '@/db/products';
import { isAdminAuthenticated } from '@/lib/admin-auth';
import { DEFAULT_WORKSHOP_IMAGE } from '@/lib/catalog-actions';

function safeRevalidateHome(): void {
  try {
    revalidatePath('/');
  } catch {
    // Ignored outside Next.js request lifecycle.
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const products = await getAllProducts();
  return NextResponse.json({
    products,
    count: products.length,
    maxProducts: MAX_CATALOG_PRODUCTS,
    databaseConfigured: isDatabaseConfigured(),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAdminAuthenticated(request)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: 'POSTGRES_URL no está configurado.' },
      { status: 503 }
    );
  }

  try {
    const body = (await request.json()) as {
      title?: string;
      description?: string | null;
      price?: number;
      image_url?: string;
      in_stock?: boolean;
    };

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const price = Number(body.price);
    if (!title) {
      return NextResponse.json({ error: 'El nombre de la pieza es obligatorio.' }, { status: 400 });
    }
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: 'El precio debe ser un número entero válido.' }, { status: 400 });
    }

    const created = await createProduct({
      title,
      description: typeof body.description === 'string' ? body.description.trim() || null : null,
      price: Math.round(price),
      image_url:
        typeof body.image_url === 'string' && body.image_url.trim()
          ? body.image_url.trim()
          : DEFAULT_WORKSHOP_IMAGE,
      in_stock: body.in_stock !== undefined ? Boolean(body.in_stock) : true,
    });

    await enforceProductCap(MAX_CATALOG_PRODUCTS);
    safeRevalidateHome();

    return NextResponse.json({ product: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error creando pieza.' },
      { status: 500 }
    );
  }
}
