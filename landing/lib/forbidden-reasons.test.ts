import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getForbiddenReason } from './forbidden-reasons.ts';

test('getForbiddenReason("role") devolve configuração do gestor', () => {
  const config = getForbiddenReason('role');
  assert.equal(
    config.message,
    'Esta área é para quem gere o Kixi. O teu acesso chega até aqui.',
  );
  assert.equal(config.primary.href, '/manager');
  assert.equal(config.primary.label, 'Ir para o meu painel');
  assert.equal(config.secondary?.href, '/');
  assert.equal(config.secondary?.label, 'Ver o site');
});

test('getForbiddenReason("student-manager") devolve configuração do aluno', () => {
  const config = getForbiddenReason('student-manager');
  assert.equal(
    config.message,
    'Esta área é para quem gere o Kixi. O teu acesso é do lado dos alunos.',
  );
  assert.equal(config.primary.href, '/aluno/inicio');
  assert.equal(config.primary.label, 'Ir para o meu painel');
  assert.equal(config.secondary?.href, '/');
  assert.equal(config.secondary?.label, 'Ver o site');
});

test('getForbiddenReason("manager") devolve configuração do gestor', () => {
  const config = getForbiddenReason('manager');
  assert.equal(config.message, 'Esta área é para alunos. O teu acesso é do lado do gestor.');
  assert.equal(config.primary.href, '/manager');
  assert.equal(config.primary.label, 'Ir para o meu painel');
  assert.equal(config.secondary?.href, '/');
  assert.equal(config.secondary?.label, 'Ver o site');
});

test('getForbiddenReason com motivo desconhecido devolve fallback neutro', () => {
  const config = getForbiddenReason('desconhecido');
  assert.equal(config.message, 'Não tens permissão para abrir esta página.');
  assert.equal(config.primary.href, '/');
  assert.equal(config.primary.label, 'Voltar ao início');
  assert.equal(config.secondary, undefined);
});

test('getForbiddenReason("unknown") devolve fallback neutro', () => {
  const config = getForbiddenReason('unknown');
  assert.equal(config.message, 'Não tens permissão para abrir esta página.');
  assert.equal(config.primary.href, '/');
  assert.equal(config.primary.label, 'Voltar ao início');
  assert.equal(config.secondary, undefined);
});

test('getForbiddenReason com string vazia devolve fallback neutro', () => {
  const config = getForbiddenReason('');
  assert.equal(config.message, 'Não tens permissão para abrir esta página.');
  assert.equal(config.primary.href, '/');
  assert.equal(config.primary.label, 'Voltar ao início');
});

test('getForbiddenReason(undefined) devolve fallback neutro', () => {
  const config = getForbiddenReason(undefined);
  assert.equal(config.message, 'Não tens permissão para abrir esta página.');
  assert.equal(config.primary.href, '/');
  assert.equal(config.primary.label, 'Voltar ao início');
});
