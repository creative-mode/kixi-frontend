/**
 * O que se sabe do desempenho do aluno a partir das suas simulações (`GET /simulations`),
 * sem servidor e sem React para o `node --test` o cobrir.
 *
 * O backend não tem "domínio por tema" nem uma linha do tempo de atividade do aluno: o que
 * existe são simulações com nota, e a nota de uma prova sobre o seu total é a única medida
 * de domínio que não se inventa. Por isso o "tema" aqui é a prova.
 */

import { isFinished } from './attempt-history.ts';

/** Uma simulação como o backend a devolve, só com o que isto lê. */
export interface RawSimulation {
  id: number;
  status?: string | null;
  finalScore?: number | null;
  finishedAt?: string | null;
  statement?: { id?: number | null; title?: string | null; totalMaxScore?: number | null } | null;
}

export interface Mastery {
  label: string;
  value: number;
}

export interface ActivityItem {
  id: number;
  title: string;
  score: number;
  finishedAt: string | null;
}

export interface Performance {
  /** Da prova mais fraca para a mais forte: é o que há para rever primeiro. */
  mastery: Mastery[];
  /** Mais recente primeiro. */
  activity: ActivityItem[];
}

const finishedAtOf = (s: RawSimulation) => (s.finishedAt ? Date.parse(s.finishedAt) : 0) || 0;

/** A percentagem de uma prova, ou null quando falta a nota ou a escala: sem escala uma nota
 *  não vira percentagem, e uma barra a 0% diria que o aluno não sabe nada. */
export function percentOf(s: RawSimulation): number | null {
  const total = s.statement?.totalMaxScore;
  if (s.finalScore == null || !total || total <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((s.finalScore * 100) / total)));
}

export function buildPerformance(simulations: RawSimulation[]): Performance {
  const finished = simulations
    .filter((s) => isFinished(s) && s.finalScore != null)
    .sort((a, b) => finishedAtOf(b) - finishedAtOf(a));

  const activity = finished.map((s) => ({
    id: s.id,
    title: s.statement?.title?.trim() || 'Prova',
    score: s.finalScore as number,
    finishedAt: s.finishedAt ?? null,
  }));

  // Uma prova conta uma vez, pela tentativa mais recente: refazê-la é o que se quer premiar.
  const latestByStatement = new Map<number, RawSimulation>();
  for (const s of finished) {
    const key = s.statement?.id ?? -s.id;
    if (!latestByStatement.has(key)) latestByStatement.set(key, s);
  }
  const mastery: Mastery[] = [];
  for (const s of latestByStatement.values()) {
    const value = percentOf(s);
    if (value !== null) mastery.push({ label: s.statement?.title?.trim() || 'Prova', value });
  }
  mastery.sort((a, b) => a.value - b.value || a.label.localeCompare(b.label, 'pt'));

  return { mastery, activity };
}
