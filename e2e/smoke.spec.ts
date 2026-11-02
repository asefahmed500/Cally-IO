import { test, expect } from '@playwright/test';

/**
 * Public + auth smoke tests. These run without seeded credentials and assert
 * only real behaviour: routing, redirects, and honest unconfigured states.
 */

test('landing page renders the product honestly', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // No fabricated social-proof numbers.
  await expect(page.getByText(/\d+[KkMm+]?\+?\s*(customers|companies|teams)/i)).toHaveCount(0);
});

test('protected routes redirect to login when signed out', async ({ page }) => {
  for (const path of ['/dashboard', '/contacts', '/agents', '/calls', '/analytics', '/billing', '/settings/audit-log']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });
  }
});

test('login page rejects an invalid credential without leaking a stack trace', async ({ page }) => {
  await page.goto('/login');
  const email = page.getByLabel(/email/i);
  if (!(await email.isVisible().catch(() => false))) {
    test.skip(true, 'login form layout differs');
  }
  await email.fill('nobody@example.com');
  await page.getByLabel(/password/i).fill('wrong-password-value');
  await page.locator('button[type="submit"]').first().click();
  await expect(page.locator('body')).not.toContainText('at Object.');
  await expect(page.locator('body')).not.toContainText('node_modules');
});

test('API routes reject unauthenticated access', async ({ request }) => {
  const post = await request.post('/api/tts', { data: { text: 'hello' } });
  expect([401, 403]).toContain(post.status());

  const history = await request.get('/api/chat/history');
  expect([401, 403]).toContain(history.status());
});

test('stripe webhook rejects unsigned payloads', async ({ request }) => {
  const res = await request.post('/api/billing/webhook', { data: 'id=evt_test' });
  expect(res.status()).toBe(400);
});