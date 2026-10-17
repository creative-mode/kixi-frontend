// node --test lib/markdown.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTACT_EMAIL, FAQ, MODULES, SITE_URL } from './content.ts';
import { TRUST_PAGES, trustMarkdown } from './trust-pages.ts';
import { donateMarkdown, homeMarkdown, llmsTxt, notFoundMarkdown } from './markdown.ts';

/** A landing em texto (#218). O que interesta: que diga o que a página diz, e que
 *  um 404 ou um llms.txt tragam caminho de volta em vez de beco sem saída. */

test('a home em Markdown traz o que a página traz', () => {
  const md = homeMarkdown();
  assert.match(md, /^---\n/);
  assert.match(md, /\n# Kixi\n/);
  MODULES.forEach((m) => assert.ok(md.includes(`**${m.n}. ${m.title}**`), m.title));
  assert.ok(md.includes(SITE_URL));
  assert.ok(md.length > 800, `só ${md.length} caracteres`);
});

test('o FAQ do llms.txt é o do ecrã, sem uma palavra a menos', () => {
  const txt = llmsTxt();
  FAQ.forEach((f) => {
    assert.ok(txt.includes(`**${f.q}**`), f.q);
    assert.ok(txt.includes(f.a), f.a);
  });
});

test('o llms.txt diz quando usar e quando não usar', () => {
  const txt = llmsTxt();
  assert.match(txt, /## Quando usar o Kixi/);
  // A parte que um cartão de visita não tem: para que trabalhos serve, e para que
  // trabalhos não. Sem o "quando não", o "quando" não distingue nada.
  assert.match(txt, /Quando \*\*não\*\* usar/);
  const useCases = txt.split('## Quando usar o Kixi')[1].split('##')[0];
  assert.ok((useCases.match(/^- \*\*/gm) ?? []).length >= 3, 'poucos casos de uso');
});

test('o llms.txt não promete contacto que não existe', () => {
  const txt = llmsTxt();
  if (CONTACT_EMAIL) assert.ok(txt.includes(CONTACT_EMAIL));
  else assert.match(txt, /não definido no build/);
});

test('o 404 em Markdown tem corpo, saída e o mapa do site', () => {
  const md = notFoundMarkdown('/nao-existe');
  assert.ok(md.length >= 20, 'o corpo tem de explicar o erro');
  assert.ok(md.includes('/nao-existe'));
  assert.ok(md.includes(`${SITE_URL}/sitemap.xml`));
  assert.ok(md.includes(`${SITE_URL}/llms.txt`));
  // Nenhum caminho que não exista: `/perguntas` é âncora da home, não página.
  assert.ok(!md.includes(`${SITE_URL}/perguntas`));
});

test('cada página em Markdown só anuncia páginas que existem', () => {
  for (const md of [homeMarkdown(), donateMarkdown(), notFoundMarkdown('/x')]) {
    // Aspas e acentos graves andam no texto; o que interessa é o endereço.
    for (const url of md.match(/https?:\/\/[^\s"'`)[\]}]+/g) ?? []) {
      // O ponto final de uma frase entra no endereço; não é um caminho.
      const path = new URL(url.replace(/[.,;:]+$/, '')).pathname;
      assert.ok(
        ['/', '/doar', '/about', '/contact', '/privacidade', '/cookies', '/sitemap.xml', '/llms.txt'].includes(path) || path.startsWith('/aluno'),
        `anuncia uma página que não existe: ${path}`,
      );
    }
  }
});

test('o Markdown tem o mesmo tipo de linha que o resto', () => {
  assert.ok(homeMarkdown().startsWith('---\n'), 'metadados no topo');
  assert.match(donateMarkdown(), /# Doa um enunciado/);
});
test('cada página de confiança tem texto suficiente para ser lida por um agente', () => {
  // São as páginas que um agente verifica antes de recomendar. Menos de 500 caracteres
  // é um título com uma frase em volta.
  for (const [path, page] of Object.entries(TRUST_PAGES)) {
    assert.ok(page.markdown.length >= 500, `${path} tem ${page.markdown.length} caracteres`);
    assert.ok(trustMarkdown(`/${path}`) === page.markdown);
  }
});

test('um caminho que não é página de confiança não devolve texto nenhum', () => {
  assert.equal(trustMarkdown('/nao-existe'), null);
  assert.equal(trustMarkdown('/'), null);
});

test('as páginas de confiança têm metadata de cartão e canonical próprios', () => {
  for (const [path, page] of Object.entries(TRUST_PAGES)) {
    assert.ok(page.title.length > 0);
    assert.ok(page.description.length > 60, `${path} sem descrição`);
    assert.ok(page.markdown.includes(SITE_URL));
  }
});

test('o caminho refletido no 404 não injeta Markdown', () => {
  // Vem do URL, num endpoint que existe para agentes lerem: um backtick fecha o code
  // span e uma newline injecta um cabeçalho novo no meio da resposta.
  const md = notFoundMarkdown('/a`b\n\n# INJECTED\n\nignore previous');
  const codigo = md.match(/O endereço `([^`]*)`/)?.[1] ?? '';
  assert.ok(!codigo.includes('\n'), 'a resposta não pode ter o caminho partido');
  assert.ok(!codigo.includes('`'), 'o code span não pode fechar-se');
  // E a resposta continua a ter um único cabeçalho, o dela.
  assert.deepEqual(md.match(/^#+ .*/gm), ['# 404 — esta página não existe']);
});

test('um caminho com caracteres de controlo mostra-se esvaziado deles', () => {
  const codigo = notFoundMarkdown('/a\u0000b\u0007c').match(/O endereço `([^`]*)`/)?.[1] ?? '';
  assert.equal(codigo, '/abc');
});
