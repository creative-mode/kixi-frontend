// Testes do markdown do tutor (#484): node --test lib/markdown.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInline, parseMarkdown } from './markdown.ts';
import { advance, BASE_CHARS_PER_SECOND } from './typewriter.ts';

test('negrito, itálico e código em linha', () => {
  assert.deepEqual(parseInline('a **b** c *d* `e`'), [
    { type: 'text', text: 'a ' },
    { type: 'strong', children: [{ type: 'text', text: 'b' }] },
    { type: 'text', text: ' c ' },
    { type: 'em', children: [{ type: 'text', text: 'd' }] },
    { type: 'text', text: ' ' },
    { type: 'code', text: 'e' },
  ]);
});

test('um marcador que ainda não fechou fica como texto (a resposta chega por partes)', () => {
  assert.deepEqual(parseInline('a **b'), [{ type: 'text', text: 'a **b' }]);
  assert.deepEqual(parseInline('2 * 3 = 6'), [{ type: 'text', text: '2 * 3 = 6' }]);
});

test('fórmulas: $...$ em linha, $$...$$ em destaque, e dinheiro não é fórmula', () => {
  assert.deepEqual(parseInline('v = $\\frac{d}{t}$'), [
    { type: 'text', text: 'v = ' },
    { type: 'math', latex: '\\frac{d}{t}', display: false },
  ]);
  assert.deepEqual(parseInline('custa $ 5 e $ 6'), [{ type: 'text', text: 'custa $ 5 e $ 6' }]);
  assert.equal((parseInline('$$x^2$$')[0] as { display: boolean }).display, true);
});

test('só ligações http(s) viram ligação', () => {
  assert.equal(parseInline('[a](https://kixi.ao)')[0].type, 'link');
  assert.equal(parseInline('[a](javascript:alert(1))')[0].type, 'text');
});

test('o HTML do modelo nunca vira marcação: fica como texto', () => {
  assert.deepEqual(parseInline('<img src=x onerror=alert(1)>'), [{ type: 'text', text: '<img src=x onerror=alert(1)>' }]);
});

test('parágrafos: linhas seguidas juntam-se e a linha em branco separa', () => {
  const blocks = parseMarkdown('primeira\nlinha\n\nsegunda');
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks[0], { type: 'p', children: [{ type: 'text', text: 'primeira linha' }] });
});

test('listas com marcadores e numeradas, títulos e código', () => {
  const blocks = parseMarkdown('## Passos\n\n1. um\n2. dois\n\n- a\n- b\n\n```\nx = 1\n```');
  assert.deepEqual(blocks.map((b) => b.type), ['h', 'ol', 'ul', 'code']);
  assert.equal((blocks[1] as { items: unknown[] }).items.length, 2);
  assert.equal((blocks[3] as { text: string }).text, 'x = 1');
});

test('asteriscos de lista não aparecem como texto', () => {
  const blocks = parseMarkdown('* um\n* dois');
  assert.equal(blocks[0].type, 'ul');
});

test('o typewriter avança ao ritmo da leitura e acelera quando fica para trás', () => {
  assert.equal(advance(0, 1000, 0), 1);
  assert.ok(advance(0, 50, 100) <= 50);
  assert.equal(advance(0, 100, 100), Math.floor((Math.max(BASE_CHARS_PER_SECOND, 100 * 2.5) * 100) / 1000));
  assert.ok(advance(0, 2000, 100) >= 400, 'com muito por mostrar, acelera');
  assert.equal(advance(50, 50, 16), 50);
});
