import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { test } from 'node:test';
import { assinaturaValida, eSimulacaoLivre, pedidoDeCorrecao, vistaDaCorrecao } from './correcao-rules.ts';

const me = { accountId: 3, first_name: 'Ana', last_name: 'Domingos', username: 'ana.domingos', school: { id: 1, name: 'Instituto', code: 'ITEL' } };

test('enquanto não está corrigida não há nota para mostrar', () => {
  assert.deepEqual(vistaDaCorrecao({ correcaoId: 'CR-1', estado: 'ACTIVE' }), { kind: 'a-corrigir' });
  assert.deepEqual(vistaDaCorrecao({ correcaoId: 'CR-1', estado: 'CONCLUIDA' }), { kind: 'a-corrigir' }); // sem resultado ainda
});

test('corrigida mostra o resultado; sem respostas legíveis diz-se incompleta, nunca zero', () => {
  assert.equal(vistaDaCorrecao({ correcaoId: 'c', estado: 'CONCLUIDA', resultado: { estado: 'FULLY_GRADED', nota: 18 } }).kind, 'corrigida');
  assert.equal(vistaDaCorrecao({ correcaoId: 'c', estado: 'CONCLUIDA', resultado: { estado: 'INCOMPLETE', nota: null } }).kind, 'incompleta');
});

test('uma correcção cancelada ou com incidente é uma falha, não uma espera eterna', () => {
  assert.equal(vistaDaCorrecao({ correcaoId: 'c', estado: 'CANCELADA' }).kind, 'falhou');
  assert.equal(vistaDaCorrecao({ correcaoId: 'c', estado: 'INCIDENTE' }).kind, 'falhou');
});

test('o pedido leva a instituição, a prova, a simulação e o aluno, e usa o username sem nome', () => {
  const p = pedidoDeCorrecao({ me, simulationId: 9, statementId: 2, statementTitle: 'P1', callbackUrl: 'https://k/e' });
  assert.equal(p?.correcaoRef, 'kixi-sim-9');
  assert.deepEqual(p?.org, { sourcedId: '1', nome: 'Instituto', sigla: 'ITEL' });
  assert.deepEqual(p?.simulacao, { sourcedId: '9' });
  assert.equal(p?.aluno.nome, 'Ana Domingos');
  assert.equal(pedidoDeCorrecao({ me: { ...me, first_name: null, last_name: null }, simulationId: 9, statementId: 2, statementTitle: null, callbackUrl: 'x' })?.aluno.nome, 'ana.domingos');
});

test('sem escola não há pedido', () => {
  assert.equal(pedidoDeCorrecao({ me: { ...me, school: null }, simulationId: 1, statementId: 1, statementTitle: null, callbackUrl: 'x' }), null);
});

test('a simulação de uma sala de prova não é simulação livre', () => {
  assert.equal(eSimulacaoLivre(5, [{ simulationId: 5 }, { simulationId: null }]), false);
  assert.equal(eSimulacaoLivre(6, [{ simulationId: 5 }, { simulationId: null }]), true);
});

const hmac = (k: Buffer, t: string) => createHmac('sha256', k).update(t).digest();
const segredo = 'whsec_' + Buffer.from('chave-de-teste').toString('base64');
const assina = (id: string, ts: string, corpo: string) => 'v1,' + hmac(Buffer.from('chave-de-teste'), `${id}.${ts}.${corpo}`).toString('base64');

test('a assinatura Standard Webhooks valida, com rotação (várias versões) e tolerância de 300 s', () => {
  const corpo = '{"a":1}';
  const ts = '1000';
  const bom = assina('m1', ts, corpo);
  assert.equal(assinaturaValida(hmac, timingSafeEqual, segredo, { id: 'm1', timestamp: ts, assinatura: bom }, corpo, 1100), true);
  assert.equal(assinaturaValida(hmac, timingSafeEqual, segredo, { id: 'm1', timestamp: ts, assinatura: `v1,AAAA ${bom}` }, corpo, 1100), true);
  assert.equal(assinaturaValida(hmac, timingSafeEqual, segredo, { id: 'm1', timestamp: ts, assinatura: bom }, '{"a":2}', 1100), false);
  assert.equal(assinaturaValida(hmac, timingSafeEqual, segredo, { id: 'm1', timestamp: ts, assinatura: bom }, corpo, 2000), false);
  assert.equal(assinaturaValida(hmac, timingSafeEqual, segredo, { id: null, timestamp: ts, assinatura: bom }, corpo, 1100), false);
});

import { comCorrecao } from './correcao-rules.ts';

test('com a correcção feita, a nota é a do motor e as dissertativas levam pontos e justificação', () => {
  const base = {
    simulationId: 9,
    finalScore: 10,
    pendingReviewCount: 2,
    questions: [
      { questionId: 1, number: 1, text: 'a', questionType: 'CLOSED', isCorrect: true, maxScore: 5 },
      { questionId: 7, number: 3, text: 'b', questionType: 'OPEN', isCorrect: null, reviewStatus: 'PENDING_REVIEW', maxScore: 6 },
      { questionId: 8, number: 4, text: 'c', questionType: 'OPEN', isCorrect: null, reviewStatus: 'PENDING_REVIEW', maxScore: 4 },
    ],
  };
  const r = comCorrecao(base, {
    nota: 15,
    questoes: [
      { questaoId: '7', tipo: 'DISSERTATIVA', cotacao: 6, pontos: 4, justificativa: 'Faltou o exemplo.' },
      { questaoId: '8', tipo: 'DISSERTATIVA', cotacao: 4, pontos: 0.8, justificativa: 'Incompleta.' },
    ],
  });
  assert.equal(r.finalScore, 15);
  assert.equal(r.pendingReviewCount, 0);
  assert.equal(r.questions?.[0].isCorrect, true); // objectiva intacta
  assert.deepEqual([r.questions?.[1].scoreObtained, r.questions?.[1].isCorrect, r.questions?.[1].feedback], [4, true, 'Faltou o exemplo.']);
  assert.deepEqual([r.questions?.[2].scoreObtained, r.questions?.[2].isCorrect], [0.8, false]);
  assert.notEqual(r.questions?.[1].reviewStatus, 'PENDING_REVIEW');
});

import { semNotaDasSimulacoes } from './correcao-rules.ts';

test('a nota das simulações livres sai das outras páginas; a das salas fica', () => {
  const sims = [{ id: 1, finalScore: 14 }, { id: 2, finalScore: 18 }, { id: '3', finalScore: null }];
  assert.deepEqual(semNotaDasSimulacoes(sims, [{ simulationId: 2 }]), [{ id: 1, finalScore: null }, { id: 2, finalScore: 18 }, { id: '3', finalScore: null }]);
});

test('se a lista de salas falhou, não se arrisca: sai a nota de todas', () => {
  assert.deepEqual(semNotaDasSimulacoes([{ id: 2, finalScore: 18 }], null), [{ id: 2, finalScore: null }]);
});
