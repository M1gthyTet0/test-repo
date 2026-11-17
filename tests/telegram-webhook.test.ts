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

import { POST } from '@/app/api/webhook/telegram/route';

function makeTelegramRequest(payload: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/webhook/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

describe('telegram webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://taller-norma.vercel.app';
    mocks.isDatabaseConfigured.mockReturnValue(true);
    mocks.getAllProducts.mockResolvedValue([]);
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
      text: async () => '',
    });
    vi.stubGlobal('fetch', mocks.fetch);
  });

  it('creates product from text message and replies via Telegram sendMessage', async () => {
    mocks.analyzeNormaMessage.mockResolvedValue({
      intent: 'CREATE',
      target_product_id: null,
      title: 'Jarra de Gres',
      description: 'Jarra artesanal esmaltada.',
      price: 16500,
      reply_to_norma: 'Listo Norma, ya publiqué la Jarra de Gres a $ 16.500.',
    });
    mocks.createProduct.mockResolvedValue({ id: 'new-1' });

    const res = await POST(
      makeTelegramRequest({
        message: {
          chat: { id: 999 },
          text: 'Agregá una jarra de gres a 16500',
        },
      })
    );

    expect(res.status).toBe(200);
    expect(mocks.createProduct).toHaveBeenCalledWith({
      title: 'Jarra de Gres',
      description: 'Jarra artesanal esmaltada.',
      price: 16500,
      image_url: '/images/cuenco-gres.svg',
      in_stock: true,
    });
    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-bot-token/sendMessage',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });

  it('downloads photo, uploads to Blob, and creates product with blob URL', async () => {
    mocks.fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, result: { file_path: 'photos/file_1.jpg' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => Buffer.from('fake-jpg').buffer,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
        text: async () => '',
      });
    mocks.uploadImageToBlob.mockResolvedValue('https://blob.vercel-storage.com/jarra.jpg');
    mocks.analyzeNormaMessage.mockResolvedValue({
      intent: 'CREATE',
      target_product_id: null,
      title: 'Taza Azul',
      description: 'Taza esmaltada azul.',
      price: 11000,
      reply_to_norma: 'Listo Norma, ya publiqué la Taza Azul.',
    });
    mocks.createProduct.mockResolvedValue({ id: 'new-2' });

    const res = await POST(
      makeTelegramRequest({
        message: {
          chat: { id: 999 },
          caption: 'Taza azul 11000',
          photo: [{ file_id: 'small' }, { file_id: 'large' }],
        },
      })
    );

    expect(res.status).toBe(200);
    expect(mocks.uploadImageToBlob).toHaveBeenCalledWith(expect.any(Buffer), 'image/jpeg');
    expect(mocks.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        image_url: 'https://blob.vercel-storage.com/jarra.jpg',
      })
    );
  });
});
