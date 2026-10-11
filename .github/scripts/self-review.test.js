/* eslint-disable @typescript-eslint/no-require-imports */
// Testes da auto-revisão:  node --test .github/scripts/self-review.test.js
//
// Cada regra tem de falhar no caso mau e passar no bom. Uma regra que dispara sempre
// ninguém lê, e uma que nunca dispara é pior do que não existir.
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  checarBasePath, checarTexto, checarXss, checarSegredos, checarParidadeMock, EXCLUIDOS,
} = require('./self-review.js');

const linha = (texto, caminho = 'student/lib/x.ts', n = 1) => [{ caminho, linha: n, texto }];
const regras = (p) => p.map((x) => x.regra);

// ── basePath ──────────────────────────────────────────────────────────────────────

test('redirect de server action com o prefixo dentro é apanhado', () => {
  assert.deepEqual(regras(checarBasePath(linha("  redirect('/aluno/inicio');"))),
    ['basepath/redirect-prefixado']);
});

test('o helper appPath é apanhado onde quer que apareça', () => {
  assert.deepEqual(regras(checarBasePath(linha("  redirect(appPath('/inicio'));"))),
    ['basepath/app-path']);
});

test('action escrito à mão num form é apanhado', () => {
  assert.deepEqual(regras(checarBasePath(linha('<form action="/onboarding" method="get">'))),
    ['basepath/action-manual']);
});

test('o caminho cru passa, porque é o que o Next quer', () => {
  assert.deepEqual(checarBasePath(linha("  redirect('/inicio');")), []);
});

test('um form sem action passa', () => {
  assert.deepEqual(regras(checarBasePath(linha('<form method="get" className="grid">'))), []);
});

test('um form com server action passa', () => {
  assert.deepEqual(checarBasePath(linha('<form action={sairAction}>')), []);
});

test('o redirect de um Server Component passa, porque o Next põe-lhe o prefixo', () => {
  assert.deepEqual(checarBasePath(linha("  redirect('/onboarding');")), []);
});

test('um Link com caminho da app passa', () => {
  assert.deepEqual(checarBasePath(linha('<Link href="/perfil">Perfil</Link>')), []);
});

test('redirect para a landing em URL absoluta passa', () => {
  assert.deepEqual(checarBasePath(linha("  redirect(`${origin}/403${query}`);")), []);
});

test('o nome basePath no next.config não dispara', () => {
  assert.deepEqual(checarBasePath(linha("  basePath: '/aluno',", 'student/next.config.ts')), []);
});

test('o proxy, que também não pode levar o prefixo à mão, passa', () => {
  assert.deepEqual(checarBasePath(linha('  url.pathname = pathname;', 'student/proxy.ts')), []);
});

test('a documentação pode mostrar o contra-exemplo', () => {
  // Um README que escreve `redirect('/aluno/inicio')` para dizer que isso está errado está
  // a fazer o trabalho certo. Bloqueá-lo puniria a documentação por ensinar a evitar o bug.
  const texto = "`redirect('/aluno/inicio')` aqui chegaria a `/aluno/aluno/inicio`.";
  assert.deepEqual(checarBasePath(linha(texto, 'student/README.md')), []);
});

test('uma linha com dois problemas aparece só uma vez', () => {
  const texto = "<form action='/aluno/onboarding'>";
  assert.equal(checarBasePath(linha(texto)).length, 1);
});

// ── texto ─────────────────────────────────────────────────────────────────────────

test('caractere de outra escrita é apanhado', () => {
  assert.deepEqual(regras(checarTexto(linha('um login bem历来ucedido'))),
    ['texto/char-estranho']);
});

test('letras triplicadas são apanhadas', () => {
  assert.deepEqual(regras(checarTexto(linha('aguuu, escrevo isto com um erro'))),
    ['texto/repeticao']);
});

test('camelCase não parece texto estragado', () => {
  assert.deepEqual(checarTexto(linha("  redirect(toAppPath('/inicio'));")), []);
});

test('acentos, ordinais e pontuação portugueses passam', () => {
  const texto = 'Três bugs — todos 404; a avaliação da 11ª área passou à custa do aluno (→ ok).';
  assert.deepEqual(checarTexto(linha(texto)), []);
});

