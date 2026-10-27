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

type Resposta<T> = { ok: true; corpo: T } | { ok: false; status: number };

async function chamar<T>(cfg: { url: string; token: string }, caminho: string, init: RequestInit = {}): Promise<Resposta<T>> {
  try {
    const res = await fetch(`${cfg.url}${caminho}`, {
      ...init,
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, status: res.status };
    return { ok: true, corpo: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0 }; // o motor em baixo não pode deitar abaixo o ecrã: mostra-se "a corrigir" e volta-se a tentar
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
  const aberta = await chamar<{ correcaoId: string; resultado?: CorrecaoEstado['resultado'] }>(cfg, '/v1/correcoes?aguardar=0', {
    method: 'POST',
    body: JSON.stringify(pedido),
  });
  if (!aberta.ok) {
    // Um 4xx (menos o 429) é o motor a recusar o pedido: repetir não adianta e esperar para sempre é pior do que dizê-lo.
    return aberta.status >= 400 && aberta.status < 500 && aberta.status !== 429 && aberta.status !== 408 ? { kind: 'falhou' } : { kind: 'a-corrigir' };
  }
  const estado = await chamar<CorrecaoEstado>(cfg, `/v1/correcoes/${encodeURIComponent(aberta.corpo.correcaoId)}`);
  return vistaDaCorrecao(estado.ok ? estado.corpo : { correcaoId: aberta.corpo.correcaoId, estado: 'ACTIVE' });
}
