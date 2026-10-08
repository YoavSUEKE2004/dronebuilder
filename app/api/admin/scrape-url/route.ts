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

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractImageUrls(html: string): string[] {
  const urls: string[] = [];
  const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const src = match[1];
    if (src && !src.startsWith('data:') && !src.includes('logo') && !src.includes('icon') && !src.includes('placeholder')) {
      if (src.startsWith('//')) {
        urls.push('https:' + src);
      } else if (src.startsWith('/')) {
        // can't resolve relative without origin — skip
      } else {
        urls.push(src);
      }
    }
  }
  return urls;
}

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

    // Step 2: Fetch the page HTML
    let html: string;
    try {
      const fetchRes = await fetch(parsedUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!fetchRes.ok) {
        return NextResponse.json(
          { error: `Failed to fetch page (HTTP ${fetchRes.status})` },
          { status: 502 }
        );
      }

      html = await fetchRes.text();
    } catch {
      return NextResponse.json(
        { error: 'Could not reach the supplier URL. The site may be blocking automated requests.' },
        { status: 502 }
      );
    }

    // Clean HTML and extract candidate images
    const pageText = stripHtml(html).slice(0, 8000);
    const imageUrls = extractImageUrls(html).slice(0, 5);

    if (pageText.length < 50) {
      return NextResponse.json(
        { error: 'Page content was empty or could not be parsed.' },
        { status: 422 }
      );
    }

    // Step 3: Initialize Google Gen AI client
    const ai = new GoogleGenAI({ apiKey });

    const systemPrompt = `You are an expert FPV drone parts analyst. You receive raw text scraped from an FPV product page and must extract structured product information.

Rules:
- Infer the category from the product name and specs. If unclear, pick the closest match from the enum.
- Extract the price from the page text — look for $XX.XX patterns.
- Only include an image_url if it looks like a real product image from the provided candidate list.
- Set string fields to null when the information is not available on the page.
- Set numeric fields to null when the information is not available on the page.`;

    const userPrompt = `Product page URL: ${parsedUrl.hostname}${parsedUrl.pathname}

Page text (truncated):
${pageText}

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
