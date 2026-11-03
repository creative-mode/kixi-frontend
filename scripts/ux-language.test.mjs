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
// Só frases que não deixam dúvida: «Fecha às», «Abre-se» ou «Escolha múltipla» não são imperativos.
test('cada superfície usa um só registo: gestor formal, aluno e landing por tu', () => {
  const surfaces = [
    { roots: ['app', 'components', 'lib'], wrong: /\b(?:Tenta|Inicia sessão|Entra novamente|Escreve para|Contacta|Podes|Verifica (?:o|a)|Volta (?:a|ao)|A tua|O teu)\b/u },
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
  const schoolYearForm = read('components/school-year/school-year-form.tsx');
  assert.match(login, /<Label htmlFor="usernameOrEmail">Nome de utilizador ou e-mail<\/Label>/);
  assert.doesNotMatch(login, /Username ou email/);
  assert.match(login, /Sessão iniciada com sucesso/);
  assert.match(schoolYearForm, /A atualizar\.\.\./);
  assert.match(schoolYearForm, /A adicionar\.\.\./);
});

test('o conceito do menu do aluno usa sempre Ranking e a navegação móvel tem rótulos', () => {
  const shell = read('student/components/Shell.tsx');
  const ranking = read('student/app/(app)/ranking/page.tsx');
  const rail = read('student/components/right-rail.tsx');
  assert.match(shell, /href: '\/ranking', label: 'Ranking'/);
  assert.match(ranking, /title: 'Ranking · Kixi'/);
  assert.match(rail, /linkLabel="Ranking"/);
  // 4 colunas (#704) e o rótulo inteiro, sem `truncate`: a 320 px «Ranking» cabe numa coluna.
  assert.match(shell, /grid-cols-4/);
  assert.match(shell, /<span className="text-\[11px\] leading-tight">\{it\.label\}<\/span>/);
  assert.match(shell, /aria-current=\{on\(it\) \? 'page' : undefined\}/);
  assert.match(shell, /aria-\[current=page\]:font-semibold/);
  assert.match(shell, /aria-\[current=page\]:bg-primary\/10/);
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
