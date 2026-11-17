import { ensureSchema, getAllProducts, createProduct, isDatabaseConfigured } from './products';
import { INITIAL_WORKSHOP_PRODUCTS } from './mock-products';

async function main() {
  if (!isDatabaseConfigured()) {
    console.error('Error: POSTGRES_URL no está configurado en .env.local o en el entorno.');
    process.exit(1);
  }

  await ensureSchema();
  const existing = await getAllProducts();

  if (existing.length > 0) {
    console.log(`La base de datos ya tiene ${existing.length} pieza(s). No se agregaron duplicados.`);
    return;
  }

  for (const item of INITIAL_WORKSHOP_PRODUCTS) {
    await createProduct(item);
    console.log(`Pieza creada: ${item.title} ($ ${item.price})`);
  }

  console.log('Seed completado con éxito.');
}

main().catch((err) => {
  console.error('Error ejecutando seed:', err);
  process.exit(1);
});
