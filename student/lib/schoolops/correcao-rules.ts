import type { ResultQuestion, SimulationResult } from '../result-rules';

// Regras puras da correcção de simulações no SchoolOps (sem rede, para se testarem à parte).

/** A resposta de `GET /v1/correcoes/{id}` e do POST com `aguardar`. */
export type CorrecaoEstado = { correcaoId: string; estado: string; resultado?: ResultadoCorrecao | null };

export type ResultadoCorrecao = {
  estado?: string;
  nota?: number | null;
  pontos?: number | null;
  maximo?: number | null;
  objectivas?: { pontos: number; maximo: number } | null;
  questoes?: Array<{
    questaoId: string;
    numero?: number;
    tipo?: string;
    cotacao?: number;
    pontos?: number | null;
    justificativa?: string | null;
    corrigida?: boolean;
  }>;
};

/** O que o ecrã mostra: nunca uma nota antes de a correcção estar feita. */
export type VistaCorrecao =
  | { kind: 'corrigida'; resultado: ResultadoCorrecao }
  | { kind: 'a-corrigir' }
  | { kind: 'incompleta' }
  | { kind: 'falhou' };

/** Estados do motor em que não vale a pena esperar mais. */
const FALHADOS = new Set(['CANCELADA', 'FALHADA', 'INCIDENTE']);

export function vistaDaCorrecao(c: CorrecaoEstado): VistaCorrecao {
  if (c.estado === 'CONCLUIDA' && c.resultado) {
    // R10: sem respostas legíveis a correcção termina sem nota, e dizê-lo é melhor do que mostrar zero.
    return c.resultado.estado === 'INCOMPLETE' || c.resultado.nota == null
      ? { kind: 'incompleta' }
      : { kind: 'corrigida', resultado: c.resultado };
  }
  return FALHADOS.has(c.estado) ? { kind: 'falhou' } : { kind: 'a-corrigir' };
}

type Pessoa = { accountId: number; first_name?: string | null; last_name?: string | null; username: string; school?: { id: number; name: string; code: string } | null };

/** O pedido `POST /v1/correcoes` de uma simulação. Idempotente no motor: (cliente, org, prova, simulação). */
export function pedidoDeCorrecao(args: {
  me: Pessoa;
  simulationId: number;
  statementId: number;
  statementTitle: string | null;
  callbackUrl: string;
}) {
  const { me } = args;
  // O contrato exige a instituição. Um aluno sem escola (a simulação é aberta a quem se regista) usa a organização geral do Kixi.
  const org = me.school
    ? { sourcedId: String(me.school.id), nome: me.school.name, sigla: me.school.code }
    : { sourcedId: 'kixi', nome: 'Kixi', sigla: 'KIXI' };
  const nome = [me.first_name, me.last_name].filter(Boolean).join(' ').trim() || me.username;
  return {
    contratoVersao: '1',
    correcaoRef: `kixi-sim-${args.simulationId}`,
    org,
    prova: { sourcedId: String(args.statementId), titulo: args.statementTitle ?? undefined },
    simulacao: { sourcedId: String(args.simulationId) },
    aluno: { sourcedId: String(me.accountId), nome },
    callback: { url: args.callbackUrl },
  };
}

/** Uma prova de sala não é simulação: a nota dela vem da pauta e quem valida é o professor. */
export function eSimulacaoLivre(simulationId: number, salas: ReadonlyArray<{ simulationId: number | null }>): boolean {
  return !salas.some((s) => s.simulationId === simulationId);
}

/** Verifica a assinatura Standard Webhooks (HMAC-SHA256 de `id.timestamp.corpo`, várias versões separadas por espaço). */
export function assinaturaValida(
  hmac: (chave: Buffer, texto: string) => Buffer,
  igual: (a: Buffer, b: Buffer) => boolean,
  segredo: string,
  cab: { id: string | null; timestamp: string | null; assinatura: string | null },
  corpo: string,
  agoraSegundos: number,
): boolean {
  if (!cab.id || !cab.timestamp || !cab.assinatura) return false;
  if (Math.abs(agoraSegundos - Number(cab.timestamp)) > 300) return false;
  const esperada = hmac(Buffer.from(segredo.replace(/^whsec_/, ''), 'base64'), `${cab.id}.${cab.timestamp}.${corpo}`);
  return cab.assinatura.split(' ').some((par) => {
    const [versao, valor] = par.split(',');
    if (versao !== 'v1' || !valor) return false;
    const recebida = Buffer.from(valor, 'base64');
    return recebida.length === esperada.length && igual(recebida, esperada);
  });
}

/** Junta ao resultado do backend a nota do SchoolOps: a nota final, as dissertativas com pontos e justificação, sem "por corrigir". */
export function comCorrecao(base: SimulationResult, r: ResultadoCorrecao): SimulationResult {
  const porQuestao = new Map((r.questoes ?? []).map((q) => [String(q.questaoId), q]));
  const questions: ResultQuestion[] | undefined = base.questions?.map((q) => {
    const c = porQuestao.get(String(q.questionId));
    if (!c || c.tipo !== 'DISSERTATIVA' || c.pontos == null) return q;
    const cotacao = c.cotacao ?? q.maxScore ?? 0;
    return {
      ...q,
      scoreObtained: c.pontos,
      maxScore: cotacao,
      reviewStatus: 'REVIEWED',
      // Certa a partir de metade da cotação; os pontos exactos e a justificação ficam por baixo.
      isCorrect: cotacao > 0 ? c.pontos >= cotacao / 2 : false,
      feedback: c.justificativa ?? null,
    };
  });
  return { ...base, finalScore: r.nota ?? null, pendingReviewCount: 0, questions };
}

/** Com a correcção do SchoolOps ligada, a nota de uma simulação só se mostra no resultado, depois de corrigida. Nas outras páginas
 *  (histórico, catálogo, detalhe, desempenho) a nota do backend sai das simulações livres. As provas de sala ficam como estão;
 *  se a lista de salas não se leu, não se arrisca e sai a de todas. */
export function semNotaDasSimulacoes<T extends { id?: number | string; finalScore?: number | null }>(
  simulacoes: readonly T[],
  salas: ReadonlyArray<{ simulationId: number | null }> | null,
): T[] {
  const deSala = new Set((salas ?? []).map((s) => s.simulationId).filter((id): id is number => id != null));
  return simulacoes.map((s) => (salas != null && s.id != null && deSala.has(Number(s.id)) ? s : { ...s, finalScore: null }));
}
