import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cardNumber, expiry, cvc, sessionData } = body as {
      cardNumber: string;
      expiry: string;
      cvc: string;
      sessionData: {
        session_id: string;
        grand_total: number;
        vendor_totals: Record<string, { amount: number; parts: string[] }>;
        builder_fee: number;
        platform_fee: number;
        fulfillment_type: string;
        builder_id: string | null;
      };
    };

    if (!cardNumber || !expiry || !cvc) {
      return NextResponse.json({ error: 'Missing card details' }, { status: 400 });
    }

    const cleanNum = cardNumber.replace(/\s/g, '');
    if (cleanNum.length < 13 || cleanNum.length > 19) {
      return NextResponse.json({ error: 'Invalid card number' }, { status: 400 });
    }

    await new Promise((resolve) => setTimeout(resolve, 2200));

    const isDeclineCard = cleanNum.startsWith('4000') && cleanNum.slice(-1) === '2';
    if (isDeclineCard) {
      return NextResponse.json({
        success: false,
        error: 'Your card was declined. (Simulated decline — use a different test card number.)',
      });
    }

    const transfers: { destination: string; amount: number; type: string; status: string }[] = [];

    for (const [storeName, info] of Object.entries(sessionData.vendor_totals)) {
      transfers.push({
        destination: `${storeName} (acct_***${storeName.slice(0, 4)})`,
        amount: info.amount,
        type: 'parts_payment',
        status: 'transferred',
      });
    }

    if (sessionData.fulfillment_type === 'builder' && sessionData.builder_fee > 0 && sessionData.builder_id) {
      transfers.push({
        destination: `Builder (acct_***${sessionData.builder_id.slice(0, 4)})`,
        amount: sessionData.builder_fee,
        type: 'assembly_fee',
        status: 'transferred',
      });
    }

    transfers.push({
      destination: 'Platform (DroneForge)',
      amount: sessionData.platform_fee,
      type: 'platform_commission',
      status: 'collected',
    });

    return NextResponse.json({
      success: true,
      paymentIntentId: `pi_test_${Date.now()}`,
      transfers,
      message: 'Payment successful! Funds have been split and distributed.',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Payment processing failed' }, { status: 500 });
  }
}
