import { put } from '@vercel/blob';

export interface DownloadedMedia {
  buffer: Buffer;
  mimeType: string;
}

export interface ProcessedMedia extends DownloadedMedia {
  blobUrl?: string;
}

function getExtensionFromMime(mimeType: string): string {
  const clean = mimeType.split(';')[0].trim().toLowerCase();
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/amr': 'amr',
  };
  return map[clean] ?? 'bin';
}

export async function downloadTwilioMedia(
  mediaUrl: string,
  fallbackContentType = 'application/octet-stream'
): Promise<DownloadedMedia> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();

  if (!accountSid || !authToken) {
    throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be configured.');
  }

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const response = await fetch(mediaUrl, {
    headers: {
      Authorization: `Basic ${credentials}`,
    },
  });

  if (!response.ok) {
    console.error('Twilio media download failed:', {
      status: response.status,
      requestUrl: mediaUrl,
      finalUrl: response.url,
      sidPrefix: accountSid.slice(0, 6),
    });
    throw new Error(`Failed to download Twilio media: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeType =
    response.headers.get('content-type')?.split(';')[0].trim() || fallbackContentType;

  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType,
  };
}

export async function uploadImageToBlob(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const hasBlobAuth =
    Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()) ||
    Boolean(process.env.BLOB_STORE_ID?.trim()) ||
    Boolean(process.env.VERCEL_OIDC_TOKEN?.trim());

  if (!hasBlobAuth) {
    throw new Error('Vercel Blob is not configured (missing BLOB_READ_WRITE_TOKEN or BLOB_STORE_ID).');
  }

  const ext = getExtensionFromMime(mimeType);
  const filename = `norma-taller/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const blob = await put(filename, buffer, {
    access: 'public',
    contentType: mimeType,
  });

  return blob.url;
}

export async function processIncomingMedia(
  mediaUrl: string,
  mediaContentType?: string
): Promise<ProcessedMedia> {
  const downloaded = await downloadTwilioMedia(mediaUrl, mediaContentType);
  const isImage = downloaded.mimeType.toLowerCase().startsWith('image/');

  if (!isImage) {
    return downloaded;
  }

  const blobUrl = await uploadImageToBlob(downloaded.buffer, downloaded.mimeType);
  return {
    ...downloaded,
    blobUrl,
  };
}
