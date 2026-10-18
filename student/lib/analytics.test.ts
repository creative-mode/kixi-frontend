import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canTrack,
  EVENTS,
  eventInSearch,
  isEventName,
  searchWithoutEvent,
  sendEvent,
  withEvent,
} from './analytics.ts';

test('a analítica só passa com a escolha «tudo» e uma propriedade configurada', () => {
  assert.equal(canTrack('all', 'G-ABC123'), true);
  assert.equal(canTrack(null, 'G-ABC123'), false);
  assert.equal(canTrack('necessary', 'G-ABC123'), false);
  assert.equal(canTrack('all', ''), false);
});

test('um evento só sai com consentimento, propriedade e gtag', () => {
  const sent: unknown[][] = [];
  const gtag = (...args: unknown[]) => { sent.push(args); };

  assert.equal(sendEvent(gtag, 'necessary', 'G-ABC123', EVENTS.examStarted), false);
  assert.equal(sendEvent(gtag, null, 'G-ABC123', EVENTS.examStarted), false);
  assert.equal(sendEvent(gtag, 'all', '', EVENTS.examStarted), false);
  assert.equal(sendEvent(undefined, 'all', 'G-ABC123', EVENTS.examStarted), false);
  assert.deepEqual(sent, [], 'nenhum dos casos não consentidos pode ter enviado');

  assert.equal(sendEvent(gtag, 'all', 'G-ABC123', EVENTS.examStarted, { origem: 'aluno' }), true);
  assert.deepEqual(sent, [['event', 'prova_iniciada', { origem: 'aluno' }]]);
});

test('só nomes do catálogo são eventos', () => {
  assert.equal(isEventName('prova_submetida'), true);
  assert.equal(isEventName('doacao_submetida'), false, 'o evento da landing não é do aluno');
  assert.equal(isEventName(undefined), false);
  assert.equal(isEventName(7), false);
});

test('o evento junta-se ao caminho e sobrevive à query que já lá está', () => {
  assert.equal(withEvent('/inicio', EVENTS.onboardingDone), '/inicio?evento=onboarding_concluido');
  assert.equal(
    withEvent('/resultado?prova=42', EVENTS.examSubmitted),
    '/resultado?prova=42&evento=prova_submetida',
  );
});

test('um destino com origem própria fica sem marcador', () => {
  assert.equal(withEvent('https://gestor.kixi.ao/manager', EVENTS.registrationDone), 'https://gestor.kixi.ao/manager');
});

test('lê o evento do endereço e limpa-o sem tocar no resto', () => {
  assert.equal(eventInSearch('?evento=registo_concluido'), 'registo_concluido');
  assert.equal(eventInSearch('?prova=42&evento=prova_submetida'), 'prova_submetida');
  assert.equal(eventInSearch('?evento=inventado'), null, 'um nome fora do catálogo não passa');
  assert.equal(eventInSearch('?prova=42'), null);
  assert.equal(eventInSearch(''), null);

  assert.equal(searchWithoutEvent('?evento=registo_concluido'), '');
  assert.equal(searchWithoutEvent('?prova=42&evento=prova_submetida'), '?prova=42');
});
