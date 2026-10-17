import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accept, friendIds, listRequests, remove, request, searchable, viewOf, type Friendship } from './friends.ts';

const name = (id: number) => `Aluno ${id}`;
const rows = (): Friendship[] => [
  { id: 1, requesterId: 4, addresseeId: 3, accepted: false },
  { id: 2, requesterId: 3, addresseeId: 5, accepted: true },
  { id: 3, requesterId: 3, addresseeId: 6, accepted: false },
];

test('um pedido recebido tem incoming; um enviado não', () => {
  assert.equal(viewOf(rows()[0], 3, name).incoming, true);
  assert.equal(viewOf(rows()[2], 3, name).incoming, false);
  assert.equal(viewOf(rows()[1], 3, name).status, 'ACCEPTED');
});

test('o ranking de amigos só conta as ligações aceites, dos dois lados', () => {
  assert.deepEqual(friendIds(rows(), 3), [5]);
  assert.deepEqual(friendIds(rows(), 5), [3]);
  assert.deepEqual(friendIds(rows(), 4), []);
});

test('a caixa de entrada traz recebidos e enviados por responder', () => {
  assert.deepEqual(listRequests(rows(), 3, name).map((r) => r.friendshipId), [1, 3]);
});

test('não se convida a si próprio nem duas vezes, e o id tem de ser um número', () => {
  assert.equal(request(rows(), 3, 3, 9).ok, false);
  const twice = request(rows(), 3, 5, 9);
  assert.ok(!twice.ok && twice.status === 409);
  const bad = request(rows(), 3, '5', 9);
  assert.ok(!bad.ok && bad.status === 400);
  const fresh = request(rows(), 3, 7, 9);
  assert.ok(fresh.ok && fresh.value.requesterId === 3 && !fresh.value.accepted);
});

test('só quem recebeu o pedido o aceita; qualquer ponta o remove', () => {
  assert.equal(accept(rows(), 3, 1).ok, true);
  assert.equal(accept(rows(), 4, 1).ok, false);
  assert.equal(accept(rows(), 3, 2).ok, false);
  assert.equal(remove(rows(), 4, 1).ok, true);
  assert.equal(remove(rows(), 9, 1).ok, false);
});

test('a pesquisa exclui o próprio, quem já tem ligação, e filtra pelo nome', () => {
  const colleagues = [3, 4, 5, 6, 7, 8].map((id) => ({ id, name: `Aluno ${id}` }));
  assert.deepEqual(searchable(rows(), 3, colleagues, '').map((c) => c.accountId), [7, 8]);
  assert.deepEqual(searchable(rows(), 3, colleagues, ' 8 ').map((c) => c.accountId), [8]);
});
