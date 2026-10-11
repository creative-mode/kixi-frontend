import assert from 'node:assert/strict';
import test from 'node:test';

import { invitationsOf, join, ownedBy, type MockRoom } from './exam-rooms.ts';

const MIN = 60_000;
const at = (deltaMs: number) => new Date(Date.now() + deltaMs).toISOString();

const room = (over: Partial<MockRoom> = {}): MockRoom => ({
  id: 1,
  statementId: 1,
  startsAt: at(-MIN),
  endsAt: at(90 * MIN),
  durationMinutes: 90,
  status: 'RUNNING',
  invitedAccountIds: [3],
  ...over,
});

const AGORA = Date.now();

test('só quem está na lista de convidados vê a sala', () => {
  const sala = room();
  assert.equal(invitationsOf([sala], 3).length, 1);
  assert.equal(invitationsOf([sala], 99).length, 0);
});

test('uma sala a correr dá simulação; uma sala aberta dá só presença', () => {
  const aCorrer = invitationsOf([room({ status: 'RUNNING' })], 3);
  assert.notEqual(aCorrer[0].simulationId, null);

  // `OPEN` é presença: o serviço devolve simulationId null e não cria prova.
  const aberta = invitationsOf([room({ status: 'OPEN' })], 3);
  assert.equal(aberta[0].simulationId, null);
  assert.equal(aberta[0].joinedAt, null);
});

test('as recusas são as do serviço, pela mesma ordem', () => {
  const nada = join(undefined, 3, AGORA);
  assert.deepEqual(nada, { status: 404, message: 'Exam room not found' });

  const naoConvidado = join(room({ invitedAccountIds: [] }), 3, AGORA);
  assert.equal(naoConvidado.status, 403);

  // DRAFT e CLOSED são a mesma recusa, como no serviço.
  assert.deepEqual(join(room({ status: 'DRAFT' }), 3, AGORA), { status: 409, message: 'The exam room is not open' });
  assert.deepEqual(join(room({ status: 'CLOSED' }), 3, AGORA), { status: 409, message: 'The exam room is not open' });
});

test('a janela decide, e recusa antes e depois', () => {
  const ainda = join(room({ startsAt: at(30 * MIN) }), 3, AGORA);
  assert.deepEqual(ainda, { status: 409, message: 'The exam room has not started' });

  const acabou = join(room({ endsAt: at(-MIN) }), 3, AGORA);
  assert.deepEqual(acabou, { status: 409, message: 'The exam room has ended' });

  const dentro = join(room(), 3, AGORA);
  assert.deepEqual(dentro, { status: 200, simulationId: room().id * 100 + 3 });
});

test('numa sala aberta, a janela já passou, é o fim e não o começo', () => {
  // A ordem no serviço é: OPEN verifica endsAt; RUNNING verifica startsAt e depois
  // endsAt. Trocar as duas daria «ainda não começou» para uma sala que já acabou.
  const aberta = join(room({ status: 'OPEN', endsAt: at(-MIN) }), 3, AGORA);
  assert.deepEqual(aberta, { status: 409, message: 'The exam room has ended' });

  const abertaFutura = join(room({ status: 'OPEN', endsAt: at(90 * MIN) }), 3, AGORA);
  assert.deepEqual(abertaFutura, { status: 200, simulationId: null });
});

test('entrar duas vezes devolve a mesma prova, não outra', () => {
  // A chave da simulação é sala e conta; entrar de novo devolve a existente.
  const sala = room();
  const primeira = join(sala, 3, AGORA);
  const segunda = join(sala, 3, AGORA);
  assert.deepEqual(primeira, segunda);
});

test('a lista do aluno não traz nada do owned', () => {
  // `/owned` é a lista do professor. O aluno só a lê para a forma da sala.
  assert.deepEqual(ownedBy(), []);
});
