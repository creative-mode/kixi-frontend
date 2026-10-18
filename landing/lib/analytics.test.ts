import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canTrack, EVENTS, sendEvent } from './analytics.ts';

test('a analítica só passa com a escolha «tudo» e uma propriedade configurada', () => {
  assert.equal(canTrack('all', 'G-ABC123'), true);
  assert.equal(canTrack(null, 'G-ABC123'), false);
  assert.equal(canTrack('necessary', 'G-ABC123'), false);
  assert.equal(canTrack('all', ''), false);
});

test('um evento só sai com consentimento, propriedade e gtag', () => {
  const sent: unknown[][] = [];
  const gtag = (...args: unknown[]) => { sent.push(args); };

  assert.equal(sendEvent(gtag, 'necessary', 'G-ABC123', EVENTS.donationSubmitted), false);
  assert.equal(sendEvent(gtag, null, 'G-ABC123', EVENTS.donationSubmitted), false);
  assert.equal(sendEvent(gtag, 'all', '', EVENTS.donationSubmitted), false);
  assert.equal(sendEvent(undefined, 'all', 'G-ABC123', EVENTS.donationSubmitted), false);
  assert.deepEqual(sent, [], 'nenhum dos casos não consentidos pode ter enviado');

  assert.equal(sendEvent(gtag, 'all', 'G-ABC123', EVENTS.donationSubmitted, { origem: 'landing' }), true);
  assert.deepEqual(sent, [['event', 'doacao_submetida', { origem: 'landing' }]]);
});

test('o evento sai sem parâmetros quando não há nenhum', () => {
  const sent: unknown[][] = [];
  const gtag = (...args: unknown[]) => { sent.push(args); };
  assert.equal(sendEvent(gtag, 'all', 'G-ABC123', EVENTS.donationSubmitted), true);
  assert.deepEqual(sent, [['event', 'doacao_submetida', {}]]);
});
