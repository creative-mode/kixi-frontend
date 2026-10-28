import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cabecalhosDeSeguranca } from './security-headers.ts';

const valor = (cabecalhos: { key: string; value: string }[], chave: string) => cabecalhos.find((h) => h.key === chave)?.value;

test('os cabeçalhos de base estão sempre lá', () => {
  const h = cabecalhosDeSeguranca({});
  assert.equal(valor(h, 'X-Content-Type-Options'), 'nosniff');
  assert.equal(valor(h, 'Referrer-Policy'), 'strict-origin-when-cross-origin');
  assert.equal(valor(h, 'X-Frame-Options'), 'SAMEORIGIN');
  assert.match(valor(h, 'Permissions-Policy') ?? '', /camera=\(\)/);
  assert.match(valor(h, 'Permissions-Policy') ?? '', /microphone=\(\)/);
});

test('a CSP imposta só leva o que não custa nada: sem plugins, base fixa e molduras só da mesma origem', () => {
  const imposta = valor(cabecalhosDeSeguranca({}), 'Content-Security-Policy');
  assert.equal(imposta, "object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
});

test('a política completa é só relatório e fecha tudo à mesma origem', () => {
  const h = cabecalhosDeSeguranca({});
  assert.equal(valor(h, 'Content-Security-Policy'), "object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
  const relatorio = valor(h, 'Content-Security-Policy-Report-Only') ?? '';
  assert.match(relatorio, /default-src 'self'/);
  assert.match(relatorio, /frame-src 'none'/);
  assert.match(relatorio, /form-action 'self'/);
  assert.doesNotMatch(relatorio, /unsafe-eval/);
  assert.doesNotMatch(relatorio, /(^|[ ;])\*([ ;]|$)/); // nenhum curinga solto
  assert.doesNotMatch(relatorio, /http:/); // nada de HTTP sem cifra
});

test('sem NEXT_PUBLIC_GA_ID nenhum domínio do Google entra na política', () => {
  const relatorio = valor(cabecalhosDeSeguranca({}), 'Content-Security-Policy-Report-Only') ?? '';
  assert.doesNotMatch(relatorio, /google/);
});

test('com NEXT_PUBLIC_GA_ID só o necessário ao Analytics é permitido, em scripts, ligações e imagens', () => {
  const relatorio = valor(cabecalhosDeSeguranca({ NEXT_PUBLIC_GA_ID: 'G-TESTE' }), 'Content-Security-Policy-Report-Only') ?? '';
  assert.match(relatorio, /script-src 'self' 'unsafe-inline' https:\/\/www\.googletagmanager\.com/);
  assert.match(relatorio, /connect-src 'self' https:\/\/www\.googletagmanager\.com https:\/\/\*\.google-analytics\.com/);
  assert.match(relatorio, /img-src 'self' data: blob: https:\/\/\*\.google-analytics\.com/);
  assert.doesNotMatch(relatorio, /default-src[^;]*google/); // o resto continua fechado
});

test('o X-Frame-Options e o frame-ancestors dizem o mesmo (a mesma origem)', () => {
  const h = cabecalhosDeSeguranca({});
  assert.equal(valor(h, 'X-Frame-Options'), 'SAMEORIGIN');
  assert.match(valor(h, 'Content-Security-Policy') ?? '', /frame-ancestors 'self'/);
});
