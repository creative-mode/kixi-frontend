import 'server-only';

import { BASE_PATH } from '../base-path';
import type { Me } from '../types';
import { abrirCorrecao } from './correcao-motor';
import { pedidoDeCorrecao, type VistaCorrecao } from './correcao-rules';

// Cliente do SchoolOps para as simulações do aluno: a correcção corre no motor (objectivas pelo gabarito, dissertativas
// por proximidade ao gabarito) e o aluno só vê a nota quando está feita. Só corre no servidor: o token do cliente nunca
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
  const cfg = config();
  if (!cfg) return null;
  const pedido = pedidoDeCorrecao({ ...args, callbackUrl: cfg.callback });
  return abrirCorrecao({ cfg, pedido, simulationId: args.simulationId });
}
