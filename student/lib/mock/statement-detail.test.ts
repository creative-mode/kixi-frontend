import assert from 'node:assert/strict';
import test from 'node:test';

import { canOpenChat, findVisible, summaryOf, type DetailRow } from './statement-detail.ts';

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
  // needsReview e ocrConfidence são null para quem não pode editar o enunciado, e não
  // há campo de gabarito nenhum: o summary é o que o catálogo já devolvia.
  assert.equal(summary.needsReview, null);
  assert.equal(summary.ocrConfidence, null);
  assert.equal('questions' in summary, false);
  assert.equal('options' in summary, false);
});

test('a sessão de chat exige um enunciado que o aluno pode ler', () => {
  // statementId é @NotNull: não existe tutor sem papel. E um id que não é número
  // é recusado antes de chegar a lado nenhum.
  assert.equal(canOpenChat([row()], 1), true);
  assert.equal(canOpenChat([row()], 99), false);
  assert.equal(canOpenChat([row({ visible: false })], 1), false);
  assert.equal(canOpenChat([row()], null), false);
  assert.equal(canOpenChat([row()], '1'), false);
  assert.equal(canOpenChat([row()], 1.5), false);
});
