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
  const rawPhone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.trim() || '+5491112345678';
  const whatsappDigits = rawPhone.replace(/\D/g, '');
  const imagePart = product.image_url.startsWith('https://')
    ? ` ${product.image_url}`
    : '';
  const inquiryText = `Hola Norma, vi "${product.title}" a ${formatPrice(product.price)} y quería saber si está disponible.${imagePart}`;
  const inquiryHref = `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(inquiryText)}`;

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
          alt={
            product.description
              ? `${product.title} — ${product.description}`
              : product.title
          }
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
        <p className={styles.price} aria-label={`Precio: ${formatPrice(product.price)}`}>
          {formatPrice(product.price)}
        </p>
        {!isSold && (
          <a
            href={inquiryHref}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.inquiryLink}
            aria-label={`Consultar por ${product.title} por WhatsApp`}
          >
            Consultar por WhatsApp
          </a>
        )}
      </div>
    </article>
  );
}
