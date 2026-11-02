import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

/**
 * Stripe billing (test mode). Without STRIPE_SECRET_KEY the integration
 * stays in an explicit NOT_CONNECTED state — never a simulated payment.
 */

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET;
}

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing).');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' as any });
}

/** Maps a plan tier to its Stripe price env var (STRIPE_PRICE_GROWTH etc.). */
export function priceIdForPlan(plan: string): string | null {
  const map: Record<string, string | undefined> = {
    STARTER: process.env.STRIPE_PRICE_STARTER,
    GROWTH: process.env.STRIPE_PRICE_GROWTH,
    BUSINESS: process.env.STRIPE_PRICE_BUSINESS,
  };
  return map[plan] ?? null;
}

export async function ensureStripeCustomer(workspaceId: string): Promise<string> {
  const subscription = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (subscription?.stripeCustomerId) return subscription.stripeCustomerId;

  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  const customer = await getStripe().customers.create({
    name: workspace.name,
    metadata: { workspaceId },
  });

  await prisma.subscription.upsert({
    where: { workspaceId },
    update: { stripeCustomerId: customer.id },
    create: { workspaceId, stripeCustomerId: customer.id, plan: 'FREE', status: 'TRIALING' },
  });
  return customer.id;
}

export async function createCheckoutSession(input: {
  workspaceId: string;
  plan: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string | null; error?: string }> {
  if (!isStripeConfigured()) {
    return { url: null, error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to enable billing.' };
  }
  const priceId = priceIdForPlan(input.plan);
  if (!priceId) {
    return { url: null, error: `No Stripe price configured for the ${input.plan} plan (STRIPE_PRICE_${input.plan}).` };
  }

  try {
    const customerId = await ensureStripeCustomer(input.workspaceId);
    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: { workspaceId: input.workspaceId, plan: input.plan },
      subscription_data: { metadata: { workspaceId: input.workspaceId, plan: input.plan } },
    });
    return { url: session.url };
  } catch (error: any) {
    return { url: null, error: 'Stripe checkout failed. Please try again.' };
  }
}

export async function createPortalSession(workspaceId: string, returnUrl: string) {
  if (!isStripeConfigured()) {
    return { url: null, error: 'Stripe is not configured.' };
  }
  const customerId = await ensureStripeCustomer(workspaceId);
  try {
    const session = await getStripe().billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
    return { url: session.url };
  } catch (error: any) {
    return { url: null, error: 'Could not open the billing portal. Please try again.' };
  }
}

// Stripe SDK version differences (v17 vs v20+): current_period_end moved to items in v20.
function resolvePeriodEnd(sub: any): Date | undefined {
  const unix: number | undefined =
    sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end;
  return unix ? new Date(unix * 1000) : undefined;
}

export async function handleStripeWebhook(rawBody: string, signature: string): Promise<string> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe webhook is not configured.');
  }
  const event = getStripe().webhooks.constructEvent(rawBody, signature, secret);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId = session.metadata?.workspaceId;
      if (workspaceId) {
        await prisma.subscription.updateMany({
          where: { workspaceId },
          data: {
            stripeCustomerId: session.customer as string,
            status: 'ACTIVE',
            plan: (session.metadata?.plan as any) ?? 'STARTER',
          },
        });
        await prisma.integration.upsert({
          where: { workspaceId_type: { workspaceId, type: 'STRIPE' } },
          update: { status: 'CONNECTED', connectedAt: new Date() },
          create: { workspaceId, type: 'STRIPE', status: 'CONNECTED', connectedAt: new Date() },
        });
      }
      break;
    }
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const workspaceId = sub.metadata?.workspaceId;
      if (workspaceId) {
        await prisma.subscription.updateMany({
          where: { workspaceId },
          data: {
            stripeSubscriptionId: sub.id,
            status:
              sub.status === 'active' ? 'ACTIVE'
              : sub.status === 'past_due' ? 'PAST_DUE'
              : sub.status === 'canceled' ? 'CANCELED'
              : 'INCOMPLETE',
            plan: (sub.metadata?.plan as any) ?? undefined,
            currentPeriodEnd: resolvePeriodEnd(sub),
          },
        });
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const workspaceId = sub.metadata?.workspaceId;
      if (workspaceId) {
        await prisma.subscription.updateMany({
          where: { workspaceId },
          data: { status: 'CANCELED', plan: 'FREE' },
        });
      }
      break;
    }
    default:
      break;
  }

  return `handled: ${event.type}`;
}