import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const uiRoots = [
  'app', 'components', 'lib',
  'student/app', 'student/components', 'student/lib',
  'landing/app', 'landing/components', 'landing/lib',
];

function sourceFiles(directory) {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (/\.(?:ts|tsx)$/.test(entry.name) && !/\.test\.(?:ts|tsx)$/.test(entry.name)) return [path];
    return [];
  });
}

function read(path) {
  return readFileSync(join(root, path), 'utf8');
}

const allUiSource = uiRoots.flatMap(sourceFiles);

/** Os textos que chegam à interface: a árvore sintática exclui comentários e documentação e preserva os valores
 *  reais de JSX, atributos acessíveis, mensagens e metadados. */
function uiTexts(path) {
  const file = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const texts = [];
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node)) texts.push(node.text);
    if (ts.isTemplateExpression(node)) {
      texts.push(node.head.text);
      for (const span of node.templateSpans) texts.push(span.literal.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return texts;
}

// Âmbito: o texto que chega à interface (literais, JSX e atributos). Comentários e documentação ficam fora de
// propósito, para um comentário poder citar o termo antigo; estão limpos à mão, não por este teste.
test('a cópia da interface não reintroduz termos assinalados na Issue #511', () => {
  const forbidden = [
    /\b(?:você|senha|salvar|reciclagem|buke|ano\s+lectivo|tem\s+certeza)\b/iu,
    /\bClose\b/u,
  ];
  const hits = [];

  for (const path of allUiSource) {
    for (const text of uiTexts(path)) {
      if (forbidden.some((pattern) => pattern.test(text))) hits.push(`${relative(root, join(root, path))}: ${text.trim()}`);
    }
  }
  assert.deepEqual(hits, [], `termos proibidos encontrados:\n${hits.join('\n')}`);
});

// Um registo por superfície: o gestor trata por «você» (formal), o aluno e a landing por «tu».
// O «tu» do gestor apanha-se em duas partes, sem distinguir maiúsculas:
// - formas que só existem na 2.ª pessoa, em qualquer sítio da frase («Precisas», «podes», «a tua», «Confirma?»);
// - imperativos que também são 3.ª pessoa («entra», «guarda», «volta»), só no início de uma frase: «o professor
//   entra na plataforma» ou «Bem-vindo de volta» não são tratamento. «Abre»/«Fecha» ficam de fora («Abre às 10:00»).
const LETTER = '\\p{L}';
const TU_ANYWHERE = new RegExp(`(?<![${LETTER}-])(?:precisas|podes|tens|queres|sabes|deves|estás|vais|consegues|entras|contigo|a tua|o teu|as tuas|os teus|tua|teu)(?![${LETTER}-])|(?<![${LETTER}])confirma\\?`, 'iu');
const TU_SENTENCE_START = new RegExp(`(?:^|[.!?:]\\s+)(?:entra|guarda|escolhe|toca|indica|tenta|inicia|verifica|volta|contacta|escreve|confirma|clica|carrega|faz|vê|seleciona|introduz|aguarda|preenche|adiciona|cria|experimenta|pede|revê|corrige|atualiza|recarrega|insere)(?![${LETTER}-])`, 'iu');
const managerUsesTu = (text) => TU_ANYWHERE.test(text.trim()) || TU_SENTENCE_START.test(text.trim());

test('a regra do gestor apanha o tratamento por tu e deixa passar a 3.ª pessoa', () => {
  // As frases que já escaparam a uma versão anterior da regra (revisão do #681).
  for (const tu of [
    'Esta sessão não dá acesso ao Kixi Manager. Entra com outra conta.',
    'Precisas de iniciar sessão para continuar.',
    'Guarda as alterações, aprova e publica no catálogo do aluno',
    'Revogar o selo tira o símbolo de verificada a esta escola e aos seus professores. Confirma?',
    // Pedaço de template a seguir a `${...}` (lib/moderation/model.ts): é assim que a árvore sintática o vê.
    ' escreve uma nota com pelo menos ',
    'A tua sessão expirou.',
    'Podes continuar a escrever a fórmula em LaTeX.',
  ]) assert.ok(managerUsesTu(tu), `devia apanhar: ${tu}`);
  for (const formal of [
    'Entre com outra conta.',
    'Precisa de iniciar sessão para continuar.',
    'Confirme a revogação.',
    'Com acesso, o professor entra na plataforma e monta provas.',
    'Bem-vindo de volta',
    'Estilo removido: o tutor volta ao modo padrão.',
    'Prova guardada. Continua oculta até a publicar.',
    'Abre às',
    'Escolha múltipla',
    'Confirmação',
  ]) assert.ok(!managerUsesTu(formal), `não devia apanhar: ${formal}`);
});

test('cada superfície usa um só registo: gestor formal, aluno e landing por tu', () => {
  const surfaces = [
    { roots: ['app', 'components', 'lib'], wrong: { test: managerUsesTu } },
    {
      roots: ['student/app', 'student/components', 'student/lib', 'landing/app', 'landing/components', 'landing/lib'],
      wrong: /\b(?:Tente|Inicie sessão|Verifique|Volte|Contacte|Escreva|Selecione|Introduza|Aguarde|Clique|Peça|Preencha|Indique|Recarregue|Confirme|A sua sessão|Pode continuar)\b/u,
    },
  ];
  const hits = [];
  for (const { roots, wrong } of surfaces) {
    for (const path of roots.flatMap(sourceFiles)) {
      for (const text of uiTexts(path)) if (wrong.test(text)) hits.push(`${path}: ${text.trim()}`);
    }
  }
  assert.deepEqual(hits, [], `registo misturado:\n${hits.join('\n')}`);
});

test('o controlo de fecho dos diálogos tem nome acessível em português', () => {
  const dialog = read('components/ui/dialog.tsx');
  assert.match(dialog, /<span className="sr-only">Fechar<\/span>/);
  assert.doesNotMatch(dialog, /<span className="sr-only">Close<\/span>/i);
});

test('o login e o estado de carregamento do gestor usam cópia PT-AO', () => {
  const login = read('app/login/page.tsx');
  // O ano letivo usa o formulário genérico (#510): a cópia do carregamento vem do CrudForm.
  const crudForm = read('components/crud/crud-form.tsx');
  assert.match(login, /<Label htmlFor="usernameOrEmail">Nome de utilizador ou e-mail<\/Label>/);
  assert.doesNotMatch(login, /Username ou email/);
  assert.match(login, /Sessão iniciada com sucesso/);
  for (const page of ['app/school-year/new/page.tsx', 'app/school-year/[id]/edit/page.tsx']) {
    assert.match(read(page), /<CrudForm entityKey="school-years"/, page);
  }
  assert.match(crudForm, /'A guardar…'/);
  assert.doesNotMatch(crudForm, /Atualizando|Adicionando|Salvando/);
});

test('o menu do aluno chama «Turma» ao destino do ranking e a navegação móvel tem rótulos', () => {
  const shell = read('student/components/Shell.tsx');
  const ranking = read('student/app/(app)/ranking/page.tsx');
  // Nova experiência (#729): o item do menu é «Turma» (/turma); o ranking continua em /ranking, com o seu nome.
  assert.match(shell, /href: '\/turma', label: 'Turma'/);
  assert.match(shell, /also: \['\/ranking'/);
  assert.match(ranking, /title: 'Ranking · Kixi'/);
  // A coluna da direita só tem os temas e o calendário: o ranking chega-se pela «Turma» (Médias).
  // 4 colunas (#704) e o rótulo inteiro, visível, sem `truncate`.
  assert.match(shell, /grid-cols-4/);
  assert.doesNotMatch(shell, /truncate/);
  assert.match(shell, /<NavIcon name=\{it\.icon\} active=\{on\(it\)\} size=\{24\} \/>\s*\{it\.label\}/);
  assert.match(shell, /aria-current=\{on\(it\) \? 'page' : undefined\}/);
  assert.match(shell, /aria-\[current=page\]:font-bold/);
});

test('idioma das aplicações, manifest e Open Graph identificam português de Angola', () => {
  for (const path of ['app/layout.tsx', 'app/global-error.tsx', 'student/app/layout.tsx', 'student/app/global-error.tsx', 'landing/app/layout.tsx', 'landing/app/global-error.tsx']) {
    assert.match(read(path), /<html lang="pt-AO"/u, path);
  }
  assert.equal(JSON.parse(read('public/manifest.json')).lang, 'pt-AO');
  assert.match(read('scripts/icons.mjs'), /lang: 'pt-AO'/);
  assert.match(read('landing/app/layout.tsx'), /locale: 'pt_AO'/);
});

test('os skip links têm acentuação e apontam para conteúdo focável', () => {
  const cases = [
    ['components/auth-layout.tsx', 'Saltar para o conteúdo'],
    ['student/components/Shell.tsx', 'Saltar para o conteúdo'],
    ['landing/components/legal/LegalPage.tsx', 'Saltar para o conteúdo'],
  ];
  for (const [path, label] of cases) {
    const source = read(path);
    assert.ok(source.includes(label), `${path}: falta o rótulo acentuado`);
    assert.match(source, /href="#conteudo"/);
    assert.match(source, /id="conteudo"/);
    assert.match(source, /tabIndex=\{-1\}/);
  }
});
