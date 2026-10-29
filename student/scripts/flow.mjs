// Integração do fluxo do aluno:  node student/scripts/flow.mjs
//
// Percorre registo → onboarding → matrícula → perfil → logout por HTTP, contra a app a
// arrancar com o mock, e falha se algum destino final não responder 200.
//
// Existe por causa de uma falha concreta. O PR #98 escrevia `/aluno/inicio` num
// `redirect()` de server action: o servidor devolvia `Location: /aluno/inicio`, o cliente
// acrescentava o basePath e o browser acabava em `/aluno/aluno/inicio`, que não existe. O
// CI passou na altura — o `lint`, o `build` e os testes unitários não exercem um redirect.
//
// Por isso a asserção não é "o Location tem o prefixo certo", que é um detalhe de
// implementação. É: **o destino final, depois de o browser resolver, responde 200 dentro de
// `/aluno`.** Duplo prefixo, prefixo em falta, caminho trocado — todos dão 404 e este
// teste falha. É a única forma de o teste não depender do mecanismo, só do resultado.

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.FLOW_PORT ?? 3103);
const BASE = `http://127.0.0.1:${PORT}`;
const APP = fileURLToPath(new URL('../', import.meta.url));
const COOKIE = 'auth_token';

let cookie = '';
let passos = 0;
let falhou = 0;

function registar(nome, problema) {
  passos++;
  if (problema) falhou++;
  console.log(`  ${problema ? 'FALHA' : 'ok  '} ${nome}${problema ? ` — ${problema}` : ''}`);
}

/**
 * Guarda o cookie de sessão, como o browser faria. Um `Set-Cookie` sem valor é o logout a
 * apagar o cookie, e isso tem de limpar a variável — senão o teste passa a achar que a
 * sessão continua viva.
 */
function guardarCookies(resposta) {
  for (const bruto of resposta.headers.getSetCookie?.() ?? []) {
    const par = bruto.split(';')[0];
    if (!par.startsWith(`${COOKIE}=`)) continue;
    cookie = par === `${COOKIE}=` ? '' : par;
  }
}

/** Os headers são lidos de fresco em cada salto: o cookie pode ter acabado de nascer. */
const cabecalhos = () => (cookie ? { cookie } : {});

/**
 * Onde o prefixo entra depende de como o browser fez o pedido, e é a subtilidade que dá
 * aos dois bugs de que já falámos:
 *
 * - Navegação (`GET`): o redirect vem do `NextResponse.redirect` do proxy, feito a partir
 *   de um `NextURL`, que **já traz** o basePath. O browser usa-o tal e qual.
 * - Server action submetida sem JavaScript (`POST`): o `Location` é o valor do `redirect()`
 *   e o browser usa-o tal e qual, sem juntar o basePath (confirmado com Chromium contra
 *   produção, #479: `Location: /inicio` levou a `/inicio`, um 404). Por isso
 *   `redirectFromAction` escreve o prefixo neste caso. Quando o JavaScript já hidratou, a
 *   action vai por `fetch` e o Next usa `x-action-redirect`, onde é o cliente que junta o
 *   basePath; esse caminho é o das jornadas do Playwright, não deste teste.
 *
 * Preferi isto a copiar a função do Next: internal package não é um contrato, e o que este
 * teste tem de apanhar é o 404 e o duplo prefixo, não a implementação de quem o aplica.
 */
function resolver(_metodo, location) {
  return new URL(location, `${BASE}/aluno/`);
}

async function pedir(metodo, caminho, { form, seguir = false } = {}) {
  let resposta = await fetch(`${BASE}${caminho}`, {
    method: metodo, redirect: 'manual', headers: cabecalhos(), body: form,
  });
  guardarCookies(resposta);

  // Só o primeiro salto de um POST é um redirect de server action, e é o único cru.
  // A partir daí já é navegação: o proxy e os Server Components devolvem o prefixo no
  // próprio Location. Prefixar a cadeia toda dava `/aluno/aluno/...` em cada volta.
  let primeiro = true;
  let visited = [];
  for (let salto = 0; seguir && resposta.status >= 300 && resposta.status < 400 && salto < 6; salto++) {
    const location = resposta.headers.get('location');
    if (!location) break;
    const destino = resolver(primeiro ? metodo : 'GET', location);
    primeiro = false;
    visited = destino.pathname + destino.search;
    resposta = await fetch(destino, { redirect: 'manual', headers: cabecalhos() });
    guardarCookies(resposta);
  }
  return { resposta, final: visited, status: resposta.status };
}

