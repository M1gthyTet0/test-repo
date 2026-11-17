import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getAllProducts: vi.fn(),
  createProduct: vi.fn(),
  updateProductByTitleOrId: vi.fn(),
  markOutOfStock: vi.fn(),
  enforceProductCap: vi.fn(),
  isDatabaseConfigured: vi.fn(),
  processIncomingMedia: vi.fn(),
  analyzeNormaMessage: vi.fn(),
  revalidatePath: vi.fn(),
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
  processIncomingMedia: mocks.processIncomingMedia,
}));

vi.mock('@/lib/gemini-agent', () => ({
  analyzeNormaMessage: mocks.analyzeNormaMessage,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { POST } from '@/app/api/webhook/whatsapp/route';
import { checkAuthorization } from '@/lib/whatsapp-helpers';

function makeTwilioRequest(formFields: Record<string, string>): NextRequest {
  const body = new URLSearchParams(formFields).toString();
  return new NextRequest('http://localhost:3000/api/webhook/whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

describe('whatsapp webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NORMA_PHONE_WHITELIST = 'whatsapp:+5491112345678';
    process.env.SANDBOX_KEYWORD = 'DEMO';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://taller-norma.vercel.app';
    mocks.isDatabaseConfigured.mockReturnValue(true);
    mocks.getAllProducts.mockResolvedValue([
      {
        id: '11111111-1111-4111-8111-111111111111',
        title: 'Cuenco de Gres Esmaltado',
        description: 'Cuenco artesanal',
        price: 15000,
        image_url: '/images/cuenco-gres.svg',
        in_stock: true,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    mocks.enforceProductCap.mockResolvedValue(0);
  });

  it('authorizes whitelisted numbers and DEMO keyword', () => {
    expect(checkAuthorization('whatsapp:+5491112345678', 'Hola').authorized).toBe(true);
    const demoAuth = checkAuthorization('whatsapp:+5491199999999', 'DEMO: Subir taza 12000');
    expect(demoAuth.authorized).toBe(true);
    expect(demoAuth.isDemo).toBe(true);
    expect(demoAuth.cleanedBody).toBe('Subir taza 12000');

    expect(checkAuthorization('whatsapp:+5491199999999', 'Hola').authorized).toBe(false);
  });

  it('rejects unauthorized sender with 403 TwiML', async () => {
    const req = makeTwilioRequest({
      From: 'whatsapp:+5491100000000',
      Body: 'Quiero borrar todo',
    });

    const res = await POST(req);
    const text = await res.text();

    expect(res.status).toBe(403);
    expect(res.headers.get('content-type')).toContain('text/xml');
    expect(text).toContain('<Response><Message>');
    expect(text).toContain('DEMO');
  });

  it('creates a product from image + text payload and revalidates home', async () => {
    mocks.processIncomingMedia.mockResolvedValue({
      buffer: Buffer.from('img-bytes'),
      mimeType: 'image/jpeg',
      blobUrl: 'https://abc.public.blob.vercel-storage.com/plato.jpg',
    });
    mocks.analyzeNormaMessage.mockResolvedValue({
      intent: 'CREATE',
      target_product_id: null,
      title: 'Plato Playo Rústico',
      description: 'Plato de gres esmaltado en tonos cálidos.',
      price: 14000,
      reply_to_norma: 'Listo Norma, publiqué el Plato Playo Rústico a $14.000.',
    });
    mocks.createProduct.mockResolvedValue({
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Plato Playo Rústico',
    });

    const req = makeTwilioRequest({
      From: 'whatsapp:+5491112345678',
      Body: 'Plato playo rústico a 14000',
      MediaUrl0: 'https://api.twilio.com/media/123',
      MediaContentType0: 'image/jpeg',
    });

    const res = await POST(req);
    const xml = await res.text();

    expect(res.status).toBe(200);
    expect(mocks.processIncomingMedia).toHaveBeenCalledWith(
      'https://api.twilio.com/media/123',
      'image/jpeg'
    );
    expect(mocks.createProduct).toHaveBeenCalledWith({
      title: 'Plato Playo Rústico',
      description: 'Plato de gres esmaltado en tonos cálidos.',
      price: 14000,
      image_url: 'https://abc.public.blob.vercel-storage.com/plato.jpg',
      in_stock: true,
    });
    expect(mocks.enforceProductCap).toHaveBeenCalledWith(15);
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/');
    expect(xml).toContain('Plato Playo Rústico');
    expect(xml).toContain('https://taller-norma.vercel.app');
  });

  it('processes audio payload to mark a product sold', async () => {
    mocks.processIncomingMedia.mockResolvedValue({
      buffer: Buffer.from('ogg-bytes'),
      mimeType: 'audio/ogg',
    });
    mocks.analyzeNormaMessage.mockResolvedValue({
      intent: 'MARK_SOLD',
      target_product_id: '11111111-1111-4111-8111-111111111111',
      title: null,
      description: null,
      price: null,
      reply_to_norma: 'Ya marqué el cuenco como vendido.',
    });
    mocks.markOutOfStock.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      in_stock: false,
    });

    const req = makeTwilioRequest({
      From: 'whatsapp:+5491199999999',
      Body: 'DEMO',
      MediaUrl0: 'https://api.twilio.com/media/audio1',
      MediaContentType0: 'audio/ogg',
    });

    const res = await POST(req);
    const xml = await res.text();

    expect(res.status).toBe(200);
    expect(mocks.markOutOfStock).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111'
    );
    expect(xml).toContain('Ya marqué el cuenco como vendido.');
  });

  it('updates price from text-only message', async () => {
    mocks.analyzeNormaMessage.mockResolvedValue({
      intent: 'UPDATE_PRICE',
      target_product_id: '11111111-1111-4111-8111-111111111111',
      title: null,
      description: null,
      price: 16500,
      reply_to_norma: 'Actualicé el precio del cuenco a $16.500.',
    });
    mocks.updateProductByTitleOrId.mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      price: 16500,
    });

    const req = makeTwilioRequest({
      From: 'whatsapp:+5491112345678',
      Body: 'Subí el cuenco de gres a 16500',
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mocks.updateProductByTitleOrId).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      { price: 16500 }
    );
  });
});
