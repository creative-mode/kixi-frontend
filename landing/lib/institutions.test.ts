import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  exactInstitution,
  filterInstitutions,
  institutionLabel,
  normalizeSearch,
  parseInstitutions,
  parseSessionInstitution,
} from './institutions.ts';

test('lê a lista nua e o envelope, com a sigla em qualquer nome', () => {
  const list = parseInstitutions([
    { id: 2, name: 'Instituto Médio Industrial de Luanda', shortName: 'IMIL' },
    { id: 1, name: 'Instituto de Telecomunicações', short_name: 'ITEL' },
    { id: 3, name: 'Escola 5 de Abril', acronym: 'E5A' },
  ]);
  assert.deepEqual(list.map((i) => i.id), [3, 1, 2]);
  assert.equal(list[1].shortName, 'ITEL');
  assert.deepEqual(parseInstitutions({ items: [{ id: 1, name: 'A' }] }), [{ id: 1, name: 'A', shortName: null }]);
  assert.deepEqual(parseInstitutions([{ id: 6, name: 'Liceu', code: 'LK' }]), [{ id: 6, name: 'Liceu', shortName: 'LK' }]);
  assert.deepEqual(parseInstitutions({ content: [{ id: 1, name: 'A' }] }), [{ id: 1, name: 'A', shortName: null }]);
  assert.deepEqual(parseInstitutions({ data: [{ id: 1, name: 'A' }] }), [{ id: 1, name: 'A', shortName: null }]);
});

test('descarta linhas sem id ou sem nome e não repete ids', () => {
  assert.deepEqual(
    parseInstitutions([
      { id: 0, name: 'Zero' },
      { id: -1, name: 'Negativo' },
      { id: 'x', name: 'Texto' },
      { id: 4, name: '   ' },
      { id: 5, name: 'Escola' },
      { id: 5, name: 'Outra grafia' },
      { nope: true },
      null,
    ]),
    [{ id: 5, name: 'Escola', shortName: null }],
  );
  assert.deepEqual(parseInstitutions(null), []);
  assert.deepEqual(parseInstitutions('nada'), []);
});

test('a pesquisa ignora acentos e olha ao nome e à sigla', () => {
  const list = parseInstitutions([
    { id: 1, name: 'Instituto de Telecomunicações', shortName: 'ITEL' },
    { id: 2, name: 'Escola de Educação Básica' },
  ]);
  assert.deepEqual(filterInstitutions(list, 'itel').map((i) => i.id), [1]);
  assert.deepEqual(filterInstitutions(list, 'educacao').map((i) => i.id), [2]);
  assert.deepEqual(filterInstitutions(list, 'INSTITUTO').map((i) => i.id), [1]);
  assert.deepEqual(filterInstitutions(list, '').map((i) => i.id), [2, 1]);
  assert.deepEqual(filterInstitutions(list, 'inexistente'), []);
  assert.equal(normalizeSearch('  Educação  '), 'educacao');
});

test('a escola da sessão só conta com um id e um nome válidos', () => {
  assert.deepEqual(parseSessionInstitution({ institution: { id: 7, name: 'ITEL' } }), {
    id: 7,
    name: 'ITEL',
    shortName: null,
  });
  assert.deepEqual(parseSessionInstitution({ school: { id: 8, name: 'Liceu', code: 'LK' } }), {
    id: 8,
    name: 'Liceu',
    shortName: 'LK',
  });
  assert.equal(parseSessionInstitution({ institution: null }), null);
  assert.equal(parseSessionInstitution({ institution: { id: 0, name: 'X' } }), null);
  assert.equal(parseSessionInstitution({ institution: { id: 1, name: '' } }), null);
  assert.equal(parseSessionInstitution({}), null);
  assert.equal(parseSessionInstitution(null), null);
});

test('só uma correspondência por inteiro troca o texto por uma escola', () => {
  const list = parseInstitutions([
    { id: 1, name: 'Instituto de Telecomunicações', shortName: 'ITEL' },
    { id: 2, name: 'Instituto Médio Industrial de Luanda', shortName: 'IMIL' },
    { id: 3, name: 'Escola 5 de Abril', acronym: 'E5A' },
  ]);
  assert.equal(exactInstitution(list, 'itel')?.id, 1);
  assert.equal(exactInstitution(list, '  INSTITUTO DE TELECOMUNICAÇÕES ')?.id, 1);
  assert.equal(exactInstitution(list, 'Escola 5 de Abril')?.id, 3);
  // Uma pesquisa parcial não é uma escolha.
  assert.equal(exactInstitution(list, 'instituto'), null);
  assert.equal(exactInstitution(list, ''), null);
  // Texto ambíguo (duas escolas com a mesma sigla) também não escolhe nenhuma.
  const repetidas = parseInstitutions([
    { id: 4, name: 'Um', shortName: 'X' },
    { id: 5, name: 'Dois', shortName: 'X' },
  ]);
  assert.equal(exactInstitution(repetidas, 'x'), null);
});

test('o rótulo mostra a sigla quando acrescenta informação', () => {
  assert.equal(
    institutionLabel({ id: 1, name: 'Instituto de Telecomunicações', shortName: 'ITEL' }),
    'Instituto de Telecomunicações (ITEL)',
  );
  assert.equal(institutionLabel({ id: 1, name: 'ITEL', shortName: 'ITEL' }), 'ITEL');
  assert.equal(institutionLabel({ id: 1, name: 'ITEL', shortName: null }), 'ITEL');
});
