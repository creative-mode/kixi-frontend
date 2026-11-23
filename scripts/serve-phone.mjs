// Stack de demonstração na rede local, para testar no telemóvel (#799).
//
//   node scripts/serve-phone.mjs
//
// Usa as builds já feitas (as mesmas do e2e) e imprime o URL da máquina na Wi-Fi, as
// credenciais e o painel de métricas. `KIXI_VITALS_LOG=true` liga o coletor local; o
// evento continua a ir para o GA4 quando houver `NEXT_PUBLIC_GA_ID`.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import https from 'node:https';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PHONE_PORT ?? 3100);
const lan = Object.values(networkInterfaces()).flat()
  .find((entry) => entry && entry.family === 'IPv4' && !entry.internal)?.address;
const origin = `https://${lan ?? 'localhost'}:${port}`;

// O cookie de sessão é `Secure` em produção; por HTTP numa rede local o browser
// descarta-o e o login não se mantém. Um certificado local resolve-o (#799).
const demo = path.join(root, '.demo');
const cert = path.join(demo, 'phone-cert.pem');
const key = path.join(demo, 'phone-key.pem');
if (!existsSync(cert) || !existsSync(key)) {
  mkdirSync(demo, { recursive: true });
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '30',
    '-keyout', key, '-out', cert,
    '-subj', `/CN=${lan ?? 'localhost'}`,
    '-addext', `subjectAltName=IP:${lan ?? '127.0.0.1'},IP:127.0.0.1,DNS:localhost`,
  ], { stdio: 'ignore' });
}

const APPS = [
  { name: 'landing', dir: 'landing', port: 3014, build: 'landing/.next/BUILD_ID' },
  { name: 'aluno', dir: 'student', port: 3013, build: 'student/.next/BUILD_ID' },
  { name: 'gestor', dir: '.', port: 3012, build: '.next/BUILD_ID' },
];

const missing = APPS.filter((app) => !existsSync(path.join(root, app.build)));
if (missing.length) {
  console.error('Faltam builds: ' + missing.map((app) => app.name).join(', '));
  console.error('Corre:');
  console.error('  npm run build && npm --prefix student run build');
  console.error('  NEXT_PUBLIC_MANAGER_URL=https://manager.e2e.invalid npm --prefix landing run build');
  process.exit(1);
}

const env = {
  ...process.env,
  NODE_ENV: 'production',
  JWT_SECRET: process.env.JWT_SECRET ?? 'phone-demo-secret-that-is-at-least-32-characters',
  KIXI_MOCK: 'true',
  KIXI_ALLOW_MOCK_IN_PROD: 'true',
  KIXI_VITALS_LOG: 'true',
  APP_ORIGIN: origin,
  PUBLIC_ORIGINS: process.env.PUBLIC_ORIGINS ?? 'kixi.creativemode.ao',
};

const children = [];
const start = (name, args, cwd, extra = {}) => {
  const child = spawn(process.execPath, args, { cwd, env: { ...env, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (data) => process.stdout.write(`[${name}] ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`[${name}] ${data}`));
  child.on('exit', (code) => {
    if (code !== 0) console.error(`[${name}] saiu com ${code}`);
  });
  children.push(child);
};

for (const app of APPS) {
  start(app.name, [path.join(root, app.dir, 'node_modules/next/dist/bin/next'), 'start', '-p', String(app.port)],
    path.join(root, app.dir), { PORT: String(app.port), HOSTNAME: '127.0.0.1' });
}
start('gateway', ['scripts/gateway.mjs'], root, {
  PORT: String(port),
  MANAGER_PORT: '3012',
  STUDENT_PORT: '3013',
  LANDING_PORT: '3014',
  TLS_CERT: cert,
  TLS_KEY: key,
});

const stop = () => {
  for (const child of children) child.kill('SIGTERM');
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

async function wait(url) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status < 500) return true;
    } catch {
      // ainda a arrancar
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}

/** O certificado é nosso e local: para a espera, não vale a pena validá-lo. */
function waitTls(url) {
  return new Promise((resolve) => {
    const request = https.get(url, { rejectUnauthorized: false }, (response) => {
      response.resume();
      resolve((response.statusCode ?? 500) < 500);
    });
    request.setTimeout(2_000, () => { request.destroy(); resolve(false); });
    request.on('error', () => resolve(false));
  });
}

for (const [name, url, secure] of [
  ['gestor', 'http://127.0.0.1:3012/manager/login', false],
  ['aluno', 'http://127.0.0.1:3013/aluno/entrar', false],
  ['landing', 'http://127.0.0.1:3014/', false],
  ['gateway', `https://127.0.0.1:${port}/healthz`, true],
]) {
  const ready = secure ? await waitTls(url) : await wait(url);
  if (!ready) {
    console.error(`[stack] ${name} não arrancou (${url})`);
    stop();
  }
}

console.log(`
Telemóvel (mesma Wi-Fi): ${origin}/aluno/entrar
Aluno: 12345 / Kixi1234!
Painel de métricas:     ${origin}/aluno/metricas

No telemóvel aceita o aviso de certificado (Avançado -> Continuar) uma vez.
Aceita os cookies, navega no Início/Provas/Resultado e abre o painel.
Ctrl+C para parar.
`);
