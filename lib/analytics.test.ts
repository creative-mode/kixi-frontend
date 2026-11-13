import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalyticsQueue, safePageLocation, sanitizeAttribution, sanitizeEvent, type AnalyticsApp, attributionFromSearch, donationField, donationStep, scrollDepthsReached, signupField } from './analytics.ts';

test('fila: envia eventos quando gtag está disponível e mantém o schema privado', () => {
  const calls: unknown[][] = [];
  const queue = createAnalyticsQueue({ hasConsent: () => true, getGtag: () => ((...args: unknown[]) => calls.push(args)), getOrigin: () => 'https://kixi.ao' });
  assert.equal(queue.track('page_view', { app: 'landing', page: 'home', page_location: 'https://kixi.ao/?email=ana@example.ao' }), 'sent');
  assert.equal(calls.length, 1);
  assert.equal((calls[0][2] as Record<string, unknown>).page_location, 'https://kixi.ao/');
  assert.equal('page_referrer' in (calls[0][2] as object), true);
});

test('fila: preserva em memória até gtag carregar, respeitando consentimento e limite', () => {
  let granted = true;
  let ready = false;
  const calls: unknown[][] = [];
  const queue = createAnalyticsQueue({ hasConsent: () => granted, getGtag: () => ready ? ((...args: unknown[]) => calls.push(args)) : undefined, getOrigin: () => 'https://kixi.ao', maxPending: 2 });
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
  const queue = createAnalyticsQueue({ hasConsent: () => true, getGtag: () => ((...args: unknown[]) => calls.push(args)), getOrigin: () => 'https://kixi.ao', getPathname: () => '/aluno/cadastro?email=ana@example.ao#password' });
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
  const queue = createAnalyticsQueue({ hasConsent: () => granted, getGtag: () => ready ? ((...args: unknown[]) => calls.push(args)) : undefined, getOrigin: () => 'https://kixi.ao' });
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
  const queue = createAnalyticsQueue({ hasConsent: () => true, getGtag: () => ((...args: unknown[]) => calls.push(args)), getOrigin: () => 'https://kixi.ao', getPathname: () => '/aluno/cadastro?email=ana@example.ao#password' });
  const result = queue.track('page_view', { app: 'student', page: 'signup' });
  assert.equal(result, 'sent');
  const params = calls[0][2] as Record<string, unknown>;
  assert.equal(params.page_location, 'https://kixi.ao/aluno/cadastro');
  assert.equal(params.page_referrer, '');
  assert.ok(!String(params).includes('ana@example.ao'));
  assert.ok(!String(params).includes('password'));
});

test('eventos automáticos não contornam a proteção de consentimento', () => {
  let granted = true;
  const calls: unknown[][] = [];
  const queue = createAnalyticsQueue({ hasConsent: () => granted, getGtag: () => ((...args: unknown[]) => calls.push(args)), getOrigin: () => 'https://kixi.ao' });
  granted = false;
  assert.equal(queue.track('page_view', { app: 'landing', page: 'home' }), 'denied');
  assert.equal(calls.length, 0);
});

test('retirada de consentimento desativa imediatamente a medição', () => {
  let granted = true;
  const calls: unknown[][] = [];
  const queue = createAnalyticsQueue({ hasConsent: () => granted, getGtag: () => ((...args: unknown[]) => calls.push(args)), getOrigin: () => 'https://kixi.ao' });
  assert.equal(queue.track('page_view', { app: 'landing', page: 'home' }), 'sent');
  assert.equal(calls.length, 1);
  granted = false;
  assert.equal(queue.track('cta_clique', { origem: 'header' }), 'denied');
  assert.equal(calls.length, 1); // nenhum novo evento enviado após a retirada
});

test('reabertura das definições mantém a medição desativada', () => {
  let granted = false;
  const calls: unknown[][] = [];
  const queue = createAnalyticsQueue({ hasConsent: () => granted, getGtag: () => ((...args: unknown[]) => calls.push(args)), getOrigin: () => 'https://kixi.ao' });
  assert.equal(queue.track('page_view', { app: 'landing', page: 'home' }), 'denied');
  assert.equal(calls.length, 0);
  granted = false; // reabrir definições com consentimento nulo continua sem medir
  assert.equal(queue.track('cta_clique', { origem: 'header' }), 'denied');
  assert.equal(calls.length, 0);
});

test('eventos pendentes não são enviados após retirada do consentimento', () => {
  let granted = true;
  const ready = false;
  const calls: unknown[][] = [];
  const queue = createAnalyticsQueue({ hasConsent: () => granted, getGtag: () => ready ? ((...args: unknown[]) => calls.push(args)) : undefined, getOrigin: () => 'https://kixi.ao' });
  assert.equal(queue.track('page_view', { app: 'landing', page: 'home' }), 'queued');
  assert.equal(queue.track('cta_clique', { origem: 'header' }), 'queued');
  granted = false;
  assert.equal(queue.flush(), 0);
  assert.equal(queue.pendingCount(), 0);
  assert.equal(calls.length, 0);
});

