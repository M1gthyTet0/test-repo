# Skill 03: Webhook de WhatsApp (Twilio) + Cerebro Multimodal (Gemini Flash)

## Objetivo
Permitir que Norma (y el evaluador del challenge) administren el catálogo enviando fotos, textos o audios por WhatsApp.

## Pasos Incrementales
1. **Endpoint Webhook (`src/app/api/webhook/whatsapp/route.ts`):**
   - Aceptar peticiones `POST` (`application/x-www-form-urlencoded`) provenientes de Twilio.
   - Validar firma o whitelist de teléfono (`NORMA_PHONE_WHITELIST` o modo demo abierto con prefijo `DEMO`).
2. **Descarga de Multimedia (`src/lib/twilio-media.ts`):**
   - Si el mensaje incluye `MediaUrl0` (imagen `image/*` o audio `audio/ogg`), descargarlo usando autenticación Basic (`TWILIO_ACCOUNT_SID:TWILIO_AUTH_TOKEN`).
   - Si es imagen, subirla inmediatamente a **Vercel Blob** y obtener su `image_url` pública.
3. **Procesamiento con Gemini Flash (`src/lib/gemini-agent.ts`):**
   - Enviar a `gemini-2.5-flash` el texto del mensaje, el buffer del audio (si hay) y/o la imagen, junto con la lista actual de títulos de productos en DB (para que pueda identificar a qué pieza se refiere si pide editar o borrar).
   - Usar `responseSchema` (Structured Outputs) para forzar respuesta JSON estricta:
     ```json
     {
       "intent": "CREATE | UPDATE_PRICE | UPDATE_IMAGE | MARK_SOLD | UNKNOWN",
       "target_product_id": "uuid-o-null",
       "title": "Nombre artesanal de la pieza",
       "description": "Descripción cálida de 1 oración estilo taller de cerámica",
       "price": 15000,
       "reply_to_norma": "Mensaje corto, cálido y en letra clara confirmando lo que se hizo"
     }
     ```
4. **Ejecución y Respuesta TwiML:**
   - Ejecutar la acción en PostgreSQL y revalidar la caché de Next.js (`revalidatePath('/')`).
   - Devolver respuesta XML TwiML válida a Twilio con `reply_to_norma` + el link de la web.
5. **Validación:** Escribir tests unitarios (`tests/gemini-agent.test.ts` y `tests/webhook.test.ts`) mockeando payloads de Twilio (texto, audio e imagen).
