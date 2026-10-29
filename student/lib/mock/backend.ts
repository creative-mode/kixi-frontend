import 'server-only';
export * from './store';
import { currentFault, problem, store, accountIdOf, unauthorized, json, meResponse, hash, loginResponse, type Account, type MockCtx } from './store';
import { friendsRoutes } from './domains/friends';
import { rankingRoutes } from './domains/ranking';
import { feedRoutes } from './domains/feed';
import { profilesRoutes } from './domains/profiles';
import { communityRoutes } from './domains/community';
import { roomsRoutes } from './domains/rooms';
import { tutorRoutes } from './domains/tutor';

export async function mockHandle(
  method: string,
  path: string,
  token: string | null,
  bodyText: string,
): Promise<Response> {
  // Latência simulada por pedido, só para medir (KIXI_MOCK_LATENCY_MS): o backend real não responde em 0 ms.
  const latency = Number(process.env.KIXI_MOCK_LATENCY_MS ?? 0);
  if (latency > 0) await new Promise((resolve) => setTimeout(resolve, latency));
  const fault = currentFault();
  if (fault === 'timeout') throw new TypeError('fetch failed');
  if (fault === '500') {
    return problem(500, 'Injected failure');
  }
  const db = store();
  // `path` may carry a query string, exactly as the real request would: the mock has
  // to filter the same way the backend does, or the screens get exercised against a
  // contract that does not exist.
  const [pathname, rawQuery = ''] = path.split('?');
  const search = new URLSearchParams(rawQuery);
  const filter = (key: string) => {
    const value = search.get(key);
    return value === null || value === '' ? undefined : Number(value);
  };
  const body = bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : {};
  const text = (key: string) => String(body[key] ?? '').trim();
  const accountId = accountIdOf(token);

  // ── public: the two auth routes ─────────────────────────────────────────────
  if (pathname === '/auth/login' && method === 'POST') {
    const key = text('usernameOrEmail');
    if (!key || !body.password) return problem(400, 'usernameOrEmail, password is required');
    const found = db.accounts.find(
      (a) => a.username === key || a.email === key.toLowerCase(),
    );
    if (!found || found.passwordHash !== hash(String(body.password))) {
      return problem(401, 'Invalid username or password');
    }
    if (!found.active) return problem(401, 'Account is inactive');
    return json(loginResponse(found));
  }

  if (pathname === '/auth/register' && method === 'POST') {
    const missing = ['username', 'email', 'password', 'firstName', 'lastName'].filter(
      (key) => !text(key),
    );
    if (missing.length) return problem(400, `${missing.join(', ')} is required`);
    if (String(body.password).length < 8) return problem(400, 'Password must be at least 8 characters');
    const username = text('username');
    const email = text('email').toLowerCase();
    if (db.accounts.some((a) => a.username === username || a.email === email)) {
      return problem(409, 'Username or email already exists');
    }
    const account: Account = {
      id: db.nextAccount++,
      username,
      email,
      passwordHash: hash(String(body.password)),
      roles: ['STUDENT'],
      active: true,
      firstName: text('firstName'),
      lastName: text('lastName'),
      photo: null,
      accessibilityExtraTime: false,
    };
    db.accounts.push(account);
    return json(loginResponse(account), 201);
  }

  // ── everything else needs a live session ───────────────────────────────────
  if (accountId === null) return unauthorized();
  // O backend filtra `active` e `deletedAt` e devolve 404, nao 401: sao estados
  // diferentes para o cliente, que manda para o login num e deixa passar no outro.
  const account = db.accounts.find((a) => a.id === accountId && a.active);
  if (!account) return problem(404, 'Account not found');

  const staff = account.roles.some((role) => role === 'ADMIN' || role === 'TEACHER');

  if (pathname === '/me' && method === 'GET') return json(meResponse(db, account));

  // Gamificação (#118): quem nunca terminou uma simulação não tem XP nenhum, não um
  // 404 — a mesma razão de user_stats não ter linha a menos que algo a tenha criado.
  if (pathname === '/me/stats' && method === 'GET') {
    const stats = db.userStats[account.id] ?? {
      accountId: account.id, xp: 0, level: 1, streak: 0, longestStreak: 0, freePauses: 1,
      lastActivityDate: null,
    };
    return json(stats);
  }

  if (pathname === '/me/badges' && method === 'GET') {
    return json(db.userBadges[account.id] ?? []);
  }

  const ctx: MockCtx = { method, pathname, search, filter, body, text, accountId, account, staff, db };
  for (const domain of [friendsRoutes, rankingRoutes, feedRoutes, profilesRoutes, communityRoutes, roomsRoutes, tutorRoutes]) {
    const response = await domain(ctx);
    if (response) return response;
  }

  return problem(404, `No route for ${method} ${pathname}`);
}

/** Kept for the auth server actions, which post without a session. */
export const mockPost = (path: string, payload: Record<string, unknown>) =>
  mockHandle('POST', path, null, JSON.stringify(payload));
