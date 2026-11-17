import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getAllProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProductByTitleOrId: vi.fn(),
  deleteProductById: vi.fn(),
  enforceProductCap: vi.fn(),
  isDatabaseConfigured: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/db/products', () => ({
  MAX_CATALOG_PRODUCTS: 15,
  getAllProducts: mocks.getAllProducts,
  createProduct: mocks.createProduct,
  updateProductByTitleOrId: mocks.updateProductByTitleOrId,
  deleteProductById: mocks.deleteProductById,
  enforceProductCap: mocks.enforceProductCap,
  isDatabaseConfigured: mocks.isDatabaseConfigured,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { POST as loginPost } from '@/app/api/admin/auth/route';
import { GET as listProducts, POST as createProductRoute } from '@/app/api/admin/products/route';
import {
  PATCH as patchProductRoute,
  DELETE as deleteProductRoute,
} from '@/app/api/admin/products/[id]/route';
import { ADMIN_COOKIE_NAME } from '@/lib/admin-auth';

function extractSessionCookie(setCookieHeader: string | null): string {
  if (!setCookieHeader) return '';
  const match = setCookieHeader.match(new RegExp(`${ADMIN_COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : '';
}

describe('admin auth & CRUD API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_PASSWORD = 'super-secret-norma';
    mocks.isDatabaseConfigured.mockReturnValue(true);
    mocks.getAllProducts.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Cuenco Gres',
        description: 'Artesanal',
        price: 12000,
        image_url: '/images/cuenco-gres.svg',
        in_stock: true,
        created_at: '2026-11-17T00:00:00.000Z',
        updated_at: '2026-11-17T00:00:00.000Z',
      },
    ]);
  });

  it('rejects unauthenticated requests to /api/admin/products with 401', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/products');
    const res = await listProducts(req);
    expect(res.status).toBe(401);
  });

  it('authenticates with valid ADMIN_PASSWORD and allows CRUD operations', async () => {
    const badLogin = await loginPost(
      new NextRequest('http://localhost:3000/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong' }),
      })
    );
    expect(badLogin.status).toBe(401);

    const goodLogin = await loginPost(
      new NextRequest('http://localhost:3000/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'super-secret-norma' }),
      })
    );
    expect(goodLogin.status).toBe(200);
    const cookieVal = extractSessionCookie(goodLogin.headers.get('set-cookie'));
    expect(cookieVal.length).toBeGreaterThan(10);

    const authHeaders = {
      Cookie: `${ADMIN_COOKIE_NAME}=${cookieVal}`,
      'Content-Type': 'application/json',
    };

    const getRes = await listProducts(
      new NextRequest('http://localhost:3000/api/admin/products', { headers: authHeaders })
    );
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as { count: number; maxProducts: number };
    expect(getBody.count).toBe(1);
    expect(getBody.maxProducts).toBe(15);

    mocks.createProduct.mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Taza Nueva',
      price: 9500,
    });
    const postRes = await createProductRoute(
      new NextRequest('http://localhost:3000/api/admin/products', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ title: 'Taza Nueva', price: 9500 }),
      })
    );
    expect(postRes.status).toBe(201);
    expect(mocks.enforceProductCap).toHaveBeenCalledWith(15);

    mocks.updateProductByTitleOrId.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      in_stock: false,
    });
    const patchRes = await patchProductRoute(
      new NextRequest('http://localhost:3000/api/admin/products/11111111-1111-4111-8111-111111111111', {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ in_stock: false }),
      }),
      { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }) }
    );
    expect(patchRes.status).toBe(200);

    mocks.deleteProductById.mockResolvedValue(true);
    const delRes = await deleteProductRoute(
      new NextRequest('http://localhost:3000/api/admin/products/11111111-1111-4111-8111-111111111111', {
        method: 'DELETE',
        headers: authHeaders,
      }),
      { params: Promise.resolve({ id: '11111111-1111-4111-8111-111111111111' }) }
    );
    expect(delRes.status).toBe(200);
  });
});
