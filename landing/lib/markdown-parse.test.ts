// node --test lib/markdown-parse.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from './markdown-parse.ts';

/** O parser das páginas de confiança. O que não sabe tem de lançar: um bloco que não
 *  percebe e passa em silêncio vira um parágrafo de texto normal e ninguém sabe que o
 *  Markdown está errado. */

test('cabeçalhos, parágrafos e listas', () => {
  assert.deepEqual(parse('# Um\n## Dois\n\nParágrafo\nde duas linhas.\n\n- primeiro\n- segundo'), [
    { kind: 'h1', text: 'Um' },
    { kind: 'h2', text: 'Dois' },
    { kind: 'p', lines: ['Parágrafo', 'de duas linhas.'] },
    { kind: 'ul', items: [{ text: 'primeiro', sub: [] }, { text: 'segundo', sub: [] }] },
  ]);
});

test('um sub-item fica dentro do item que o precede', () => {
  const blocks = parse('- **Alunos** — uma linha\n  e a continuação\n- **Docentes**');
  assert.equal(blocks.length, 1);
  const list = blocks[0];
  assert.equal(list.kind, 'ul');
  assert.equal(list.kind === 'ul' ? list.items[0].sub[0] : '', 'e a continuação');
});

test('linhas em branco não criam blocos vazios', () => {
  assert.deepEqual(parse('\n\n# Um\n\n\n'), [{ kind: 'h1', text: 'Um' }]);
  assert.deepEqual(parse(''), []);
});

test('uma lista órfã lança, em vez de virar texto solto', () => {
  assert.throws(() => parse('texto\n  sub-item sem lista'), /sem lista antes/);
});

test('cada bloco do texto real sai lido como se espera', () => {
  // O nome prometia "sem resto" e a asserção só provava que não lançava: um bloco lido
  // errado é uma página errada em produção sem nenhum sinal.
  assert.deepEqual(parse('# Kixi\n\n- **I. OCR** — Fotografa.\n\n## Perguntas\n\ntexto'), [
    { kind: 'h1', text: 'Kixi' },
    { kind: 'ul', items: [{ text: '**I. OCR** — Fotografa.', sub: [] }] },
    { kind: 'h2', text: 'Perguntas' },
    { kind: 'p', lines: ['texto'] },
  ]);
});

test('uma citação ou uma tabela lançam, em vez de virar um parágrafo', () => {
  // Antes eram engolidas num parágrafo: a página saía com a sintaxe Markdown à vista e
  // ninguém via o erro. A asserção antiga não apanhava isto — juntava as linhas com
  // espaços e perguntava se sobrava alguma newline, o que nunca era verdade.
  for (const markdown of [
    '> citação\n\ntexto',
    '| a | b |\n| - | - |\n| 1 | 2 |',
    '### um subtitulo',
    '```\ncodigo\n```',
    '---',
  ]) {
    assert.throws(() => parse(markdown), /não lê/, markdown.split('\n')[0]);
  }
});

test('o erro diz o que não foi lido, não só que algo correu mal', () => {
  assert.throws(() => parse('> citação'), /citação/);
  assert.throws(() => parse('| a | b |'), /tabela/);
});