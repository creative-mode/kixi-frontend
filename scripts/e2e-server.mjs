// Arranca a stack de E2E a partir de builds já feitos: três `next start` e o gateway.
//
// Na CI os builds são passos explícitos do workflow (`.github/workflows/e2e.yml`);
// aqui só se levantam os processos. Assim o prazo do `webServer` do Playwright cobre
// segundos de arranque, e não os ~25 min de um `docker compose up --build` a frio.
// O compose continua a ser o caminho local (`playwright.config.ts`).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const APPS = [
  { name: 'landing', dir: 'landing', port: 3004, path: '/' },
  { name: 'aluno', dir: 'student', port: 3003, path: '/aluno/entrar' },
  { name: 'manager', dir: '.', port: 3002, path: '/manager/login' },
];

const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const { child } of children) child.kill('SIGTERM');
  const killTimer = setTimeout(() => {
    for (const { child } of children) child.kill('SIGKILL');
    process.exit(code);
  }, 5_000);
  killTimer.unref();
  Promise.all(
    children.map(
      ({ child }) =>
        new Promise((resolve) => (child.exitCode !== null || child.signalCode !== null ? resolve() : child.once('exit', resolve))),
    ),
  ).then(() => process.exit(code));
}

function start(name, command, args, options) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
  const tag = (data) =>
    String(data)
      .split('\n')
      .filter(Boolean)
      .forEach((line) => console.log(`[${name}] ${line}`));
  child.stdout.on('data', tag);
  child.stderr.on('data', tag);
  child.on('exit', (code, signal) => {
    if (stopping) return;
    console.error(`[${name}] terminou inesperadamente (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
    stop(code === 0 ? 1 : (code ?? 1));
  });
  children.push({ name, child });
  return child;
}

async function waitFor(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (stopping) return false;
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status < 500) return true;
    } catch {
      // ainda a arrancar
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function main() {
  for (const app of APPS) {
    const nextBin = path.join(root, app.dir, 'node_modules', 'next', 'dist', 'bin', 'next');
    if (!existsSync(nextBin)) {
      console.error(`[e2e] ${app.name}: falta node_modules/next — corre \`npm ci\` em ${app.dir === '.' ? 'a raiz' : app.dir}.`);
      return stop(1);
    }
    start(app.name, process.execPath, [nextBin, 'start', '-p', String(app.port)], {
      cwd: path.join(root, app.dir),
      // APP_ORIGIN é obrigatório em produção e é o que o compose também define:
      // os redirects entre apps não podem sair dos cabeçalhos do pedido.
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(app.port),
        HOSTNAME: '127.0.0.1',
        APP_ORIGIN: process.env.APP_ORIGIN ?? 'http://localhost:3000',
      },
    });
  }

  for (const app of APPS) {
    const url = `http://127.0.0.1:${app.port}${app.path}`;
    if (!(await waitFor(url))) {
      console.error(`[e2e] ${app.name}: tempo esgotado à espera de ${url}`);
      return stop(1);
    }
    console.log(`[e2e] ${app.name} pronta em ${url}`);
  }

  // O gateway só sobe depois das apps: quando o Playwright vê o /healthz, a stack
  // já responde, e não há 502 na primeira navegação dos testes.
  start('gateway', process.execPath, ['scripts/gateway.mjs'], {
    cwd: root,
    env: {
      ...process.env,
      PORT: '3000',
      MANAGER_HOST: '127.0.0.1',
      MANAGER_PORT: '3002',
      STUDENT_HOST: '127.0.0.1',
      STUDENT_PORT: '3003',
      LANDING_HOST: '127.0.0.1',
      LANDING_PORT: '3004',
    },
  });
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

await main();
