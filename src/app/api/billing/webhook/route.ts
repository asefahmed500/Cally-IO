import { NextRequest, NextResponse } from 'next/server';
import { handleStripeWebhook } from '@/lib/billing/stripe';

export const dynamic = 'force-dynamic';

/** Stripe webhook — signature-verified subscription lifecycle updates. */
export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return new NextResponse('Missing stripe-signature header', { status: 400 });
  }
  const rawBody = await request.text();

  try {
    const result = await handleStripeWebhook(rawBody, signature);
    return NextResponse.json({ received: true, result });
  } catch (error: unknown) {
    // Stripe treats 400 as "do not retry" for malformed events; details go
    // to the server log only, not back to the caller.
    console.error('Stripe webhook error:', error);
    return new NextResponse('Webhook Error', { status: 400 });
  }
}