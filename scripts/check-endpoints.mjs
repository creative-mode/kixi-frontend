#!/usr/bin/env node
// Confirma que o backend de destino expõe os endpoints que a app do aluno chama.
// Foi isto que faltou quando o frontend chegou a PRD a pedir comentários que só existiam na dev do backend.
//
// Uso: node scripts/check-endpoints.mjs <pasta-do-backend>
//   <pasta-do-backend>  checkout do repositório do backend no ramo de destino (dev, qua ou prod)
//
// Lê os controllers (@RequestMapping de classe + @GetMapping/@PostMapping/... de método) e procura cada
// chamada apiGet/apiPost/apiPut/apiDelete com caminho literal em student/. Sai com código 1 se faltar algum.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const backend = process.argv[2];
if (!backend || !existsSync(backend)) {
  console.error('Uso: node scripts/check-endpoints.mjs <pasta-do-backend>');
  process.exit(2);
}

function walk(dir, ok, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name === '.git' || name === 'target') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, ok, out);
    else if (ok(full)) out.push(full);
  }
  return out;
}

const norm = (p) => '/' + p.replace(/\?.*$/, '').split('/').filter(Boolean).map((s) => (/^\{.*\}$|^\$\{.*\}$/.test(s) ? '{}' : s)).join('/');
const strip = (p) => p.replace(/^\/?api\/v1/, '').replace(/^\/?api(?=\/)/, '');

// 1. Endpoints do backend: [método, caminho normalizado, sem /api/v1]
const have = [];
for (const file of walk(backend, (f) => f.endsWith('Controller.java'))) {
  const src = readFileSync(file, 'utf8');
  const quoted = (text) => [...text.matchAll(/"([^"]*)"/g)].map((q) => q[1]);
  // @RequestMapping("/a") ou @RequestMapping({"/api/v1/a", "/api/a"}): vários prefixos são normais aqui
  const classMap = src.match(/@RequestMapping\(([^)]*)\)/);
  const bases = classMap ? quoted(classMap[1]) : [''];
  for (const m of src.matchAll(/@(Get|Post|Put|Patch|Delete)Mapping(?:\(([^)]*)\))?/g)) {
    const subs = m[2] ? quoted(m[2]) : [];
    for (const base of bases.length ? bases : ['']) {
      for (const sub of subs.length ? subs : ['']) have.push([m[1].toUpperCase(), norm(strip(base + (sub ? '/' + sub : '')))]);
    }
  }
}
if (have.length === 0) {
  console.error('Não encontrei nenhum controller em ' + backend);
  process.exit(2);
}
const matches = (want, got) => {
  const a = want.split('/'), b = got.split('/');
  return a.length === b.length && a.every((s, i) => s === b[i] || s === '{}' || b[i] === '{}');
};

// 2. Chamadas do aluno com caminho literal (os do manager montam o caminho em código e ficam de fora)
const calls = new Map();
const root = join(process.cwd(), 'student');
for (const file of walk(root, (f) => /\.(ts|tsx)$/.test(f) && !/\.test\.|\/mock\/|\/e2e\//.test(f))) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/\bapi(Get|Post|Put|Delete|Patch)(?:<[^>(]*>)?\(\s*[`'"]([^`'"]+)[`'"]/g)) {
    const key = m[1].toUpperCase() + ' ' + norm(m[2]);
    if (!calls.has(key)) calls.set(key, relative(process.cwd(), file));
  }
}

const missing = [];
for (const [key, file] of calls) {
  const [method, path] = key.split(' ');
  if (!have.some(([mth, p]) => mth === method && matches(path, p))) missing.push(`${method} ${path}  (${file})`);
}

console.log(`${calls.size} chamadas do aluno, ${have.length} endpoints no backend.`);
if (missing.length) {
  console.error('\nO backend de destino não expõe:\n  ' + missing.join('\n  '));
  process.exit(1);
}
console.log('Todos os endpoints existem.');
