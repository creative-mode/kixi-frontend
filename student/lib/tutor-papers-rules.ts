/**
 * As provas que o tutor oferece quando se abre sem contexto (#491), com regras puras
 * para o `node --test` as cobrir.
 *
 * `/tutor` sozinho era um beco sem saída: dizia «escolhe uma prova» e mandava o aluno
 * para a lista. O que o aluno já fez é a melhor lista que existe — as últimas provas, e
 * as que estão mais fracas —, por isso é daqui que saem as linhas do ecrã.
 */

import { acceptsAnswers, type SimulationSummary } from './exam-rules.ts';
import type { Mastery } from './performance-rules.ts';

/** Uma linha da lista do tutor: a prova e uma nota curta de porque está ali. */
export interface TutorPaper {
  statementId: number;
  title: string;
  /** «Concluída · 16,4», «Cancelada», «82%». Ausente quando não há nada honesto a dizer. */
  note?: string;
}

/** Quantas provas cada lista mostra. Três cabe num ecrã de telemóvel sem se tornar catálogo. */
export const TUTOR_PAPERS = 3;

/** Uma nota é um número; mostrá-la com ponto decimal é o único erro que se corrige aqui. */
function scoreLabel(score: number | null | undefined): string | null {
  return score == null ? null : String(score).replace('.', ',');
}

function noteOf(simulation: SimulationSummary): string | undefined {
  const status = (simulation.status ?? '').toUpperCase();
  if (status === 'FINISHED') {
    const score = scoreLabel(simulation.finalScore);
    return score ? `Concluída · ${score}` : 'Concluída';
  }
  // Uma tentativa em curso que já passou do prazo não fecha o tutor (#192): continua a
  // ser uma prova, só não está a decorrer.
  if (status === 'IN_PROGRESS') return 'Em curso';
  if (status === 'CANCELLED') return 'Cancelada';
  return undefined;
}

/**
 * As provas das tentativas mais recentes, uma por prova.
 *
 * A ordem é a do id decrescente, a única que o backend garante (ver `attempt-history`).
 * Uma prova com tentativa a decorrer fica de fora: o tutor fecha enquanto a prova corre
 * (#192), e oferecê-la seria outra porta que não abre.
 */
export function recentPapers(
  simulations: SimulationSummary[],
  now: number,
  limit = TUTOR_PAPERS,
): TutorPaper[] {
  const seen = new Set<number>();
  const papers: TutorPaper[] = [];
  const newest = [...simulations].sort((a, b) => Number(b.id) - Number(a.id));
  for (const simulation of newest) {
    const statementId = Number(simulation.statement?.id);
    if (!Number.isInteger(statementId) || statementId <= 0 || seen.has(statementId)) continue;
    if (acceptsAnswers(simulation, now)) continue;
    seen.add(statementId);
    papers.push({
      statementId,
      title: simulation.statement?.title?.trim() || 'Prova',
      note: noteOf(simulation),
    });
    if (papers.length === limit) break;
  }
  return papers;
}

/**
 * As provas a rever, da mais fraca para a mais forte — a ordem que `buildPerformance`
 * já dá à mestria. A percentagem é o que diz porque é que esta prova vem primeiro.
 */
export function reviewPapers(mastery: Mastery[], limit = TUTOR_PAPERS): TutorPaper[] {
  return mastery.slice(0, limit).map((item) => ({
    statementId: item.id,
    title: item.label,
    note: `${item.value}%`,
  }));
}
