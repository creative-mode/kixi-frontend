// Testes da validação de destinos internos do aluno (#503): node --test lib/safe-next.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { appRelativePath, studentNext, studentPath, STUDENT_BASE_PATH } from './safe-next.ts';

test('aceita caminhos internos, com e sem o basePath', () => {
  assert.equal(studentNext('/prova/2'), `${STUDENT_BASE_PATH}/prova/2`);
  assert.equal(studentNext('/prova/2?iniciada=1'), `${STUDENT_BASE_PATH}/prova/2?iniciada=1`);
  assert.equal(studentNext('/aluno/prova/2'), `${STUDENT_BASE_PATH}/prova/2`);
  assert.equal(studentNext('/aluno'), `${STUDENT_BASE_PATH}/`);
  assert.equal(studentNext('/'), `${STUDENT_BASE_PATH}/`);
});

test('rejeita URLs externas e protocolos perigosos', () => {
  for (const value of [
    'https://evil.com',
    'http://evil.com/aluno',
    '//evil.com',
    '///evil.com',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '\\\\evil.com',
    '/\\evil.com',
    '/\\\\evil.com',
  ]) {
    assert.equal(studentNext(value), null, value);
  }
});

test('rejeita tentativas de escape por codificação', () => {
  for (const value of [
    '%2F%2Fevil.com',
    '/%2Fevil.com',
    '/%5Cevil.com',
    '/%255Cevil.com',
    '%252F%252Fevil.com',
    '/aluno/%2e%2e/%2e%2e/entrar',
    '/aluno%2F..%2F..%2Fentrar',
  ]) {
    assert.equal(studentNext(value), null, value);
  }
});

test('rejeita rotas de autenticação, erro e API como destino', () => {
  assert.equal(studentNext('/entrar'), null);
  assert.equal(studentNext('/aluno/entrar?next=/inicio'), null);
  assert.equal(studentNext('/cadastro'), null);
  assert.equal(studentNext('/403'), null);
  assert.equal(studentNext('/recuperar'), null);
  assert.equal(studentNext('/api/me'), null);
});

test('rejeita lixo, caminhos relativos e valores demasiado longos', () => {
  for (const value of [null, undefined, 42, {}, '', '   ', 'prova/2', '?x=1', '#fragmento']) {
    assert.equal(studentNext(value), null, String(value));
  }
  assert.equal(studentNext(`/${'a'.repeat(3000)}`), null);
  assert.equal(studentNext('/aluno/ok\u0000'), null);
});

test('appRelativePath tira o basePath para o router do Next', () => {
  assert.equal(appRelativePath('/aluno/prova/2?x=1', STUDENT_BASE_PATH), '/prova/2?x=1');
  assert.equal(appRelativePath('/aluno', STUDENT_BASE_PATH), '/');
  assert.equal(appRelativePath('/aluno/', STUDENT_BASE_PATH), '/');
});

test('studentPath constrói o caminho público a partir do caminho do proxy', () => {
  assert.equal(studentPath('/prova/2', '?x=1'), '/aluno/prova/2?x=1');
  assert.equal(studentPath('/'), '/aluno');
});
