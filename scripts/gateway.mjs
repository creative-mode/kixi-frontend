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

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('ok');
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
