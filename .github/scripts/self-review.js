/* eslint-disable @typescript-eslint/no-require-imports */
// Auto-revisão — as regras que existem porque eu as parti.
//
// Não é estilo. Cada regra nasceu de um bug que passou o CI e que eu só apanhei porque
// alguém perguntou. Estão aqui para o próximo não depender de alguém perguntar.
//
//   node .github/scripts/self-review.js [base]     (base por omissão: DEV)
//
// Devolve código 1 se algo falhar, para servir de check no CI.
//
// Tudo corre sobre as **linhas novas** do diff. Um problema que já estava no ficheiro não é
// blame desta mudança, e um gate que apontaCulpa alheia acaba desligado — que é pior do que
// não ter gate. O que já está no código é assunto de outra mudança, e o teste de integração
// apanha o que estiver a correr mal hoje.

const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const BASE_POR_OMISSAO = 'DEV';

/** Caracteres que um diff em português pode ter. O resto é sinal de texto estragado. */
const PONTUACAO = new Set(['—', '–', '·', '…', '→', '↔', '’', '«', '»', '“', '”']);
// Ordinais: "11ª", "1º". Não são latin Extendido-A, mas são português.
const ORDINais = new Set(['ª', 'º']);

const ehLatin = (codigo) => codigo >= 0xc0 && codigo <= 0x24f;
// ─│┌└, usados como separador de secção nos comentários do mock.
const ehCaixa = (codigo) => codigo >= 0x2500 && codigo <= 0x257f;

/** Documentação mostra o contra-exemplo para ensinar a evitá-lo. Não é código a corrigir. */
const ehDocumentacao = (caminho) => /\.(md|mdx)$/.test(caminho);

/**
 * Ficheiros que existem para conter código mau de propósito. Uma lista, não um padrão:
 * alargar isto é desligar o alarme, e há um teste que fixa o conteúdo desta lista.
 */
const EXCLUIDOS = new Set(['.github/scripts/self-review.test.js']);

/** Códigos de regra. */
const REGRAS = {
  'basepath/redirect-prefixado':
    'o redirect de uma server action não leva o basePath; escreva o caminho cru',
  'basepath/app-path':
    'o basePath é aplicado por quem redirecciona, não aqui; ver student/README.md',
  'basepath/action-manual':
    'um action escrito à mão não recebe o basePath; tire-o e o form submete para o URL actual',
  'basepath/location':
    'o basePath não é aplicado a um location escrito à mão',
  'basepath/fetch-absoluto':
    'um caminho absoluto para a própria app não é reescrito pelo basePath',
  'texto/char-estranho': 'caractere de outra escrita numa linha nova',
  'texto/repeticao': 'letras triplicadas; deve ser texto estragado',
  'xss/html-injectado': 'o __html tem de ser um literal no código, não um valor',
  'segredo/literal': 'literal onde devia vir do ambiente',
  'mock/sem-teste':
    'a lógica do mock mudou e nenhum teste mudou com ela; cada regra do backend precisa de um teste',
};

/**
 * basePath. O `redirect()` de uma server action quer o caminho cru, porque o cliente do Next
 * é que acrescenta o prefixo; com `/aluno` dentro, o browser vai para `/aluno/aluno/...`.
 * Foi o bug do PR #98, e o helper que introduzi para o "resolver" era o mesmo bug.
 */
