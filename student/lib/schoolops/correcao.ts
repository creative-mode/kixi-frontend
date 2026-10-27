import 'server-only';

import { BASE_PATH } from '../base-path';
import type { Me } from '../types';
import { pedidoDeCorrecao, vistaDaCorrecao, type CorrecaoEstado, type VistaCorrecao } from './correcao-rules';

// Cliente do SchoolOps para as simulações do aluno: a correcção corre no motor (objectivas pelo gabarito, dissertativas
// por proximidade ao gabarito) e o aluno só vê a nota quando está feita. Só corre no servidor: o token do cliente nunca
// chega ao browser. Sem SCHOOLOPS_URL e SCHOOLOPS_CLIENTE_TOKEN a funcionalidade está desligada e o resultado fica como antes.

const TIMEOUT_MS = 8_000;

function config(): { url: string; token: string; callback: string } | null {
  const url = process.env.SCHOOLOPS_URL?.replace(/\/$/, '');
  const token = process.env.SCHOOLOPS_CLIENTE_TOKEN;
  if (!url || !token) return null;
  const origem = process.env.APP_ORIGIN?.replace(/\/$/, '') ?? '';
  return { url, token, callback: process.env.SCHOOLOPS_CALLBACK_URL ?? `${origem}${BASE_PATH}/api/schoolops/eventos` };
}

export const correcaoLigada = (): boolean => config() !== null;

async function chamar<T>(cfg: { url: string; token: string }, caminho: string, init: RequestInit = {}): Promise<T | null> {
  try {
    const res = await fetch(`${cfg.url}${caminho}`, {
      ...init,
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null; // o motor em baixo não pode deitar abaixo o ecrã: mostra-se "a corrigir" e volta-se a tentar
  }
}

/** Abre a correcção (idempotente no motor, por simulação) e devolve o que se pode mostrar já. */
export async function correcaoDaSimulacao(args: {
  me: Me;
  simulationId: number;
  statementId: number;
  statementTitle: string | null;
}): Promise<VistaCorrecao | null> {
  const cfg = config();
  if (!cfg) return null;
  const pedido = pedidoDeCorrecao({ ...args, callbackUrl: cfg.callback });
  if (!pedido) return { kind: 'a-corrigir' };
  const aberta = await chamar<{ correcaoId: string; resultado?: CorrecaoEstado['resultado'] }>(cfg, '/v1/correcoes?aguardar=0', {
    method: 'POST',
    body: JSON.stringify(pedido),
  });
  if (!aberta) return { kind: 'a-corrigir' };
  const estado = await chamar<CorrecaoEstado>(cfg, `/v1/correcoes/${encodeURIComponent(aberta.correcaoId)}`);
  return vistaDaCorrecao(estado ?? { correcaoId: aberta.correcaoId, estado: 'ACTIVE' });
}
