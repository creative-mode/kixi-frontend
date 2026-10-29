/** O que o resultado diz depois da nota (#492), sem servidor e sem React para o
 *  `node --test` alcançar.
 *
 *  A nota é do servidor e não se recalcula: aqui só se lê o que ela significa para
 *  quem a recebe. A comparação com a turma é a média de
 *  `GET /statements/{id}/community`, e a medalha nova é uma das que o servidor
 *  devolveu em `/me/badges`, desbloqueada durante esta tentativa. */

import { formatDelta, formatScore } from './result-rules.ts';

export type ReadingTone = 'above' | 'level' | 'below' | 'low';

export interface GradeReading {
  tone: ReadingTone;
  text: string;
  /** Uma nota baixa leva ao tutor: é o caminho para a próxima correr melhor. */
  leadsToTutor: boolean;
}

export interface ReadingInput {
  score: number | null | undefined;
  totalMax: number | null | undefined;
  meanScore: number | null | undefined;
  sampleSize: number | null | undefined;
  delta: number | null | undefined;
}

/**
 * Uma frase de leitura da nota, com uma comparação honesta com a turma quando o
 * servidor tem amostra suficiente. Sem média, a leitura é qualitativa e continua a
 * sair da nota que o servidor calculou.
 */
export function gradeReading({ score, totalMax, meanScore, sampleSize, delta }: ReadingInput): GradeReading | null {
  if (score == null || !Number.isFinite(score) || totalMax == null || !Number.isFinite(totalMax) || totalMax <= 0) {
    return null;
  }

  const pct = score / totalMax;
  const hasClass = meanScore != null && Number.isFinite(meanScore) && (sampleSize ?? 0) >= 2;
  const mean = hasClass ? formatScore(meanScore) : null;
  const samples = `${sampleSize} ${sampleSize === 1 ? 'tentativa' : 'tentativas'}`;
  const subiu = delta != null && delta > 0 ? ` Subiste ${formatDelta(delta)} face à tentativa anterior.` : '';

  // Abaixo de metade não é um veredicto sobre o aluno: é o ponto de partida da
  // próxima tentativa, e o tutor é quem ajuda a fechar o que falhou.
  if (pct < 0.5) {
    const classPart =
      hasClass && score < meanScore!
        ? ` A média da turma é ${mean} em ${samples}, mas ainda vais a tempo de a alcançar.`
        : '';
    return {
      tone: 'low',
      text: `Esta nota é um ponto de partida, não um veredicto.${classPart} Vê o que falhou e leva as dúvidas ao tutor.${subiu}`,
      leadsToTutor: true,
    };
  }

  if (hasClass) {
    if (score > meanScore!) {
      return {
        tone: 'above',
        text: `Acima da média da turma: ${formatScore(score)} de ${formatScore(totalMax)}, contra ${mean} em ${samples}.${subiu}`,
        leadsToTutor: false,
      };
    }
    if (score < meanScore!) {
      return {
        tone: 'below',
        text: `Ainda abaixo da média da turma (${mean} em ${samples}), mas no bom caminho. Vê o que falhou e continua.${subiu}`,
        leadsToTutor: true,
      };
    }
    return {
      tone: 'level',
      text: `Ao nível da média da turma: ${mean} em ${samples}.${subiu}`,
      leadsToTutor: false,
    };
  }

  return pct >= 0.8
    ? {
        tone: 'above',
        text: `Boa prova: acertaste a maior parte. Continua a rever para não perderes o ritmo.${subiu}`,
        leadsToTutor: false,
      }
    : {
        tone: 'level',
        text: `Prova sólida: já dominas parte disto. Vê o que falhou para chegares mais longe.${subiu}`,
        leadsToTutor: false,
      };
}

/** Medalhas que o servidor desbloqueou durante esta tentativa. A janela começa no
 *  início da tentativa e fecha uns minutos depois da entrega: a medalha é atribuída
 *  ao terminar, e relógios ligeiramente diferentes não a podem esconder. */
export function badgesUnlockedIn<T extends { unlockedAt: string }>(
  badges: readonly T[],
  startedAt: string | null | undefined,
  finishedAt: string | null | undefined,
): T[] {
  const start = timeOf(startedAt);
  if (start == null) return [];
  const finish = timeOf(finishedAt) ?? Date.now();
  const from = start - 60_000;
  const to = finish + 10 * 60_000;
  return badges.filter((badge) => {
    const at = timeOf(badge.unlockedAt);
    return at != null && at >= from && at <= to;
  });
}

/** `Date.parse` de uma data sem fuso do backend, ou null quando não é uma data. */
function timeOf(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
