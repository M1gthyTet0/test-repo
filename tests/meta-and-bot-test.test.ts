import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getAllProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProductByTitleOrId: vi.fn(),
  markOutOfStock: vi.fn(),
  enforceProductCap: vi.fn(),
  isDatabaseConfigured: vi.fn(),
  uploadImageToBlob: vi.fn(),
  analyzeNormaMessage: vi.fn(),
  revalidatePath: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@/db/products', () => ({
  getAllProducts: mocks.getAllProducts,
  createProduct: mocks.createProduct,
  updateProductByTitleOrId: mocks.updateProductByTitleOrId,
  markOutOfStock: mocks.markOutOfStock,
  enforceProductCap: mocks.enforceProductCap,
  isDatabaseConfigured: mocks.isDatabaseConfigured,
}));

vi.mock('@/lib/twilio-media', () => ({
  uploadImageToBlob: mocks.uploadImageToBlob,
}));

vi.mock('@/lib/gemini-agent', () => ({
  analyzeNormaMessage: mocks.analyzeNormaMessage,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { POST as botTestPost } from '@/app/api/bot/test/route';
import { GET as metaGet, POST as metaPost } from '@/app/api/webhook/meta/route';

describe('/api/bot/test & /api/webhook/meta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_PASSWORD = 'test-admin-password';
    process.env.META_VERIFY_TOKEN = 'my-verify-token';
    process.env.META_ACCESS_TOKEN = 'meta-token';
    process.env.META_PHONE_NUMBER_ID = '99887766';
    process.env.NORMA_PHONE_WHITELIST = 'whatsapp:+5491112345678';
    process.env.SANDBOX_KEYWORD = 'DEMO';
    mocks.isDatabaseConfigured.mockReturnValue(true);
    mocks.getAllProducts.mockResolvedValue([]);
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
      text: async () => '',
    });
    vi.stubGlobal('fetch', mocks.fetch);
  });

  it('rejects unauthenticated /api/bot/test and accepts Bearer ADMIN_PASSWORD', async () => {
    const unauth = await botTestPost(
      new NextRequest('http://localhost:3000/api/bot/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Hola' }),
      })
    );
    expect(unauth.status).toBe(401);

    mocks.analyzeNormaMessage.mockResolvedValue({
      intent: 'CREATE',
      target_product_id: null,
      title: 'Mate Cerámica',
      description: 'Mate hecho a mano.',
      price: 9000,
      reply_to_norma: 'Listo Norma.',
    });
    mocks.createProduct.mockResolvedValue({ id: '1' });

    const authRes = await botTestPost(
      new NextRequest('http://localhost:3000/api/bot/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-admin-password',
        },
        body: JSON.stringify({ text: 'Mate cerámica 9000' }),
      })
    );
    expect(authRes.status).toBe(200);
    const body = (await authRes.json()) as { ok: boolean; reply: string };
    expect(body.ok).toBe(true);
    expect(mocks.createProduct).toHaveBeenCalledTimes(1);
  });

  it('verifies Meta webhook handshake on GET and processes incoming text on POST', async () => {
    const verifyRes = await metaGet(
      new NextRequest(
        'http://localhost:3000/api/webhook/meta?hub.mode=subscribe&hub.verify_token=my-verify-token&hub.challenge=12345'
      )
    );
    expect(verifyRes.status).toBe(200);
    expect(await verifyRes.text()).toBe('12345');

    mocks.analyzeNormaMessage.mockResolvedValue({
      intent: 'CREATE',
      target_product_id: null,
      title: 'Plato Verde',
      description: 'Plato esmaltado verde.',
      price: 14000,
      reply_to_norma: 'Publicado el Plato Verde.',
    });
    mocks.createProduct.mockResolvedValue({ id: '2' });

    const postRes = await metaPost(
      new NextRequest('http://localhost:3000/api/webhook/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry: [
            {
              changes: [
                {
                  value: {
                    messages: [
                      {
                        from: '5491112345678',
                        type: 'text',
                        text: { body: 'Agregá plato verde a 14000' },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        }),
      })
    );
    expect(postRes.status).toBe(200);
    expect(mocks.createProduct).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://graph.facebook.com/v21.0/99887766/messages',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
