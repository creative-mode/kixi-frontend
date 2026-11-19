import assert from 'node:assert/strict';
import { test } from 'node:test';
import { abrirCorrecao, consultarEstado, type Registo } from './correcao-motor.ts';

// O motor falso responde, por caminho, o que o teste combinar. Sem rede e sem relógio.
type Rota = { status: number; corpo?: unknown };
function motor(rotas: { post: Rota; get?: Record<string, Rota> }) {
  const chamadas: string[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    const caminho = String(url).replace('http://motor', '');
    chamadas.push(`${init?.method ?? 'GET'} ${caminho}`);
    let r: Rota;
    if (init?.method === 'POST') {
      r = rotas.post;
    } else {
      r = rotas.get?.[caminho] ?? { status: 404, corpo: {} };
    }
    const texto = typeof r.corpo === 'string' ? r.corpo : JSON.stringify(r.corpo ?? {});
    return new Response(texto, { status: r.status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return { fetcher, chamadas };
}

const cfg = { url: 'http://motor', token: 't' };
const pedido = { correcaoRef: 'kixi-sim-9' };
const corrigida = { correcaoId: 'CR-0A5ECDCA54339EB3', estado: 'CONCLUIDA', resultado: { estado: 'FULLY_GRADED', nota: 14.2, escala: 20 } };

function registos() {
  const lista: Array<{ mensagem: string; contexto: Record<string, unknown> }> = [];
  const registar: Registo = (mensagem, contexto) => lista.push({ mensagem, contexto });
  return { lista, registar };
}

test('409: a correcção já existe com outro conteúdo, lê-se o estado e mostra-se a nota', async () => {
  const { fetcher, chamadas } = motor({
    post: { status: 409, corpo: { status: 409, detail: 'A correcção CR-0A5ECDCA54339EB3 já existe com outro conteúdo.' } },
    get: { '/v1/correcoes/CR-0A5ECDCA54339EB3': { status: 200, corpo: corrigida } },
  });
  const { lista, registar } = registos();
  const vista = await abrirCorrecao({ cfg, pedido, simulationId: 9, fetcher, registar });
  assert.equal(vista.kind, 'corrigida');
  assert.deepEqual(chamadas, ['POST /v1/correcoes?aguardar=0', 'GET /v1/correcoes/CR-0A5ECDCA54339EB3']);
  assert.equal(lista.length, 0); // não é uma falha
});

test('409 de uma correcção que continua a correr: espera, com a leitura certa', async () => {
  const { fetcher } = motor({
    post: { status: 409, corpo: { detail: 'A correcção CR-0A5ECDCA54339EB3 já existe com outro conteúdo.' } },
    get: { '/v1/correcoes/CR-0A5ECDCA54339EB3': { status: 200, corpo: { correcaoId: 'CR-0A5ECDCA54339EB3', estado: 'ABERTA' } } },
  });
  assert.deepEqual(await abrirCorrecao({ cfg, pedido, simulationId: 9, fetcher }), { kind: 'a-corrigir' });
});

test('409 de uma correcção que já falhou leva ao ecrã com saída e fica registado', async () => {
  const { fetcher } = motor({
    post: { status: 409, corpo: { detail: 'A correcção CR-0A5ECDCA54339EB3 já existe com outro conteúdo.' } },
    get: { '/v1/correcoes/CR-0A5ECDCA54339EB3': { status: 200, corpo: { correcaoId: 'CR-0A5ECDCA54339EB3', estado: 'FALHADA' } } },
  });
  const { lista, registar } = registos();
  assert.deepEqual(await abrirCorrecao({ cfg, pedido, simulationId: 9, fetcher, registar }), { kind: 'falhou', motivo: 'incidente' });
  assert.deepEqual(lista[0].contexto, { estado: 'FALHADA', correcaoId: 'CR-0A5ECDCA54339EB3', simulationId: 9 });
});

test('409 sem identificador legível não prende o aluno: ecrã com saída e registo', async () => {
  const { fetcher } = motor({ post: { status: 409, corpo: { detail: 'conflito' } } });
  const { lista, registar } = registos();
  assert.deepEqual(await abrirCorrecao({ cfg, pedido, simulationId: 9, fetcher, registar }), { kind: 'falhou', motivo: 'conflito' });
  assert.equal(lista.length, 1);
  assert.equal(lista[0].contexto.simulationId, 9);
});

test('422: o motor recusa o pedido, o aluno tem saída e a falha fica registada com o estado e a simulação', async () => {
  const { fetcher, chamadas } = motor({ post: { status: 422, corpo: { detail: 'inválido' } } });
  const { lista, registar } = registos();
  assert.deepEqual(await abrirCorrecao({ cfg, pedido, simulationId: 9, fetcher, registar }), { kind: 'falhou', motivo: 'recusada' });
  assert.deepEqual(chamadas, ['POST /v1/correcoes?aguardar=0']);
  assert.deepEqual(lista[0].contexto, { status: 422, simulationId: 9 });
});

test('incidente: a correcção aberta fica FALHADA e leva ao ecrã com saída', async () => {
  const { fetcher } = motor({
    post: { status: 202, corpo: { correcaoId: 'CR-1' } },
    get: { '/v1/correcoes/CR-1': { status: 200, corpo: { correcaoId: 'CR-1', estado: 'FALHADA' } } },
  });
  const { lista, registar } = registos();
  assert.deepEqual(await abrirCorrecao({ cfg, pedido, simulationId: 9, fetcher, registar }), { kind: 'falhou', motivo: 'incidente' });
  assert.deepEqual(lista[0].contexto, { estado: 'FALHADA', correcaoId: 'CR-1', simulationId: 9 });
});

test('o motor em baixo, lento ou sobrecarregado é atraso: espera-se e não se regista como falha', async () => {
  for (const post of [{ status: 503 }, { status: 504 }, { status: 429 }, { status: 408 }]) {
    const { fetcher } = motor({ post });
    const { lista, registar } = registos();
    assert.deepEqual(await abrirCorrecao({ cfg, pedido, simulationId: 9, fetcher, registar }), { kind: 'a-corrigir' }, String(post.status));
    assert.equal(lista.length, 0);
  }
  const semRede = (async () => { throw new Error('rede'); }) as unknown as typeof fetch;
  assert.deepEqual(await abrirCorrecao({ cfg, pedido, simulationId: 9, fetcher: semRede }), { kind: 'a-corrigir' });
});

test('aberta e corrigida: devolve a nota', async () => {
  const { fetcher } = motor({ post: { status: 202, corpo: { correcaoId: 'CR-0A5ECDCA54339EB3' } }, get: { '/v1/correcoes/CR-0A5ECDCA54339EB3': { status: 200, corpo: corrigida } } });
  assert.equal((await abrirCorrecao({ cfg, pedido, simulationId: 9, fetcher })).kind, 'corrigida');
});

test('o progresso e a previsão do motor chegam à vista de quem espera (schoolops#59)', async () => {
  const { fetcher } = motor({
    post: { status: 200, corpo: { correcaoId: 'CR-0A5ECDCA54339EB3' } },
    get: { '/v1/correcoes/CR-0A5ECDCA54339EB3': { status: 200, corpo: { correcaoId: 'CR-0A5ECDCA54339EB3', estado: 'ABERTA', progresso: { corrigidas: 2, total: 5 }, previsaoSegundos: 55 } } },
  });
  assert.deepEqual(await abrirCorrecao({ cfg, pedido, simulationId: 9, fetcher }), { kind: 'a-corrigir', progresso: { corrigidas: 2, total: 5 }, previsaoSegundos: 55 });
});

test('a leitura do estado distingue "não existe" de "não sei agora" (#794)', async () => {
  const cfg = { url: 'http://motor', token: 't' };
  const corrigidaAgora = { correcaoId: 'CR-1', estado: 'CONCLUIDA', resultado: { estado: 'FULLY_GRADED', nota: 14.5 } };

  const ok = motor({ post: { status: 202 }, get: { '/v1/correcoes/CR-1': { status: 200, corpo: corrigidaAgora } } });
  const lido = await consultarEstado(cfg, 'CR-1', ok.fetcher);
  assert.equal(lido.ok && lido.vista.kind, 'corrigida');

  const naoExiste = motor({ post: { status: 202 }, get: { '/v1/correcoes/CR-1': { status: 404, corpo: {} } } });
  assert.deepEqual(await consultarEstado(cfg, 'CR-1', naoExiste.fetcher), { ok: false, status: 404 });

  const emBaixo = motor({ post: { status: 202 }, get: { '/v1/correcoes/CR-1': { status: 503, corpo: {} } } });
  assert.deepEqual(await consultarEstado(cfg, 'CR-1', emBaixo.fetcher), { ok: false, status: 503 });

  const semRede = (async () => { throw new Error('rede'); }) as unknown as typeof fetch;
  assert.deepEqual(await consultarEstado(cfg, 'CR-1', semRede), { ok: false, status: 0 });
});
