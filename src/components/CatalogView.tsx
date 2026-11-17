'use client';

import { useState } from 'react';
import type { Product } from '@/db/products';
import { ProductCard } from './ProductCard';
import styles from './CatalogView.module.css';

interface CatalogViewProps {
  products: Product[];
}

export function CatalogView({ products }: CatalogViewProps) {
  const [largeView, setLargeView] = useState(false);

  return (
    <main className="page-shell">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Cerámica artesanal</p>
        <h1 className={styles.heading}>Taller de Cerámica — Norma</h1>
        <p className={styles.lead}>
          Cada pieza nace en mi mesa de taller, modelada a mano y horneada en pequeñas
          tandas con arcillas y esmaltes minerales.
        </p>
        <p className={styles.contactNote}>
          Si te interesa alguna pieza, escribime por WhatsApp y coordinamos.
        </p>
      </header>

      <div className={styles.toolbar}>
        <p className={styles.count}>
          {products.length === 1
            ? '1 pieza en el taller'
            : `${products.length} piezas en el taller`}
        </p>
        <button
          type="button"
          className={styles.toggleButton}
          onClick={() => setLargeView((prev) => !prev)}
          aria-pressed={largeView}
        >
          {largeView ? 'Ver en Cuadrícula' : 'Ver en Tamaño Grande'}
        </button>
      </div>

      {products.length === 0 ? (
        <div className={styles.emptyState}>
          Todavía no hay piezas publicadas en el catálogo.
        </div>
      ) : (
        <section
          aria-label="Catálogo de piezas de cerámica"
          className={largeView ? styles.listLarge : styles.grid}
        >
          {products.map((product) => (
            <ProductCard key={product.id} product={product} largeView={largeView} />
          ))}
        </section>
      )}

      <footer className={styles.footer}>
        Taller de Cerámica de la Tía Norma — Piezas únicas hechas a mano.
      </footer>
    </main>
  );
}
