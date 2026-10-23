// Um só endereço para os três apps (http://localhost:3000):
//   /manager*  -> manager  (:3002)
//   /aluno*    -> aluno    (:3003)
//   tudo o resto -> landing (:3004)
import http from 'node:http';
import net from 'node:net';

const PORT = Number(process.env.PORT ?? 3000);
// Em Docker cada app é um contentor: MANAGER_HOST=manager, STUDENT_HOST=student, LANDING_HOST=landing.
const ROUTES = [
  { prefix: '/manager', host: process.env.MANAGER_HOST ?? '127.0.0.1', port: Number(process.env.MANAGER_PORT ?? 3002) },
  { prefix: '/aluno', host: process.env.STUDENT_HOST ?? '127.0.0.1', port: Number(process.env.STUDENT_PORT ?? 3003) },
];
const LANDING = { host: process.env.LANDING_HOST ?? '127.0.0.1', port: Number(process.env.LANDING_PORT ?? 3004) };

const pick = (url = '/') => {
  const hit = ROUTES.find((r) => url === r.prefix || url.startsWith(r.prefix + '/') || url.startsWith(r.prefix + '?'));
  return hit ?? LANDING;
};

const forwarded = (req) => ({
  ...req.headers,
  'x-forwarded-host': req.headers.host,
  // atrás de um proxy TLS (nginx, Caddy, Traefik) mantém o protocolo original
  'x-forwarded-proto': req.headers['x-forwarded-proto'] ?? 'http',
});

// Cabeçalhos de segurança, definidos só aqui para as três apps ficarem iguais.
// A CSP começa em modo "só relatório": mostra no console o que partiria sem bloquear nada.
// Passa a bloqueio com CSP_ENFORCE=true quando o relatório estiver limpo (docs/seguranca.md).
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
  "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com",
].join('; ');
const CSP_HEADER = process.env.CSP_ENFORCE === 'true' ? 'content-security-policy' : 'content-security-policy-report-only';

const securityHeaders = (req) => {
  const h = {
    [CSP_HEADER]: CSP,
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'permissions-policy': 'camera=(self), microphone=(), geolocation=(), payment=()',
  };
  if ((req.headers['x-forwarded-proto'] ?? '') === 'https') h['strict-transport-security'] = 'max-age=31536000; includeSubDomains';
  return h;
};


// Quem já tem sessão não precisa de ver a landing: `/` leva direto para a app certa.
// Só lê o cookie para decidir o destino (não verifica a assinatura: as apps verificam-na a sério);
// um cookie falso apenas troca a landing por um ecrã de entrada.
const sessionHome = (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return null;
  const path = (req.url ?? '/').split('?')[0];
  if (path !== '/') return null;
  const raw = /(?:^|;\s*)auth_token=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
  if (!raw) return null;
  try {
    const payload = JSON.parse(Buffer.from(decodeURIComponent(raw).split('.')[1], 'base64url').toString('utf8'));
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return null;
    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    if (roles.includes('ADMIN') || roles.includes('TEACHER')) return '/manager';
    if (roles.includes('STUDENT')) return '/aluno/inicio';
  } catch {
    // cookie ilegível: segue para a landing
  }
  return null;
};

// As rotas internas das apps (o aviso do gestor ao aluno, #389) falam entre contentores, nunca pelo gateway.
// A rota valida a assinatura de qualquer forma; isto só garante que de fora nem se chega lá.
const isInternal = (url = '/') => {
  let path = url.split('?')[0];
  try { path = decodeURIComponent(path); } catch { return true; }
  return /^\/aluno\/+api\/+internal(\/|$)/i.test(path.replace(/\/{2,}/g, '/'));
};

const server = http.createServer((req, res) => {
  for (const [k, v] of Object.entries(securityHeaders(req))) res.setHeader(k, v);
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('ok');
  }
  if (isInternal(req.url)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Não encontrado.');
  }
  const home = sessionHome(req);
  if (home) {
    res.writeHead(302, { location: home, 'cache-control': 'private, no-store', vary: 'Cookie' });
    return res.end();
  }
  const t = pick(req.url);
  const up = http.request({ host: t.host, port: t.port, method: req.method, path: req.url, headers: forwarded(req) }, (r) => {
    res.writeHead(r.statusCode ?? 502, r.headers);
    r.pipe(res);
  });
  up.on('error', () => {
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Esta parte do Kixi ainda está a arrancar. Tenta outra vez daqui a pouco.');
  });
  req.pipe(up);
});

// HMR (websocket) dos três apps
server.on('upgrade', (req, socket, head) => {
  const t = pick(req.url);
  const up = net.connect(t.port, t.host, () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    up.write(lines.join('\r\n') + '\r\n\r\n');
    if (head?.length) up.write(head);
    socket.pipe(up).pipe(socket);
  });
  up.on('error', () => socket.destroy());
  socket.on('error', () => up.destroy());
});

server.listen(PORT, () => console.log(`Kixi: http://localhost:${PORT}  (landing /, aluno /aluno, gestor /manager)`));
