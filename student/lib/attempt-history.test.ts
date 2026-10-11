import assert from 'node:assert/strict';
import test from 'node:test';

import {
  currentAttempt,
  formatScore,
  history,
  inProgress,
  isFinished,
  labelOf,
  settled,
  sinceLabel,
  type Attempt,
} from './attempt-history.ts';

const done = (id: number, score: number | null = 16.4, status = 'FINISHED'): Attempt => ({ id, status, finalScore: score });
const running = (id: number): Attempt => ({ id, status: 'IN_PROGRESS', finalScore: null });

test('a tentativa em curso ganha a mais recente', () => {
  // A regra do cartão: há uma prova por terminar, e é dessa que se fala. Sem ela,
  // a mesma prova aparecia terminada no cartão e em curso no detalhe.
  assert.equal(currentAttempt([done(1), running(2), done(3)])?.id, 2);
  assert.equal(currentAttempt([done(1), done(3)])?.id, 3);
  assert.equal(currentAttempt([running(5), done(9)])?.id, 5);
});

test('sem tentativas não há tentativa actual', () => {
  assert.equal(currentAttempt([]), null);
});

test('o estado é lido sem distinção de maiúsculas', () => {
  assert.equal(inProgress({ id: 1, status: 'in_progress' }), true);
  assert.equal(isFinished({ id: 1, status: 'finished' }), true);
  assert.equal(inProgress({ id: 1 }), false);
});

test('o histórico vai do mais recente para o mais antigo', () => {
  // Ordenar por id porque é o que o backend garante. `startedAt` não vem em todas
  // as respostas e ordenar por ele reordenava em silêncio quando faltava.
  assert.deepEqual(history([done(1), done(3), done(2)]).map((a) => a.id), [3, 2, 1]);
  assert.deepEqual(history([]), []);
});

test('o histórico não mexe na lista que recebeu', () => {
  const original = [done(1), done(2)];
  history(original);
  assert.deepEqual(original.map((a) => a.id), [1, 2]);
});

test('uma nota de zero é uma nota', () => {
  // Só a ausente é ausente: um aluno que tirou zero fez a prova como os outros.
  assert.equal(formatScore(0), '0');
  assert.equal(formatScore(16.4), '16,4');
  assert.equal(formatScore(null), undefined);
  assert.equal(formatScore(undefined), undefined);
});

test('o tempo passado é legível e nunca inventa data', () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  const min = 60_000, hora = 60 * min, dia = 24 * hora;
  assert.equal(sinceLabel(ago(30_000)), 'agora mesmo');
  assert.equal(sinceLabel(ago(5 * min)), 'há 5 min');
  assert.equal(sinceLabel(ago(3 * hora)), 'há 3 h');
  assert.equal(sinceLabel(ago(1 * dia)), 'há 1 dia');
  assert.equal(sinceLabel(ago(5 * dia)), 'há 5 dias');
  assert.equal(sinceLabel(ago(40 * dia)), 'há 1 mês');
  assert.equal(sinceLabel(ago(90 * dia)), 'há 3 meses');
});

test('uma data ausente ou ilegível não vira "agora mesmo"', () => {
  // A alternativa seria dizer ao aluno que a prova foi mesmo agora, quando o que
  // falta é a data. Ausente é ausente.
  assert.equal(sinceLabel(null), undefined);
  assert.equal(sinceLabel(undefined), undefined);
  assert.equal(sinceLabel(''), undefined);
  assert.equal(sinceLabel('ontem'), undefined);
});

test('uma data no futuro não dá um tempo negativo', () => {
  const futuro = new Date(Date.now() + 5 * 60_000).toISOString();
  assert.equal(sinceLabel(futuro), 'agora mesmo');
});

// ── CANCELLED ────────────────────────────────────────────────────────────────
// O aluno cancela uma tentativa com `PUT /simulations/{id}`, e aí o cartão e o
// detalhe discordavam: o cartão contava-a como terminada («Ver resultado») porque
// usava `status !== 'IN_PROGRESS'`, e o detalhe só via FINISHED, portanto dizia
// «Em curso» e oferecia Continuar para uma prova que já não existia.

test('uma tentativa cancelada é cancelada, nem terminada nem em curso', () => {
  const cancelada: Attempt = { id: 1, status: 'CANCELLED', finalScore: null };
  assert.equal(labelOf(cancelada), 'cancelled');
  assert.equal(isFinished(cancelada), false);
  assert.equal(inProgress(cancelada), false);
  assert.equal(settled(cancelada), true);
});

test('cancelada e terminada partilham o mesmo rótulo', () => {
  assert.equal(labelOf(done(1)), 'corrected');
  assert.equal(labelOf(running(1)), 'unfinished');
  // Só CANCELLED: o backend escreve o estado em maiúsculas e com dois L.
  assert.equal(labelOf({ id: 1, status: 'canceled' }), 'unfinished');
  assert.equal(labelOf({ id: 1, status: 'CANCELLED' }), 'cancelled');
});

test('uma tentativa cancelada nunca tem nota', () => {
  // Nem o servidor a dá: uma prova por cancelar não foi corrigida.
  const cancelada: Attempt = { id: 1, status: 'CANCELLED', finalScore: 15 };
  assert.equal(labelOf(cancelada), 'cancelled');
  // E o detalhe só mostra nota quando o rótulo é 'corrected'.
  assert.equal(labelOf(cancelada), 'cancelled');
});

test('cancelada nunca passa a ser a tentativa actual se há uma mais recente', () => {
  const maisAntiga: Attempt = { id: 1, status: 'CANCELLED', finalScore: null };
  const maisRecente = done(2);
  assert.equal(currentAttempt([maisAntiga, maisRecente])?.id, 2);
  assert.equal(labelOf(currentAttempt([maisAntiga, maisRecente])!), 'corrected');
});

test('a tentativa em curso ganha mesmo a uma cancelada mais recente', () => {
  // Há um papel por terminar: é esse que o cartão e o detalhe falam.
  assert.equal(currentAttempt([{ id: 5, status: 'CANCELLED' }, running(9)])?.id, 9);
});

test('um estado que o servidor invente não é dado como terminado', () => {
  // Um estado novo amanhã não pode trazer uma nota que não existe. Melhor dizer
  // «em curso» do que mentir sobre uma correção.
  assert.equal(labelOf({ id: 1, status: 'SOMETHING_NEW' }), 'unfinished');
  assert.equal(settled({ id: 1, status: 'SOMETHING_NEW' }), false);
});
