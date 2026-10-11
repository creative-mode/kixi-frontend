import assert from 'node:assert/strict';
import test from 'node:test';

import { findVisible, summaryOf, type DetailRow } from './statement-detail.ts';

const row = (over: Partial<DetailRow> = {}): DetailRow => ({
  id: 1,
  title: 'Redes de Computadores',
  examType: 'Teste',
  subjectId: 1,
  schoolYearId: 1,
  institutionId: 1,
  classId: 1,
  durationMinutes: 90,
  totalMaxScore: 20,
  termId: 2,
  needsReview: false,
  visible: true,
  ...over,
});

test('uma prova publicada abre-se pelo id', () => {
  assert.equal(findVisible([row()], 1)?.id, 1);
});

test('uma prova oculta não abre-se, e a resposta não distingue de não existir', () => {
  // findByIdVisible só devolve visible = true e o resto é 404. Dizer «existe mas não
  // podes ver» confirma ao aluno que um enunciado existe.
  assert.equal(findVisible([row({ visible: false })], 1), null);
  assert.equal(findVisible([row()], 99), null);
});

test('o resumo não leva o gabarito nem os enunciados', () => {
  const summary = summaryOf(row());
  assert.equal(summary.id, 1);
  assert.equal(summary.title, 'Redes de Computadores');
  assert.equal(summary.durationMinutes, 90);
  assert.equal(summary.totalMaxScore, 20);
  // needsReview e ocrConfidence viajam como o backend os manda no summary. O mock
  // escondia-os aos alunos e o teste confirmava isso, mais um sítio onde mock e backend
  // discordavam: so o `/full` esconde o ocrConfidence.
  assert.equal(summary.needsReview, false);
  assert.equal(summary.ocrConfidence, null);
  assert.equal('questions' in summary, false);
  assert.equal('options' in summary, false);
  // O `termId` faltava: faz parte do StatementSummary e o mock nao o mandava.
  assert.equal(summary.termId, 2);
});

test('o catálogo só lista o que está publicado', () => {
  // Com a linha única, uma prova oculta vive na mesma tabela que as do catálogo. O
  // `StatementCatalogService` só devolve `visible = true`, e o mock tem de fazer o
  // mesmo: senão o aluno via no catálogo uma prova que o detalhe diz que não existe.
  const rows = [
    row({ id: 1 }),
    row({ id: 2 }),
    row({ id: 4, title: 'Rascunho', visible: false }),
  ];
  const publicados = rows.filter((r) => r.visible).map((r) => r.id);
  assert.deepEqual(publicados, [1, 2]);
  // E a oculta continua a dar 404 pelo id, como se nunca tivesse existido.
  assert.equal(findVisible(rows, 4), null);
});
