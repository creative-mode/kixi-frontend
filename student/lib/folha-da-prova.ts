/**
 * A prova como folha: as questões que o aluno recebe (cada uma a sua linha, as alíneas já separadas) postas na
 * estrutura em que o professor as montou no construtor: questão numerada, enunciado comum, alíneas a), b)…,
 * opções A), B)…, figuras e linhas de resposta.
 *
 * Pura e sem React, para o `node --test` chegar cá. `orderQuestions` já tirou as questões-pai (o enunciado comum
 * vem em `parentText` de cada alínea), por isso agrupa-se pelo número da questão inteira.
 */
import { itemLabel, isItem, topNumber } from './question-number.ts';
import type { ExamOption, ExamQuestion } from './exam-rules.ts';
import type { MathContentFields } from './shared/math-types.ts';

export interface PaperItem extends MathContentFields {
  id: number;
  /** `a`, `b`… */
  label: string;
  text: string;
  maxScore: number | null;
  options: ExamOption[];
}

export interface PaperQuestion extends MathContentFields {
  /** O número da questão inteira (o 3 de 3a). */
  number: number;
  /** O enunciado: o comum, se tem alíneas; o próprio, se não. */
  text: string;
  /** A cotação da questão: a própria, ou a soma das alíneas. */
  maxScore: number | null;
  /** O id da questão quando é uma folha (sem alíneas); `null` num grupo. */
  id: number | null;
  /** Persistent question id that owns the shared statement and its figures. */
  groupId?: number | null;
  options: ExamOption[];
  items: PaperItem[];
}

/** O que o cabeçalho da folha diz. Tudo é opcional: o que o servidor não mandou fica em branco no molde. */
export interface PaperMeta {
  institution?: string | null;
  subject?: string | null;
  kind?: string | null;
  grade?: string | null;
  schoolYear?: string | null;
  variant?: string | null;
  durationMinutes?: number | null;
  totalMaxScore?: number | null;
  rules?: string[];
}

const sum = (values: (number | null | undefined)[]): number | null => {
  const present = values.filter((v): v is number => typeof v === 'number');
  return present.length > 0 ? Math.round(present.reduce((a, b) => a + b, 0) * 100) / 100 : null;
};

/** As questões da folha, por ordem: as de topo e os grupos de alíneas, cada alínea na sua questão. */
export function buildPaper(questions: readonly ExamQuestion[]): PaperQuestion[] {
  const papers: PaperQuestion[] = [];
  const groups = new Map<number, PaperQuestion>();

  for (const q of questions) {
    if (!isItem(q)) {
      papers.push({ number: q.number, text: q.text, maxScore: q.maxScore ?? null, id: q.id, options: q.options ?? [], items: [], rawText: q.rawText, confidence: q.confidence ?? q.ocrConfidence, formulas: q.formulas, blocks: q.blocks });
      continue;
    }
    const number = q.parentNumber ?? topNumber(q.number);
    let group = groups.get(number);
    if (!group) {
      group = { number, text: q.parentText ?? '', maxScore: null, id: null, groupId: q.parentId ?? null, options: [], items: [] };
      groups.set(number, group);
      papers.push(group);
    }
    group.items.push({
      id: q.id,
      label: q.label?.trim() || itemLabel(group.items.length),
      text: q.text,
      maxScore: q.maxScore ?? null,
      options: q.options ?? [],
      rawText: q.rawText,
      confidence: q.confidence ?? q.ocrConfidence,
      formulas: q.formulas,
      blocks: q.blocks,
    });
  }

  for (const group of groups.values()) group.maxScore = sum(group.items.map((i) => i.maxScore));
  return papers.sort((a, b) => a.number - b.number);
}

/** A questão (ou alínea) em que a folha se detém: o id é o da que o aluno tem aberta. */
export function containsLeaf(paper: PaperQuestion, id: number | null | undefined): boolean {
  return id != null && (paper.id === id || paper.items.some((i) => i.id === id));
}

/** `3a` / `5`: como o aluno lê o número da folha. */
export function leafNumber(paper: PaperQuestion, item?: PaperItem): string {
  return item ? `${paper.number}${item.label}` : String(paper.number);
}

/** O que o aluno tem escrito numa questão, para a folha o mostrar como o papel: a opção marcada e o texto. */
export type PaperAnswer = { optionId: number | null; text: string };

/** A correcção de uma questão, para a folha a mostrar como um professor a corrigiria à mão. */
export type PaperMark = {
  verdict: 'correct' | 'wrong' | 'pending' | 'blank';
  correctOptionId?: number | null;
  scoreObtained?: number | null;
  maxScore?: number | null;
  /** A resposta esperada de uma questão aberta, quando o servidor a dá. */
  modelAnswer?: string | null;
};

/** A nota estampada no topo da folha: verde se positiva, vermelha se negativa. `passed` nulo = ainda por corrigir. */
export type PaperStamp = { score: string; max: string | null; passed: boolean | null; provisional: boolean };

