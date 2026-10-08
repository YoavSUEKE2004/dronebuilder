import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type ComponentSummary = {
  id: string;
  name: string;
  category: string;
  price: number;
  quality_score: number;
  electrical_specs?: {
    max_voltage_s?: number | null;
    max_current_a?: number | null;
    protocol?: string;
  } | null;
  mounting_pattern?: string;
  weight_g?: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, components } = body as { prompt: string; components: ComponentSummary[] };

    if (!prompt || !components || components.length === 0) {
      return NextResponse.json({ error: 'Missing prompt or components' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        error: 'OPENAI_API_KEY is not configured. Add it to your environment to enable AI-powered build recommendations.',
      }, { status: 400 });
    }

    // Build a compact component catalog for the AI
    const catalog = components.map((c) => ({
      id: c.id,
      name: c.name,
      category: c.category,
      price: c.price,
      quality: c.quality_score,
      voltage: c.electrical_specs?.max_voltage_s,
      current: c.electrical_specs?.max_current_a,
      protocol: c.electrical_specs?.protocol,
      mount: c.mounting_pattern,
      weight: c.weight_g,
    }));

    const systemPrompt = `You are an expert FPV drone builder. The user will describe what kind of drone they want.
You have access to a catalog of components. Select the best parts for their build and return ONLY a JSON object with this exact shape:
{
  "parts": { "frame": "<id>", "motor": "<id>", "esc": "<id>", "flight_controller": "<id>", "propeller": "<id>", "battery": "<id>", "camera": "<id>", "vtx": "<id>", "receiver": "<id>" },
  "summary": "<short summary like '5-inch 6S freestyle build'>",
  "reasoning": "<1-2 sentence explanation>"
}
Rules:
- Pick parts ONLY from the provided catalog. Use the exact id values.
- Ensure mounting patterns match between frame, FC, and ESC.
- Ensure voltage compatibility (battery S rating vs component max voltage).
- Match motor KV to frame size (smaller frames need higher KV).
- Match camera and VTX video systems (both digital or both analog).
- Stay within budget if specified.
- If no exact match exists for a category, omit that key from the parts object.`;

    const userPrompt = `User request: "${prompt}"\n\nAvailable components:\n${JSON.stringify(catalog)}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
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
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `OpenAI API error (${res.status}): ${text.slice(0, 200)}` }, { status: 500 });
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: 'No response from AI' }, { status: 500 });
    }

    try {
      const parsed = JSON.parse(content);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 500 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
