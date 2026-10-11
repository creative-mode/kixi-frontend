import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canEnter,
  joinMessage,
  joinOutcome,
  phaseOf,
  visible,
  type RoomPhase,
} from './exam-room-rules.ts';

const MIN = 60_000;
const at = (deltaMs: number) => new Date(Date.now() + deltaMs).toISOString();

test('a sala com simulação é uma prova, a sala sem é presença', () => {
  // `ExamRoomService.join` devolve `simulationId: null` enquanto a sala está OPEN:
  // o aluno fica registado, mas o papel não é criado.
  const comProva = joinOutcome(200, '', { simulationId: 42 }, { startsAt: null });
  assert.deepEqual(comProva, { kind: 'joined', simulationId: 42 });

  const soPresenca = joinOutcome(200, '', { simulationId: null }, { startsAt: at(30 * MIN) });
  assert.equal(soPresenca.kind, 'attendance');
});

test('as seis recusas do serviço são seis casos, não uma', () => {
  // Os 409 distinguem-se só pela frase. Um switch por status fundia três deles.
  const casos: [number, string, string][] = [
    [409, 'The exam room is not open', 'notOpen'],
    [409, 'The exam room has not started', 'notStarted'],
    [409, 'The exam room has ended', 'ended'],
    [409, 'The room invitation points to a deleted simulation', 'staleInvitation'],
    [403, 'The student is not invited to this room', 'notInvited'],
    [404, 'Exam room not found', 'missing'],
  ];
  for (const [status, message, esperado] of casos) {
    assert.equal(joinOutcome(status, message, null, { startsAt: null }).kind, esperado, message);
  }
});

test('401 é sessão, e nada mais é', () => {
  assert.equal(joinOutcome(401, '', null, null).kind, 'unauthorized');
  // Um 409 que o serviço não reconhece não pode virar "não podes entrar" com confiança.
  assert.equal(joinOutcome(409, 'algo novo do servidor', { simulationId: null }, null).kind, 'attendance');
});

test('"ainda não começou" guarda a hora, e a mensagem mostra-a', () => {
  const quando = at(45 * MIN);
  const r = joinOutcome(409, 'The exam room has not started', null, { startsAt: quando });
  assert.equal(r.kind, 'notStarted');
  assert.match(joinMessage(r), /começa às \d{2}:\d{2}/);
});

test('sem hora, a mensagem não inventa uma', () => {
  const r = joinOutcome(409, 'The exam room has not started', null, { startsAt: null });
  assert.equal(joinMessage(r), 'Esta prova ainda não começou.');
});

test('cada recusa tem uma frase diferente para o aluno', () => {
  const frases = new Set([
    joinMessage({ kind: 'notOpen' }),
    joinMessage({ kind: 'notStarted', startsAt: null }),
    joinMessage({ kind: 'ended' }),
    joinMessage({ kind: 'staleInvitation' }),
    joinMessage({ kind: 'notInvited' }),
    joinMessage({ kind: 'missing' }),
  ]);
  // Fundir as seis num "não podes entrar" é o erro que o service desambigua por nós.
  assert.equal(frases.size, 6);
});

test('um rascunho do professor não se mostra ao aluno', () => {
  assert.equal(visible('DRAFT'), false);
  assert.equal(visible('OPEN'), true);
  assert.equal(visible('RUNNING'), true);
  assert.equal(visible('CLOSED'), true);
});

test('a fase da sala concorda com o que o join aceita', () => {
  const agora = Date.now();
  const casos: [Parameters<typeof phaseOf>, RoomPhase][] = [
    [['DRAFT', at(MIN), at(90 * MIN), agora], 'closed'],
    [['OPEN', at(MIN), at(90 * MIN), agora], 'open'],
    [['CLOSED', at(-90 * MIN), at(-MIN), agora], 'closed'],
    [['RUNNING', at(30 * MIN), at(90 * MIN), agora], 'upcoming'],
    [['RUNNING', at(-MIN), at(90 * MIN), agora], 'running'],
    [['RUNNING', at(-90 * MIN), at(-MIN), agora], 'closed'],
  ];
  for (const [args, esperado] of casos) {
    assert.equal(phaseOf(...args), esperado, JSON.stringify(args));
  }
});

test('só se entra numa sala a correr', () => {
  // Numa sala OPEN o join regista presença e cria a prova; dizer «entrar» ali
  // promete uma prova que o servidor não vai dar.
  assert.equal(canEnter('running'), true);
  assert.equal(canEnter('open'), false);
  assert.equal(canEnter('upcoming'), false);
  assert.equal(canEnter('closed'), false);
});

test('uma data ilegível não vira «a entrar agora»', () => {
  const agora = Date.now();
  // Sem datas não se sabe a fase; o serviço decide, e o cartão não inventar.
  assert.equal(phaseOf('RUNNING', null, null, agora), 'running');
  assert.equal(phaseOf('RUNNING', 'amanhã', null, agora), 'running');
});
