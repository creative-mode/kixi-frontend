/**
 * A notificação que avisa o aluno de que a nota chegou (kixi#793), sem React nem
 * `server-only` para o `node --test` poder cobrir a frase e a data. Uma correção
 * sem data não pode ser "nova": é melhor ficar de fora do sino do que aparecer
 * com uma hora inventada.
 */

import { correctionDone, formatScore, isFinished } from './attempt-history.ts';

export interface CorrectionNoticeInput {
  id: number;
  status?: string | null;
  finalScore?: number | null;
  finishedAt?: string | null;
  correctionStatus?: string | null;
  correctedAt?: string | null;
  statement?: { title?: string | null; totalMaxScore?: number | null } | null;
}

export interface CorrectionNotice {
  key: string;
  text: string;
  href: string;
  at: string;
}

/** «A tua prova de Matemática foi corrigida: 14/20». Sem nota ou sem escala não se
 *  inventa o denominador: dizer só que ficou corrigida é verdade, «/0» não é. */
export function correctionText(s: CorrectionNoticeInput): string {
  const title = s.statement?.title?.trim();
  const nota = formatScore(s.finalScore);
  const total = s.statement?.totalMaxScore;
  const fim = nota != null && total != null && total > 0 ? `: ${nota}/${formatScore(total)}` : '.';
  return `${title ? `A tua prova de ${title}` : 'A tua prova'} foi corrigida${fim}`;
}

/**
 * Substitui «Terminaste…» no instante em que a correção fica pronta. A data é a da
 * correção, não a da entrega — é isso que faz a mesma prova voltar a ser «nova»
 * no sino quando a nota chega, mesmo para quem já tinha lido a notificação da entrega.
 */
export function correctionNoticeOf(s: CorrectionNoticeInput): CorrectionNotice | null {
  if (!isFinished(s) || !correctionDone(s)) return null;
  const at = s.correctedAt || s.finishedAt;
  if (!at) return null;
  return {
    key: `sim-${s.id}`,
    text: correctionText(s),
    href: `/resultado?prova=${s.id}`,
    at,
  };
}
