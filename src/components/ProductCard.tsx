import type { Product } from '@/db/products';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  product: Product;
  largeView?: boolean;
}

export function formatPrice(price: number): string {
  const formatted = Math.round(price)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$ ${formatted}`;
}

export function ProductCard({ product, largeView = false }: ProductCardProps) {
  const isSold = !product.in_stock;

  return (
    <article
      className={[
        styles.card,
        largeView ? styles.cardLarge : '',
        isSold ? styles.cardSold : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={styles.imageWrap}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image_url}
          alt={product.title}
          className={styles.image}
          loading="lazy"
        />
      </div>

      <div className={styles.body}>
        {isSold && <span className={styles.soldBadge}>Pieza única — Vendida</span>}
        <h2 className={styles.title}>{product.title}</h2>
        {product.description && (
          <p className={styles.description}>{product.description}</p>
        )}
        <p className={styles.price}>{formatPrice(product.price)}</p>
      </div>
    </article>
  );
}
