import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalyticsQueue, safePageLocation, sanitizeAttribution, sanitizeEvent } from './analytics.ts';

test('fila: envia eventos quando gtag está disponível e mantém o schema privado', () => {
  const calls: unknown[][] = [];
  const queue = createAnalyticsQueue({ hasConsent: () => true, getGtag: () => ((...args) => calls.push(args)), getOrigin: () => 'https://kixi.ao' });
  assert.equal(queue.track('page_view', { app: 'landing', page: 'home', page_location: 'https://kixi.ao/?email=ana@example.ao' }), 'sent');
  assert.equal(calls.length, 1);
  assert.equal((calls[0][2] as Record<string, unknown>).page_location, 'https://kixi.ao/');
  assert.equal('page_referrer' in (calls[0][2] as object), true);
});

test('fila: preserva em memória até gtag carregar, respeitando consentimento e limite', () => {
  let granted = true;
  let ready = false;
  const calls: unknown[][] = [];
  const queue = createAnalyticsQueue({ hasConsent: () => granted, getGtag: () => ready ? ((...args) => calls.push(args)) : undefined, getOrigin: () => 'https://kixi.ao', maxPending: 2 });
  assert.equal(queue.track('signup_started', { surface: 'signup_form' }), 'queued');
  assert.equal(queue.track('donation_started'), 'queued');
  assert.equal(queue.track('donation_started'), 'overflow');
  ready = true;
  assert.equal(queue.flush(), 2);
  assert.equal(queue.pendingCount(), 0);
  assert.equal(calls.length, 2);
  ready = false;
  queue.track('signup_started', { surface: 'signup_form' });
  granted = false;
  assert.equal(queue.flush(), 0);
  assert.equal(queue.pendingCount(), 0);
  assert.equal(queue.track('sign_up'), 'denied');
});

test('all events override GA auto-location with a canonical URL without query strings', () => {
  const calls: unknown[][] = [];
  const queue = createAnalyticsQueue({ hasConsent: () => true, getGtag: () => ((...args) => calls.push(args)), getOrigin: () => 'https://kixi.ao', getPathname: () => '/aluno/cadastro?email=ana@example.ao#password' });
  assert.equal(queue.track('signup_started', { surface: 'signup_form' }), 'sent');
  const params = calls[0][2] as Record<string, unknown>;
  assert.equal(params.page_location, 'https://kixi.ao/aluno/cadastro');
  assert.equal(params.page_referrer, '');
});

test('schema rejects free text and personal data in event parameters', () => {
  assert.deepEqual(sanitizeEvent('signup_error', { field: 'email', category: 'validation', value: 'ana@example.ao' })?.params, { field: 'email', category: 'validation' });
  assert.deepEqual(sanitizeEvent('donation_error', { step: 'contact', category: 'validation', field: 'donor_email', value: 'ana@example.ao' })?.params, { step: 'contact', category: 'validation', field: 'donor_email' });
  assert.deepEqual(sanitizeEvent('signup_error', { field: 'email', category: 'validation' })?.params, { field: 'email', category: 'validation' });
  assert.deepEqual(sanitizeEvent('error_view', { app: 'student', kind: 'unexpected', message: 'private error' })?.params, { app: 'student', kind: 'unexpected' });
});

test('UTM aceita apenas valores controlados e únicos', () => {
  assert.deepEqual(sanitizeAttribution(new URLSearchParams('utm_source=google&utm_medium=cpc&utm_campaign=launch&utm_term=private')), { utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'launch' });
  assert.deepEqual(sanitizeAttribution(new URLSearchParams('utm_source=ana%40example.ao&utm_campaign=launch&utm_campaign=back_to_school')), {});
});

test('o contexto de qualquer app usa apenas origem e rota categorizada', () => {
  assert.equal(safePageLocation('manager', 'login', 'https://kixi.ao'), 'https://kixi.ao/manager/login');
  assert.equal(safePageLocation('student', 'exam', 'https://kixi.ao'), 'https://kixi.ao/aluno/prova');
  assert.equal(safePageLocation('landing', 'donation', 'https://kixi.ao'), 'https://kixi.ao/doar');
});

test('evento ainda pendente é descartado ao retirar consentimento e não volta ao aceitar', () => {
  let granted = true;
  let ready = false;
  const calls: unknown[][] = [];
  const queue = createAnalyticsQueue({ hasConsent: () => granted, getGtag: () => ready ? ((...args) => calls.push(args)) : undefined, getOrigin: () => 'https://kixi.ao' });
  assert.equal(queue.track('page_view', { app: 'landing', page: 'home' }), 'queued');
  granted = false;
  assert.equal(queue.flush(), 0);
  assert.equal(queue.pendingCount(), 0);
  granted = true;
  ready = true;
  assert.equal(queue.flush(), 0);
  assert.equal(calls.length, 0);
});

