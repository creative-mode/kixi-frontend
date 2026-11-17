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

/** Abre a correcção (idempotente no motor, por simulação) e devolve o que se pode mostrar já. */
export async function abrirCorrecao(args: {
  cfg: ConfigDoMotor;
  pedido: Pedido;
  simulationId: number;
  fetcher?: typeof fetch;
  registar?: Registo;
}): Promise<VistaCorrecao> {
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
        if (estado.ok) return vistaLida(estado.corpo, simulationId, registar);
        registar('[SchoolOps] 409 e o estado não se leu', { status: estado.status, correcaoId, simulationId });
        return { kind: 'a-corrigir' };
      }
      registar('[SchoolOps] 409 sem identificador da correcção', { status: 409, simulationId });
      return { kind: 'falhou', motivo: 'conflito' };
    }
    const vista = vistaDeUmaRecusa(aberta.status);
    if (vista.kind === 'falhou') registar('[SchoolOps] pedido de correcção recusado', { status: aberta.status, simulationId });
    return vista;
  }

  const estado = await lerEstado(cfg, aberta.corpo.correcaoId, fetcher);
  return vistaLida(estado.ok ? estado.corpo : { correcaoId: aberta.corpo.correcaoId, estado: 'ACTIVE' }, simulationId, registar);
}

function vistaLida(estado: CorrecaoEstado, simulationId: number, registar: Registo): VistaCorrecao {
  const vista = vistaDaCorrecao(estado);
  if (vista.kind === 'falhou') registar('[SchoolOps] correcção falhada no motor', { estado: estado.estado, correcaoId: estado.correcaoId, simulationId });
  return vista;
}
