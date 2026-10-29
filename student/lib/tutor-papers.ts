import 'server-only';

import { listSimulationsResult } from './exam';
import { getPerformance } from './performance';
import { recentPapers, reviewPapers, type TutorPaper } from './tutor-papers-rules';

/** O que o tutor mostra quando abre sem prova (#491): as últimas provas e as mais fracas. */
export type TutorLists =
  | { kind: 'ok'; recent: TutorPaper[]; review: TutorPaper[] }
  /** As tentativas não vieram. É diferente de «não há nenhuma», e o ecrã diz isso em
   *  vez de mandar o aluno escolher uma prova que pode muito bem existir. */
  | { kind: 'error'; status: number; message: string };

/**
 * Lê as duas listas numa passagem.
 *
 * As tentativas são a fonte das provas recentes e, se falharem, o ecrã inteiro falha —
 * é a única coisa que ele tem para oferecer. O desempenho é um painel de apoio
 * (`getPerformance` já degrada para vazio), por isso uma falha ali só custa «Para rever».
 */
export async function loadTutorPapers(now = Date.now()): Promise<TutorLists> {
  const [simulations, performance] = await Promise.all([listSimulationsResult(), getPerformance()]);
  if (!simulations.ok) {
    return { kind: 'error', status: simulations.status, message: simulations.message };
  }
  const recent = recentPapers(simulations.data, now);
  // Uma prova já listada em «últimas» não se repete em «Para rever»: a mesma linha
  // duas vezes no mesmo ecrã parece um erro, não uma prioridade.
  const shown = new Set(recent.map((paper) => paper.statementId));
  return {
    kind: 'ok',
    recent,
    review: reviewPapers(performance.mastery).filter((paper) => !shown.has(paper.statementId)),
  };
}
