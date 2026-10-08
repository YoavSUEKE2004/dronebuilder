import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

export const runtime = 'nodejs';

type ScrapedPart = {
  name: string;
  brand: string;
  category: string;
  mounting_pattern: string | null;
  voltage_range: string | null;
  continuous_current: number | null;
  mcu: string | null;
  weight_g: number | null;
  image_url: string;
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
    voltage_range: { type: Type.STRING, description: 'e.g. 3S-6S or 4S-6S', nullable: true },
    continuous_current: { type: Type.NUMBER, description: 'Max current in Amps', nullable: true },
    mcu: { type: Type.STRING, description: 'MCU chip e.g. STM32F405, F722', nullable: true },
    weight_g: { type: Type.NUMBER, description: 'Weight in grams', nullable: true },
    image_url: { type: Type.STRING, description: 'Best primary product image URL from page candidates' },
    buy_price: { type: Type.NUMBER, description: 'Listed supplier price in USD', nullable: true },
  },
  required: ['name', 'brand', 'category', 'image_url'],
};

function extractImageUrls(text: string): string[] {
  const urls: string[] = [];
  const urlRegex = /(?:!\[.*?\]\((https?:\/\/[^\s)]+)\)|"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp|gif)[^"]*)")/gi;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const src = match[1] || match[2];
    if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('placeholder') && !urls.includes(src)) {
      urls.push(src);
    }
  }
  return urls.slice(0, 8);
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Missing URL' }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Step 1: Validate API key before making any network requests
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured in .env' },
        { status: 400 }
      );
    }

    // Step 2: Fetch the page via Jina AI Reader to bypass anti-bot protection
    const jinaUrl = `https://r.jina.ai/${parsedUrl.toString()}`;
    let pageContent: string;
    try {
      const jinaRes = await fetch(jinaUrl, {
        headers: {
          'Accept': 'text/plain',
          'X-Target-Selector': 'body',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (!jinaRes.ok) {
        return NextResponse.json(
          { error: `Jina Reader failed to fetch the page (HTTP ${jinaRes.status}). The supplier site may be down or blocking requests.` },
          { status: 502 }
        );
      }

      pageContent = await jinaRes.text();
    } catch {
      return NextResponse.json(
        { error: 'Could not reach the supplier URL via Jina Reader. The site may be temporarily unavailable.' },
        { status: 502 }
      );
    }

    if (pageContent.length < 50) {
      return NextResponse.json(
        { error: 'Page content was empty or could not be parsed.' },
        { status: 422 }
      );
    }

    // Extract candidate image URLs from Jina's output
    const imageUrls = extractImageUrls(pageContent);

    // Truncate for token limits
    const truncatedContent = pageContent.slice(0, 10000);

    // Step 3: Initialize Google Gen AI client
    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are an expert FPV drone parts analyst. You receive text scraped from an FPV product page (via Jina AI Reader) and must extract structured product information.

Rules:
- Infer the category from the product name and specs. If unclear, pick the closest match from the enum.
- Extract the price from the page text — look for $XX.XX patterns or listed prices.
- Only include an image_url if it looks like a real product image from the provided candidate list.
- Set string fields to null when the information is not available on the page.
- Set numeric fields to null when the information is not available on the page.`;

    const userPrompt = `Product page URL: ${parsedUrl.hostname}${parsedUrl.pathname}

Page content (truncated):
${truncatedContent}

Candidate image URLs:
${imageUrls.length > 0 ? imageUrls.join('\n') : 'No images found'}`;

    // Step 4: Call gemini-2.5-flash with structured JSON output
    let extracted: ScrapedPart;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.3,
        },
      });

      const text = response.text;
      if (!text) {
        return NextResponse.json({ error: 'Gemini returned no content' }, { status: 500 });
      }

      extracted = JSON.parse(text) as ScrapedPart;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gemini API error';
      return NextResponse.json(
        { error: `Gemini parsing failed: ${msg}` },
        { status: 500 }
      );
    }

    // Normalize category
    if (extracted.category && !VALID_CATEGORIES.includes(extracted.category)) {
      const lower = extracted.category.toLowerCase();
      const match = VALID_CATEGORIES.find((c) => lower.includes(c) || c.includes(lower));
      extracted.category = match || 'flight_controller';
    }

    // Infer vendor name from hostname
    const hostPart = parsedUrl.hostname.replace(/^www\./, '').split('.')[0];
    const vendorName = hostPart.charAt(0).toUpperCase() + hostPart.slice(1);

    return NextResponse.json({
      ...extracted,
      vendor_name: vendorName,
      supplier_url: parsedUrl.toString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
