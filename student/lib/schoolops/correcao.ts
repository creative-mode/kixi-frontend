import 'server-only';

import { BASE_PATH } from '../base-path';
import type { Me } from '../types';
import { abrirCorrecaoComId, iniciarAbertura, consultarEstado, type Abertura, type EstadoLido } from './correcao-motor';
import { pedidoDeCorrecao, type VistaCorrecao } from './correcao-rules';

// Cliente do SchoolOps para as simulações do aluno: a correcção corre no motor (objectivas pelo gabarito, dissertativas
// por proximidade ao gabarito) e o aluno só vê a nota quando está feita. Só corre no servidor: the token do cliente nunca
// chega ao browser. Sem SCHOOLOPS_URL e SCHOOLOPS_CLIENTE_TOKEN a funcionalidade está desligada e o resultado fica como antes.

function config(): { url: string; token: string; callback: string } | null {
  const url = process.env.SCHOOLOPS_URL?.replace(/\/$/, '');
  const token = process.env.SCHOOLOPS_CLIENTE_TOKEN;
  if (!url || !token) return null;
  const origem = process.env.APP_ORIGIN?.replace(/\/$/, '') ?? '';
  return { url, token, callback: process.env.SCHOOLOPS_CALLBACK_URL ?? `${origem}${BASE_PATH}/api/schoolops/eventos` };
}

export const correcaoLigada = (): boolean => config() !== null;

/** Abre a correcção (idempotente no motor, por simulação) e devolve o que se pode mostrar já. */
export async function correcaoDaSimulacao(args: {
  me: Me;
  simulationId: number;
  statementId: number;
}): Promise<VistaCorrecao | null> {
  const abertura = await correcaoDaSimulacaoComId(args);
  return abertura?.vista ?? null;
}

/** Como `correcaoDaSimulacao`, mas devolve também o `correcaoId`: o ecrã de resultado usa-o para a
 *  espera ler só o estado pela rota leve (#794). O resto do código continua a usar a vista. */
export async function correcaoDaSimulacaoComId(args: {
  me: Me;
  simulationId: number;
  statementId: number;
}): Promise<Abertura | null> {
  const cfg = config();
  if (!cfg) return null;
  const pedido = pedidoDeCorrecao({ ...args, callbackUrl: cfg.callback });
  return abrirCorrecaoComId({ cfg, pedido, simulationId: args.simulationId });
}

/** Inicia a correcção na entrega (POST /v1/correcoes?aguardar=0) sem esperar o resultado.
 *  Devolve o correcaoId para a espera ler o estado pela rota leve (#794). */
export async function iniciarCorrecao(args: {
  me: Me;
  simulationId: number;
  statementId: number;
}): Promise<{ correcaoId: string } | null> {
  const cfg = config();
  if (!cfg) return null;
  const pedido = pedidoDeCorrecao({ ...args, callbackUrl: cfg.callback });
  return iniciarAbertura({ cfg, pedido, simulationId: args.simulationId });
}

/** Consulta o estado de uma correcção pelo ID (para polling leve na espera).
 *  Devolve o estado do motor quando falha (0 = fora, 404 = não existe) para a espera distinguir "volta a ler" de "desiste". */
export async function consultarEstadoCorrecao(correcaoId: string): Promise<EstadoLido> {
  const cfg = config();
  if (!cfg) return { ok: false, status: 0 };
  return consultarEstado(cfg, correcaoId);
}