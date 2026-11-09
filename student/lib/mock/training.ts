/** «Prepara-te para a prova» no mock: a matriz de uma sala, o que há para treinar por tema e a escolha das questões.
 *  Espelha as regras do backend (creative-mode/kixi, TrainingPlanService): o treino nunca usa a prova da própria
 *  sala, prefere o que o aluno ainda não tentou e reparte as questões por provas e anos diferentes. */

import type { PlanItem, PlanSource } from '../training.ts';

export interface MockTopic {
  id: number;
  subjectId: number;
  name: string;
}

export interface MockMatrixItem {
  topicId: number;
  questionCount: number;
  points: number | null;
  cognitiveLevel: string | null;
}

export interface MockMatrix {
  roomId: number;
  title: string | null;
  totalPoints: number;
  items: MockMatrixItem[];
}

/** Uma questão do banco com o tema, a prova de onde vem e o que o aluno já fez com ela. */
export interface Candidate {
  questionId: number;
  statementId: number;
  statementTitle: string;
  year: string | null;
  topicIds: number[];
  history: 'new' | 'wrong' | 'right';
}

const RANK: Record<Candidate['history'], number> = { new: 0, wrong: 1, right: 2 };

/**
 * Escolhe `count` questões de um tema: primeiro as que o aluno nunca tentou, depois as que falhou, depois as que já
 * acertou; dentro de cada grupo reparte pelas provas (a que tem menos escolhidas vai primeiro, a mais recente
 * desempata), para o treino não ser todo da mesma prova.
 */
export function pickForTopic(pool: readonly Candidate[], count: number): Candidate[] {
  const chosen: Candidate[] = [];
  const perStatement = new Map<number, number>();
  const left = [...pool];
  while (chosen.length < count && left.length > 0) {
    left.sort((a, b) => {
      if (RANK[a.history] !== RANK[b.history]) return RANK[a.history] - RANK[b.history];
      const used = (perStatement.get(a.statementId) ?? 0) - (perStatement.get(b.statementId) ?? 0);
      if (used !== 0) return used;
      const year = (b.year ?? '').localeCompare(a.year ?? '');
      return year !== 0 ? year : a.questionId - b.questionId;
    });
    const next = left.shift()!;
    chosen.push(next);
    perStatement.set(next.statementId, (perStatement.get(next.statementId) ?? 0) + 1);
  }
  return chosen;
}

export interface Allocation {
  topicId: number;
  requested: number;
  provided: number;
}

/** A alocação por tema, pela ordem pedida; uma questão nunca entra em dois temas. */
export function allocate(
  pool: readonly Candidate[],
  requests: readonly { topicId: number; count: number }[],
): { questionIds: number[]; allocation: Allocation[] } {
  const used = new Set<number>();
  const questionIds: number[] = [];
  const allocation: Allocation[] = [];
  for (const request of requests) {
    const candidates = pool.filter((c) => c.topicIds.includes(request.topicId) && !used.has(c.questionId));
    const picked = pickForTopic(candidates, request.count);
    for (const c of picked) {
      used.add(c.questionId);
      questionIds.push(c.questionId);
    }
    allocation.push({ topicId: request.topicId, requested: request.count, provided: picked.length });
  }
  return { questionIds, allocation };
}

/** O plano de uma sala: cada tema da matriz com o que há para treinar e o que o aluno já fez. */
export function planItems(matrix: MockMatrix, topics: readonly MockTopic[], pool: readonly Candidate[]): PlanItem[] {
  return matrix.items.map((item) => {
    const inTopic = pool.filter((c) => c.topicIds.includes(item.topicId));
    const bySource = new Map<number, PlanSource>();
    for (const c of inTopic) {
      const found = bySource.get(c.statementId);
      if (found) found.count += 1;
      else bySource.set(c.statementId, { statementId: c.statementId, title: c.statementTitle, year: c.year, count: 1 });
    }
    const attempted = inTopic.filter((c) => c.history !== 'new').length;
    return {
      topicId: item.topicId,
      name: topics.find((t) => t.id === item.topicId)?.name ?? 'Tema',
      questionCount: item.questionCount,
      points: item.points,
      cognitiveLevel: item.cognitiveLevel,
      available: inTopic.length,
      sources: [...bySource.values()].sort((a, b) => String(b.year ?? '').localeCompare(String(a.year ?? '')) || b.count - a.count),
      attempted,
      correct: inTopic.filter((c) => c.history === 'right').length,
    };
  });
}