test('reaceitar consentimento não duplica eventos já enviados', () => {
  let granted = true;
  const ready = true;
  const calls: unknown[][] = [];
  const queue = createAnalyticsQueue({ hasConsent: () => granted, getGtag: () => ready ? ((...args: unknown[]) => calls.push(args)) : undefined, getOrigin: () => 'https://kixi.ao' });
  assert.equal(queue.track('page_view', { app: 'landing', page: 'home' }), 'sent');
  assert.equal(calls.length, 1);
  granted = false;
  granted = true;
  assert.equal(queue.track('page_view', { app: 'landing', page: 'home' }), 'sent');
  assert.equal(calls.length, 2); // apenas o novo evento, sem duplicação do anterior
});

test('comportamento consistente nas três aplicações', () => {
  for (const app of ['manager', 'student', 'landing']) {
    const calls: unknown[][] = [];
    const queue = createAnalyticsQueue({ hasConsent: () => true, getGtag: () => ((...args: unknown[]) => calls.push(args)), getOrigin: () => 'https://kixi.ao' });
    const result = queue.track('page_view', { app: app as AnalyticsApp, page: 'other' });
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

test('cta_clique leva só a origem do CTA da landing (#512), como o CtaLink envia', () => {
  assert.deepEqual(sanitizeEvent('cta_clique', { origem: 'outro' }), { event: 'cta_clique', params: { origem: 'outro' } });
  assert.deepEqual(sanitizeEvent('cta_clique', { origem: 'faq', email: 'ana@example.ao' }), { event: 'cta_clique', params: { origem: 'faq' } });
  // #762: as entradas novas de «Doar um enunciado» contam cada uma a sua origem.
  for (const origem of ['header', 'hero', 'provas', 'provas-empty', 'student-menu']) {
    assert.deepEqual(sanitizeEvent('cta_clique', { origem, destino: 'doar' }), { event: 'cta_clique', params: { origem } });
  }
  assert.equal(sanitizeEvent('cta_clique', { origem: 'footer' }), null);
  assert.equal(sanitizeEvent('cta_click', { surface: 'hero', destination: 'signup' }), null);
});

test('scroll_depth só é aceite na landing, como dizem os docs', () => {
  assert.deepEqual(sanitizeEvent('scroll_depth', { app: 'landing', page: 'home', depth: 50 }), { event: 'scroll_depth', params: { app: 'landing', page: 'home', depth: 50 } });
  assert.equal(sanitizeEvent('scroll_depth', { app: 'student', page: 'exam', depth: 50 }), null);
  assert.equal(sanitizeEvent('scroll_depth', { app: 'manager', page: 'dashboard', depth: 50 }), null);
  assert.equal(sanitizeEvent('scroll_depth', { app: 'landing', page: 'home', depth: 33 }), null);
});

test('UTMs do endereço: só as permitidas, o resto descartado', () => {
  assert.deepEqual(attributionFromSearch('?utm_source=whatsapp&utm_medium=social&email=ana@kixi.ao&utm_term=x'), { utm_source: 'whatsapp', utm_medium: 'social' });
  assert.deepEqual(attributionFromSearch(''), {});
});

test('scroll_depth: limiares pela parte vista da página, sem passar de 100', () => {
  assert.deepEqual(scrollDepthsReached(0, 800, 4000), []);
  assert.deepEqual(scrollDepthsReached(1200, 800, 4000), [25, 50]);
  assert.deepEqual(scrollDepthsReached(3200, 800, 4000), [25, 50, 75, 100]);
  assert.deepEqual(scrollDepthsReached(3199.6, 800, 4000), [25, 50, 75, 100], 'meio píxel de folga no fim');
  assert.deepEqual(scrollDepthsReached(-50, 800, 4000), [], 'o elástico do iOS não conta');
  assert.deepEqual(scrollDepthsReached(0, 800, 0), []);
});

test('campos e passos no nome do contrato: o sanitize aceita-os, e o que não se conhece vai para form', () => {
  assert.equal(signupField('firstName'), 'first_name');
  assert.equal(signupField('confirm'), 'confirm');
  assert.equal(signupField('outro'), 'form');
  assert.equal(donationField('institutionName'), 'institution');
  assert.equal(donationField('donorEmail'), 'donor_email');
  assert.equal(donationField('website'), 'form');
  assert.deepEqual([0, 1, 2, 7, -1].map(donationStep), ['statement', 'origin', 'contact', 'contact', 'statement']);
  for (const name of ['firstName', 'lastName', 'username', 'email', 'password', 'confirm', 'x']) {
    assert.ok(sanitizeEvent('signup_error', { field: signupField(name), category: 'validation' }), name);
  }
  for (const name of ['files', 'institutionName', 'subjectName', 'examType', 'classGrade', 'schoolYear', 'donorName', 'donorEmail', 'notes', 'consent', 'x']) {
    assert.ok(sanitizeEvent('donation_error', { step: donationStep(1), category: 'validation', field: donationField(name) }), name);
  }
});


test('donation_error separa o 429 (rate_limit) de um erro do servidor', () => {
  assert.deepEqual(sanitizeEvent('donation_error', { step: 'contact', category: 'rate_limit' }), { event: 'donation_error', params: { step: 'contact', category: 'rate_limit' } });
  assert.deepEqual(sanitizeEvent('donation_error', { step: 'contact', category: 'server' }), { event: 'donation_error', params: { step: 'contact', category: 'server' } });
  assert.equal(sanitizeEvent('donation_error', { step: 'contact', category: 'timeout' }), null);
});
