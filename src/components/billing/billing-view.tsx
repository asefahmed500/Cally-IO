'use client'

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle2, CreditCard, ExternalLink, Loader2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTransition } from 'react';
import { startCheckout, openBillingPortal } from '@/app/billing/actions';
import { PLAN_PRICING } from '@/lib/usage';
import type { PlanTier } from '@prisma/client';

type UsageItem = { label: string; used: number; limit: number };

type BillingState = {
  stripeConfigured: boolean;
  subscription: {
    plan: PlanTier;
    status: string;
    seats: number;
    currentPeriodEnd: string | null;
    hasStripeCustomer: boolean;
  } | null;
  integrationStatus: string;
};

const PLAN_ORDER: PlanTier[] = ['FREE', 'STARTER', 'GROWTH', 'BUSINESS', 'ENTERPRISE'];

const PLAN_FEATURES: Record<PlanTier, string[]> = {
  FREE: ['100 AI minutes', '50 telephony minutes', '1 AI agent', '3 members', '1 phone number'],
  STARTER: ['600 AI minutes', '300 telephony minutes', '3 AI agents', '5 members', '2 phone numbers'],
  GROWTH: ['3,000 AI minutes', '1,500 telephony minutes', '10 AI agents', '20 members', '5 phone numbers'],
  BUSINESS: ['15,000 AI minutes', '7,500 telephony minutes', '30 AI agents', '75 members', '15 phone numbers'],
  ENTERPRISE: ['Unlimited usage', 'Custom agent limits', 'SSO & audit export', 'Dedicated support', 'SLA'],
};

function formatLimit(limit: number): string {
  if (!Number.isFinite(limit)) return '∞';
  if (limit >= 1000) return limit.toLocaleString();
  return String(limit);
}

export function BillingView({
  canManage,
  billing,
  usage,
}: {
  canManage: boolean;
  billing: BillingState;
  usage: { plan: PlanTier; periodEnd: string; items: UsageItem[] };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const checkoutState = searchParams.get('checkout');

  const handleCheckout = (plan: PlanTier) => {
    startTransition(async () => {
      const result = await startCheckout(plan);
      if (result.url) {
        window.location.href = result.url;
      } else {
        toast({ variant: 'destructive', title: 'Checkout unavailable', description: result.error });
      }
    });
  };

  const handlePortal = () => {
    startTransition(async () => {
      const result = await openBillingPortal();
      if (result.url) {
        window.location.href = result.url;
      } else {
        toast({ variant: 'destructive', title: 'Portal unavailable', description: result.error });
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {checkoutState === 'success' && (
        <Alert className="border-success/40">
          <CheckCircle2 className="size-4 text-success" />
          <AlertTitle>Checkout complete</AlertTitle>
          <AlertDescription>
            Stripe is confirming your subscription via webhook — the plan updates within seconds.
          </AlertDescription>
        </Alert>
      )}
      {checkoutState === 'cancelled' && (
        <Alert>
          <Info className="size-4" />
          <AlertTitle>Checkout cancelled</AlertTitle>
          <AlertDescription>No changes were made to your subscription.</AlertDescription>
        </Alert>
      )}
      {!billing.stripeConfigured && (
        <Alert>
          <CreditCard className="size-4" />
          <AlertTitle>Billing not connected</AlertTitle>
          <AlertDescription>
            Add <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_WEBHOOK_SECRET</code> (plus plan
            price IDs) to enable real test-mode checkout. No payments are simulated.
          </AlertDescription>
        </Alert>
      )}

      {/* Current usage */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Current Usage — {usage.plan} plan
          </CardTitle>
          <CardDescription>
            Resets {new Date(usage.periodEnd).toLocaleDateString()}. Metered from real activity.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {usage.items.map((item) => {
            const pct = Number.isFinite(item.limit) ? Math.min(100, Math.round((item.used / item.limit) * 100)) : 0;
            const over = Number.isFinite(item.limit) && item.used >= item.limit;
            return (
              <div key={item.label} className="border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className={`text-xs tabular-nums ${over ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
                    {formatLimit(Math.round(item.used))} / {formatLimit(item.limit)}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full bg-muted">
                  <div
                    className={over ? 'h-full bg-destructive' : 'h-full bg-primary'}
                    style={{ width: `${Number.isFinite(item.limit) ? pct : 0}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Subscription state */}
      {billing.subscription && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Subscription</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-4 text-sm">
            <Badge variant={billing.subscription.status === 'ACTIVE' ? 'default' : 'secondary'}>
              {billing.subscription.status}
            </Badge>
            <span>
              Plan: <span className="font-medium">{billing.subscription.plan}</span>
            </span>
            {billing.subscription.currentPeriodEnd && (
              <span className="text-muted-foreground">
                Renews {new Date(billing.subscription.currentPeriodEnd).toLocaleDateString()}
              </span>
            )}
            {canManage && billing.subscription.hasStripeCustomer && (
              <Button variant="outline" size="sm" className="ml-auto" onClick={handlePortal} disabled={isPending}>
                <ExternalLink />
                Manage in Stripe
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plans */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Plans</h2>
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
          {PLAN_ORDER.map((plan) => {
            const isCurrent = usage.plan === plan;
            const price = PLAN_PRICING[plan];
            const purchasable = plan !== 'FREE' && plan !== 'ENTERPRISE';
            return (
              <Card key={plan} className={isCurrent ? 'border-primary' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{price.label}</CardTitle>
                    {isCurrent && <Badge>Current</Badge>}
                  </div>
                  <CardDescription>
                    {plan === 'ENTERPRISE'
                      ? 'Contact sales'
                      : price.monthly === 0
                        ? 'Free forever'
                        : `$${price.monthly}/mo`}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <ul className="flex flex-col gap-1.5">
                    {PLAN_FEATURES[plan].map((feature) => (
                      <li key={feature} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 size-3 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Separator />
                  {plan === 'FREE' ? (
                    <Button variant="outline" size="sm" disabled>
                      Included
                    </Button>
                  ) : plan === 'ENTERPRISE' ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href="mailto:sales@cally-io.com">Contact sales</a>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="mt-auto"
                      disabled={!canManage || isPending || !billing.stripeConfigured || isCurrent}
                      onClick={() => handleCheckout(plan)}
                    >
                      {isPending && <Loader2 className="animate-spin" />}
                      {isCurrent ? 'Current plan' : 'Upgrade'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}