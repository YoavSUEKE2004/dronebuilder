import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

export const runtime = 'nodejs';

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

    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `You are an expert FPV drone component parser. Extract product specs from unformatted raw supplier web page text. Infer missing details where logical, but do not hallucinate numbers.`;

    const truncatedText = rawText.slice(0, 10000);

    let parsed: ParsedPart;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: truncatedText,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.3,
        },
      });

      const text = response.text;
      if (!text) {
        return NextResponse.json({ error: 'Gemini returned no content' }, { status: 500 });
      }

      parsed = JSON.parse(text) as ParsedPart;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gemini API error';
      return NextResponse.json(
        { error: `Gemini parsing failed: ${msg}` },
        { status: 500 }
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
