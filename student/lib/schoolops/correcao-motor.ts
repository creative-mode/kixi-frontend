import { correcaoIdDoConflito, vistaDaCorrecao, vistaDeUmaRecusa, type CorrecaoEstado, type VistaCorrecao } from './correcao-rules.ts';

// A conversa com o motor, sem `server-only` nem `process.env`, para se testar com um `fetch` falso: abrir a correcção e
// ler o estado, e dizer sempre ao ecrã o que mostrar. Nenhum caminho devolve "espera" quando o motor já disse que não
// vai corrigir (#787), e cada falha fica registada no servidor com o estado, a correcção e a simulação (sem dados pessoais).

export type ConfigDoMotor = { url: string; token: string };
export type Pedido = Record<string, unknown>;
export type Registo = (mensagem: string, contexto: Record<string, unknown>) => void;

type Resposta<T> = { ok: true; corpo: T } | { ok: false; status: number; texto: string };

const TIMEOUT_MS = 8_000;

async function chamar<T>(cfg: ConfigDoMotor, caminho: string, init: RequestInit, fetcher: typeof fetch): Promise<Resposta<T>> {
  try {
    const res = await fetcher(`${cfg.url}${caminho}`, {
      ...init,
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, status: res.status, texto: (await res.text().catch(() => '')).slice(0, 600) };
    return { ok: true, corpo: (await res.json()) as T };
  } catch {
    return { ok: false, status: 0, texto: '' }; // o motor em baixo não pode deitar abaixo o ecrã: mostra-se "a corrigir" e volta-se a ler
  }
}

async function lerEstado(cfg: ConfigDoMotor, correcaoId: string, fetcher: typeof fetch): Promise<Resposta<CorrecaoEstado>> {
  return chamar<CorrecaoEstado>(cfg, `/v1/correcoes/${encodeURIComponent(correcaoId)}`, {}, fetcher);
}

/** O que a abertura deixa ao ecrã: o que mostrar já e o id para a espera ler só o estado (#794). */
export type Abertura = { vista: VistaCorrecao; correcaoId: string | null };

/** Abre a correcção (idempotente no motor, por simulação) e devolve a vista e o id. */
export async function abrirCorrecaoComId(args: {
  cfg: ConfigDoMotor;
  pedido: Pedido;
  simulationId: number;
  fetcher?: typeof fetch;
  registar?: Registo;
}): Promise<Abertura> {
  const { cfg, pedido, simulationId } = args;
  const fetcher = args.fetcher ?? fetch;
  const registar = args.registar ?? ((m, c) => console.error(m, c));

  const aberta = await chamar<{ correcaoId: string }>(cfg, '/v1/correcoes?aguardar=0', { method: 'POST', body: JSON.stringify(pedido) }, fetcher);

  if (!aberta.ok) {
    if (aberta.status === 409) {
      // Já existe com outro conteúdo: não é uma recusa, é "já está aberta". Lê-se o estado dela.
      const correcaoId = correcaoIdDoConflito(aberta.texto);
      if (correcaoId) {
        const estado = await lerEstado(cfg, correcaoId, fetcher);
        if (estado.ok) return { vista: vistaLida(estado.corpo, simulationId, registar), correcaoId };
        registar('[SchoolOps] 409 e o estado não se leu', { status: estado.status, correcaoId, simulationId });
        return { vista: { kind: 'a-corrigir' }, correcaoId };
      }
      registar('[SchoolOps] 409 sem identificador da correcção', { status: 409, simulationId });
      return { vista: { kind: 'falhou', motivo: 'conflito' }, correcaoId: null };
    }
    const vista = vistaDeUmaRecusa(aberta.status);
    if (vista.kind === 'falhou') registar('[SchoolOps] pedido de correcção recusado', { status: aberta.status, simulationId });
    return { vista, correcaoId: null };
  }

  const estado = await lerEstado(cfg, aberta.corpo.correcaoId, fetcher);
  return {
    vista: vistaLida(estado.ok ? estado.corpo : { correcaoId: aberta.corpo.correcaoId, estado: 'ACTIVE' }, simulationId, registar),
    correcaoId: aberta.corpo.correcaoId,
  };
}

/** Como `abrirCorrecaoComId`, só a vista: para quem não precisa de continuar a ler o estado. */
export async function abrirCorrecao(args: {
  cfg: ConfigDoMotor;
  pedido: Pedido;
  simulationId: number;
  fetcher?: typeof fetch;
  registar?: Registo;
}): Promise<VistaCorrecao> {
  return (await abrirCorrecaoComId(args)).vista;
}

/** Inicia a correcção (POST /v1/correcoes?aguardar=0) e devolve o correcaoId, sem ler o estado.
 *  Usado na entrega (#794): o aluno segue para o ecrã de espera e a espera lê o estado pela rota leve. */
export async function iniciarAbertura(args: {
  cfg: ConfigDoMotor;
  pedido: Pedido;
  simulationId: number;
  fetcher?: typeof fetch;
  registar?: Registo;
}): Promise<{ correcaoId: string } | null> {
  const { cfg, pedido, simulationId } = args;
  const fetcher = args.fetcher ?? fetch;
  const registar = args.registar ?? ((m, c) => console.error(m, c));

  const aberta = await chamar<{ correcaoId: string }>(cfg, '/v1/correcoes?aguardar=0', { method: 'POST', body: JSON.stringify(pedido) }, fetcher);
  if (!aberta.ok) {
    if (aberta.status === 409) {
      const correcaoId = correcaoIdDoConflito(aberta.texto);
      if (correcaoId) return { correcaoId };
      registar('[SchoolOps] 409 sem identificador da correcção (na entrega)', { status: 409, simulationId });
    } else if (aberta.status >= 400 && aberta.status < 500 && aberta.status !== 408 && aberta.status !== 429) {
      registar('[SchoolOps] pedido de correcção recusado (na entrega)', { status: aberta.status, simulationId });
    }
    return null;
  }
  return { correcaoId: aberta.corpo.correcaoId };
}

/** Lê o estado de uma correcção existente pelo ID (para polling leve na espera). A falha traz o estado HTTP:
 *  um 404 do motor é "não existe"; um 0/5xx é "não sei agora" e quem espera volta a ler em vez de desistir (#794). */
export type EstadoLido = { ok: true; vista: VistaCorrecao } | { ok: false; status: number };

export async function consultarEstado(cfg: ConfigDoMotor, correcaoId: string, fetcher?: typeof fetch): Promise<EstadoLido> {
  const f = fetcher ?? fetch;
  const estado = await lerEstado(cfg, correcaoId, f);
  if (!estado.ok) return { ok: false, status: estado.status };
  return { ok: true, vista: vistaDaCorrecao(estado.corpo) };
}

function vistaLida(estado: CorrecaoEstado, simulationId: number, registar: Registo): VistaCorrecao {
  const vista = vistaDaCorrecao(estado);
  if (vista.kind === 'falhou') registar('[SchoolOps] correcção falhada no motor', { estado: estado.estado, correcaoId: estado.correcaoId, simulationId });
  return vista;
}
