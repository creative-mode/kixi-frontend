/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
 

import { RES, add, db, json, missing, now, problem, strip } from '../store';
import type { MockContext } from './auth';

/** Rotas do domínio «crud» do mock; devolve `undefined` quando o pedido não é deste domínio. */
export async function crudRoutes({ method, path, url, auth, isStaff, readBody, loginResponse, isAdmin, activeInst, writeWorld, denyWrite }: MockContext): Promise<Response | undefined> {
  let m: RegExpMatchArray | null = null;
  void [m, url, auth, isStaff, readBody, loginResponse, isAdmin, activeInst, writeWorld, denyWrite];
  // ── generic CRUD (/api/v1/<resource>) ──
  m = path.match(/^\/api\/v1\/([a-z-]+)(?:\/(trash|active|[^/]+?))?(?:\/(restore|purge|login))?$/);
  const def = m && RES[m[1]];
  if (def) {
    const keyField = def.key ?? 'id';
    const rows = db[def.table];
    const seg = m[2];
    const act = m[3];
    const out = (r) => (def.table === 'accounts' ? strip(r) : def.table === 'teachers' ? { ...r, hasAccess: !!r.accountId } : r);
    if (!seg && method === 'GET') return json(200, rows.filter((r) => !r.deletedAt).map(out));
    if (seg === 'trash' && method === 'GET') return json(200, rows.filter((r) => r.deletedAt).map(out));
    if (seg === 'active' && def.table === 'accounts' && method === 'GET') return json(200, rows.filter((r) => !r.deletedAt && r.active === (url.searchParams.get('active') !== 'false')).map(out));
    if (!seg && method === 'POST') {
      if (def.readOnly) return problem(405, 'Method not allowed');
      const b = readBody();
      const miss = missing(b, def.req);
      if (miss.length) return problem(400, `${miss.join(', ')} is required`);
      // validação (400) e conflito de unicidade (409) têm estados próprios.
      const verr = def.validate?.(b);
      if (verr) return problem(400, verr);
      const rerr = def.rule?.(b);
      if (rerr) return problem(rerr.status, rerr.message);
      const uerr = def.unique?.(b, null);
      if (uerr) return problem(409, uerr);
      if (def.key && rows.some((r) => !r.deletedAt && r[def.key] === b[def.key])) return problem(409, `${def.key} already exists`);
      return json(201, out(add(def.table, { ...(def.defaults ?? {}), ...def.pick(b) })));
    }
    const row = rows.find((r) => String(r[keyField]) === decodeURIComponent(seg ?? ''));
    if (!row) return problem(404, `${m[1]} not found`);
    if (!act && method === 'GET') return row.deletedAt ? problem(404, `${m[1]} not found`) : json(200, out(row));
    if (!act && method === 'PUT') {
      if (def.noUpdate || def.readOnly) return problem(405, 'Method not allowed');
      const b = readBody();
      const miss = missing(b, def.req);
      if (miss.length) return problem(400, `${miss.join(', ')} is required`);
      const verr2 = def.validate?.(b);
      if (verr2) return problem(400, verr2);
      const rerr2 = def.rule?.(b);
      if (rerr2) return problem(rerr2.status, rerr2.message);
      const guard2 = def.updateGuard?.(b, row);
      if (guard2) return problem(409, guard2);
      const uerr2 = def.unique?.(b, row.id);
      if (uerr2) return problem(409, uerr2);
      Object.assign(row, def.pick(b), { updatedAt: now() });
      return json(200, out(row));
    }
    if (!act && method === 'DELETE') { row.deletedAt = now(); return json(204); }
    if (act === 'restore' && method === 'POST') { row.deletedAt = null; return json(204); }
    if (act === 'purge' && method === 'DELETE') { db[def.table] = rows.filter((r) => r !== row); return json(204); }
    if (act === 'login' && method === 'POST') { row.lastLogin = now(); return json(200, out(row)); }
  }
  return undefined;
}
