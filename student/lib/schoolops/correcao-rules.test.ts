import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { test } from 'node:test';
import { assinaturaValida, previsaoValida, progressoValido, correcaoIdDoConflito, eSimulacaoLivre, escalaDaNota, notaProvisoria, pedidoDeCorrecao, vistaDaCorrecao, vistaDeUmaRecusa } from './correcao-rules.ts';

const me = { accountId: 3, first_name: 'Ana', last_name: 'Domingos', username: 'ana.domingos', school: { id: 1, name: 'Instituto', code: 'ITEL' } };

test('enquanto não está corrigida não há nota para mostrar', () => {
  assert.deepEqual(vistaDaCorrecao({ correcaoId: 'CR-1', estado: 'ACTIVE' }), { kind: 'a-corrigir' });
  assert.deepEqual(vistaDaCorrecao({ correcaoId: 'CR-1', estado: 'CONCLUIDA' }), { kind: 'a-corrigir' }); // sem resultado ainda
});

test('corrigida mostra o resultado; sem respostas legíveis diz-se incompleta, nunca zero', () => {
  assert.equal(vistaDaCorrecao({ correcaoId: 'c', estado: 'CONCLUIDA', resultado: { estado: 'FULLY_GRADED', nota: 18 } }).kind, 'corrigida');
  assert.deepEqual(vistaDaCorrecao({ correcaoId: 'c', estado: 'CONCLUIDA', resultado: { estado: 'INCOMPLETE', nota: null } }), { kind: 'incompleta', semGabarito: false });
});

test('uma correcção cancelada ou com incidente é uma falha, não uma espera eterna', () => {
  assert.deepEqual(vistaDaCorrecao({ correcaoId: 'c', estado: 'CANCELADA' }), { kind: 'falhou', motivo: 'incidente' });
  assert.deepEqual(vistaDaCorrecao({ correcaoId: 'c', estado: 'FALHADA' }), { kind: 'falhou', motivo: 'incidente' });
  assert.deepEqual(vistaDaCorrecao({ correcaoId: 'c', estado: 'INCIDENTE' }), { kind: 'falhou', motivo: 'incidente' });
});

test('o pedido leva a instituição, a prova, a simulação e o aluno, e usa o username sem nome', () => {
  const p = pedidoDeCorrecao({ me, simulationId: 9, statementId: 2, callbackUrl: 'https://k/e' });
  assert.equal(p?.correcaoRef, 'kixi-sim-9');
  assert.deepEqual(p?.org, { sourcedId: '1', nome: 'Instituto', sigla: 'ITEL' });
  assert.deepEqual(p?.simulacao, { sourcedId: '9' });
  assert.equal(p?.aluno.nome, 'Ana Domingos');
  assert.equal(pedidoDeCorrecao({ me: { ...me, first_name: null, last_name: null }, simulationId: 9, statementId: 2, callbackUrl: 'x' })?.aluno.nome, 'ana.domingos');
});

