'use server';

import { requireWorkspace, requireCapability } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { logAudit } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import { createCheckoutSession, createPortalSession, isStripeConfigured } from '@/lib/billing/stripe';
import type { PlanTier } from '@prisma/client';

export async function startCheckout(plan: string) {
  const ctx = await requireCapability('billing.manage');
  const valid: PlanTier[] = ['STARTER', 'GROWTH', 'BUSINESS'];
  if (!valid.includes(plan as PlanTier)) {
    return { error: 'Invalid plan.' };
  }
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) return { error: 'NEXT_PUBLIC_BASE_URL is not configured.' };

  const result = await createCheckoutSession({
    workspaceId: ctx.workspaceId,
    plan,
    successUrl: `${baseUrl}/billing?checkout=success`,
    cancelUrl: `${baseUrl}/billing?checkout=cancelled`,
  });

  if (result.error || !result.url) {
    return { error: result.error ?? 'Could not start checkout.' };
  }

  await logAudit({
    workspaceId: ctx.workspaceId,
    userId: ctx.user.$id,
    action: 'billing.checkout_started',
    entityType: 'Subscription',
    metadata: { plan },
  });

  return { url: result.url };
}

export async function openBillingPortal() {
  const ctx = await requireCapability('billing.manage');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) return { error: 'NEXT_PUBLIC_BASE_URL is not configured.' };

  const result = await createPortalSession(ctx.workspaceId, `${baseUrl}/billing`);
  if (result.error || !result.url) {
    return { error: result.error ?? 'Could not open the billing portal.' };
  }
  return { url: result.url };
}

/** Records the connection state so the UI can show it honestly. */
export async function getBillingState() {
  const ctx = await requireWorkspace();
  const [subscription, integration] = await Promise.all([
    prisma.subscription.findUnique({ where: { workspaceId: ctx.workspaceId } }),
    prisma.integration.findUnique({
      where: { workspaceId_type: { workspaceId: ctx.workspaceId, type: 'STRIPE' } },
    }),
  ]);
  return {
    stripeConfigured: isStripeConfigured(),
    subscription: subscription
      ? {
          plan: subscription.plan,
          status: subscription.status,
          seats: subscription.seats,
          currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
          hasStripeCustomer: !!subscription.stripeCustomerId,
        }
      : null,
    integrationStatus: integration?.status ?? 'NOT_CONNECTED',
  };
}