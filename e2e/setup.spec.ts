import { test, expect } from '@playwright/test';

// Ce test valide uniquement que le serveur répond.
// Il sera remplacé par walking-skeleton.spec.ts en Phase 1.
test('serveur répond sur /health', async ({ request }) => {
  const res = await request.get('/health');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body).toHaveProperty('status', 'ok');
});
