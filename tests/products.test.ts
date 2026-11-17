import { describe, expect, it } from 'vitest';
import { getAllProducts } from '@/db/products';
import { formatPrice } from '@/components/ProductCard';

describe('products and formatting', () => {
  it('formats integer ARS prices with thousands separator', () => {
    expect(formatPrice(15000)).toBe('$ 15.000');
    expect(formatPrice(950)).toBe('$ 950');
    expect(formatPrice(125000)).toBe('$ 125.000');
  });

  it('returns mock workshop products when POSTGRES_URL is not configured', async () => {
    const prev = process.env.POSTGRES_URL;
    delete process.env.POSTGRES_URL;
    try {
      const products = await getAllProducts();
      expect(products.length).toBe(4);
      expect(products[0].title).toBe('Cuenco de Gres Esmaltado');
    } finally {
      if (prev !== undefined) {
        process.env.POSTGRES_URL = prev;
      }
    }
  });
});
