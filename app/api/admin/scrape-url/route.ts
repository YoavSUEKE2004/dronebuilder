import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type ScrapedPart = {
  name: string;
  brand: string;
  category: string;
  mounting_pattern: string;
  voltage_range: string;
  continuous_current: number | null;
  mcu: string;
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
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: 'OPENAI_API_KEY is not configured. Add it to your environment variables to enable AI-powered auto-fill.',
      }, { status: 400 });
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

    // Truncate to keep within token limits
    const pageText = stripHtml(html).slice(0, 8000);
    const imageUrls = extractImageUrls(html).slice(0, 5);

    if (pageText.length < 50) {
      return NextResponse.json(
        { error: 'Page content was empty or could not be parsed.' },
        { status: 422 }
      );
    }

    // Step 3: Use OpenAI to extract structured data
    const systemPrompt = `You are an expert FPV drone parts analyst. You receive raw text scraped from an FPV product page and must extract structured product information.

Return ONLY a JSON object with this exact shape:
{
  "name": "product name (string)",
  "brand": "manufacturer/brand name (string, empty if unknown)",
  "category": "one of: flight_controller, esc, motor, frame, vtx, camera, receiver, battery, propeller",
  "mounting_pattern": "e.g. 30.5x30.5mm or 20x20mm (string, empty if N/A)",
  "voltage_range": "e.g. 4S-6S or 3-6S (string, empty if N/A)",
  "continuous_current": "max current in amps as a number, null if N/A",
  "mcu": "MCU chip e.g. F405, F722 (string, empty if N/A)",
  "weight_g": "weight in grams as a number, null if unknown",
  "image_url": "best product image URL from the provided list, empty string if none",
  "buy_price": "listed price in USD as a number, null if not found"
}

Rules:
- Infer the category from the product name and specs. If unclear, pick the closest match.
- Extract the price from the page text — look for $XX.XX patterns.
- Only include the image_url if it looks like a real product image from the provided list.
- Return empty strings (not null) for text fields when unknown. Use null only for numeric fields.`;

    const userPrompt = `Product page URL: ${parsedUrl.hostname}${parsedUrl.pathname}

Page text (truncated):
${pageText}

Candidate image URLs:
${imageUrls.length > 0 ? imageUrls.join('\n') : 'No images found'}`;

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      return NextResponse.json(
        { error: `AI parsing failed (${aiRes.status}). ${errText.slice(0, 150)}` },
        { status: 500 }
      );
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: 'AI returned no content' }, { status: 500 });
    }

    let extracted: ScrapedPart;
    try {
      extracted = JSON.parse(content);
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 });
    }

    // Normalize category
    if (extracted.category && !VALID_CATEGORIES.includes(extracted.category)) {
      const lower = extracted.category.toLowerCase();
      const match = VALID_CATEGORIES.find((c) => lower.includes(c) || c.includes(lower));
      extracted.category = match || 'flight_controller';
    }

    // Infer vendor name from hostname
    const vendorName = parsedUrl.hostname
      .replace(/^www\./, '')
      .replace(/\.(com|net|org|io|co|store|shop)$/, '')
      .replace(/^([a-z0-9]+)\./, '$1')
      .split('.')[0]
      .charAt(0).toUpperCase() + parsedUrl.hostname.replace(/^www\./, '').split('.')[0].slice(1);

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
