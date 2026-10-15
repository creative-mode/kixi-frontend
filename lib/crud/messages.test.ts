import test from 'node:test';
import assert from 'node:assert/strict';
import { friendlyMessage, translate } from './messages.ts';

const problem = (detail: string, extra: Record<string, unknown> = {}) => JSON.stringify({ title: 'x', detail, properties: extra });

test('tira instance, requestId e caminhos do texto', () => {
  const body = problem('Algo falhou', { instance: '/api/v1/classes/3', requestId: 'req-abc123', campo: 'obrigatório' });
  assert.equal(friendlyMessage(400, body), 'Algo falhou · obrigatório');
  assert.equal(friendlyMessage(400, problem('/api/v1/x', { requestId: 'req-1' })), 'x');
});

test('409 de remoção protegida fica em português', () => {
  assert.equal(friendlyMessage(409, problem('This course still has 2 active class(es): remove or move them first')), 'Este curso ainda tem 2 turma(s) ativa(s): remova-as ou mude-as primeiro.');
  assert.match(friendlyMessage(409, problem('This class still has 3 active enrollment(s) and 1 active teaching assignment(s): cancel or move them first')), /3 matrícula\(s\) e 1 atribuição/);
  assert.match(friendlyMessage(409, problem('The institution still has 4 active course(s): remove or move them first')), /4 curso\(s\)/);
});

test('409 de duplicado, com e sem detalhe', () => {
  assert.equal(friendlyMessage(409, problem('This teacher is already assigned to this class and subject')), 'Este professor já está atribuído a esta turma e disciplina.');
  assert.match(friendlyMessage(409, problem('This teacher is already assigned to this class and subject, possibly in the trash; restore or purge that assignment first')), /talvez na lixeira/);
  assert.equal(friendlyMessage(409, JSON.stringify({ title: 'Conflict' })), 'Já existe um registo com estes dados.');
});

test('422 de atribuição inválida', () => {
  assert.match(friendlyMessage(422, problem('The teacher is not affiliated to the school of this class: add them to the institution first')), /não está afiliado/);
  assert.match(friendlyMessage(422, problem('The subject is not in the curriculum of this class: add it to its course for grade 12 first')), /currículo do curso/);
  assert.equal(friendlyMessage(422, JSON.stringify({})), 'Os dados não são válidos para esta operação.');
});

test('401, 403 e 404 não dependem do corpo', () => {
  assert.equal(friendlyMessage(403, problem('Forbidden')), 'Não tem permissão para esta operação.');
  assert.equal(friendlyMessage(401, ''), 'Sessão expirada. Inicie sessão novamente.');
  assert.equal(friendlyMessage(404, ''), 'Registo não encontrado.');
});

test('texto desconhecido e corpo que não é JSON ficam como vieram', () => {
  assert.equal(translate('Something odd'), 'Something odd');
  assert.equal(friendlyMessage(500, 'boom'), 'boom');
  assert.equal(friendlyMessage(500, ''), 'Erro 500');
});
