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

const PORT = Number(process.env.FLOW_PORT ?? 3103);
const BASE = `http://127.0.0.1:${PORT}`;
const APP = new URL('../', import.meta.url).pathname;
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
 * - Server action submetida sem JavaScript (`POST`): o `Location` é o valor cru do
 *   `redirect()`, e quem prefixa é o cliente — uma vez, à frente, sem verificar se já lá
 *   estava. Daí `/aluno/aluno/...` quando o `redirect()` já traz `/aluno`.
 *
 * Preferi isto a copiar a função do Next: internal package não é um contrato, e o que este
 * teste tem de apanhar é o duplo prefixo, não a implementação de quem o aplica.
 */
function resolver(metodo, location) {
  const caminho = metodo === 'GET' ? location : `/aluno${location}`;
  return new URL(caminho, `${BASE}/aluno/`);
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
  for (const tag of html.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
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
  if (final !== esperado) return `esperado ${esperado}, o browser foi para ${final || '(sem destino)'}`;
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
    env: { ...process.env, KIXI_MOCK: 'true', APP_ORIGIN: BASE },
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

    // 2 · onboarding. Os dois primeiros passos são GETs e não precisam de nada disto.
    await passo('a lista de escolas abre', 'GET', '/aluno/onboarding', {},
      (r) => (r.status === 200 ? null : `esperado 200, veio ${r.status}`));

    await passo('a escola estreita o catálogo de cursos', 'GET', '/aluno/onboarding?escola=1', {},
      (r) => (r.status === 200 ? null : `esperado 200, veio ${r.status}`));

    // 3 · o passo da turma, e a matrícula
    const passo2 = await pedir('GET', '/aluno/onboarding?escola=1&curso=3');
    const corpo = await passo2.resposta.text();
    // Isto verifica a ligação: que o ecrã mostra um ano e que o formulário o leva. A regra do
    // mês de corte NÃO é verificável aqui, porque a semente só tem anos em que a resposta
    // não muda com o corte — mudá-lo não muda nada e o teste passa. Quem cobre essa regra são
    // os testes de `lib/school-year.test.ts`, com datas fixas em Março e no mês de corte.
    const ano = /Ano letivo (\d{4}\/\d{4})/.exec(corpo)?.[1];
    registar('o passo da turma oferece um ano letivo', ano ? null : 'não encontrei o ano letivo',
      ano ?? '');
    const turma = /<option value="(\d+)">/.exec(corpo)?.[1];
    registar('há turma para escolher', turma ? null : 'nenhuma turma na lista', turma ?? '');

    await passo(
      'a matrícula leva ao início, com o basePath',
      'POST', '/aluno/onboarding',
      { form: camposDoForm(corpo, { classId: turma ?? '', schoolYearId: '1' }), seguir: true },
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

    // 4b · o detalhe da prova (#19): o ecrã que liga a lista aos três modos.
    // A prova 1 é a que o aluno tem tentativa corrigida, a 3 é a que nunca fez.
    await passo('o detalhe mostra o resumo e os dois modos', 'GET', '/aluno/prova/1/detalhe', {}, async (r) => {
      const html = await r.text();
      const falta = ['Redes de Computadores', 'Como queres estudar', 'Simular', 'Estudo assistido']
        .find((t) => !html.includes(t));
      return falta ? `não encontrei "${falta}"` : null;
    });

    await passo('o social não aparece sem o endpoint de comunidade', 'GET', '/aluno/prova/1/detalhe', {}, async (r) => {
      // A tarefa é escondê-lo enquanto o kixi#119 estiver fechado. Um botão morto
      // ensina o aluno a desconfiar do ecrã.
      const html = await r.text();
      return html.includes('Ver como outros') ? 'o CTA social está visível' : null;
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
