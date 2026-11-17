# Taller de Cerámica — Tía Norma

Catálogo web minimalista y accesible para que Norma pueda mostrar y actualizar sus piezas de cerámica artesanal desde el celular, sin conocimientos técnicos.

---

## Parte 1: Guía para Norma (Uso diario)

### 1. Actualizar el catálogo con el Bot de Telegram (forma principal)

No necesitás abrir ninguna página ni completar formularios. Solo abrí el chat con el bot en Telegram y mandale un mensaje como si le hablaras a un ayudante:

- **Publicar una pieza nueva:** mandá una **foto** con el nombre y el precio en el texto (ej: *"Cuenco de gres esmaltado, 15000"*), o una **nota de voz** contándolo.
- **Cambiar un precio:** escribí o mandá un audio diciendo *"Cambiá el precio del cuenco de gres a 18000"*.
- **Marcar una pieza como vendida:** decile *"Se vendió el cuenco de gres"*.
- **Cambiar la foto de una pieza:** mandá la foto nueva aclarando el nombre de la pieza.

El bot te responde confirmando el cambio y te pasa el link del catálogo actualizado.

> 📸 *Espacio para capturas del bot de Telegram:*
> `<!-- Agregá acá tus capturas, ej: ![Bot de Telegram](public/docs/telegram-ejemplo.png) -->`

---

### 2. Panel de Administración Web (`/admin`) — Opcional

Si alguna vez el bot no entiende un pedido, querés borrar una pieza, o hay dos piezas con el mismo nombre y necesitás ver su **ID único**, podés entrar al panel web en `/admin`.

1. **Ingresar (Login):** abrí `https://<tu-sitio>/admin` e ingresá la contraseña del taller (`ADMIN_PASSWORD`).
2. **Ver el límite del catálogo:** arriba vas a ver cuántas piezas tenés cargadas sobre el máximo de **15 piezas**.
3. **Crear una pieza nueva:** completá nombre, precio, descripción breve y subí una foto desde tu compu o celular.
4. **Editar, marcar vendida o eliminar:** en cada tarjeta podés:
   - Tocar **Marcar vendida / Marcar disponible**.
   - Tocar **Editar** para corregir nombre, precio, descripción o foto.
   - Tocar **Eliminar** para borrar la pieza del catálogo.
   - Tocar **Copiar ID** si necesitás pasarle el identificador exacto al bot.

> 📸 *Espacio para capturas del panel `/admin`:*
> `<!-- Agregá acá tus capturas, ej: ![Panel Admin](public/docs/admin-panel.png) -->`

---

## Parte 2: Documentación para Desarrolladores

### Arquitectura y Stack

- **Framework:** Next.js 15 (App Router, TypeScript).
- **Estilos:** CSS puro + CSS Modules (`src/app/globals.css`, sin Tailwind ni librerías de componentes).
- **Base de datos:** PostgreSQL en Neon (`@neondatabase/serverless`). Si `POSTGRES_URL` no está configurado, el catálogo público (`/`) hace fallback a 4 piezas de ejemplo (`src/db/mock-products.ts`).
- **Storage de imágenes:** Vercel Blob (`@vercel/blob` v2 con soporte OIDC o `BLOB_READ_WRITE_TOKEN`).
- **IA Multimodal:** Google Gemini (`@google/genai`) en `src/lib/gemini-agent.ts` con salida JSON estructurada (`CREATE`, `UPDATE_PRICE`, `UPDATE_IMAGE`, `MARK_SOLD`, `UNKNOWN`) y fallback automático ante errores transitorios `503`/`429`.
- **Canales de mensajería:**
  - **Telegram Bot** (`POST /api/webhook/telegram`) — texto, fotos y notas de voz sin límites de mensajes.
  - **Twilio WhatsApp Sandbox** (`POST /api/webhook/whatsapp`) — con whitelist (`NORMA_PHONE_WHITELIST`), palabra clave de prueba (`SANDBOX_KEYWORD=DEMO`) y fallback si falla la descarga de media.

### Estructura principal

```text
src/
├── app/
│   ├── page.tsx                        # Catálogo público (SSR force-dynamic)
│   ├── admin/page.tsx                  # Panel administrativo protegido por cookie
│   └── api/
│       ├── admin/auth/route.ts         # Login / Logout / Estado de sesión
│       ├── admin/products/route.ts     # GET / POST piezas
│       ├── admin/products/[id]/route.ts# PATCH / DELETE por UUID
│       ├── admin/upload/route.ts       # Subida de imágenes a Vercel Blob (máx 5 MB)
│       ├── webhook/telegram/route.ts   # Webhook de Telegram Bot
│       └── webhook/whatsapp/route.ts   # Webhook de Twilio WhatsApp
├── components/
│   ├── CatalogView.tsx                 # Grilla / Vista Grande accesible
│   ├── ProductCard.tsx                 # Tarjeta pública (sin IDs ni carrito)
│   └── AdminPanel.tsx                  # UI de gestión manual
├── db/
│   ├── schema.sql                      # Esquema SQL de PostgreSQL
│   ├── products.ts                     # Queries CRUD + tope de 15 piezas
│   └── seed.ts                         # Script de carga inicial
└── lib/
    ├── admin-auth.ts                   # Cookie HMAC-SHA256 httpOnly
    ├── catalog-actions.ts              # Aplicación de intents de IA a DB
    ├── gemini-agent.ts                 # Agente multimodal Gemini + fallback
    ├── twilio-media.ts                 # Descarga Twilio + subida a Vercel Blob
    └── whatsapp-helpers.ts             # TwiML y validación de whitelist/DEMO
```

