// node --test lib/feed-conversation.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { IDLE, requestRead, settled, started, withComment, type Conversation } from './feed-conversation.ts';
import type { PostComment } from './feed.ts';

const row = (id: number, content: string): PostComment => ({
  id,
  postId: 9910,
  authorAccountId: 1,
  content,
  isHidden: false,
  createdAt: '2026-10-16T10:00:00',
  updatedAt: '2026-10-16T10:00:00',
  mine: true,
  displayName: 'Ana N.',
});

const contents = (c: Conversation) => c.comments?.map((r) => r.content);

/** A corrida que a revisão apanhou: o aluno abre o painel, o GET inicial ainda
 *  corre, escreve, e o POST acaba antes do GET. O comentário tem de aparecer na
 *  mesma, sem esperar pela leitura que vem a seguir. */
test('o comentário escrito antes de a leitura inicial acabar aparece de imediato', () => {
  // 1. Abrir o painel: sai uma leitura, e ainda não há lista.
  const open = requestRead(IDLE);
  assert.equal(open.start, true);
  let state = open.state;
  assert.equal(state.reading, true);
  assert.equal(state.comments, null);

  // 2. O POST é aceite antes de o GET inicial acabar.
  state = withComment(state, row(3, 'Novo'));
  assert.deepEqual(contents(state), ['Novo'], 'aparece sem esperar por nenhum GET');

  // 3. O pedido de relê fica à espera da leitura em curso.
  const asked = requestRead(state, true);
  assert.equal(asked.start, false, 'não sai uma segunda leitura em paralelo');
  state = asked.state;
  assert.equal(state.stale, true);

  // 4. O GET inicial acaba — e é velho: não traz o comentário novo, e não pinta a lista.
  const initial = settled(state, [row(1, 'Antigo')], null);
  assert.equal(initial.chained, true, 'tem de sair outra leitura');
  assert.deepEqual(contents(initial.state), ['Novo'], 'o resultado velho não entra');
  assert.equal(initial.state.reading, false);
  assert.equal(requestRead(initial.state, true).start, true, 'a segunda leitura sai');

  // 5. A segunda leitura confirma a lista com o comentário novo, na ordem do servidor.
  const confirm = settled(initial.state, [row(1, 'Antigo'), row(3, 'Novo')], null);
  assert.equal(confirm.chained, false);
  assert.deepEqual(contents(confirm.state), ['Antigo', 'Novo']);
  assert.equal(confirm.state.reading, false);
});

test('com a lista já carregada, o comentário entra na mesma e a leitura confirma depois', () => {
  let state = settled(IDLE, [row(1, 'Antigo')], null).state;
  assert.deepEqual(contents(state), ['Antigo']);

  state = withComment(state, row(2, 'Resposta'));
  assert.deepEqual(contents(state), ['Antigo', 'Resposta'], 'aparece de imediato');

  // Sem nada em curso, o pedido de confirmação sai logo.
  const asked = requestRead(state, true);
  assert.equal(asked.start, true);
  assert.equal(asked.state.reading, true);

  // E se um terceiro pedido chega a meio dessa, não se perde nem lava a lista.
  const third = requestRead(asked.state, true).state;
  assert.equal(third.stale, true);
  const first = settled(third, [row(1, 'Antigo')], null);
  assert.equal(first.chained, true);
  assert.deepEqual(contents(first.state), ['Antigo', 'Resposta'], 'a lista não pisca');
});

test('o mesmo comentário não entra duas vezes', () => {
  const state = withComment(settled(IDLE, [row(1, 'Antigo')], null).state, row(1, 'Antigo'));
  assert.deepEqual(contents(state), ['Antigo']);
});

test('um pedido forçado espera por uma leitura em curso, em vez de se perder', () => {
  const reading = started(IDLE);
  const asked = requestRead(reading, true);
  assert.equal(asked.start, false, 'não sai uma segunda leitura em paralelo');
  assert.equal(asked.state.stale, true, 'fica à espera de a outra');
});

test('reabrir o painel lê uma vez só; ler à força relê', () => {
  const loaded = settled(IDLE, [], null).state;
  assert.deepEqual(contents(loaded), [], 'conversa vazia já foi lida');
  assert.equal(requestRead(loaded).start, false);
  assert.equal(requestRead(loaded, true).start, true);
});

test('um erro mostra-se sem deitar fora a lista que já lá estava', () => {
  const loaded = settled(IDLE, [row(1, 'Antigo')], null).state;
  const failed = settled(loaded, null, 'A sessão expirou.');
  assert.equal(failed.state.error, 'A sessão expirou.');
  assert.deepEqual(contents(failed.state), ['Antigo']);
  assert.equal(failed.state.reading, false);
});