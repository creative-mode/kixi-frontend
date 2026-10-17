import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DECISION_LABEL,
  DECISIONS,
  REASONS,
  REASON_KEYS,
  TARGET_LABEL,
  contarPorMotivo,
  decisionValida,
  isDecision,
  isReportReason,
  noteError,
  porAlvo,
  type Report,
} from './model.ts';

// A issue põe dois critérios: perfil ocultado devolve 404 a terceiros, e existe
// registo de auditoria das decisões. Aqui fica a parte que é regra — o resto é
// transporte.

function relatorio(over: Partial<Report> = {}): Report {
  return {
    id: 1,
    target: 'ACCOUNT',
    targetId: 7,
    targetName: 'Alguem',
    reporterAccountId: 3,
    reporterName: 'Quem Denunciou',
    reason: 'IMPERSONATION',
    note: '',
    status: 'OPEN',
    createdAt: '2026-01-01T10:00:00',
    decidedAt: null,
    decidedBy: null,
    decisionNote: null,
    ...over,
  };
}

test('as decisões são as três da issue, e cada uma tem o que faz escrito', () => {
  assert.deepEqual(DECISIONS, ['IGNORED', 'HIDDEN', 'SUSPENDED']);
  assert.ok(isDecision('HIDDEN'));
  assert.ok(!isDecision('DELETED'));
  assert.ok(!isDecision(null));
  // A nota de cada decisão é o que impede um moderador de escolher «ocultar» a
  // pensar que é outra coisa.
  for (const d of DECISIONS) {
    assert.ok(DECISION_LABEL[d].length > 0);
  }
  assert.match(DECISION_LABEL.HIDDEN, /Ocultar/);
});

test('escola oculta-se mas nao se suspende', () => {
  assert.ok(decisionValida('INSTITUTION', 'IGNORED'));
  assert.ok(decisionValida('INSTITUTION', 'HIDDEN'));
  assert.ok(!decisionValida('INSTITUTION', 'SUSPENDED'));
  for (const d of DECISIONS) assert.ok(decisionValida('ACCOUNT', d), `${d} devia valer para uma conta`);
  assert.ok(!decisionValida('ACCOUNT', 'NOPE'));
});

test('os motivos sao os mesmos do lado do aluno', () => {
  // Se um dos lados ganhar ou perder um motivo, este teste tem de falhar. E a
  // denuncia vira illegivel do outro lado da fila.
  assert.deepEqual(REASON_KEYS, [
    'IMPERSONATION', 'FAKE_SCHOOL', 'OFFENSIVE_NAME', 'OFFENSIVE_PHOTO',
    'MISLEADING_CONTENT', 'BLOCK', 'OTHER',
  ]);
  assert.ok(isReportReason('FAKE_SCHOOL'));
  assert.ok(!isReportReason('OUTRA_COISA'));
  assert.equal(REASONS.BLOCK, 'Bloquear esta pessoa');
});

test('a nota tem limite e o erro diz qual e', () => {
  assert.equal(noteError('curta'), null);
  assert.equal(noteError('   '), null);
  assert.match(noteError('x'.repeat(501)) ?? '', /500 caracteres/);
});

test('as contagens por motivo Consideram so o que esta por decidir', () => {
  const Reports = [
    relatorio({ id: 1, reason: 'IMPERSONATION' }),
    relatorio({ id: 2, reason: 'IMPERSONATION' }),
    relatorio({ id: 3, reason: 'FAKE_SCHOOL' }),
    // Ja decidida: nao entra na contagem, senao o topo da fila mostra o que ja foi tratado.
    relatorio({ id: 4, reason: 'IMPERSONATION', status: 'IGNORED' }),
    relatorio({ id: 5, reason: 'OFFENSIVE_PHOTO', target: 'INSTITUTION' }),
  ];
  const conta = contarPorMotivo(Reports);
  assert.deepEqual(conta, [
    { reason: 'IMPERSONATION', total: 2 },
    { reason: 'FAKE_SCHOOL', total: 1 },
    { reason: 'OFFENSIVE_PHOTO', total: 1 },
  ]);
  assert.deepEqual(contarPorMotivo([]), []);
});

test('denuncias do mesmo alvo agrupam-se, e de alvos diferentes nao', () => {
  const mapa = porAlvo([
    relatorio({ id: 1, target: 'ACCOUNT', targetId: 7 }),
    relatorio({ id: 2, target: 'ACCOUNT', targetId: 7 }),
    relatorio({ id: 3, target: 'INSTITUTION', targetId: 7 }),
  ]);
  // O id 7 e o mesmo nas duas tabelas: sem o tipo na chave, as três cairiam no
  // mesmo grupo e a fila mostraria uma pessoa como se fosse uma escola.
  assert.equal(mapa.size, 2);
  assert.equal(mapa.get('ACCOUNT:7')?.length, 2);
  assert.equal(mapa.get('INSTITUTION:7')?.length, 1);
});

test('o alvo tem nome legivel nos dois tipos', () => {
  assert.equal(TARGET_LABEL.ACCOUNT, 'Pessoa');
  assert.equal(TARGET_LABEL.INSTITUTION, 'Escola');
});