test('um aluno sem escola usa a organização geral do Kixi em vez de ficar sem pedido', () => {
  const p = pedidoDeCorrecao({ me: { ...me, school: null }, simulationId: 1, statementId: 1, callbackUrl: 'x' });
  assert.deepEqual(p?.org, { sourcedId: 'kixi', nome: 'Kixi', sigla: 'KIXI' });
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

test('o anel usa a escala da nota (20), nunca a cotação em pontos da prova', () => {
  // Uma prova de 25 pontos: a nota do motor é 11,6 de 20, não 11,6 de 25.
  assert.equal(escalaDaNota({ nota: 11.6, pontos: 14.5, maximo: 25, escala: 20 }), 20);
  // Motor anterior ao #60, sem escala no resultado: a nota continua a ser 0–20.
  assert.equal(escalaDaNota({ nota: 11.6, pontos: 14.5, maximo: 25 }), 20);
  assert.equal(escalaDaNota({ escala: 0 }), 20);
  assert.equal(escalaDaNota({ escala: -5 }), 20);
});

import { semNotaDasSimulacoes } from './correcao-rules.ts';

test('a nota das simulações livres sai das outras páginas; a das salas fica', () => {
  const sims = [{ id: 1, finalScore: 14 }, { id: 2, finalScore: 18 }, { id: '3', finalScore: null }];
  assert.deepEqual(semNotaDasSimulacoes(sims, [{ simulationId: 2 }]), [{ id: 1, finalScore: null }, { id: 2, finalScore: 18 }, { id: '3', finalScore: null }]);
});

test('se a lista de salas falhou, não se arrisca: sai a nota de todas', () => {
  assert.deepEqual(semNotaDasSimulacoes([{ id: 2, finalScore: 18 }], null), [{ id: 2, finalScore: null }]);
});

test('sem gabarito numa questão aberta diz-se, em vez de culpar a leitura das respostas', () => {
  const v = vistaDaCorrecao({
    correcaoId: 'c',
    estado: 'CONCLUIDA',
    resultado: { estado: 'INCOMPLETE', nota: null, questoes: [{ questaoId: '1', tipo: 'DISSERTATIVA', corrigida: false }] },
  });
  assert.deepEqual(v, { kind: 'incompleta', semGabarito: true });
});

test('uma correcção FALHADA (incidente no motor) é uma falha, não uma espera', () => {
  assert.equal(vistaDaCorrecao({ correcaoId: 'c', estado: 'FALHADA' }).kind, 'falhou');
});

// ── #787: recusa, 409, nota provisória ───────────────────────────────────────

test('o pedido só leva o que o contrato exige: o título da prova, que o professor pode editar, não segue', () => {
  const p = pedidoDeCorrecao({ me, simulationId: 9, statementId: 2, callbackUrl: 'https://k/e' });
  assert.deepEqual(p.prova, { sourcedId: '2' });
});

test('um 4xx do motor (menos 408 e 429) é uma recusa; rede, 5xx, 408 e 429 são só atraso', () => {
  for (const status of [400, 401, 403, 404, 422]) assert.deepEqual(vistaDeUmaRecusa(status), { kind: 'falhou', motivo: 'recusada' }, String(status));
  for (const status of [0, 408, 429, 500, 502, 503, 504]) assert.deepEqual(vistaDeUmaRecusa(status), { kind: 'a-corrigir' }, String(status));
});

test('o 409 do motor traz o identificador da correcção que já existe', () => {
  const problema = JSON.stringify({ status: 409, title: 'Conflict', detail: 'A correcção CR-0A5ECDCA54339EB3 já existe com outro conteúdo.' });
  assert.equal(correcaoIdDoConflito(problema), 'CR-0A5ECDCA54339EB3');
  assert.equal(correcaoIdDoConflito('{"detail":"outro erro"}'), null);
  assert.equal(correcaoIdDoConflito('CR-123 curto'), null);
  assert.equal(correcaoIdDoConflito(null), null);
});

test('a nota provisória soma só as questões fechadas já pontuadas e nunca inventa uma', () => {
  const q = (reviewStatus: string, scoreObtained: number | null, maxScore: number) => ({ questionId: 1, reviewStatus, scoreObtained, maxScore }) as never;
  const base = { simulationId: 1, finalScore: null, pendingReviewCount: 2 };
  const com = (questions?: unknown[]) => notaProvisoria({ ...base, questions } as never);
  assert.deepEqual(com([q('AUTO_GRADED', 2, 2), q('AUTO_GRADED', 0, 3), q('PENDING_REVIEW', null, 6)]), { pontos: 2, maximo: 5 });
  assert.equal(com([q('PENDING_REVIEW', null, 6)]), null);
  assert.equal(com([]), null);
  assert.equal(com(undefined), null);
});

test('o progresso e a previsão do motor passam para a espera quando fazem sentido (schoolops#59)', () => {
  assert.deepEqual(
    vistaDaCorrecao({ correcaoId: 'c', estado: 'ABERTA', progresso: { corrigidas: 2, total: 5 }, previsaoSegundos: 63 }),
    { kind: 'a-corrigir', progresso: { corrigidas: 2, total: 5 }, previsaoSegundos: 63 },
  );
  // Motor antigo, ou ainda sem amostras: nada a mostrar além da espera, e nunca um zero inventado.
  assert.deepEqual(vistaDaCorrecao({ correcaoId: 'c', estado: 'ABERTA', progresso: null, previsaoSegundos: null }), { kind: 'a-corrigir' });
  assert.deepEqual(vistaDaCorrecao({ correcaoId: 'c', estado: 'ABERTA', progresso: { corrigidas: 0, total: 5 } }), { kind: 'a-corrigir', progresso: { corrigidas: 0, total: 5 } });
  assert.deepEqual(vistaDaCorrecao({ correcaoId: 'c', estado: 'ABERTA', previsaoSegundos: 0 }), { kind: 'a-corrigir', previsaoSegundos: 0 });
});

test('um progresso incoerente conta como «ainda não se sabe»', () => {
  assert.equal(progressoValido({ corrigidas: 6, total: 5 }), null);
  assert.equal(progressoValido({ corrigidas: -1, total: 5 }), null);
  assert.equal(progressoValido({ corrigidas: 0, total: 0 }), null);
  assert.equal(progressoValido({ corrigidas: 1.5, total: 5 }), null);
  assert.equal(previsaoValida(-3), null);
  assert.equal(previsaoValida(Number.NaN), null);
  assert.equal(previsaoValida(undefined), null);
  assert.equal(previsaoValida(41.6), 42);
});
