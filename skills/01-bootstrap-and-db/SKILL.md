---
name: 01-bootstrap-and-db
description: Inicializa el proyecto Next.js con TypeScript y CSS puro, configura las variables de entorno, define el esquema de PostgreSQL y prepara el repositorio de productos y storage en Vercel Blob.
---

# Skill 01: Inicialización del Proyecto y Esquema de Base de Datos

## Objetivo
Configurar el proyecto Next.js con TypeScript y CSS puro, definir el esquema de PostgreSQL y preparar las capas de acceso a datos y almacenamiento de imágenes.

## Reglas y Guardrails
- **Cero frameworks CSS:** No instalar Tailwind CSS, Bootstrap ni librerías de componentes (MUI, Shadcn). Usar únicamente CSS puro / CSS Modules nativos.
- **Sin privilegios elevados:** Ejecutar todo en espacio de usuario (`npm install` local). Si faltan credenciales externas, documentarlas en `.env.example` y notificar al usuario sin intentar escalar privilegios.

## Pasos Incrementales
1. **Inicializar Next.js:** Crear la aplicación Next.js con App Router y TypeScript en el directorio raíz (sin Tailwind CSS). Instalar las dependencias base: `@neondatabase/serverless` (o `@vercel/postgres`), `@vercel/blob`, `@google/genai` y `twilio`.
2. **Variables de entorno:** Crear `.env.example` documentando las siguientes claves:
   - `POSTGRES_URL`
   - `BLOB_READ_WRITE_TOKEN`
   - `GEMINI_API_KEY`
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `NORMA_PHONE_WHITELIST`
   Si `.env.local` no existe o no tiene valores reales, frenar tareas bloqueadas por credenciales y pedirle al usuario que las configure.
3. **Esquema SQL (`src/db/schema.sql`):**
   Crear la definición de la tabla `products`:
   - `id` (`UUID`, Primary Key, default `gen_random_uuid()`)
   - `title` (`VARCHAR(120)`, `NOT NULL`)
   - `description` (`TEXT`)
   - `price` (`INTEGER`, `NOT NULL` — expresado en pesos enteros sin decimales)
   - `image_url` (`TEXT`, `NOT NULL`)
   - `in_stock` (`BOOLEAN`, default `true`)
   - `created_at` (`TIMESTAMP`, default `NOW()`)
   - `updated_at` (`TIMESTAMP`, default `NOW()`)
4. **Repositorio de Datos (`src/db/products.ts`):**
   Implementar funciones limpias, tipadas y con manejo explícito de errores:
   - `getAllProducts()`
   - `createProduct()`
   - `updateProductByTitleOrId()`
   - `markOutOfStock()`
5. **Validación (Definition of Done):**
   Ejecutar `make build` y verificar que la compilación de Next.js y TypeScript finalice con código de salida `0`.
