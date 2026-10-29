import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeHref, buildCrumbs, groupLinks, NAV_GROUPS } from './nav-rules.ts';

const link = (href: string) => ({ href });

test('o início fica no topo e cada destino no seu grupo, pela ordem de entrada', () => {
  const out = groupLinks(['/', '/exam-rooms', '/terms', '/accounts', '/statements'].map(link));
  assert.deepEqual(out.top.map((l) => l.href), ['/']);
  assert.deepEqual(
    out.groups.map((g) => [g.id, g.items.map((l) => l.href)]),
    [
      ['ensino', ['/exam-rooms', '/statements']],
      ['estrutura', ['/terms']],
      ['administracao', ['/accounts']],
    ],
  );
});

test('o professor não vê grupos vazios nem o início do admin', () => {
  const out = groupLinks(['/professor', '/exam-rooms', '/classes', '/professor/tutor'].map(link));
  assert.deepEqual(out.top.map((l) => l.href), ['/professor']);
  assert.deepEqual(out.groups.map((g) => g.id), ['ensino', 'estrutura']);
  assert.deepEqual(out.groups[0].items.map((l) => l.href), ['/exam-rooms', '/professor/tutor']);
});

test('um destino desconhecido cai no último grupo em vez de desaparecer', () => {
  const out = groupLinks(['/exam-rooms', '/algo-novo'].map(link));
  const last = out.groups[out.groups.length - 1];
  assert.equal(last.id, NAV_GROUPS[NAV_GROUPS.length - 1].id);
  assert.deepEqual(last.items.map((l) => l.href), ['/algo-novo']);
});

test('a raiz só está ativa por igualdade', () => {
  assert.equal(activeHref('/', ['/', '/exam-rooms']), '/');
  assert.equal(activeHref('/exam-rooms', ['/', '/exam-rooms']), '/exam-rooms');
});

test('um destino contém as páginas debaixo dele, mas não um nome parecido', () => {
  const hrefs = ['/statements', '/simulations'];
  assert.equal(activeHref('/statements/12', hrefs), '/statements');
  assert.equal(activeHref('/statements/import', hrefs), '/statements');
  assert.equal(activeHref('/statements-extra', hrefs), null);
});

test('ganha o destino mais específico: o tutor não marca também o início do professor', () => {
  const hrefs = ['/professor', '/professor/tutor'];
  assert.equal(activeHref('/professor', hrefs), '/professor');
  assert.equal(activeHref('/professor/tutor', hrefs), '/professor/tutor');
});

test('fora do menu não há nada ativo', () => {
  assert.equal(activeHref('/403', ['/', '/exam-rooms']), null);
});

test('os breadcrumbs vão do início à página atual, que não é ligação', () => {
  const crumbs = buildCrumbs({ label: 'Cursos', href: '/courses' }, 'Editar curso');
  assert.deepEqual(crumbs, [
    { label: 'Início', href: '/' },
    { label: 'Cursos', href: '/courses' },
    { label: 'Editar curso' },
  ]);
  assert.equal(crumbs[crumbs.length - 1].href, undefined);
});
