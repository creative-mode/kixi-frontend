// node --test lib/markdown-negotiation.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { prefersMarkdown } from './markdown-negotiation.ts';

/** Quem pede. Um wildcard tem de continuar a dar HTML: é o que o `curl` manda
 *  sem `-H`, e é assim que um agente segue o primeiro link que encontra. */

test('Markdown quando é o que se pede explicitamente', () => {
  assert.equal(prefersMarkdown('text/markdown'), true);
  assert.equal(prefersMarkdown('text/markdown, */*;q=0.1'), true);
  assert.equal(prefersMarkdown('text/html;q=0.5, text/markdown;q=0.9'), true);
});

test('HTML quando é HTML que se pede, mesmo com Markdown à mistura', () => {
  assert.equal(prefersMarkdown('text/html'), false);
  assert.equal(
    prefersMarkdown('text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'),
    false,
    'é o que um navegador envia',
  );
  assert.equal(prefersMarkdown('text/html, text/markdown'), false, 'empate vai para HTML');
});

test('um wildcard sem preferência dá HTML, não Markdown', () => {
  assert.equal(prefersMarkdown('*/*'), false);
  assert.equal(prefersMarkdown('application/json'), false);
  assert.equal(prefersMarkdown(null), false);
  assert.equal(prefersMarkdown(''), false);
});

test('quality zero é o mesmo que não pedir', () => {
  assert.equal(prefersMarkdown('text/markdown;q=0, text/html'), false);
  assert.equal(prefersMarkdown('text/markdown;q=0'), false);
});

test('maiúsculas e espaços não mudam a decisão', () => {
  assert.equal(prefersMarkdown('TEXT/Markdown'), true);
  assert.equal(prefersMarkdown(' text/markdown ,  text/html ; q=0.1 '), true);
});