/** O HTML vem com `&quot;` e companhia. Sem descodificar, o id da acção chega ao
 *  servidor com as entidades dentro e o Next responde "Failed to find Server Action" —
 *  um 500 que não parece nada ter a ver com o form. */
function descodificar(valor) {
  return valor
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * O texto como o leitor o vê. O React separa nós de texto com `<!-- -->`, por isso
 * "0 de 3 respondidas" chega partido em pedaços; comparar a frase inteira dava um
 * falso negativo que nada tem com o ecrã. Isto junta o que é pontuação do React e
 * não do conteúdo.
 */
function textoLegivel(html) {
  return html.replace(/<!-- -->/g, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
}

/**
 * Os inputs escondidos que o próprio form emite, que é como se submete uma server action.
 *
 * `FormData` e não `URLSearchParams` porque o Next lê o corpo da acção como multipart: com
 * `application/x-www-form-urlencoded` a acção até corre, mas devolve 200 com o estado do
 * formulário em vez do redirect, e o fluxo passa a parecer quebrado sem erro nenhum.
 */
function camposDoForm(html, extras = {}) {
  const dados = new FormData();
  for (const [nome, valor] of Object.entries(extras)) dados.append(nome, valor);

  // Uma página pode ter mais do que uma Server Action (por exemplo, matrícula e
  // terminar sessão no onboarding). Recolher todos os campos hidden da página mistura
  // as referências das actions e submete a action errada. Quando há um campo extra,
  // escolhe o form que contém esse campo; sem extras usa o primeiro form. Se a página
  // tiver vários forms, passa um campo extra exclusivo do form pretendido.
  const campoAlvo = Object.keys(extras)[0];
  const formularios = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map((match) => match[0]);
  const formulario = campoAlvo
    ? formularios.find((form) => new RegExp(`name="${campoAlvo}"`).test(form))
    : formularios[0];
  const fonte = formulario ?? html;

  for (const tag of fonte.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const nome = tag[0].match(/name="([^"]+)"/)?.[1];
    if (!nome || dados.has(nome)) continue;
    dados.append(nome, descodificar(tag[0].match(/value="([^"]*)"/)?.[1] ?? ''));
  }
  return dados;
}

/**
 * Um destino final tem de ser o esperado e ter respondido 200. O 200 é o que apanha o
 * duplo prefixo: `/aluno/aluno/inicio` tem o caminho certo com o prefixo a mais, e a
 * única coisa que o denuncia é o 404.
 */
function destinoOk(final, esperado, status) {
  // O que isto verifica é o basePath (ver o cabeçalho do ficheiro) e os parâmetros que
  // quem chama pediu (ex.: "?reason=logged-out"). Um parâmetro A MAIS no browser não
  // reprova: desde o kixi-frontend#219 algumas páginas chegam com um parâmetro de uso
  // único para a analítica (`?matriculado=1`, `?iniciada=1`, ...), que não é parte do
  // contrato aqui testado.
  const [caminhoEsperado, queryEsperada] = esperado.split('?');
  const [caminhoFinal, queryFinal] = (final || '').split('?');
  const pedida = new URLSearchParams(queryEsperada ?? '');
  const recebida = new URLSearchParams(queryFinal ?? '');
  const faltaOuDifere = [...pedida.entries()].find(([chave, valor]) => recebida.get(chave) !== valor);
  if (caminhoFinal !== caminhoEsperado || faltaOuDifere) {
    return `esperado ${esperado}, o browser foi para ${final || '(sem destino)'}`;
  }
  if (status !== 200) return `${esperado} respondeu ${status}`;
  return null;
}

async function passo(nome, metodo, caminho, opcoes, assercao) {
  try {
    const { resposta, final, status } = await pedir(metodo, caminho, opcoes);
    registar(nome, (await assercao(resposta, final, status)) ?? null);
  } catch (erro) {
    registar(nome, erro.message);
  }
}

async function esperarPeloServidor(processo) {
  for (let tentativa = 0; tentativa < 90; tentativa++) {
    if (processo.exitCode !== null) {
      throw new Error(`o servidor morreu com código ${processo.exitCode}\n${lerLogDoServidor()}`);
    }
    try {
      if ((await fetch(`${BASE}/aluno/entrar`, { redirect: 'manual' })).status < 500) return;
    } catch { /* ainda a arrancar */ }
    await sleep(1000);
  }
  throw new Error('o servidor não respondeu a tempo');
}

/** `next start` não arranca sem build, e esperar 90 segundos para descobrir isso é
 *  uma forma cara de perder tempo. */
function exigirBuild() {
  if (!existsSync(`${APP}.next/BUILD_ID`)) {
    throw new Error('sem build: corre `npm run build` antes do teste de fluxo');
  }
}

let logDoServidor = '';
function lerLogDoServidor() {
  return logDoServidor ? `--- servidor ---\n${logDoServidor}` : '';
}

async function main() {
  exigirBuild();
  // `next start` directamente, e não `npm start`: o script fixa a porta 3003.
  const servidor = spawn('node_modules/.bin/next', ['start', '-p', String(PORT)], {
    cwd: APP,
    // `next start` corre em produção, e lá `APP_ORIGIN` é obrigatório: sem esta variável a
    // app recusa servir. Defini-lo aqui é também o cenário real, em que o redireccionamento
    // do `/403` e a passagem ao gestor têm um destino de confiança.
    env: { ...process.env, KIXI_MOCK: 'true', KIXI_ALLOW_MOCK_IN_PROD: 'true', APP_ORIGIN: BASE },
    stdio: ['ignore', 'ignore', 'pipe'],
    detached: true,
  });
  servidor.stderr?.on('data', (pedaco) => {
    logDoServidor = `${logDoServidor}${pedaco}`.slice(-2000);
  });

  try {
    await esperarPeloServidor(servidor);
    console.log('fluxo do aluno\n');

    // 1 · registo. Uma conta nova por corrida: repetir username dá 200 e não há sessão.
    const quem = `ana.verde.${process.pid}`;
    const cadastro = await (await fetch(`${BASE}/aluno/cadastro`)).text();
    await passo(
      'o registo leva ao onboarding, com o basePath',
      'POST', '/aluno/cadastro',
      {
        form: camposDoForm(cadastro, {
          firstName: 'Ana', lastName: 'Verde', username: quem,
          email: `${quem}@kixi.ao`, password: 'Kixi1234!', confirm: 'Kixi1234!',
        }),
        seguir: true,
      },
      (r, final, status) => destinoOk(final, '/aluno/onboarding', status),
    );

    // 2 · onboarding: só o código. O ecrã é estático e a turma vem do código (kixi#255),
    // por isso não há passos de escola/curso/turma para percorrer.
    const onboarding = await pedir('GET', '/aluno/onboarding');
    const corpo = await onboarding.resposta.text();
    registar(
      'o onboarding pede o código de matrícula',
      corpo.includes('name="codigo"') ? null : 'não encontrei o campo do código',
      '/aluno/onboarding',
    );

    await passo(
      'um código inválido é explicado e não matricula',
      'POST', '/aluno/onboarding',
      { form: camposDoForm(corpo, { codigo: 'CODIGOINVALIDO' }), seguir: true },
      async (r, final) => {
        const html = await r.text();
        if ((final || '').includes('/aluno/inicio')) return 'matriculou com um código inválido';
        return html.includes('Código inválido') ? null : 'não mostrou a mensagem do código inválido';
      },
    );

    await passo(
      'a matrícula leva ao início, com o basePath',
      'POST', '/aluno/onboarding',
      // Desde kixi#255 a auto-matrícula exige um código (TESTE5678 é o da turma vazia
      // que este fluxo usa; o da 12B fica para o teste do código no fim).
      { form: camposDoForm(corpo, { codigo: 'TESTE5678' }), seguir: true },
      (r, final, status) => destinoOk(final, '/aluno/inicio', status),
    );

    // 4 · o perfil, com dados que nenhum administrador escreveu
    await passo('o perfil mostra nome e escola reais', 'GET', '/aluno/perfil', {}, async (r) => {
      const html = await r.text();
      const falta = ['Ana Verde', 'Instituto de Telecomunicações'].find((t) => !html.includes(t));
      return falta ? `não encontrei "${falta}"` : null;
    });

    // 4 · a sala de prova, do princípio ao fim. Este é o passo que o `lint`, o `build`
    // e os testes unitários não apanham: que a página renderiza o enunciado verdadeiro,
    // que o botão de começar arranca mesmo uma tentativa, e que o servidor aceita a
    // entrega. A conta é nova, por isso começa pelo ecrã de começar.
    await passo('uma prova por começar oferece o início, não a sala', 'GET', '/aluno/prova/2', {}, async (r) => {
      const html = await r.text();
      if (r.status !== 200) return `esperado 200, veio ${r.status}`;
      return html.includes('Começar a prova') ? null : 'não ofereceu começar a prova';
    });

    const comecar = await (await fetch(`${BASE}/aluno/prova/2`, { headers: cabecalhos() })).text();
    await passo(
      'começar a prova leva à sala',
      'POST', '/aluno/prova/2',
      { form: camposDoForm(comecar, { statementId: '2' }), seguir: true },
      (r, final, status) => destinoOk(final, '/aluno/prova/2', status),
    );

    await passo('a sala mostra o enunciado, o mapa e o botão de entregar', 'GET', '/aluno/prova/2', {}, async (r) => {
      const html = await r.text();
      if (r.status !== 200) return `esperado 200, veio ${r.status}`;
      const falta = ['Questões', 'Entregar', 'Marcar para rever'].find((t) => !html.includes(t));
      return falta ? `não encontrei "${falta}" na sala` : null;
    });

    await passo('a sala conta as questões por responder', 'GET', '/aluno/prova/2', {}, async (r) => {
      const texto = textoLegivel(await r.text());
      // A prova 2 tem três questões e nada guardado: o mapa diz 0 de 3. Um ecrã que
      // mentisse aqui deixaria o aluno entregar sem ver o que falta.
      return texto.includes('0 de 3 respondidas')
        ? null
        : `o mapa não contou as três questões por responder (vi "${(texto.match(/\d+ de \d+ respondidas/) ?? ['nada'])[0]}")`;
    });

    await passo('a sala não mostra o gabarito ao aluno', 'GET', '/aluno/prova/2', {}, async (r) => {
      const html = await r.text();
      // `isCorrect` não chega num /full de aluno: o backend põe o campo a null e o
      // @JsonInclude(NON_NULL) tira-o do JSON (StatementOcrResponse.java:171). O que
      // se procura é o marcador do campo, não a resposta em si, que está no enunciado.
      return html.includes('isCorrect') ? 'a sala recebeu o campo isCorrect' : null;
    });

    // A primeira questão da prova 2 é de escolha, e a sala só desenha uma de cada vez.
    // Se desenhasse pelo `questionType` em vez de pela existência de opções, o
    // servidor mandaria a resposta aberta para o professor e o desenho mentiria.
    await passo('a questão de escolha desenha alternativas', 'GET', '/aluno/prova/2', {}, async (r) => {
      const html = await r.text();
      const radios = (html.match(/type="radio"/g) ?? []).length;
      if (radios === 0) return 'a questão de escolha não desenhou alternativas';
      return null;
    });

    // Entregar é o único submit por HTTP sem JavaScript na sala: é um form. Leva ao
    // resultado pelo caminho cru do `redirect()` numa server action, com o basePath
    // aplicado uma vez — o duplo `/aluno/aluno` que já custou um 404 no PR #98.
    const sala = await (await fetch(`${BASE}/aluno/prova/2`, { headers: cabecalhos() })).text();
    const sessao = /name="simulationId" value="(\d+)"/.exec(sala)?.[1];
    registar('a sala tem uma tentativa', sessao ? null : 'não encontrei o simulationId na sala', sessao ?? '');

    await passo(
      'entregar a prova leva ao resultado, com o basePath',
      'POST', '/aluno/prova/2',
      { form: camposDoForm(sala), seguir: true },
      (r, final, status) => destinoOk(final, `/aluno/resultado?prova=${sessao}`, status),
    );

    // Reabrir depois de entregar não recomeça a prova. O Next 16 envia primeiro a
    // shell e o `redirect()` vem no payload de streaming, por isso não chega como um
    // 3xx: o que se confirma é que o destino está no payload e que a prova não abre.
    await passo('reabrir uma prova entregue não a abre de novo', 'GET', '/aluno/prova/2', {}, async (r) => {
      const html = await r.text();
      if (html.includes(`/aluno/resultado?prova=${sessao}`)) return null;
      if (html.includes('Questões')) return 'a sala abriu outra vez depois de entregar';
      return 'nem o redireccionamento nem a sala: a resposta não diz o que aconteceu';
    });

    // 4a · o resultado da tentativa que acabou de ser entregue (#18): vem do servidor,
    // e a tentativa de outra conta não se abre.
    await passo('o resultado mostra a revisão e as acções', 'GET', `/aluno/resultado?prova=${sessao}`, {}, async (r, final, status) => {
      if (status !== 200) return `esperado 200, veio ${status}`;
      const html = await r.text();
      const falta = ['Revisão questão a questão', 'Refazer simulação', 'Voltar às provas'].find((t) => !html.includes(t));
      return falta ? `não encontrei "${falta}"` : null;
    });

    // Com o loading.tsx a resposta já saiu como 200 quando o `notFound()` chega, por isso
    // o que se verifica é o conteúdo: nem a revisão nem a nota de outra conta.
    await passo('o resultado de outra conta não abre', 'GET', '/aluno/resultado?prova=1', {}, async (r) => {
      const html = await r.text();
      if (html.includes('Revisão questão a questão')) return 'abriu o resultado de outra conta';
      return /16[,.]4/.test(html) ? 'vazou a nota de outra conta' : null;
    });

    // 4b · o detalhe da prova (#19): o ecrã que liga a lista aos três modos.
    // A prova 1 é a que o aluno tem tentativa corrigida, a 3 é a que nunca fez.
    await passo('o detalhe mostra o resumo e os dois modos', 'GET', '/aluno/prova/1/detalhe', {}, async (r) => {
      const html = await r.text();
      const falta = ['Redes de Computadores', 'Como queres estudar', 'Simular', 'Estudo assistido']
        .find((t) => !html.includes(t));
      return falta ? `não encontrei "${falta}"` : null;
    });

    await passo('a comunidade não aparece sem tentativa corrigida', 'GET', '/aluno/prova/1/detalhe', {}, async (r) => {
      // #32/#119: a comunidade compara desempenhos, e esta conta (acabada de
      // registar-se) nunca fez esta prova - mostrá-la sem nota própria era um
      // ecrã a comparar o aluno com ninguém.
      const html = await r.text();
      return html.includes('Comunidade') ? 'a secção da comunidade está visível' : null;
    });

    // A conta deste fluxo acabou de registar-se, por isso não tem tentativas: o que se
    // verifica aqui é o estado vazio e que as tentativas de outro aluno não aparecem.
    // A lista com nota é do estado semeado, e quem a cobre é o ecrã com o mock ligado.
    await passo('sem tentativas é um estado vazio, não uma lista vazia', 'GET', '/aluno/prova/1/detalhe', {}, async (r) => {
      const html = await r.text();
      if (!html.includes('Ainda não tentaste esta prova')) return 'não encontrei o estado vazio';
      // As tentativas da conta semeada (16,4) são de outra conta e não podem vazar.
      return /16[,.]4/.test(html) ? 'vazou a nota de outro aluno' : null;
    });

    await passo('o tutor aberto da prova diz de que prova fala', 'GET', '/aluno/tutor?statementId=1', {}, async (r) => {
      const html = await r.text();
      return html.includes('Sobre Redes de Computadores') ? null : 'o tutor não recebeu o contexto';
    });

    await passo('o tutor sem prova continua a funcionar', 'GET', '/aluno/tutor', {}, async (r) => {
      const html = await r.text();
      return html.includes('Tutor') ? null : 'o tutor sem contexto não respondeu';
    });

    // 4c · o tutor (#28). O ecrã e a stream: o que o aluno vê vem do backend por SSE,
    // lido com fetch porque o EventSource não faz POST.
    await passo('o tutor sem prova pede uma prova, não finge uma conversa', 'GET', '/aluno/tutor', {}, async (r) => {
      const html = await r.text();
      return html.includes('Escolhe uma prova') ? null : 'não pediu uma prova';
    });

    await passo('estudar os erros abre o tutor com a pergunta pronta, por enviar', 'GET', '/aluno/tutor?statementId=1&questoes=2,3', {}, async (r) => {
      const html = await r.text();
      return html.includes('Errei as questões 2 e 3') ? null : 'a pergunta não veio escrita';
    });

    const json = { ...cabecalhos(), 'Content-Type': 'application/json' };
    const abrir = await fetch(`${BASE}/aluno/api/tutor/sessions`, { method: 'POST', headers: json, body: JSON.stringify({ statementId: 1 }) });
    const sessaoTutor = abrir.ok ? (await abrir.json()).id : null;
    registar('abrir uma sessão do tutor', sessaoTutor ? null : `esperado 201, veio ${abrir.status}`);

    if (sessaoTutor) {
      const resp = await fetch(`${BASE}/aluno/api/tutor/sessions/${sessaoTutor}/messages`, { method: 'POST', headers: json, body: JSON.stringify({ content: 'Explica a questão 1' }) });
      const corpo = await resp.text();
      registar(
        'a resposta do tutor chega por SSE, em deltas e um final',
        resp.headers.get('content-type')?.includes('text/event-stream') && corpo.includes('event: delta') && corpo.includes('event: final')
          ? null : `tipo ${resp.headers.get('content-type')}, ${corpo.slice(0, 80)}`,
      );

      const erro = await fetch(`${BASE}/aluno/api/tutor/sessions/${sessaoTutor}/messages`, { method: 'POST', headers: json, body: JSON.stringify({ content: '[[erro]]' }) });
      const corpoErro = await erro.text();
      registar('uma falha a meio da resposta vem na própria stream', corpoErro.includes('event: error') ? null : 'sem evento de erro');

      const limite = await fetch(`${BASE}/aluno/api/tutor/sessions/${sessaoTutor}/messages`, { method: 'POST', headers: json, body: JSON.stringify({ content: '[[limite]]' }) });
      registar('o limite de mensagens é 429 com Retry-After', limite.status === 429 && limite.headers.get('retry-after') ? null : `veio ${limite.status}`);

      const semChave = await fetch(`${BASE}/aluno/api/tutor/sessions/${sessaoTutor}/messages`, { method: 'POST', headers: json, body: JSON.stringify({ content: '[[sem-chave]]' }) });
      registar('sem chave do provider é 503', semChave.status === 503 ? null : `veio ${semChave.status}`);

      // #115 · modos e contexto via abertura da sessão. A mensagem leva só conteúdo.
      const sessaoComContexto = await fetch(`${BASE}/aluno/api/tutor/sessions`, {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ statementId: 1, mode: 'EXPLAIN_QUESTION', questionId: 1, studentAnswer: '/8' }),
      });
      const sessaoComContextoId = sessaoComContexto.ok ? (await sessaoComContexto.json()).id : null;
      const comContexto = sessaoComContextoId
        ? await fetch(`${BASE}/aluno/api/tutor/sessions/${sessaoComContextoId}/messages`, {
            method: 'POST',
            headers: json,
            body: JSON.stringify({ content: 'Onde errei?' }),
          })
        : null;
      const corpoContexto = comContexto ? await comContexto.text() : '';
      registar(
        'explicar uma questão nomeada devolve a fonte dessa questão',
        corpoContexto.includes('"questionId":1') && corpoContexto.includes('"kind":"QUESTION"') ? null : `faltou a fonte: ${corpoContexto.slice(-160)}`,
      );

      const modoInvalido = await fetch(`${BASE}/aluno/api/tutor/sessions`, { method: 'POST', headers: json, body: JSON.stringify({ statementId: 1, mode: 'INVADIR' }) });
      registar('um modo que não existe é 400, não uma resposta', modoInvalido.status === 400 ? null : `veio ${modoInvalido.status}`);

      const questaoAlheia = await fetch(`${BASE}/aluno/api/tutor/sessions`, { method: 'POST', headers: json, body: JSON.stringify({ statementId: 1, mode: 'EXPLAIN_QUESTION', questionId: 999 }) });
      registar('uma questão que não é desta prova é 404', questaoAlheia.status === 404 ? null : `veio ${questaoAlheia.status}`);
    }

    // O link do resultado: chega em modo «explicar», com a primeira questão escolhida
    // e a resposta que o aluno deu.
    await passo('estudar os erros abre o tutor na questão a explicar', 'GET', '/aluno/tutor?statementId=1&questoes=2&respostas=%5B%5B2%2C%22%2F24%22%5D%5D', {}, async (r) => {
      const html = await r.text();
      const temSelector = html.includes('Qual questão queres que eu explique?') && html.includes('Quantos hosts utilizáveis');
      // `<option value="2" selected="">` é o que prova que a questão 2 ficou escolhida
      const temEscolha = /<option value="(\d+)" selected(?:=""|>)/.test(html);
      const temResposta = html.includes('/24');
      return temSelector && temEscolha && temResposta
        ? null : `selector ${temSelector}, escolha ${temEscolha}, resposta ${temResposta}`;
    });

    // O travão do tutor (#192): com uma tentativa a correr, o tutor da MESMA prova
    // fecha — mas só essa, e com o caminho de volta. A prova 1 ainda não tem
    // tentativa desta conta, por isso o ecrã é o de começar.
    const comecarTravao = await (await fetch(`${BASE}/aluno/prova/1`, { headers: cabecalhos() })).text();
    await passo(
      'começar a prova 1 para pôr o travão à prova',
      'POST', '/aluno/prova/1',
      { form: camposDoForm(comecarTravao, { statementId: '1' }), seguir: true },
      (r, final, status) => destinoOk(final, '/aluno/prova/1', status),
    );

    await passo('com a prova a correr, o tutor da mesma prova fecha', 'GET', '/aluno/tutor?statementId=1', {}, async (r) => {
      const html = await r.text();
      if (!html.includes('O tutor está fechado durante a prova')) return 'o tutor não fechou';
      return html.includes('Voltar à prova') ? null : 'fechou sem caminho de volta';
    });

    // O travão é da prova, não do tutor todo: sem prova, continua a estudar-se.
    await passo('o travão é só da mesma prova, e o tutor sem prova continua aberto', 'GET', '/aluno/tutor', {}, async (r) => {
      const html = await r.text();
      return html.includes('O tutor está fechado durante a prova') ? 'travou o tutor sem prova' : null;
    });

    // O travão não pode falhar aberto (#192): com a leitura das tentativas em baixo
    // não se sabe se a prova está a correr, por isso o tutor fecha e oferece nova
    // tentativa, em vez de abrir a conversa.
    const definirFalha = (mode) => fetch(`${BASE}/aluno/api/mock-fault`, {
      method: 'POST',
      headers: { ...cabecalhos(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    try {
      const falhaLigada = await definirFalha('500');
      registar('ligar a falha do mock para o travão', falhaLigada.ok ? null : `veio ${falhaLigada.status}`);
      await passo('com o backend a falhar, o tutor não abre sem confirmar a prova', 'GET', '/aluno/tutor?statementId=1', {}, async (r) => {
        const html = await r.text();
        if (html.includes('Não foi possível confirmar o estado da prova')) return null;
        return html.includes('O tutor está fechado durante a prova')
          ? 'mostrou o travão em vez do estado desconhecido'
          : 'abriu a conversa sem saber se a prova está a correr';
      });
    } finally {
      await definirFalha('');
    }

    // A resposta do aluno é contexto: se o tipo não for texto, o turno segue sem a
    // resposta que o chamador julgava ter enviado — e isso é pior do que recusar.
    const respostaNaoTexto = await fetch(`${BASE}/aluno/api/tutor/sessions`, {
      method: 'POST', headers: json,
      body: JSON.stringify({ statementId: 1, mode: 'EXPLAIN_QUESTION', questionId: 1, studentAnswer: 42 }),
    });
    registar('uma resposta que não é texto é 400, não um turno sem resposta', respostaNaoTexto.status === 400 ? null : `veio ${respostaNaoTexto.status}`);

    const alheia = await fetch(`${BASE}/aluno/api/tutor/sessions/9999/messages`, { method: 'POST', headers: json, body: JSON.stringify({ content: 'olá' }) });
    registar('uma sessão que não é da conta é 404', alheia.status === 404 ? null : `veio ${alheia.status}`);

    const oculta = await fetch(`${BASE}/aluno/api/tutor/sessions`, { method: 'POST', headers: json, body: JSON.stringify({ statementId: 4 }) });
    registar('uma prova por publicar não abre sessão', oculta.status === 404 ? null : `veio ${oculta.status}`);

    // 4c · salas de prova (#25, passos trazidos do #125). A conta deste fluxo acabou de
    // registar-se e não tem salas: o que se verifica é que a secção não aparece. As
    // salas semeadas são da conta 3.
    await passo(
      'sem salas, o início não mostra a secção',
      'GET', '/aluno/inicio', {},
      async (r) => {
        const html = await r.text();
        return html.includes('Salas de prova') ? 'a secção apareceu sem haver salas' : null;
      },
    );

    // O `/inicio` passou a Server Component, que lê as salas antes de desenhar o feed.
    // Uma divisão de ficheiro que se engana deixa a página a responder 200 sem conteúdo.
    await passo(
      'o feed continua no início, depois de o tornar servidor',
      'GET', '/aluno/inicio', {},
      async (r) => {
        const html = await r.text();
        // "Partilhar resultado" saiu do compositor com o #30: o backend só deixa o
        // aluno criar publicações do tipo doubt/topic à mão (PostType.isManual()),
        // nunca milestone - por isso o atalho deixou de fingir que essa opção existe.
        const falta = ['Início', 'Fazer uma pergunta'].find((t) => !html.includes(t));
        return falta ? `não encontrei "${falta}"` : null;
      },
    );

    await passo(
      'sem salas, a aba das salas diz que ainda não há nenhuma',
      'GET', '/aluno/provas?aba=salas', {},
      async (r) => {
        const html = await r.text();
        return html.includes('Ainda não tens salas de prova') && !html.includes('id="salas"') ? null : 'a aba das salas não mostra o estado vazio';
      },
    );

    await passo(
      'os enunciados e as salas são abas separadas, sem convites no rótulo',
      'GET', '/aluno/provas', {},
      async (r) => {
        const html = await r.text();
        if (!html.includes('Enunciados') || !html.includes('Salas de prova')) return 'faltam as duas abas';
        return html.includes('Salas de prova (') ? 'o rótulo mostra convites que não existem' : null;
      },
    );

    await passo(
      'o ranking liga-se ao backend, não às linhas fixas de lib/data.ts',
      'GET', '/aluno/ranking', {},
      async (r) => {
        // #117/#31: esta conta é desta corrida, sozinha na sua turma (curso TLP-ITEL,
        // #31 não partilha semente com a 12B) - por isso a janela do backend é só ela
        // própria, em 1.º de 1. A prova é não mostrar as linhas fixas de lib/data.ts
        // (Mariana Costa, Paulo Neto, ...), que não dependem de nota nenhuma.
        const html = await r.text();
        if (html.includes('Mariana Costa')) return 'ainda mostra as linhas fixas de lib/data.ts';
        const falta = ['Turma', 'Escola', 'Amigos', '1.º de 1'].find((t) => !html.includes(t));
        return falta ? `não encontrei "${falta}"` : null;
      },
    );

    // 5 · logout, e o cookie tem mesmo de desaparecer
    const perfil = await (await fetch(`${BASE}/aluno/perfil`, { headers: cabecalhos() })).text();
    await passo(
      'o logout leva ao entrar com o motivo',
      'POST', '/aluno/perfil',
      { form: camposDoForm(perfil), seguir: true },
      (r, final, status) => destinoOk(final, '/aluno/entrar?reason=logged-out', status),
    );
    registar('o logout limpa o cookie de sessão', cookie === '' ? null : `ainda há ${cookie.slice(0, 20)}…`);

    // 6 · sem sessão, uma rota privada vai para o entrar — e não para a raiz
    cookie = '';
    await passo(
      'sem sessão, o início vai para o entrar',
      'GET', '/aluno/inicio', { seguir: true },
      (r, final, status) => destinoOk(final, '/aluno/entrar', status),
    );

    // 7 · o código decide a turma (kixi#255). A segunda conta usa um código da 12B: o
    // perfil mostra a turma do código, que é o que a rota do mock resolve.
    const quem2 = `bruno.codigo.${process.pid}`;
    const cadastro2 = await (await fetch(`${BASE}/aluno/cadastro`)).text();
    await passo(
      'o segundo registo entra no onboarding',
      'POST', '/aluno/cadastro',
      {
        form: camposDoForm(cadastro2, {
          firstName: 'Bruno', lastName: 'Código', username: quem2,
          email: `${quem2}@kixi.ao`, password: 'Kixi1234!', confirm: 'Kixi1234!',
        }),
        seguir: true,
      },
      (r, final, status) => destinoOk(final, '/aluno/onboarding', status),
    );

    const onboarding2 = await (await fetch(`${BASE}/aluno/onboarding`, { headers: cabecalhos() })).text();
    await passo(
      'o código decide a turma da segunda conta',
      'POST', '/aluno/onboarding',
      { form: camposDoForm(onboarding2, { codigo: 'TESTE1234' }), seguir: true },
      (r, final, status) => destinoOk(final, '/aluno/inicio', status),
    );

    await passo('o perfil mostra a turma do código (12B)', 'GET', '/aluno/perfil', {}, async (r) => {
      const html = textoLegivel(await r.text());
      return html.includes('Turma 12B') ? null : 'o perfil não mostra a turma do código (12B)';
    });
  } finally {
    try { process.kill(-servidor.pid, 'SIGTERM'); } catch { /* já morreu */ }
  }

  console.log(`\n${passos - falhou}/${passos} passos ok`);
  if (falhou) {
    if (logDoServidor) console.error(lerLogDoServidor());
    process.exit(1);
  }
}

await main();
