import { NextRequest, NextResponse } from 'next/server';
import { getAllProducts } from '@/db/products';
import { applyAgentAction } from '@/lib/catalog-actions';
import { analyzeNormaMessage } from '@/lib/gemini-agent';
import { uploadImageToBlob } from '@/lib/twilio-media';

interface TelegramPhotoSize {
  file_id: string;
  width?: number;
  height?: number;
}

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
    caption?: string;
    photo?: TelegramPhotoSize[];
    voice?: { file_id: string; mime_type?: string };
    audio?: { file_id: string; mime_type?: string };
  };
}

function getMimeFromPath(filePath: string, fallback: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    ogg: 'audio/ogg',
    oga: 'audio/ogg',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
  };
  return (ext && map[ext]) || fallback;
}

async function downloadTelegramFile(
  botToken: string,
  fileId: string,
  fallbackMime: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const metaRes = await fetch(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(fileId)}`
  );
  if (!metaRes.ok) {
    throw new Error(`Telegram getFile failed: HTTP ${metaRes.status}`);
  }

  const meta = (await metaRes.json()) as {
    ok: boolean;
    result?: { file_path?: string };
  };
  const filePath = meta.result?.file_path;
  if (!meta.ok || !filePath) {
    throw new Error('Telegram getFile did not return a file_path.');
  }

  const fileRes = await fetch(
    `https://api.telegram.org/file/bot${botToken}/${filePath}`
  );
  if (!fileRes.ok) {
    throw new Error(`Telegram file download failed: HTTP ${fileRes.status}`);
  }

  const arrayBuffer = await fileRes.arrayBuffer();
  const mimeType = getMimeFromPath(filePath, fallbackMime);
  return { buffer: Buffer.from(arrayBuffer), mimeType };
}

async function sendTelegramReply(
  botToken: string,
  chatId: number,
  text: string
): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) {
    console.error('Telegram sendMessage failed:', res.status, await res.text());
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secretToken = process.env.TELEGRAM_SECRET_TOKEN?.trim();
  if (secretToken) {
    const headerToken = request.headers.get('x-telegram-bot-api-secret-token')?.trim();
    if (headerToken !== secretToken) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) {
    return NextResponse.json(
      { ok: false, error: 'TELEGRAM_BOT_TOKEN is not configured.' },
      { status: 500 }
    );
  }

  let chatId: number | undefined;

  try {
    const update = (await request.json()) as TelegramUpdate;
    const message = update.message;
    if (!message) {
      return NextResponse.json({ ok: true });
    }

    chatId = message.chat.id;
    const rawText = (message.text ?? message.caption ?? '').trim();

    let media: { buffer: Buffer; mimeType: string } | undefined;
    let blobUrl: string | undefined;

    if (message.photo && message.photo.length > 0) {
      const largest = message.photo[message.photo.length - 1];
      media = await downloadTelegramFile(botToken, largest.file_id, 'image/jpeg');
      blobUrl = await uploadImageToBlob(media.buffer, media.mimeType);
    } else if (message.voice) {
      media = await downloadTelegramFile(
        botToken,
        message.voice.file_id,
        message.voice.mime_type || 'audio/ogg'
      );
    } else if (message.audio) {
      media = await downloadTelegramFile(
        botToken,
        message.audio.file_id,
        message.audio.mime_type || 'audio/mpeg'
      );
    }

    const existingProducts = await getAllProducts();
    const action = await analyzeNormaMessage({
      text: rawText,
      media,
      existingProducts: existingProducts.map((p) => ({
        id: p.id,
        title: p.title,
        price: p.price,
        in_stock: p.in_stock,
      })),
    });

    const finalReply = await applyAgentAction(action, blobUrl);
    await sendTelegramReply(botToken, chatId, finalReply);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    if (chatId !== undefined) {
      await sendTelegramReply(
        botToken,
        chatId,
        'Hubo un problemita técnico en el taller. Intentá de nuevo en un ratito.'
      );
    }
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
