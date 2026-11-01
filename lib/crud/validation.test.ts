// Validação dos formulários CRUD (#533): node --test lib/crud/validation.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { errorSummary, fieldError, validate } from './validation.ts';

const text = { name: 'code', type: 'text', required: true, min: 2, max: 5 } as const;
const int = { name: 'grade', type: 'number', required: true, min: 1, max: 13 } as const;
const decimal = { name: 'weight', type: 'number', min: 0, max: 10, step: 0.5 } as const;

test('obrigatório: vazio ou só espaços', () => {
  assert.equal(fieldError(text, ''), 'Campo obrigatório');
  assert.equal(fieldError(text, '   '), 'Campo obrigatório');
  assert.equal(fieldError({ ...text, required: false }, ''), '');
});

test('texto respeita mínimo e máximo de caracteres', () => {
  assert.equal(fieldError(text, 'a'), 'Mínimo 2 caracteres');
  assert.equal(fieldError(text, 'abcdef'), 'Máximo 5 caracteres');
  assert.equal(fieldError(text, 'abc'), '');
});

test('sem step o campo numérico exige inteiro', () => {
  assert.equal(fieldError(int, '12'), '');
  assert.equal(fieldError(int, '1.5'), 'Introduza um número inteiro');
  assert.equal(fieldError(int, 'abc'), 'Introduza um número inteiro');
  assert.equal(fieldError(int, '0'), 'Mínimo 1');
  assert.equal(fieldError(int, '14'), 'Máximo 13');
});

test('com step fracionário o campo aceita decimais nos múltiplos do passo', () => {
  assert.equal(fieldError(decimal, '2.5'), '');
  assert.equal(fieldError(decimal, '3'), '');
  assert.equal(fieldError(decimal, '2.3'), 'Use múltiplos de 0,5');
  assert.equal(fieldError(decimal, '10.5'), 'Máximo 10');
  assert.equal(fieldError(decimal, 'x'), 'Introduza um número');
});

test('um step inteiro não abre a porta a decimais', () => {
  assert.equal(fieldError({ ...int, step: 5 }, '2.5'), 'Introduza um número inteiro');
});

test('o passo conta a partir do mínimo do campo', () => {
  assert.equal(fieldError({ ...decimal, min: 0.25 }, '0.75'), '');
  assert.equal(fieldError({ ...decimal, min: 0.25 }, '1'), 'Use múltiplos de 0,5');
});

test('email', () => {
  assert.equal(fieldError({ name: 'e', type: 'email' }, 'a@b'), 'Email inválido');
  assert.equal(fieldError({ name: 'e', type: 'email' }, 'a@b.ao'), '');
});

test('validate devolve só os campos com erro', () => {
  assert.deepEqual(validate([text, int], { code: 'abc', grade: '' }), { grade: 'Campo obrigatório' });
  assert.deepEqual(validate([text, int], { code: 'abc', grade: '3' }), {});
});

test('o resumo diz quantos campos faltam e aponta o primeiro, pela ordem do formulário', () => {
  const fields = [{ name: 'code', label: 'Código' }, { name: 'name', label: 'Nome' }, { name: 'grade', label: 'Classe' }];
  assert.deepEqual(errorSummary(fields, { grade: 'x', name: 'y' }), { text: 'Há 2 campos por corrigir: Nome, Classe.', first: 'name' });
  assert.deepEqual(errorSummary(fields, { code: 'x' }), { text: 'Há 1 campo por corrigir: Código.', first: 'code' });
  assert.equal(errorSummary(fields, {}), null);
});
