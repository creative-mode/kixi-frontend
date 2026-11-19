import type { ResultQuestion, SimulationResult } from '../result-rules';

// Regras puras da correcção de simulações no SchoolOps (sem rede, para se testarem à parte).

/** A resposta de `GET /v1/correcoes/{id}` e do POST com `aguardar`. */
export type CorrecaoEstado = {
  correcaoId: string;
  estado: string;
  resultado?: ResultadoCorrecao | null;
  /** As dissertativas já corrigidas (schoolops#59). Opcional: null até o motor saber quantas são, e ausente num motor antigo. */
  progresso?: ProgressoDoMotor | null;
  /** Segundos que faltam, estimados pelo motor (schoolops#59). null/ausente sem amostras: o cliente estima por si. */
  previsaoSegundos?: number | null;
};

export type ProgressoDoMotor = { corrigidas: number; total: number };

export type ResultadoCorrecao = {
  estado?: string;
  /** A nota do motor, na escala 0 a 20 (uma casa decimal). */
  nota?: number | null;
  pontos?: number | null;
  /** A cotação da prova em pontos: pode não somar 20, por isso não serve de denominador da nota. */
  maximo?: number | null;
  /** A escala da nota (20), separada de `maximo` em pontos (#60). */
  escala?: number | null;
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

/** O denominador do anel da nota: a escala do motor (20), nunca o `maximo`, que é a cotação em pontos da prova (#60). */
export function escalaDaNota(r: ResultadoCorrecao): number {
  return r.escala != null && r.escala > 0 ? r.escala : 20;
}

/** O que o ecrã mostra: nunca uma nota antes de a correcção estar feita. */
export type VistaCorrecao =
  | { kind: 'corrigida'; resultado: ResultadoCorrecao }
  /** `progresso` e `previsaoSegundos` só vêm quando o motor os disse; ausentes, o ecrã estima pelo número de abertas da prova. */
  | { kind: 'a-corrigir'; progresso?: ProgressoDoMotor; previsaoSegundos?: number }
  /** `semGabarito`: há questões abertas que o motor não pôde corrigir por não terem gabarito no Kixi. */
  | { kind: 'incompleta'; semGabarito: boolean }
  /** `motivo`: o motor recusou o pedido, a correcção ficou com um incidente (ou foi cancelada), ou o motor diz que já existe
   *  com outro conteúdo e não se conseguiu ler o estado. Em todos o aluno tem uma saída (#787). */
  | { kind: 'falhou'; motivo: MotivoDaFalha };

export type MotivoDaFalha = 'recusada' | 'incidente' | 'conflito';

/** Estados do motor em que não vale a pena esperar mais. */
const FALHADOS = new Set(['CANCELADA', 'FALHADA', 'INCIDENTE']); // FALHADA: o motor tem um incidente e não avança sozinho

export function vistaDaCorrecao(c: CorrecaoEstado): VistaCorrecao {
  if (c.estado === 'CONCLUIDA' && c.resultado) {
    // R10: sem respostas legíveis a correcção termina sem nota, e dizê-lo é melhor do que mostrar zero.
    if (c.resultado.estado === 'INCOMPLETE' || c.resultado.nota == null) {
      const semGabarito = (c.resultado.questoes ?? []).some((q) => q.tipo === 'DISSERTATIVA' && q.corrigida === false);
      return { kind: 'incompleta', semGabarito };
    }
    return { kind: 'corrigida', resultado: c.resultado };
  }
  if (FALHADOS.has(c.estado)) return { kind: 'falhou', motivo: 'incidente' };
  const progresso = progressoValido(c.progresso);
  const previsaoSegundos = previsaoValida(c.previsaoSegundos);
  return {
    kind: 'a-corrigir',
    ...(progresso ? { progresso } : {}),
    ...(previsaoSegundos != null ? { previsaoSegundos } : {}),
  };
}

/** O progresso do motor, só se for coerente: inteiros, sem negativos e com `corrigidas` até ao `total`. O resto é «ainda não se sabe». */
export function progressoValido(p: ProgressoDoMotor | null | undefined): ProgressoDoMotor | null {
  if (!p || !Number.isInteger(p.corrigidas) || !Number.isInteger(p.total)) return null;
  return p.corrigidas >= 0 && p.total > 0 && p.corrigidas <= p.total ? { corrigidas: p.corrigidas, total: p.total } : null;
}

/** A previsão do motor, só se for um número finito e não negativo; null, ausente ou lixo é «ainda não se sabe», nunca zero. */
export function previsaoValida(segundos: number | null | undefined): number | null {
  return typeof segundos === 'number' && Number.isFinite(segundos) && segundos >= 0 ? Math.round(segundos) : null;
}

/** O que o motor respondeu ao abrir a correcção (sem ser um 2xx). O 409 trata-se à parte (`correcaoIdDoConflito`). */
export function vistaDeUmaRecusa(status: number): VistaCorrecao {
  // Um 4xx (menos 408 e 429) é o motor a recusar o pedido: repetir tal e qual não adianta e esperar para sempre é pior do que dizê-lo.
  // O resto (rede, 5xx, 408, 429) é um atraso: mostra-se "a corrigir" e volta-se a ler.
  const recusa = status >= 400 && status < 500 && status !== 408 && status !== 429;
  return recusa ? { kind: 'falhou', motivo: 'recusada' } : { kind: 'a-corrigir' };
}

/**
 * O motor responde 409 quando a mesma correcção chega com outro conteúdo (o aluno mudou de nome, por exemplo). A
 * correcção já existe: o `detail` do problema traz o seu identificador (`CR-` e 16 hexadecimais) e é com ele que se lê o estado.
 */
export function correcaoIdDoConflito(corpo: string | null | undefined): string | null {
  return /\bCR-[0-9A-F]{16}\b/.exec(corpo ?? '')?.[0] ?? null;
}

/**
 * A nota das questões fechadas, só para dizer ao aluno onde está enquanto as abertas não se corrigem. Vem do resultado do
 * backend (as fechadas já foram pontuadas na entrega) e nunca é a nota final: sem fechadas pontuadas não há nada a mostrar.
 */
export function notaProvisoria(resultado: SimulationResult): { pontos: number; maximo: number } | null {
  let pontos = 0;
  let maximo = 0;
  let fechadas = 0;
  for (const q of resultado.questions ?? []) {
    if ((q.reviewStatus ?? '').toUpperCase() !== 'AUTO_GRADED' || q.scoreObtained == null || q.maxScore == null) continue;
    pontos += q.scoreObtained;
    maximo += q.maxScore;
    fechadas += 1;
  }
  return fechadas > 0 && maximo > 0 ? { pontos: Math.round(pontos * 100) / 100, maximo } : null;
}

type Pessoa = { accountId: number; first_name?: string | null; last_name?: string | null; username: string; school?: { id: number; name: string; code: string } | null };

/**
 * O pedido `POST /v1/correcoes` de uma simulação. Idempotente no motor: (cliente, org, prova, simulação). O motor compara o
 * corpo inteiro e responde 409 se mudou, por isso só vai o que o contrato exige: o título da prova (opcional, e que o
 * professor pode editar) já não segue (#787).
 */
export function pedidoDeCorrecao(args: {
  me: Pessoa;
  simulationId: number;
  statementId: number;
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
    prova: { sourcedId: String(args.statementId) },
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
