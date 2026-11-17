# Skill 02: Frontend del Catálogo (Estética Taller & Accesibilidad)

## Objetivo
Construir la interfaz pública de una sola página respetando el boceto minimalista de Norma, priorizando legibilidad para adultos mayores y estética artesanal.

## Pasos Incrementales
1. **Sistema de Diseño (`src/app/globals.css`):**
   - Paleta cálida de taller de cerámica: fondo crema/papel (`#FAF6F0`), tarjetas blanco hueso (`#FFFDF9`), texto carbón de alto contraste (`#1F1D1A`), acento terracota (`#B85D3B`).
   - Tipografía base mínima de `18px` en desktop y mobile, escalable con `clamp()`.
   - Cero frameworks CSS. Todo escrito con variables CSS y Grid/Flexbox nativos.
2. **Header Artesanal:**
   - Título principal del taller ("Taller de Cerámica — Norma") y una breve bajada cálida que refleje su espíritu de profesora de plástica y trabajo hecho a mano.
   - Instrucción simple en texto claro (no botón invasivo): *"Si te interesa alguna pieza, escribime por WhatsApp y coordinamos."*
3. **Toggle de Visualización (Grilla vs. Vista Grande):**
   - Un botón flotante o fijo de alto contraste y tamaño grande que permita alternar entre:
     - **Vista Cuadrícula:** 2 o 3 columnas en desktop, 1 o 2 en móvil.
     - **Vista Grande (Lectura fácil):** 1 tarjeta por fila a ancho completo con foto grande y precio destacado.
4. **Tarjeta de Producto (`ProductCard`):**
   - Mostrar exclusivamente: Imagen (aspect-ratio 1:1 o 4:3, `object-fit: cover`), Título, Descripción breve de taller y Precio formateado (`$ 15.000`).
   - Si `in_stock === false`, mostrar badge sutil `"Pieza única — Vendida"` con opacidad controlada, sin botón de compra ni carrito.
5. **Validación:** Verificar renderizado SSR desde PostgreSQL (con datos mockeados si la DB aún no tiene credenciales) y probar responsividad en mobile y desktop.
