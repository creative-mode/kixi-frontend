/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
import 'server-only';
// In-process stand-in for the Spring Boot backend: the manager runs with no network and no database.
// O estado e os auxiliares vivem em ./store; as rotas, por domínio, em ./domains. Aqui só se despacha.
import { db, json, problem, authorize, sign, verify, requestHelpers } from './store';
import { authRoutes, type MockContext } from './domains/auth';
import { institutionRoutes } from './domains/institutions';
import { statementRoutes } from './domains/statements';
import { roomAndSimulationRoutes } from './domains/rooms-and-simulations';
import { academicRoutes } from './domains/academic';
import { crudRoutes } from './domains/crud';
import { termSheetRoutes } from './domains/term-sheets';
import { termPlanRoutes } from './domains/term-plans';
import { coordinationRoutes } from './domains/coordination';

export async function handle(method: string, rawUrl: string, authorization: string | null, bodyText: string): Promise<Response> {
  const url = new URL(rawUrl, 'http://x');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (method === 'OPTIONS') return json(204);
  if (path === '/actuator/health') return json(200, { status: 'UP' });

  const header = authorization ?? '';
  const auth = header.startsWith('Bearer ') ? verify(header.slice(7)) : null;
  const status = authorize(auth, method, path);
  if (status !== 200) return problem(status, status === 401 ? 'Unauthorized' : 'Forbidden');
  const readBody = (): any => { try { return bodyText ? JSON.parse(bodyText) : {}; } catch { return {}; } };
  const isStaff = (auth?.roles ?? []).some((r) => r === 'ADMIN' || r === 'TEACHER');

  const loginResponse = (acc) => {
    const roles = db.accountRoles.filter((r) => r.accountId === acc.id).map((r) => db.roles.find((x) => x.id === r.roleId)?.name).filter(Boolean);
    const exp = Math.floor(Date.now() / 1000) + 86400;
    return { accessToken: sign({ sub: String(acc.id), roles, iat: Math.floor(Date.now() / 1000), exp }), tokenType: 'Bearer', expiresAt: new Date(exp * 1000).toISOString(), accountId: acc.id, roles };
  };

  try {
    const ctx: MockContext = { method, path, url, auth, isStaff, readBody, loginResponse, ...requestHelpers(auth) };
    for (const domain of [authRoutes, institutionRoutes, statementRoutes, roomAndSimulationRoutes, academicRoutes, termSheetRoutes, termPlanRoutes, coordinationRoutes, crudRoutes]) {
      const response = await domain(ctx);
      if (response) return response;
    }
    return problem(404, `No route for ${method} ${path}`);
  } catch (e) {
    console.error(e);
    return problem(500, 'Internal error');
  }
}
