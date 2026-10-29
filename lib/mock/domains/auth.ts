/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */

import { add, db, hash, json, missing, now, problem, roleId } from '../store';

export type MockContext = {
  method: string; path: string; url: URL; auth: any; isStaff: boolean; readBody: () => any; loginResponse: (acc: any) => any;
  isAdmin: boolean; activeInst: (id: any) => any; writeWorld: () => any; denyWrite: (st: any) => Response | null;
};

/** Rotas do domínio «auth» do mock; devolve `undefined` quando o pedido não é deste domínio. */
export async function authRoutes({ method, path, url, auth, isStaff, readBody, loginResponse, isAdmin, activeInst, writeWorld, denyWrite }: MockContext): Promise<Response | undefined> {
  void [url, auth, isStaff, readBody, loginResponse, isAdmin, activeInst, writeWorld, denyWrite];
  // ── auth ──
  if (path === '/api/v1/auth/login' && method === 'POST') {
    const b = readBody();
    const m = missing(b, ['usernameOrEmail', 'password']);
    if (m.length) return problem(400, `${m.join(', ')} is required`);
    const key = String(b.usernameOrEmail).trim();
    const acc = db.accounts.find((a) => !a.deletedAt && (a.username === key || a.email === key.toLowerCase()));
    if (!acc || acc.passwordHash !== hash(b.password)) return problem(400, 'Invalid username or password');
    if (!acc.active) return problem(400, 'Account is inactive');
    acc.lastLogin = now();
    return json(200, loginResponse(acc));
  }
  if (path === '/api/v1/auth/register' && method === 'POST') {
    const b = readBody();
    const m = missing(b, ['username', 'email', 'password', 'firstName', 'lastName']);
    if (m.length) return problem(400, `${m.join(', ')} is required`);
    if (String(b.password).length < 8) return problem(400, 'Password must be at least 8 characters');
    const username = String(b.username).trim();
    const email = String(b.email).trim().toLowerCase();
    if (db.accounts.some((a) => !a.deletedAt && (a.username === username || a.email === email))) return problem(409, 'Username or email already exists');
    const acc = add('accounts', { username, email, passwordHash: hash(b.password), emailVerified: false, active: true, lastLogin: now() });
    db.accountRoles.push({ accountId: acc.id, roleId: roleId('STUDENT') });
    add('users', { accountId: acc.id, firstName: String(b.firstName).trim(), lastName: String(b.lastName).trim(), photo: null });
    return json(201, loginResponse(acc));
  }


  // ── account roles ──
  let m = path.match(/^\/api\/v1\/accounts\/(\d+)\/roles(?:\/(\d+))?$/);
  if (m) {
    const accountId = Number(m[1]);
    if (method === 'GET') {
      return json(200, db.accountRoles.filter((r) => r.accountId === accountId).map((r) => db.roles.find((x) => x.id === r.roleId)));
    }
    const rid = Number(m[2]);
    if (method === 'POST') {
      if (!db.accountRoles.some((r) => r.accountId === accountId && r.roleId === rid)) db.accountRoles.push({ accountId, roleId: rid });
      return json(204);
    }
    if (method === 'DELETE') {
      db.accountRoles = db.accountRoles.filter((r) => !(r.accountId === accountId && r.roleId === rid));
      return json(204);
    }
  }
  if ((m = path.match(/^\/api\/v1\/users\/(\d+)\/with-account$/)) && method === 'GET') {
    const u = db.users.find((x) => x.id === Number(m[1]) && !x.deletedAt);
    if (!u) return problem(404, 'User not found');
    const a = db.accounts.find((x) => x.id === u.accountId);
    const rest = { ...u };
    delete rest.accountId;
    return json(200, { ...rest, account: a ? { id: a.id, username: a.username, email: a.email } : null });
  }


  return undefined;
}
