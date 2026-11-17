import { describe, expect, it, vi } from 'vitest';
import {
  analyzeNormaMessage,
  parseAgentAction,
  type GenAIClientLike,
} from '@/lib/gemini-agent';

const sampleCatalog = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Cuenco de Gres Esmaltado',
    price: 15000,
    in_stock: true,
  },
];

describe('gemini-agent', () => {
  it('parses a CREATE action from text message', async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        intent: 'CREATE',
        target_product_id: null,
        title: 'Jarra de Arcilla Blanca',
        description: 'Jarra modelada a mano con esmalte natural de taller.',
        price: 18500,
        reply_to_norma: 'Listo Norma, ya publiqué la Jarra de Arcilla Blanca a $18.500.',
      }),
    });
    const mockClient: GenAIClientLike = { models: { generateContent } };

    const result = await analyzeNormaMessage(
      {
        text: 'Agregá una jarra de arcilla blanca a 18500 pesos',
        existingProducts: sampleCatalog,
      },
      mockClient
    );

    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(result.intent).toBe('CREATE');
    expect(result.title).toBe('Jarra de Arcilla Blanca');
    expect(result.price).toBe(18500);
    expect(result.reply_to_norma).toContain('Jarra de Arcilla Blanca');
  });

  it('sends inlineData when audio buffer is provided', async () => {
    const generateContent = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        intent: 'MARK_SOLD',
        target_product_id: '11111111-1111-4111-8111-111111111111',
        title: null,
        description: null,
        price: null,
        reply_to_norma: 'Anotado Norma, ya marqué el Cuenco de Gres Esmaltado como vendido.',
      }),
    });
    const mockClient: GenAIClientLike = { models: { generateContent } };

    const audioBuffer = Buffer.from('fake-ogg-audio');
    const result = await analyzeNormaMessage(
      {
        media: { buffer: audioBuffer, mimeType: 'audio/ogg' },
        existingProducts: sampleCatalog,
      },
      mockClient
    );

    expect(result.intent).toBe('MARK_SOLD');
    expect(result.target_product_id).toBe('11111111-1111-4111-8111-111111111111');

    const callArg = generateContent.mock.calls[0][0];
    const parts = callArg.contents[0].parts;
    expect(parts[0].inlineData).toEqual({
      data: audioBuffer.toString('base64'),
      mimeType: 'audio/ogg',
    });
  });

  it('returns UNKNOWN when both text and media are empty', async () => {
    const generateContent = vi.fn();
    const mockClient: GenAIClientLike = { models: { generateContent } };

    const result = await analyzeNormaMessage(
      { text: '   ', existingProducts: sampleCatalog },
      mockClient
    );

    expect(generateContent).not.toHaveBeenCalled();
    expect(result.intent).toBe('UNKNOWN');
  });

  it('normalizes malformed intent in parseAgentAction to UNKNOWN', () => {
    const parsed = parseAgentAction(
      JSON.stringify({
        intent: 'DELETE_ALL',
        reply_to_norma: 'No entendí eso.',
      })
    );
    expect(parsed.intent).toBe('UNKNOWN');
    expect(parsed.reply_to_norma).toBe('No entendí eso.');
  });
});
