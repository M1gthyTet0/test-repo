import { neon } from '@neondatabase/serverless';
import { INITIAL_WORKSHOP_PRODUCTS } from './mock-products';

export interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string;
  in_stock: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateProductInput {
  title: string;
  description?: string | null;
  price: number;
  image_url: string;
  in_stock?: boolean;
}

export interface UpdateProductInput {
  title?: string;
  description?: string | null;
  price?: number;
  image_url?: string;
  in_stock?: boolean;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isDatabaseConfigured(): boolean {
  const url = process.env.POSTGRES_URL?.trim();
  if (!url) return false;
  if (url.includes('user:password@host')) return false;
  return true;
}

function getSql() {
  const url = process.env.POSTGRES_URL?.trim();
  if (!url) {
    throw new Error('POSTGRES_URL is not configured in environment variables.');
  }
  return neon(url);
}

function normalizeProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    title: String(row.title),
    description: row.description === null || row.description === undefined ? null : String(row.description),
    price: Number(row.price),
    image_url: String(row.image_url),
    in_stock: Boolean(row.in_stock),
    created_at: new Date(String(row.created_at)).toISOString(),
    updated_at: new Date(String(row.updated_at)).toISOString(),
  };
}

export async function ensureSchema(): Promise<void> {
  const sql = getSql();
  await sql`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(120) NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      in_stock BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;
}

export async function getAllProducts(): Promise<Product[]> {
  if (!isDatabaseConfigured()) {
    const now = new Date('2026-01-15T12:00:00.000Z').toISOString();
    return INITIAL_WORKSHOP_PRODUCTS.map((item, idx) => ({
      id: `00000000-0000-4000-8000-00000000000${idx + 1}`,
      title: item.title,
      description: item.description,
      price: item.price,
      image_url: item.image_url,
      in_stock: item.in_stock,
      created_at: now,
      updated_at: now,
    }));
  }

  try {
    const sql = getSql();
    const rows = await sql`
      SELECT id, title, description, price, image_url, in_stock, created_at, updated_at
      FROM products
      ORDER BY created_at DESC;
    `;
    return rows.map((row) => normalizeProduct(row as Record<string, unknown>));
  } catch (error) {
    throw new Error(
      `Failed to fetch products from PostgreSQL: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  if (!input.title.trim()) {
    throw new Error('Product title is required.');
  }
  if (!Number.isFinite(input.price) || input.price < 0) {
    throw new Error('Product price must be a non-negative integer.');
  }
  if (!input.image_url.trim()) {
    throw new Error('Product image_url is required.');
  }

  const sql = getSql();
  const roundedPrice = Math.round(input.price);
  const inStock = input.in_stock ?? true;

  try {
    const rows = await sql`
      INSERT INTO products (title, description, price, image_url, in_stock)
      VALUES (
        ${input.title.trim().slice(0, 120)},
        ${input.description?.trim() ?? null},
        ${roundedPrice},
        ${input.image_url.trim()},
        ${inStock}
      )
      RETURNING id, title, description, price, image_url, in_stock, created_at, updated_at;
    `;
    if (rows.length === 0) {
      throw new Error('Insert returned no rows.');
    }
    return normalizeProduct(rows[0] as Record<string, unknown>);
  } catch (error) {
    throw new Error(
      `Failed to create product: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function findTargetProductId(identifier: string): Promise<string | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  const sql = getSql();
  if (UUID_REGEX.test(trimmed)) {
    const rows = await sql`SELECT id FROM products WHERE id = ${trimmed} LIMIT 1;`;
    return rows[0]?.id ? String(rows[0].id) : null;
  }

  const exactRows = await sql`
    SELECT id FROM products WHERE LOWER(title) = LOWER(${trimmed}) ORDER BY created_at DESC LIMIT 1;
  `;
  if (exactRows[0]?.id) {
    return String(exactRows[0].id);
  }

  const partialRows = await sql`
    SELECT id FROM products WHERE title ILIKE ${`%${trimmed}%`} ORDER BY created_at DESC LIMIT 1;
  `;
  return partialRows[0]?.id ? String(partialRows[0].id) : null;
}

export async function updateProductByTitleOrId(
  identifier: string,
  updates: UpdateProductInput
): Promise<Product | null> {
  const targetId = await findTargetProductId(identifier);
  if (!targetId) {
    return null;
  }

  const sql = getSql();
  const existingRows = await sql`
    SELECT id, title, description, price, image_url, in_stock
    FROM products
    WHERE id = ${targetId}
    LIMIT 1;
  `;
  if (existingRows.length === 0) {
    return null;
  }

  const current = existingRows[0] as Record<string, unknown>;
  const nextTitle = updates.title !== undefined ? updates.title.trim().slice(0, 120) : String(current.title);
  const nextDescription =
    updates.description !== undefined
      ? updates.description?.trim() ?? null
      : current.description === null
        ? null
        : String(current.description);
  const nextPrice =
    updates.price !== undefined && Number.isFinite(updates.price) && updates.price >= 0
      ? Math.round(updates.price)
      : Number(current.price);
  const nextImageUrl =
    updates.image_url !== undefined && updates.image_url.trim()
      ? updates.image_url.trim()
      : String(current.image_url);
  const nextInStock =
    updates.in_stock !== undefined ? updates.in_stock : Boolean(current.in_stock);

  try {
    const rows = await sql`
      UPDATE products
      SET
        title = ${nextTitle},
        description = ${nextDescription},
        price = ${nextPrice},
        image_url = ${nextImageUrl},
        in_stock = ${nextInStock},
        updated_at = NOW()
      WHERE id = ${targetId}
      RETURNING id, title, description, price, image_url, in_stock, created_at, updated_at;
    `;
    return rows[0] ? normalizeProduct(rows[0] as Record<string, unknown>) : null;
  } catch (error) {
    throw new Error(
      `Failed to update product: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function markOutOfStock(identifier: string): Promise<Product | null> {
  return updateProductByTitleOrId(identifier, { in_stock: false });
}

export async function enforceProductCap(maxProducts = 15): Promise<number> {
  const sql = getSql();
  const deleted = await sql`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn
      FROM products
    )
    DELETE FROM products
    WHERE id IN (SELECT id FROM ranked WHERE rn > ${maxProducts})
    RETURNING id;
  `;
  return deleted.length;
}
