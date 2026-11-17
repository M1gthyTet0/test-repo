import { GoogleGenAI, Type, type Schema } from '@google/genai';

export type AgentIntent =
  | 'CREATE'
  | 'UPDATE_PRICE'
  | 'UPDATE_IMAGE'
  | 'MARK_SOLD'
  | 'UNKNOWN';

export interface CatalogSummaryItem {
  id: string;
  title: string;
  price: number;
  in_stock: boolean;
}

export interface AgentAction {
  intent: AgentIntent;
  target_product_id: string | null;
  title: string | null;
  description: string | null;
  price: number | null;
  reply_to_norma: string;
}

export interface AnalyzeMessageInput {
  text?: string;
  media?: {
    buffer: Buffer;
    mimeType: string;
  };
  existingProducts: CatalogSummaryItem[];
}

export interface GenAIClientLike {
  models: {
    generateContent: (params: {
      model: string;
      contents: unknown;
      config?: unknown;
    }) => Promise<{ text?: string }>;
  };
}

const AGENT_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      enum: ['CREATE', 'UPDATE_PRICE', 'UPDATE_IMAGE', 'MARK_SOLD', 'UNKNOWN'],
    },
    target_product_id: {
      type: Type.STRING,
      nullable: true,
    },
    title: {
      type: Type.STRING,
      nullable: true,
    },
    description: {
      type: Type.STRING,
      nullable: true,
    },
    price: {
      type: Type.INTEGER,
      nullable: true,
    },
    reply_to_norma: {
      type: Type.STRING,
    },
  },
  required: ['intent', 'reply_to_norma'],
};

const VALID_INTENTS = new Set<AgentIntent>([
  'CREATE',
  'UPDATE_PRICE',
  'UPDATE_IMAGE',
  'MARK_SOLD',
  'UNKNOWN',
]);

function buildSystemInstruction(existingProducts: CatalogSummaryItem[]): string {
  const catalogLines =
    existingProducts.length === 0
      ? 'El catálogo actualmente está vacío.'
      : existingProducts
          .map(
            (p) =>
              `- ID: ${p.id} | Título: "${p.title}" | Precio: $${p.price} | Disponible: ${p.in_stock ? 'Sí' : 'Vendida'}`
          )
          .join('\n');

  return [
    'Sos el asistente del taller de cerámica de Norma (70 años, profesora de plástica).',
    'Tu trabajo es interpretar sus mensajes de WhatsApp (texto, nota de voz o foto) y devolver una acción JSON estricta.',
    '',
    'Intenciones posibles:',
    '- CREATE: Norma quiere publicar una pieza nueva (indicá title, description cálida de 1 oración estilo taller, y price entero en pesos).',
    '- UPDATE_PRICE: Norma quiere cambiar el precio de una pieza existente (indicá target_product_id del catálogo y el nuevo price entero).',
    '- UPDATE_IMAGE: Norma envió una foto nueva para reemplazar la foto de una pieza existente (indicá target_product_id).',
    '- MARK_SOLD: Norma avisa que una pieza se vendió o ya no está disponible (indicá target_product_id).',
    '- UNKNOWN: El mensaje no se entiende o no pide cambios en el catálogo.',
    '',
    'Reglas:',
    '- Usá siempre pesos enteros sin centavos ni símbolos en "price" (ej: 15000).',
    '- En "reply_to_norma", escribí un mensaje corto, cálido, respetuoso y en letra clara confirmando lo que se hizo o pidiendo el dato que falta.',
    '',
    'Catálogo actual:',
    catalogLines,
  ].join('\n');
}

function getDefaultClient(): GenAIClientLike {
  const apiKey = process.env.GENAI_G_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GENAI_G_API_KEY is not configured.');
  }
  return new GoogleGenAI({ apiKey }) as unknown as GenAIClientLike;
}

export function parseAgentAction(rawText: string | undefined): AgentAction {
  if (!rawText) {
    return {
      intent: 'UNKNOWN',
      target_product_id: null,
      title: null,
      description: null,
      price: null,
      reply_to_norma:
        'Norma, no pude escuchar o leer bien tu mensaje. ¿Me lo repetís por favor?',
    };
  }

  const parsed = JSON.parse(rawText) as Record<string, unknown>;
  const rawIntent = String(parsed.intent ?? 'UNKNOWN').toUpperCase() as AgentIntent;
  const intent: AgentIntent = VALID_INTENTS.has(rawIntent) ? rawIntent : 'UNKNOWN';

  const priceValue =
    typeof parsed.price === 'number' && Number.isFinite(parsed.price)
      ? Math.round(parsed.price)
      : null;

  return {
    intent,
    target_product_id:
      typeof parsed.target_product_id === 'string' && parsed.target_product_id.trim()
        ? parsed.target_product_id.trim()
        : null,
    title:
      typeof parsed.title === 'string' && parsed.title.trim()
        ? parsed.title.trim()
        : null,
    description:
      typeof parsed.description === 'string' && parsed.description.trim()
        ? parsed.description.trim()
        : null,
    price: priceValue,
    reply_to_norma:
      typeof parsed.reply_to_norma === 'string' && parsed.reply_to_norma.trim()
        ? parsed.reply_to_norma.trim()
        : 'Listo Norma, ya actualicé tu catálogo.',
  };
}

export async function analyzeNormaMessage(
  input: AnalyzeMessageInput,
  client?: GenAIClientLike
): Promise<AgentAction> {
  const ai = client ?? getDefaultClient();
  const parts: Array<
    | { text: string }
    | { inlineData: { data: string; mimeType: string } }
  > = [];

  if (input.text?.trim()) {
    parts.push({ text: input.text.trim() });
  }

  if (input.media) {
    parts.push({
      inlineData: {
        data: input.media.buffer.toString('base64'),
        mimeType: input.media.mimeType,
      },
    });
  }

  if (parts.length === 0) {
    return {
      intent: 'UNKNOWN',
      target_product_id: null,
      title: null,
      description: null,
      price: null,
      reply_to_norma:
        'Norma, recibí un mensaje vacío. Mandame una foto, un audio o un texto contándome qué pieza querés publicar.',
    };
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: [{ role: 'user', parts }],
    config: {
      systemInstruction: buildSystemInstruction(input.existingProducts),
      responseMimeType: 'application/json',
      responseSchema: AGENT_RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  });

  return parseAgentAction(response.text);
}