function checarBasePath(linhas) {
  const problemas = [];
  for (const { caminho, linha, texto } of linhas) {
    if (ehDocumentacao(caminho)) continue;
    for (const [expressao, regra] of [
      [/redirect\(\s*(['"`])\/aluno/g, 'basepath/redirect-prefixado'],
      [/\bappPath\(/g, 'basepath/app-path'],
      [/<form\b[^>]*\baction=["']\/[^"']*["']/g, 'basepath/action-manual'],
      [/location\.(?:href|assign|replace)\s*=\s*['"`]\/aluno/g, 'basepath/location'],
      [/fetch\(\s*['"`]\/aluno/g, 'basepath/fetch-absoluto'],
    ]) {
      if (expressao.test(texto)) problemas.push({ caminho, linha, regra });
    }
  }
  return problemas;
}

/**
 * Texto estragado em linhas novas. Já me aconteceu pôr caracteres de outra escrita no meio
 * de uma frase, e o CI passou na altura.
 */
function checarTexto(linhas) {
  const problemas = [];
  for (const { caminho, linha, texto } of linhas) {
    for (const caractere of texto) {
      const codigo = caractere.codePointAt(0);
      if (codigo < 127 || ehLatin(codigo) || ehCaixa(codigo)
        || PONTUACAO.has(caractere) || ORDINais.has(caractere)) continue;
      problemas.push({
        caminho, linha, regra: 'texto/char-estranho',
        detalhe: `${caractere} (U+${codigo.toString(16).toUpperCase().padStart(4, '0')})`,
      });
      break;
    }
    // Sem a flag `i`: com ela o `pp` de um identificador em camelCase casa com o `P` e
    // cada `appPath` do repositório aparece como texto estragado.
    for (const m of texto.matchAll(/\b\w*(?:([a-zà-ú])\1{2,})\w*\b/g)) {
      if (m[0].toLowerCase() === 'www') continue;
      problemas.push({ caminho, linha, regra: 'texto/repeticao', detalhe: `"${m[0]}"` });
    }
  }
  return problemas;
}

/**
 * `dangerouslySetInnerHTML` só com literal. A do tema é uma string no código; se um dia
 * levar um nome, um erro ou uma query, deixa de ser inocua.
 *
 * O espaço de `\s*` também não pode passar o lookahead, senão o `\s*` faz match de largura
 * zero antes da aspa e um literal passa como se fosse uma variável.
 */
function checarXss(linhas) {
  const problemas = [];
  for (const { caminho, linha, texto } of linhas) {
    if (/dangerouslySetInnerHTML=\{\{\s*__html:\s*(?![\s'"`])/.test(texto)) {
      problemas.push({ caminho, linha, regra: 'xss/html-injectado' });
    }
  }
  return problemas;
}

/**
 * Um segredo novo tem de vir do ambiente com guarda, não de um literal. O mock tem um
 * fallback público herdado do DEV, e cada vez que se toca nessa linha a pergunta volta.
 */
function checarSegredos(linhas) {
  const problemas = [];
  for (const { caminho, linha, texto } of linhas) {
    for (const m of texto.matchAll(/\b(SECRET|PASSWORD|TOKEN|API_KEY)\w*\s*[:=]\s*['"]([^'"]{12,})['"]/g)) {
      problemas.push({
        caminho, linha, regra: 'segredo/literal',
        detalhe: `${m[1]} tem um literal; de onde vem e porque é seguro em produção?`,
      });
    }
  }
  return problemas;
}

/**
 * Mexer na lógica do mock sem mexer num teste é a forma de voltar a divergir do backend em
 * silêncio. Foi assim que a precedência da escola ficou invertida: a semente tinha os dois
 * lados de acordo, e nenhuma linha de teste cobria a regra.
 */
function checarParidadeMock(linhas) {
  const mexeMock = linhas.some(
    (l) => /^student\/lib\/mock\/.*\.ts$/.test(l.caminho) && !l.caminho.endsWith('.test.ts'),
  );
  if (!mexeMock) return [];
  const mexeTeste = linhas.some((l) => /^student\/lib\/.*\.test\.ts$/.test(l.caminho));
  return mexeTeste ? [] : [{ caminho: 'student/lib/mock', linha: 0, regra: 'mock/sem-teste' }];
}

const TODAS = [checarBasePath, checarTexto, checarXss, checarSegredos, checarParidadeMock];

// ── recolha ───────────────────────────────────────────────────────────────────────

function git(raiz, args) {
  return execFileSync('git', args, { cwd: raiz, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

/** As linhas novas de um diff unificado, com o número que o editor mostra. */
function linhasDe(bruto, caminho) {
  const linhas = [];
  let n = 0;
  for (const l of bruto.split('\n')) {
    const cabecalho = /@@ -\d+(?:,\d+)? \+(\d+)/.exec(l);
    if (l.startsWith('@@') && cabecalho) n = Number(cabecalho[1]);
    else if (l.startsWith('+') && !l.startsWith('+++')) {
      linhas.push({ caminho, linha: n, texto: l.slice(1) });
      n++;
    } else if (!l.startsWith('-')) n++;
  }
  return linhas;
}

/**
 * As linhas novas a rever: o diff contra a base **e** o trabalho ainda por commitar.
 *
 * A segunda parte não é um luxo. Este comando corre-se antes de abrir o PR, e nessa altura
 * quase nada está commitado; sem isto o gate dizia "nada a apontar" sobre um ficheiro
 * acabado de escrever, e a instrução de o correr antes do PR era falsa.
 */
function recolher(raiz, base) {
  const linhas = [];
  const lista = (saida) => saida.split('\n').filter(Boolean);

  for (const caminho of lista(git(raiz, ['diff', '--name-only', `${base}...HEAD`]))) {
    if (EXCLUIDOS.has(caminho)) continue;
    let bruto = '';
    try {
      bruto = git(raiz, ['diff', '--unified=0', `${base}...HEAD`, '--', caminho]);
    } catch {
      continue;
    }
    linhas.push(...linhasDe(bruto, caminho));
  }

  // staged e unstaged: `git diff HEAD` é os dois de uma vez
  for (const caminho of lista(git(raiz, ['diff', '--name-only', 'HEAD']))) {
    if (EXCLUIDOS.has(caminho)) continue;
    linhas.push(...linhasDe(git(raiz, ['diff', '--unified=0', 'HEAD', '--', caminho]), caminho));
  }

  // ficheiros por seguimentar: todas as linhas são novas
  for (const caminho of lista(git(raiz, ['ls-files', '--others', '--exclude-standard']))) {
    if (EXCLUIDOS.has(caminho)) continue;
    let texto = '';
    try {
      texto = readFileSync(join(raiz, caminho), 'utf8');
    } catch {
      continue;
    }
    texto.split('\n').forEach((t, i) => linhas.push({ caminho, linha: i + 1, texto: t }));
  }

  return linhas;
}

function avaliar({ raiz, base }) {
  const linhas = recolher(raiz, base);
  return TODAS.flatMap((regra) => regra(linhas));
}

module.exports = {
  avaliar, recolher, REGRAS, BASE_POR_OMISSAO, EXCLUIDOS,
  checarBasePath, checarTexto, checarXss, checarSegredos, checarParidadeMock,
};

if (require.main === module) {
  const base = process.argv[2] || BASE_POR_OMISSAO;
  let problemas;
  try {
    problemas = avaliar({ raiz: process.cwd(), base });
  } catch (erro) {
    console.error(`Não consegui ler o diff contra ${base}: ${erro.message}`);
    process.exit(2);
  }

  if (!problemas.length) {
    console.log('Auto-revisão: nada a apontar.');
    process.exit(0);
  }

  const porRegra = new Map();
  for (const p of problemas) {
    if (!porRegra.has(p.regra)) porRegra.set(p.regra, []);
    porRegra.get(p.regra).push(p);
  }

  for (const [regra, lista] of porRegra) {
    console.log(`\n${regra} — ${REGRAS[regra]}`);
    for (const p of lista) {
      console.log(`  ${p.caminho}${p.linha ? `:${p.linha}` : ''}${p.detalhe ? ` — ${p.detalhe}` : ''}`);
    }
  }
  console.log(`\n${problemas.length} problema(s). Nenhum é estilo: cada um já custou um bug.`);
  process.exit(1);
}
