# Catálogo Web — Taller de Cerámica de la Tía Norma

## Contexto y Propósito
Aplicación web minimalista diseñada para que Norma (70 años, profesora de plástica retirada) publique y gestione sus piezas de cerámica artesanal sin conocimientos técnicos, sin computadora y sin correo electrónico.

## Principios de Diseño y Producto (Guardrails)
1. **Cero fricción para Norma:** No existe panel de administración web ni login. Norma actualiza el catálogo enviando fotos, texto o notas de voz por WhatsApp.
2. **Accesibilidad para adultos mayores:** Tipografía grande, alto contraste (estética cálida de taller de arte/arcilla), sin menús complejos ni pop-ups.
3. **Respeto estricto al boceto:** Una sola página con grilla de productos (1 foto, título, descripción breve y precio). **Sin carrito de compras, sin pasarela de pagos y sin botones invasivos.**
4. **Vanilla & Clean:** Prohibido usar Tailwind CSS, Bootstrap o librerías de componentes (MUI, Shadcn). Usar **CSS puro / CSS Modules** nativos de Next.js con variables CSS.

## Stack Tecnológico
- **Framework:** Next.js (App Router, TypeScript)
- **Estilos:** CSS puro / CSS Modules (Mobile-first, toggle entre Grilla y Vista Grande de 1 columna)
- **Base de Datos:** PostgreSQL (`@neondatabase/serverless` o `@vercel/postgres`)
- **Storage de Imágenes:** Vercel Blob (`@vercel/blob`)
- **Canal de Administración:** Twilio WhatsApp Sandbox (Webhooks)
- **Motor IA Multimodal:** Google Gemini Flash (`@google/genai`) para interpretar audios, imágenes y texto de Norma.
- **Hosting:** Vercel

## Cómo Probar la Aplicación (3 Pasos)
1. **Configurar variables y levantar el entorno:**
   - Copiar `.env.example` a `.env.local` y completar `POSTGRES_URL`, `BLOB_READ_WRITE_TOKEN`, `GEMINI_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` y `NORMA_PHONE_WHITELIST` (sin `.env.local`, el catálogo público funciona en modo demo con 4 piezas de ejemplo).
   - Instalar dependencias y cargar las piezas iniciales:
     ```bash
     make setup
     npm run seed
     make dev
     ```
2. **Explorar el catálogo público:**
   - Abrir `http://localhost:3000` en desktop o móvil y alternar entre **Ver en Cuadrícula** y **Ver en Tamaño Grande** (lectura fácil).
3. **Probar el bot de WhatsApp (Modo Sandbox / Evaluador):**
   - Apuntar el webhook de Twilio WhatsApp Sandbox a `POST /api/webhook/whatsapp` (o enviar un `POST` `application/x-www-form-urlencoded` con `From`, `Body` y opcionalmente `MediaUrl0` / `MediaContentType0`).
   - Cualquier número no incluido en `NORMA_PHONE_WHITELIST` puede probar el bot iniciando el mensaje con la palabra clave `DEMO` (por ejemplo: `DEMO Agregá un plato de cerámica esmaltada a 14000`). El sistema mantiene un tope automático de 15 piezas en la base de datos.

## Comandos Útiles
- `make infra-status` — Verifica Node, npm, `.env.local` y `node_modules`
- `make test` — Ejecuta tests unitarios y de integración (`vitest`)
- `make build` — Compila la aplicación para producción
- `make lint` — Ejecuta ESLint
