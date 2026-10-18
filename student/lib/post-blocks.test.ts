import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyBlock, isPostImage, moved, payloadOf, problemOf, summaryOf, TEMPLATES, templateBlocks, toPayload, type PostBlock } from './post-blocks.ts';

const text = (t: string): PostBlock => ({ type: 'text', text: t });
const choice = (q: string, items: string[], correct: number): PostBlock => ({ type: 'choice', text: q, items, correct });

test('os blocos vazios que o construtor abre não entram na publicação', () => {
  const blocks = [emptyBlock('heading'), { ...emptyBlock('text'), text: '  Olá turma  ' }, emptyBlock('list'), emptyBlock('image')];
  assert.deepEqual(payloadOf(blocks), [{ type: 'text', text: 'Olá turma' }]);
});

test('o pedido leva só os campos do tipo, sem o key', () => {
  const b = { ...emptyBlock('callout'), text: ' Atenção ' };
  assert.deepEqual(toPayload(b), { type: 'callout', text: 'Atenção', tone: 'tip' });
  assert.equal('key' in toPayload(b), false);
});

test('na lista as linhas vazias saem e a ordem fica', () => {
  assert.deepEqual(toPayload({ type: 'list', items: ['a', ' ', 'b'], ordered: true }), { type: 'list', items: ['a', 'b'], ordered: true });
});

test('no desafio, tirar uma opção vazia não desloca a certa', () => {
  const p = toPayload({ type: 'choice', text: 'Q?', items: ['', 'x', '', 'y'], correct: 3 });
  assert.deepEqual(p.items, ['x', 'y']);
  assert.equal(p.correct, 1);
});

test('no desafio, a opção certa deixada em branco fica por marcar e o envio é recusado', () => {
  const p = toPayload({ type: 'choice', text: 'Q?', items: ['x', '', 'y'], correct: 1 });
  assert.equal(p.correct, -1);
  assert.match(problemOf('challenge', '', [p]) ?? '', /opção certa/);
});

test('uma publicação sem texto, só com imagem, não sai', () => {
  const img: PostBlock = { type: 'image', url: '/uploads/images/post/a.png' };
  assert.match(problemOf('doubt', '', [img]) ?? '', /5 caracteres/);
  assert.equal(problemOf('doubt', '', [text('Como se resolve?'), img]), null);
});

test('só aceita imagens do armazenamento das publicações', () => {
  assert.equal(isPostImage('/uploads/images/post/abc-1.webp'), true);
  assert.equal(isPostImage('/uploads/images/avatar/abc.png'), false);
  assert.equal(isPostImage('https://x.ao/a.png'), false);
  assert.equal(isPostImage('/uploads/images/post/../a.png'), false);
  assert.equal(isPostImage(''), false);
});

test('limites: 20 blocos, 6 imagens, 4000 caracteres', () => {
  assert.match(problemOf('topic', '', Array.from({ length: 21 }, (_, i) => text(`linha ${i}`))) ?? '', /20 blocos/);
  const img: PostBlock = { type: 'image', url: '/uploads/images/post/a.png' };
  assert.match(problemOf('topic', '', [text('Olá turma'), ...Array.from({ length: 7 }, () => img)]) ?? '', /6 imagens/);
  assert.match(problemOf('topic', '', [text('a'.repeat(2000)), text('b'.repeat(2000)), text('c')]) ?? '', /4000/);
});

test('desafio: 2 a 5 opções, a certa marcada e uma pergunta', () => {
  assert.equal(problemOf('challenge', '', [choice('2+2?', ['3', '4'], 1)]), null);
  assert.match(problemOf('challenge', '', [choice('2+2?', ['4'], 0)]) ?? '', /2 a 5/);
  assert.match(problemOf('challenge', '', [choice('2+2?', ['1', '2', '3', '4', '5', '6'], 0)]) ?? '', /2 a 5/);
  assert.match(problemOf('challenge', '', [text('Sem pergunta')]) ?? '', /pergunta com opções/);
});

test('o resumo é o texto simples dos blocos e ignora as imagens', () => {
  const blocks: PostBlock[] = [{ type: 'heading', text: 'Juros simples' }, { type: 'image', url: '/uploads/images/post/a.png' }, { type: 'list', items: ['capital', 'taxa'] }];
  assert.equal(summaryOf(blocks), 'Juros simples\n- capital\n- taxa');
});

test('cada modelo abre com os seus blocos e o desafio com uma pergunta', () => {
  const t = (k: string) => TEMPLATES.find((x) => x.kind === k)!;
  assert.deepEqual(templateBlocks(t('study_card')).map((b) => b.type), ['heading', 'text', 'list', 'callout']);
  assert.deepEqual(templateBlocks(t('challenge')).map((b) => b.type), ['choice']);
  assert.equal(new Set(templateBlocks(t('study_card')).map((b) => b.key)).size, 4);
});

test('mover um bloco troca a posição e os limites não fazem nada', () => {
  assert.deepEqual(moved([1, 2, 3], 0, 1), [2, 1, 3]);
  assert.deepEqual(moved([1, 2, 3], 0, -1), [1, 2, 3]);
  assert.deepEqual(moved([1, 2, 3], 2, 3), [1, 2, 3]);
});
