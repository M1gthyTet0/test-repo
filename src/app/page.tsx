import { getAllProducts } from '@/db/products';
import { CatalogView } from '@/components/CatalogView';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const products = await getAllProducts();
  return <CatalogView products={products} />;
}
