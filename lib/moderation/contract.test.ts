import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AUDIT_KEYS,
  LISTA_LIMITE,
  listaTruncada,
  REPORT_KEYS,
  auditPath,
  decisionPath,
  reportsPath,
} from './contract.ts';
import { DECISIONS, decisionValida, notaDecisaoError, type AuditEntry, type Report } from './model.ts';

// Teste de contrato (#749): confronta o que o frontend chama e lê com o que o
// `ModerationAdminController` do backend expõe (kixi#591, PR kixi#604). O teste de
// `model.test.ts` só vê o modelo; este vê os caminhos e a forma das respostas.

test('a fila chama GET /reports com o estado e o limite máximo', () => {
  assert.equal(reportsPath(null), `/api/v1/moderation/reports?limit=${LISTA_LIMITE}`);
  assert.equal(reportsPath('OPEN'), `/api/v1/moderation/reports?status=OPEN&limit=${LISTA_LIMITE}`);
  // Sem `limit` o backend devolve só 100; o tecto é 500.
  assert.equal(LISTA_LIMITE, 500);
});

test('a auditoria chama GET /audit com o limite máximo', () => {
  assert.equal(auditPath(), `/api/v1/moderation/audit?limit=${LISTA_LIMITE}`);
});

test('cada decisão tem o seu caminho POST (não existe um /decision)', () => {
  assert.equal(decisionPath(7, 'IGNORED'), '/api/v1/moderation/reports/7/ignore');
  assert.equal(decisionPath(7, 'HIDDEN'), '/api/v1/moderation/reports/7/hide');
  assert.equal(decisionPath(7, 'SUSPENDED'), '/api/v1/moderation/reports/7/suspend');
});

test('as chaves lidas batem, uma a uma, com os records do backend', () => {
  // `ModerationReportResponse` e `AuditEntryResponse`. Se o backend mudar um nome, este
  // teste (e o do backend, que fixa o mesmo JSON) tem de mudar nos dois lados.
  const report: Report = {
    id: 1, target: 'ACCOUNT', targetId: 2, targetName: 'x', reporterAccountId: 3, reporterName: 'y',
    reason: 'OTHER', note: '', status: 'OPEN', createdAt: '2026-01-01T10:00:00',
    decidedAt: null, decidedBy: null, decisionNote: null,
  };
  const entry: AuditEntry = {
    id: 1, at: '2026-01-01T10:00:00', actor: 'a', action: 'IGNORED', target: 'ACCOUNT', targetId: 2,
    targetName: 'x', reportId: 1, note: 'uma nota longa',
  };
  assert.deepEqual(Object.keys(report), [...REPORT_KEYS]);
  assert.deepEqual(Object.keys(entry), [...AUDIT_KEYS]);
});

test('o que o ecrã deixa decidir é exactamente o que o backend aceita', () => {
  // Backend: SUSPENDED só contas, HIDDEN só escolas, IGNORED ambas; nota de 10 a 500 em todas.
  const aceites = DECISIONS.flatMap((d) => (['ACCOUNT', 'INSTITUTION'] as const).filter((t) => decisionValida(t, d)).map((t) => `${t}:${d}`));
  assert.deepEqual(aceites.sort(), ['ACCOUNT:IGNORED', 'ACCOUNT:SUSPENDED', 'INSTITUTION:HIDDEN', 'INSTITUTION:IGNORED']);
  for (const d of DECISIONS) assert.notEqual(notaDecisaoError(d, ''), null);
});

test('uma lista do tamanho do limite pode estar cortada; uma menor, não', () => {
  assert.ok(!listaTruncada(0));
  assert.ok(!listaTruncada(LISTA_LIMITE - 1));
  assert.ok(listaTruncada(LISTA_LIMITE));
});
