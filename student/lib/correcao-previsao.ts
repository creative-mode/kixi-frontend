import type { ProgressoDoMotor } from './schoolops/correcao-rules.ts';

// O que o ecrã de espera diz sobre o que já está feito e quanto falta (#792). O motor manda o progresso e a previsão
// (schoolops#59) quando os tem; sem eles estima-se pelo número de respostas abertas da prova, e diz-se sempre «cerca de».
// Tudo puro, para se testar sem ecrã nem relógio.

/** Quantas respostas abertas o motor corrige ao mesmo tempo para um aluno (`concorrenciaPorAluno` do motor). */
export const ABERTAS_EM_SIMULTANEO = 5;
/** Duração que se assume para cada ronda de pedidos à IA quando o motor não deu previsão. */
export const SEGUNDOS_POR_RONDA = 20;

/** As respostas abertas da prova: as questões sem opções de escolha, fora o enunciado de um grupo. */
export function abertasDaProva(
  questoes: ReadonlyArray<{ questionType?: string | null; options?: ReadonlyArray<unknown> | null }> | null | undefined,
): number {
  return (questoes ?? []).filter((q) => (q.questionType ?? '').toLowerCase() !== 'group' && (q.options?.length ?? 0) === 0).length;
}

/** Estimativa sem dados do motor: as abertas em rondas do tamanho da concorrência, vezes a duração assumida de uma ronda. */
export function previsaoPorAbertas(abertas: number): number | null {
  if (!Number.isInteger(abertas) || abertas <= 0) return null;
  return Math.ceil(abertas / ABERTAS_EM_SIMULTANEO) * SEGUNDOS_POR_RONDA;
}

export type SituacaoDaEspera = {
  corrigidas: number;
  total: number;
  /** De 0 a 100, para a barra. */
  percentagem: number;
  /** Segundos que faltam; null quando não há como saber. */
  previsaoSegundos: number | null;
  /** `motor`: veio do motor; `estimada`: calculada pelo número de abertas (e pelo tempo que já passou). */
  origem: 'motor' | 'estimada' | null;
};

/**
 * Junta o que o motor disse com o que a prova já diz. Sem abertas na prova nem total do motor não há nada a mostrar (null).
 * Sem nenhum progresso do motor, a estimativa desconta o tempo que já passou, para não prometer o mesmo minuto durante dez
 * minutos, e nunca fica negativa. Com progresso, estima-se só o que falta.
 */
export function situacaoDaEspera(args: {
  progresso?: ProgressoDoMotor | null;
  previsaoSegundos?: number | null;
  abertas: number;
  decorridoMs: number;
}): SituacaoDaEspera | null {
  const total = args.progresso?.total ?? args.abertas;
  if (!Number.isInteger(total) || total <= 0) return null;
  const corrigidas = Math.min(total, Math.max(0, args.progresso?.corrigidas ?? 0));
  const percentagem = Math.round((corrigidas / total) * 100);
  if (args.previsaoSegundos != null) return { corrigidas, total, percentagem, previsaoSegundos: args.previsaoSegundos, origem: 'motor' };
  const faltam = previsaoPorAbertas(total - corrigidas);
  if (faltam == null) return { corrigidas, total, percentagem, previsaoSegundos: null, origem: null };
  const passado = args.progresso ? 0 : Math.round(Math.max(0, args.decorridoMs) / 1000);
  return { corrigidas, total, percentagem, previsaoSegundos: Math.max(0, faltam - passado), origem: 'estimada' };
}

/** «2 de 5» e o que é: a frase que o ecrã lê em voz alta. */
export function progressoEmTexto(corrigidas: number, total: number): string {
  return `${corrigidas} de ${total} ${total === 1 ? 'resposta aberta corrigida' : 'respostas abertas corrigidas'}`;
}

/**
 * Quanto falta, dito com a precisão que a estimativa merece: segundos arredondados a 5 até ao minuto, depois minutos
 * (para cima, para não prometer demais). Abaixo de 10 segundos, «dentro de instantes». Nunca uma frase de erro.
 */
export function previsaoEmTexto(segundos: number | null): string | null {
  if (segundos == null || !Number.isFinite(segundos) || segundos < 0) return null;
  if (segundos < 10) return 'Fica pronta dentro de instantes.';
  if (segundos < 55) return `Fica pronta em cerca de ${Math.max(10, Math.round(segundos / 5) * 5)} segundos.`;
  const minutos = Math.ceil(segundos / 60);
  return `Fica pronta em cerca de ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}.`;
}
