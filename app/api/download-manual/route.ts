import { NextRequest, NextResponse } from 'next/server';
import { renderManualPDF } from '@/lib/generateManual';
import type { GeneratedManual } from '@/lib/generateManual';
import { renderToBuffer } from '@react-pdf/renderer';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { manual } = body as { manual: GeneratedManual };

    const pdfBuffer = await renderToBuffer(renderManualPDF(manual));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="drone-assembly-manual.pdf"',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
