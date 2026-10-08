import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

export const runtime = 'nodejs';
export const maxDuration = 60;

type ParsedPart = {
  name: string;
  brand: string;
  category: string;
  mounting_pattern: string | null;
  voltage_range: string | null;
  continuous_current: number | null;
  mcu: string | null;
  weight_g: number | null;
  buy_price: number | null;
};

const VALID_CATEGORIES = [
  'flight_controller', 'esc', 'motor', 'frame',
  'vtx', 'camera', 'receiver', 'battery', 'propeller',
];

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: 'Clean, concise product title' },
    brand: { type: Type.STRING, description: 'Manufacturer or brand name' },
    category: {
      type: Type.STRING,
      description: 'One of: flight_controller, esc, motor, frame, vtx, camera, receiver, battery, propeller',
      enum: VALID_CATEGORIES,
    },
    mounting_pattern: { type: Type.STRING, description: 'e.g. 30.5x30.5mm or 20x20mm', nullable: true },
    voltage_range: { type: Type.STRING, description: 'e.g. 3S-6S or 4S', nullable: true },
    continuous_current: { type: Type.NUMBER, description: 'Max current in Amps', nullable: true },
    mcu: { type: Type.STRING, description: 'MCU chip e.g. STM32F405, F722', nullable: true },
    weight_g: { type: Type.NUMBER, description: 'Weight in grams', nullable: true },
    buy_price: { type: Type.NUMBER, description: 'Estimated supplier cost in USD', nullable: true },
  },
  required: ['name', 'brand', 'category'],
};

const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('socket hang up') ||
    msg.includes('network') ||
    msg.includes('aborted')
  );
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  try {
    const { rawText } = await req.json();

    if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 20) {
      return NextResponse.json(
        { error: 'Please paste at least a few lines of product page text.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured in .env' },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { timeout: 45000 },
    });

    const systemInstruction =
      'You are an expert FPV drone component parser. ' +
      'Extract product specs from unformatted raw supplier web page text. ' +
      'Infer missing details where logical, but do not hallucinate numbers.';

    const truncatedText = rawText.slice(0, 10000);

    let parsed: ParsedPart | null = null;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: truncatedText,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.3,
            abortSignal: AbortSignal.timeout(45000),
          },
        });

        const text = response.text;
        if (!text) {
          return NextResponse.json(
            { error: 'Gemini returned no content. The text may not contain recognizable product specs.' },
            { status: 500 }
          );
        }

        parsed = JSON.parse(text) as ParsedPart;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (isNetworkError(err) && attempt < MAX_RETRIES) {
          const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
          await sleep(delay);
          continue;
        }

        // Non-retryable error or out of retries
        if (isNetworkError(err)) {
          return NextResponse.json(
            {
              error:
                'Could not reach Google Gemini after ' +
                MAX_RETRIES +
                ' attempts. Check your network connection and try again.',
            },
            { status: 503 }
          );
        }

        // API-level error (bad key, quota, malformed request, etc.)
        const msg = err instanceof Error ? err.message : 'Gemini API error';
        return NextResponse.json(
          { error: `Gemini parsing failed: ${msg}` },
          { status: 500 }
        );
      }
    }

    if (!parsed) {
      const msg = lastError?.message ?? 'Unknown error';
      return NextResponse.json(
        { error: `Gemini parsing failed after ${MAX_RETRIES} retries: ${msg}` },
        { status: 503 }
      );
    }

    // Normalize category
    if (parsed.category && !VALID_CATEGORIES.includes(parsed.category)) {
      const lower = parsed.category.toLowerCase();
      const match = VALID_CATEGORIES.find((c) => lower.includes(c) || c.includes(lower));
      parsed.category = match || 'flight_controller';
    }

    return NextResponse.json(parsed);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
