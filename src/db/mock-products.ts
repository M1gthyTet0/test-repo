export interface SeedProductInput {
  title: string;
  description: string;
  price: number;
  image_url: string;
  in_stock: boolean;
}

export const INITIAL_WORKSHOP_PRODUCTS: SeedProductInput[] = [
  {
    title: 'Cuenco de Gres Esmaltado',
    description:
      'Modelado a mano en torno alfarero, con esmalte mineral color arena y bordes cálidos.',
    price: 15000,
    image_url: '/images/cuenco-gres.svg',
    in_stock: true,
  },
  {
    title: 'Mate de Arcilla Terracota',
    description:
      'Pieza liviana de arcilla roja bruñida a mano, ideal para las tardes de taller.',
    price: 11500,
    image_url: '/images/mate-terracota.svg',
    in_stock: true,
  },
  {
    title: 'Taza Alta con Engobe Natural',
    description:
      'Taza de cerámica horneada a alta temperatura con textura orgánica en la base.',
    price: 13000,
    image_url: '/images/taza-esmalte.svg',
    in_stock: true,
  },
  {
    title: 'Florero Silvestre de Mesa',
    description:
      'Florero de cuello angosto con acabado mate y pinceladas suaves en tonos tierra.',
    price: 22000,
    image_url: '/images/florero-campo.svg',
    in_stock: false,
  },
];
