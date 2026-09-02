import { NextRequest, NextResponse } from 'next/server';
import { generateAssemblyManual } from '@/lib/generateManual';
import type { ComponentWithSpecs, SelectedParts } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { selectedParts, components, detailLevel } = body as {
      selectedParts: SelectedParts;
      components: ComponentWithSpecs[];
      detailLevel: 'beginner' | 'expert';
    };

    const manual = await generateAssemblyManual(selectedParts, components, detailLevel);
    return NextResponse.json({ manual });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate manual' },
      { status: 500 }
    );
  }
}
