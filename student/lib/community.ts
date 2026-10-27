import 'server-only';

import { correcaoLigada } from './schoolops/correcao';
import { apiDelete, apiGet, apiPost, type Result } from './api';

export interface ScoreBucket {
  index: number;
  from: number | null;
  to: number | null;
  count: number;
}

export interface QuestionStats {
  questionId: number;
  number: number | null;
  maxScore: number | null;
  attempts: number;
  correctCount: number;
  pctCorrect: number | null;
  avgScore: number | null;
  mine: { scoreObtained: number | null; isCorrect: boolean | null } | null;
}

/** GET /statements/{id}/community (CommunityStatsResponse). */
export interface CommunityStats {
  statementId: number;
  sampleSize: number;
  meanScore: number | null;
  medianScore: number | null;
  scoreDistribution: ScoreBucket[];
  questions: QuestionStats[];
  avgTimeSpentSeconds: number | null;
  timeSampleSize: number;
  mine: { simulationId: number; finalScore: number | null } | null;
}

export interface SharedAnswer {
  questionId: number;
  number: number | null;
  selectedLabel: string | null;
  answerText: string | null;
  scoreObtained: number | null;
}

/** Uma resolução partilhada (SharedSolutionResponse). Anónima por omissão: sem
 *  nome e sem escola quando `institution` vem null. */
export interface SharedSolution {
  shareId: number;
  institution: { id: number; code: string } | null;
  authorName: string | null;
  finalScore: number | null;
  timeSpentSeconds: number | null;
  answers: SharedAnswer[];
}

interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export async function getCommunityStats(statementId: number): Promise<Result<CommunityStats>> {
  const result = await apiGet<CommunityStats>(`/statements/${statementId}/community`);
  // Com a correcção do SchoolOps ligada, a tua nota só aparece no resultado: aqui não há comparação com a média por corrigir.
  if (result.ok && result.data.mine && correcaoLigada()) {
    return { ok: true, data: { ...result.data, mine: { ...result.data.mine, finalScore: null } } };
  }
  return result;
}

export async function getSharedSolutions(
  statementId: number,
  institutionId?: number,
): Promise<Result<Page<SharedSolution>>> {
  return apiGet<Page<SharedSolution>>(`/statements/${statementId}/community/solutions`, { institutionId });
}

export async function shareSolution(simulationId: number, anonymous: boolean, displayName?: string) {
  return apiPost(`/simulations/${simulationId}/share`, { anonymous, displayName: displayName || undefined });
}

export async function unshareSolution(simulationId: number) {
  return apiDelete(`/simulations/${simulationId}/share`);
}