test('URLs com parâmetros sensíveis não são enviadas ao gtag', () => {
  const calls: unknown[][] = [];
  const queue = createAnalyticsQueue({ hasConsent: () => true, getGtag: () => ((...args) => calls.push(args)), getOrigin: () => 'https://kixi.ao', getPathname: () => '/doar?email=ana@example.ao#donation' });
  const result = queue.track('page_view', { app: 'landing', page: 'donation' });
  assert.equal(result, 'sent');
  const params = calls[0][2] as Record<string, unknown>;
  assert.equal(params.page_location, 'https://kixi.ao/doar');
  assert.equal(params.page_referrer, '');
  assert.ok(!String(params).includes('ana@example.ao'));
  assert.ok(!String(params).includes('donation'));
});

test('eventos automáticos não contornam a proteção de consentimento', () => {
  let granted = true;
  const calls: unknown[][] = [];
  const queue = createAnalyticsQueue({ hasConsent: () => granted, getGtag: () => ((...args) => calls.push(args)), getOrigin: () => 'https://kixi.ao' });
  granted = false;
  assert.equal(queue.track('page_view', { app: 'landing', page: 'home' }), 'denied');
  assert.equal(calls.length, 0);
});

test('retirada de consentimento desativa imediatamente a medição', () => {
  let granted = true;
  const calls: unknown[][] = [];
  const queue = createAnalyticsQueue({ hasConsent: () => granted, getGtag: () => ((...args) => calls.push(args)), getOrigin: () => 'https://kixi.ao' });
  assert.equal(queue.track('page_view', { app: 'landing', page: 'home' }), 'sent');
  assert.equal(calls.length, 1);
  granted = false;
  assert.equal(queue.track('cta_click', { surface: 'hero', destination: 'signup' }), 'denied');
  assert.equal(calls.length, 1);
});

test('reabertura das definições mantém a medição desativada', () => {
  let granted = false;
  const calls: unknown[][] = [];
  const queue = createAnalyticsQueue({ hasConsent: () => granted, getGtag: () => ((...args) => calls.push(args)), getOrigin: () => 'https://kixi.ao' });
  assert.equal(queue.track('page_view', { app: 'landing', page: 'home' }), 'denied');
  assert.equal(calls.length, 0);
  granted = false;
  assert.equal(queue.track('cta_click', { surface: 'hero', destination: 'signup' }), 'denied');
  assert.equal(calls.length, 0);
});

test('eventos pendentes não são enviados após retirada do consentimento', () => {
  let granted = true;
  let ready = false;
  const calls: unknown[][] = [];
  const queue = createAnalyticsQueue({ hasConsent: () => granted, getGtag: () => ready ? ((...args) => calls.push(args)) : undefined, getOrigin: () => 'https://kixi.ao' });
  assert.equal(queue.track('page_view', { app: 'landing', page: 'home' }), 'queued');
  assert.equal(queue.track('cta_click', { surface: 'hero', destination: 'signup' }), 'queued');
  granted = false;
  assert.equal(queue.flush(), 0);
  assert.equal(queue.pendingCount(), 0);
  assert.equal(calls.length, 0);
});

test('reaceitar consentimento não duplica eventos já enviados', () => {
  let granted = true;
  let ready = true;
  const calls: unknown[][] = [];
  const queue = createAnalyticsQueue({ hasConsent: () => granted, getGtag: () => ready ? ((...args) => calls.push(args)) : undefined, getOrigin: () => 'https://kixi.ao' });
  assert.equal(queue.track('page_view', { app: 'landing', page: 'home' }), 'sent');
  assert.equal(calls.length, 1);
  granted = false;
  granted = true;
  assert.equal(queue.track('page_view', { app: 'landing', page: 'home' }), 'sent');
  assert.equal(calls.length, 2);
});

test('comportamento consistente nas três aplicações', () => {
  for (const app of ['manager', 'student', 'landing']) {
    const calls: unknown[][] = [];
    const queue = createAnalyticsQueue({ hasConsent: () => true, getGtag: () => ((...args) => calls.push(args)), getOrigin: () => 'https://kixi.ao' });
    const result = queue.track('page_view', { app: app as any, page: 'other' });
    assert.equal(result, 'sent');
    assert.equal(calls.length, 1);
    const params = calls[0][2] as Record<string, unknown>;
    assert.ok(String(params.page_location).startsWith('https://kixi.ao'));
    assert.ok(!String(params.page_location).includes('?'));
    assert.ok(!String(params.page_location).includes('#'));
    assert.equal(params.page_referrer, '');
    assert.equal(params.app, app);
  }
});
