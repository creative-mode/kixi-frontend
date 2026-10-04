import 'server-only';
import crypto from 'node:crypto';

/** In-process stand-in for POST /auth/login and /auth/register: the aluno app needs no backend while we design.
 *  Same contract as the real API (LoginResponse, RFC 9457-style errors, HS256 JWT with `sub` + `roles`).
 *  The secret matches the manager's, so an ADMIN who signs in here is accepted there. */
export const MOCK = process.env.KIXI_MOCK !== 'false';

const SECRET = process.env.JWT_SECRET ?? 'default-secret-change-in-production-min-256-bits';
const SEED_PASSWORD = 'Kixi1234!';

type Account = { id: number; username: string; email: string; passwordHash: string; roles: string[]; active: boolean };
const G = globalThis as unknown as { __kixiStudentMock?: { accounts: Account[]; next: number } };

const hash = (pw: string) => crypto.createHash('sha256').update(`kixi:${pw}`).digest('hex');
const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');

function store() {
  if (!G.__kixiStudentMock) {
    const seed = (id: number, username: string, email: string, role: string): Account => ({ id, username, email, passwordHash: hash(SEED_PASSWORD), roles: [role], active: true });
    G.__kixiStudentMock = { accounts: [seed(1, 'admin', 'admin@kixi.ao', 'ADMIN'), seed(2, 'professor', 'professor@kixi.ao', 'TEACHER'), seed(3, '12345', 'aluno@kixi.ao', 'STUDENT')], next: 4 };
  }
  return G.__kixiStudentMock;
}

function loginResponse(acc: Account) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 86400;
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ sub: String(acc.id), roles: acc.roles, iat, exp });
  const sig = crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return { accessToken: `${head}.${body}.${sig}`, tokenType: 'Bearer', expiresAt: new Date(exp * 1000).toISOString(), accountId: acc.id, roles: acc.roles };
}

const problem = (status: number, detail: string) => Response.json({ type: null, title: null, status, detail, properties: null }, { status });

export async function mockPost(path: string, payload: Record<string, unknown>): Promise<Response> {
  const s = store();
  const text = (k: string) => String(payload[k] ?? '').trim();

  if (path === '/auth/login') {
    const key = text('usernameOrEmail');
    if (!key || !payload.password) return problem(400, 'usernameOrEmail, password is required');
    const acc = s.accounts.find((a) => a.username === key || a.email === key.toLowerCase());
    if (!acc || acc.passwordHash !== hash(String(payload.password))) return problem(400, 'Invalid username or password');
    if (!acc.active) return problem(400, 'Account is inactive');
    return Response.json(loginResponse(acc));
  }

  if (path === '/auth/register') {
    const missing = ['username', 'email', 'password', 'firstName', 'lastName'].filter((k) => !text(k));
    if (missing.length) return problem(400, `${missing.join(', ')} is required`);
    if (String(payload.password).length < 8) return problem(400, 'Password must be at least 8 characters');
    const username = text('username');
    const email = text('email').toLowerCase();
    if (s.accounts.some((a) => a.username === username || a.email === email)) return problem(409, 'Username or email already exists');
    const acc: Account = { id: s.next++, username, email, passwordHash: hash(String(payload.password)), roles: ['STUDENT'], active: true };
    s.accounts.push(acc);
    return Response.json(loginResponse(acc), { status: 201 });
  }

  return problem(404, `No route for POST ${path}`);
}
