import { NextRequest, NextResponse } from 'next/server';
import { getAllProducts } from '@/db/products';
import { applyAgentAction } from '@/lib/catalog-actions';
import { analyzeNormaMessage } from '@/lib/gemini-agent';
import { uploadImageToBlob } from '@/lib/twilio-media';
import { checkAuthorization } from '@/lib/whatsapp-helpers';

const GRAPH_BASE = 'https://graph.facebook.com/v21.0';

interface MetaMessage {
  from: string;
  type: string;
  text?: { body?: string };
  image?: { id: string; mime_type?: string; caption?: string };
  audio?: { id: string; mime_type?: string };
}

interface MetaWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: MetaMessage[];
      };
    }>;
  }>;
}

async function downloadMetaMedia(
  mediaId: string,
  accessToken: string,
  fallbackMime: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const metaRes = await fetch(`${GRAPH_BASE}/${encodeURIComponent(mediaId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!metaRes.ok) {
    throw new Error(`Meta media lookup failed: HTTP ${metaRes.status}`);
  }
  const metaJson = (await metaRes.json()) as { url?: string; mime_type?: string };
  if (!metaJson.url) {
    throw new Error('Meta media lookup did not return a download URL.');
  }

  const fileRes = await fetch(metaJson.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!fileRes.ok) {
    throw new Error(`Meta media download failed: HTTP ${fileRes.status}`);
  }

  const buffer = Buffer.from(await fileRes.arrayBuffer());
  const mimeType =
    metaJson.mime_type ||
    fileRes.headers.get('content-type')?.split(';')[0].trim() ||
    fallbackMime;

  return { buffer, mimeType };
}

async function sendMetaReply(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string
): Promise<void> {
  const res = await fetch(`${GRAPH_BASE}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  });
  if (!res.ok) {
    console.error('Meta sendMessage failed:', res.status, await res.text());
  }
}

/**
 * Meta WhatsApp Cloud API webhook verification handshake.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');
  const expectedToken = process.env.META_VERIFY_TOKEN?.trim();

  if (mode === 'subscribe' && expectedToken && token === expectedToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/**
 * Meta WhatsApp Cloud API incoming message webhook.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const accessToken = process.env.META_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID?.trim();

  if (!accessToken || !phoneNumberId) {
    return NextResponse.json(
      { ok: false, error: 'META_ACCESS_TOKEN and META_PHONE_NUMBER_ID must be configured.' },
      { status: 500 }
    );
  }

  try {
    const payload = (await request.json()) as MetaWebhookPayload;
    const messages =
      payload.entry?.flatMap((e) =>
        (e.changes ?? []).flatMap((c) => c.value?.messages ?? [])
      ) ?? [];

    for (const msg of messages) {
      const fromNormalized = `whatsapp:+${msg.from.replace(/\D/g, '')}`;
      const rawText = msg.text?.body ?? msg.image?.caption ?? '';

      const auth = checkAuthorization(fromNormalized, rawText);
      if (!auth.authorized) {
        await sendMetaReply(
          phoneNumberId,
          accessToken,
          msg.from,
          'Hola. Este número no está autorizado. Si estás probando el taller, empezá tu mensaje con la palabra DEMO.'
        );
        continue;
      }

      let media: { buffer: Buffer; mimeType: string } | undefined;
      let blobUrl: string | undefined;

      if (msg.type === 'image' && msg.image?.id) {
        media = await downloadMetaMedia(
          msg.image.id,
          accessToken,
          msg.image.mime_type || 'image/jpeg'
        );
        blobUrl = await uploadImageToBlob(media.buffer, media.mimeType);
      } else if (msg.type === 'audio' && msg.audio?.id) {
        media = await downloadMetaMedia(
          msg.audio.id,
          accessToken,
          msg.audio.mime_type || 'audio/ogg'
        );
      }

      const existingProducts = await getAllProducts();
      const action = await analyzeNormaMessage({
        text: auth.cleanedBody,
        media,
        existingProducts: existingProducts.map((p) => ({
          id: p.id,
          title: p.title,
          price: p.price,
          in_stock: p.in_stock,
        })),
      });

      const reply = await applyAgentAction(action, blobUrl);
      await sendMetaReply(phoneNumberId, accessToken, msg.from, reply);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Meta webhook error:', error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