### Variables de Entorno

Copiar `.env.example` a `.env.local` para desarrollo local (en Vercel, configurarlas en **Project Settings → Environment Variables**):

| Variable | Requerida | Descripción |
| --- | --- | --- |
| `POSTGRES_URL` | Sí (prod) | Connection string de Neon (`?sslmode=require`). |
| `BLOB_READ_WRITE_TOKEN` o `BLOB_STORE_ID` | Sí (fotos) | Credencial de Vercel Blob (OIDC en Vercel o token manual). |
| `GENAI_G_API_KEY` | Sí (bots) | API Key de Google AI Studio (Gemini). |
| `GEMINI_MODEL` | No | Modelo primario (default: `gemini-3.8-flash`, con fallback a `gemini-3.7-flash` y `gemini-3.5-flash-lite`). |
| `ADMIN_PASSWORD` | Sí (`/admin`) | Contraseña para ingresar al panel `/admin`. |
| `TELEGRAM_BOT_TOKEN` | Sí (Telegram) | Token de `@BotFather`. |
| `TELEGRAM_SECRET_TOKEN` | No | Secreto opcional para validar `x-telegram-bot-api-secret-token`. |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | Sí (WhatsApp) | Credenciales de Twilio. |
| `NORMA_PHONE_WHITELIST` | No | Números autorizados en WhatsApp (`whatsapp:+549...`, separados por coma). |
| `SANDBOX_KEYWORD` | No | Palabra clave para evaluadores en WhatsApp (default: `DEMO`). |
| `DISABLE_WHATSAPP_REPLY` | No | En `true`, devuelve `<Response></Response>` vacío en Twilio. |
| `NEXT_PUBLIC_SITE_URL` | No | URL pública incluida en las respuestas del bot. |

### Comandos (`Makefile` y `npm`)

```bash
make infra-status   # Verifica Node, npm, .env.local y node_modules
make setup          # npm install
make dev            # Levanta Next.js en http://localhost:3000
make test           # Ejecuta Vitest (tests unitarios y de integración)
make lint           # Ejecuta ESLint (next lint)
make build          # Compila para producción (next build)
```

Para crear la tabla e insertar las 4 piezas iniciales en Neon:

```bash
npx tsx --env-file=.env.local src/db/seed.ts
```

### Esquema de Base de Datos (`src/db/schema.sql`)

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(120) NOT NULL,
  description TEXT,
  price INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  in_stock BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_created_at ON products (created_at DESC);
```

### API Reference

#### Autenticación Admin
- `GET /api/admin/auth` → `{ configured: boolean, authenticated: boolean }`
- `POST /api/admin/auth` → Body `{ "password": "..." }`. Devuelve `200` y setea cookie `norma_admin_session` (`httpOnly`, `sameSite=lax`, `secure` en producción), o `401` / `503`.
- `DELETE /api/admin/auth` → Limpia la cookie de sesión.

#### CRUD Admin (requiere cookie `norma_admin_session`)
- `GET /api/admin/products` → `{ products, count, maxProducts: 15, databaseConfigured }`
- `POST /api/admin/products` → Body `{ title, description?, price, image_url?, in_stock? }`. Crea pieza, aplica tope de 15 y revalida `/`.
- `PATCH /api/admin/products/[id]` → Body parcial `{ title?, description?, price?, image_url?, in_stock? }`. Actualiza por UUID y revalida `/`.
- `DELETE /api/admin/products/[id]` → Elimina por UUID y revalida `/`.
- `POST /api/admin/upload` → `multipart/form-data` con campo `file` (`image/*`, máx. 5 MB). Sube a Vercel Blob y devuelve `{ url }`.

#### Webhooks
- `POST /api/webhook/telegram` → Recibe JSON `Update` de Telegram (`text`, `photo`, `voice`, `audio`), procesa con Gemini y responde por `sendMessage`.
- `POST /api/webhook/whatsapp` → Recibe `application/x-www-form-urlencoded` de Twilio (`From`, `Body`, `MediaUrl0`, `MediaContentType0`) y responde TwiML XML.

### Seguridad y Buenas Prácticas

**Implementado actualmente:**
- Consultas SQL parametrizadas con `@neondatabase/serverless` (protección contra SQL Injection).
- Sesión administrativa firmada con `HMAC-SHA256` + `crypto.timingSafeEqual`, cookie `httpOnly` y `secure` en producción.
- Validación de tamaño máximo (5 MB) y tipo MIME `image/*` en `/api/admin/upload`.
- Soporte para `TELEGRAM_SECRET_TOKEN` en el header `x-telegram-bot-api-secret-token`.
- Tope automático de 15 productos en DB (`enforceProductCap`) para evitar abuso en modo demo.

**Recomendado para hardening adicional en producción:**
1. Configurar `TELEGRAM_SECRET_TOKEN` al registrar `setWebhook` (`secret_token=...`) para rechazar requests falsificados al webhook de Telegram.
2. Agregar validación de firma `X-Twilio-Signature` (`twilio.validateRequest`) en `/api/webhook/whatsapp` si se pasa a producción con número dedicado.
3. Agregar rate limiting (por ejemplo con Upstash Redis / Vercel WAF) en `POST /api/admin/auth` para mitigar fuerza bruta sobre `ADMIN_PASSWORD`.