test('o separador de secção em comentário passa', () => {
  assert.deepEqual(checarTexto(linha('  // ── tudo o resto precisa de sessão ──────')), []);
});

test('um URL não conta como repetição', () => {
  assert.deepEqual(checarTexto(linha('ver https://kixi.ao/www/docs')), []);
});

test('limite conhecido: letra dobrada não é apanhada, e é o caso realista', () => {
  // Os meus typos reais são de letra dobrada — "deecutivas", "ahrikar" — e nenhum é
  // apanhado. Letra dobrada é normal em português ("acesso", "bilhete"), por isso baixar o
  // limiar para duas faria a regra gritar em texto correcto. O que fica é entrulho, não o
  // erro que eu de facto commito, e a revisão humana continua a ser o que apanha isso.
  assert.deepEqual(checarTexto(linha('o deecutivas da área')), []);
  assert.deepEqual(checarTexto(linha('o acesso ao feed')), []);
});

// ── XSS ───────────────────────────────────────────────────────────────────────────

test('html literal passa', () => {
  const texto = "dangerouslySetInnerHTML={{ __html: \"try{localStorage.getItem('kixi')}\" }}";
  assert.deepEqual(checarXss(linha(texto)), []);
});

test('html com espaço antes das aspas continua a ser literal', () => {
  const texto = 'dangerouslySetInnerHTML={{ __html:   "texto fixo" }}';
  assert.deepEqual(checarXss(linha(texto)), []);
});

test('html vindo de uma variável é apanhado', () => {
  assert.deepEqual(regras(checarXss(linha('dangerouslySetInnerHTML={{ __html: foto }}'))),
    ['xss/html-injectado']);
});

// ── segredos ─────────────────────────────────────────────────────────────────────

test('um segredo novo com literal é apontado', () => {
  const texto = "const SECRET = 'abc123def456ghi789jkl012';";
  assert.deepEqual(regras(checarSegredos(linha(texto))), ['segredo/literal']);
});

test('vir do ambiente passa', () => {
  assert.deepEqual(checarSegredos(linha('const SECRET = process.env.JWT_SECRET ?? fallback;')), []);
});

test('uma palavra curta em código não é segredo', () => {
  assert.deepEqual(checarSegredos(linha("const TOKEN = 'abc';")), []);
});

// ── paridade do mock ──────────────────────────────────────────────────────────────

test('mexer no mock sem mexer em testes é apontado', () => {
  assert.deepEqual(regras(checarParidadeMock(linha('x', 'student/lib/mock/backend.ts'))),
    ['mock/sem-teste']);
});

test('mexer no mock com testes passa', () => {
  const linhas = [
    { caminho: 'student/lib/mock/backend.ts', linha: 1, texto: 'x' },
    { caminho: 'student/lib/mock/school.test.ts', linha: 1, texto: 'y' },
  ];
  assert.deepEqual(checarParidadeMock(linhas), []);
});

test('mexer só em testes não conta como mexer na lógica', () => {
  assert.deepEqual(checarParidadeMock(linha('x', 'student/lib/mock/school.test.ts')), []);
});

test('mexer fora do mock não dispara', () => {
  assert.deepEqual(checarParidadeMock(linha('x', 'student/lib/school-year.ts')), []);
});

// ── a lista de exclusões ─────────────────────────────────────────────────────────

test('a exclusão é só este ficheiro de testes', () => {
  // Este ficheiro existe para conter exemplos maus. Se a lista crescer, o gate passa a
  // ignorar código que ninguém pediu para ignorar, e é assim que um alarme é desligado
  // sem ninguém decidir que o devia estar desligado.
  assert.deepEqual([...EXCLUIDOS], ['.github/scripts/self-review.test.js']);
});

test('excluir o ficheiro não exclui os restantes', () => {
  const linhas = [
    { caminho: '.github/scripts/self-review.test.js', linha: 1, texto: "redirect('/aluno/inicio');" },
    { caminho: 'student/lib/outro.ts', linha: 1, texto: "redirect('/aluno/inicio');" },
  ];
  // a regra não conhece a lista: quem filtra é o `recolher`
  assert.equal(checarBasePath(linhas).length, 2);
});
