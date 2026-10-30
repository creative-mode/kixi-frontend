import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ownTermSheets } from './pautas.ts';

const input = (accountId: number) => ({ accountId, className: '12B', schoolYear: '2025/2026', subjects: [{ code: 'RED', name: 'Redes' }, { code: 'SO', name: 'Sistemas Operativos' }, { code: 'MD', name: 'Matemática Discreta' }, { code: 'X', name: 'Fora' }] });

test('o aluno vê duas pautas fechadas por disciplina: o 3.º trimestre ainda não está fechado', () => {
  const list = ownTermSheets(input(3));
  assert.deepEqual([...new Set(list.map((s) => s.termNumber))], [1, 2]);
  assert.equal(list.length, 6);
});

test('cada linha é só a do aluno e a MT é a média das três componentes', () => {
  for (const s of ownTermSheets(input(3))) {
    assert.deepEqual(Object.keys(s.row).sort(), ['mac', 'mt', 'p1', 'p2', 'status']);
    assert.equal(s.row.mt, Math.floor((s.row.mac! + s.row.p1! + s.row.p2!) / 3 + 0.5));
    assert.equal(s.row.status, s.row.mt! >= 10 ? 'POSITIVA' : 'NEGATIVA');
  }
});

test('dois alunos não vêem as mesmas notas', () => {
  assert.notDeepEqual(ownTermSheets(input(3)).map((s) => s.row), ownTermSheets(input(4)).map((s) => s.row));
});
