/**
 * A prova entregue na folha, corrigida: o que o aluno marcou e escreveu, a certa de cada questão, a nota de cada
 * uma à margem e a nota final estampada. Pura e sem React, para o `node --test` chegar cá.
 */
import { topNumber } from './question-number.ts';
import type { ExamQuestion } from './exam-rules.ts';
import { formatScore, verdict, type ResultQuestion } from './result-rules.ts';
import type { PaperAnswer, PaperMark, PaperStamp } from './folha-da-prova.ts';

/** Abaixo de metade da cotação a nota é negativa (10 em 20). */
export const PASS_RATIO = 0.5;

/** As questões do resultado como a folha as lê: as mesmas que a sala dá, com o enunciado comum de cada alínea. */
export function paperQuestions(questions: readonly ResultQuestion[]): ExamQuestion[] {
  return questions.map((q) => ({
    id: q.questionId,
    number: q.number,
    text: q.text,
    maxScore: q.maxScore ?? null,
    questionType: q.questionType ?? null,
    parentId: q.parentId ?? null,
    label: q.label ?? null,
    parentText: q.parentText ?? null,
    parentNumber: q.parentId != null || q.number >= 100 ? topNumber(q.number) : null,
    options: (q.options ?? []).map((o) => ({ id: o.id, optionLabel: o.optionLabel ?? null, optionText: o.optionText })),
  }));
}

export function answersOf(questions: readonly ResultQuestion[]): Record<number, PaperAnswer> {
  return Object.fromEntries(questions.map((q) => [q.questionId, { optionId: q.selectedOptionId ?? null, text: q.answerText ?? '' }]));
}

export function marksOf(questions: readonly ResultQuestion[]): Record<number, PaperMark> {
  return Object.fromEntries(
    questions.map((q) => [
      q.questionId,
      {
        verdict: verdict(q),
        correctOptionId: q.correctOptionId ?? null,
        scoreObtained: q.scoreObtained ?? null,
        maxScore: q.maxScore ?? null,
        modelAnswer: q.modelAnswer ?? null,
      },
    ]),
  );
}

/** A nota estampada, ou `null` se ainda não há nota. `passed` é nulo sem cotação total ou quando ainda há respostas por
 *  corrigir e a nota provisória não chega para ser positiva. */
export function stampOf(finalScore: number | null | undefined, totalMaxScore: number | null | undefined, pendingReview: number | null | undefined): PaperStamp | null {
  const score = formatScore(finalScore);
  if (finalScore == null || score == null) return null;
  const provisional = (pendingReview ?? 0) > 0;
  const reaches = totalMaxScore != null && totalMaxScore > 0 ? finalScore / totalMaxScore >= PASS_RATIO : null;
  // Uma resposta aberta por corrigir só pode juntar pontos: já positiva, a nota não desce de positiva; abaixo disso
  // ainda não se sabe, e o carimbo não finge um vermelho que o professor pode vir a desmentir.
  const passed = provisional && reaches !== true ? null : reaches;
  return { score, max: totalMaxScore != null ? formatScore(totalMaxScore) : null, passed, provisional };
}
