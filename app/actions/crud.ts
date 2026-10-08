'use server';

import { revalidatePath } from 'next/cache';
import { getAuthHeaders } from '@/lib/auth.server';
import { API_HOST } from '@/lib/constants';
import { ENTITIES, type EntityKey, type Row } from '@/lib/crud/entities';
import { apiFetch } from '@/lib/mock/fetch';

/** Result of every action: never throws across the server boundary, so the UI can show the message. */
export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
const fail = (error: string): Result<never> => ({ ok: false, error });

async function message(res: Response): Promise<string> {
  if (res.status === 401) return 'Sessão expirada. Inicie sessão novamente.';
  if (res.status === 403) return 'Não tem permissão para esta operação.';
  if (res.status === 404) return 'Registo não encontrado.';
  const body = await res.text().catch(() => '');
  try {
    const j = JSON.parse(body);
    const props = j.properties && typeof j.properties === 'object' ? Object.values(j.properties).filter((v) => typeof v === 'string') : [];
    const detail = [j.detail, ...props].filter(Boolean).join(' · ');
    if (res.status === 409) return detail || 'Já existe um registo com estes dados.';
    return detail || j.title || `Erro ${res.status}`;
  } catch {
    return body || `Erro ${res.status}`;
  }
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = await getAuthHeaders();
  return apiFetch(`${API_HOST}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) }, cache: 'no-store' });
}

const entity = (key: string) => {
  const e = ENTITIES[key as EntityKey];
  if (!e) throw new Error('Entidade desconhecida');
  return e;
};
const safeId = (id: string | number) => {
  const s = String(id);
  if (!/^[A-Za-z0-9_.-]+$/.test(s)) throw new Error('Identificador inválido');
  return encodeURIComponent(s);
};

async function guard<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await fn();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '';
    return fail(msg.includes('Não autenticado') ? 'Sessão expirada. Inicie sessão novamente.' : msg || 'Não foi possível contactar o servidor.');
  }
}

// ── read ────────────────────────────────────────────────────────────────────
export async function listRows(key: string, trash = false): Promise<Result<Row[]>> {
  return guard(async () => {
    const e = entity(key);
    const res = await call(`${e.api}${trash ? '/trash' : ''}`);
    if (!res.ok) return fail(await message(res));
    return ok((await res.json()) as Row[]);
  });
}

export async function getRow(key: string, id: string | number): Promise<Result<Row>> {
  return guard(async () => {
    const e = entity(key);
    const res = await call(`${e.api}/${safeId(id)}`);
    if (!res.ok) return fail(await message(res));
    return ok((await res.json()) as Row);
  });
}

/** `[value, label]` pairs for a select that points at another entity. */
export async function listOptions(key: string): Promise<Result<{ value: number; label: string }[]>> {
  return guard(async () => {
    const e = entity(key);
    const res = await call(e.api);
    if (!res.ok) return fail(await message(res));
    const rows = (await res.json()) as Row[];
    return ok(
      rows.map((r) => ({
        value: Number(r.id),
        label: key === 'accounts' ? `${r.username} · ${r.email}` : key === 'courses' ? `${r.code} · ${r.name}` : e.titleOf(r),
      })),
    );
  });
}

// ── write ───────────────────────────────────────────────────────────────────
function body(key: string, values: Row): Row {
  const e = entity(key);
  if (e.toRequest) return e.toRequest(values);
  // empty strings become null; numeric inputs arrive as strings from the form
  const out: Row = {};
  for (const f of e.fields) {
    const v = values[f.name];
    out[f.name] = f.type === 'number' || f.type === 'select' ? (v === '' || v == null ? null : Number(v)) : v === '' ? null : v;
  }
  return out;
}

export async function createRow(key: string, values: Row): Promise<Result<Row>> {
  return guard(async () => {
    const e = entity(key);
    if (!e.canCreate) return fail('Esta entidade não pode ser criada aqui.');
    const res = await call(e.api, { method: 'POST', body: JSON.stringify(body(key, values)) });
    if (!res.ok) return fail(await message(res));
    revalidatePath(`/${e.path}`);
    return ok((await res.json()) as Row);
  });
}

export async function updateRow(key: string, id: string | number, values: Row): Promise<Result<Row>> {
  return guard(async () => {
    const e = entity(key);
    if (!e.canEdit) return fail('Esta entidade não pode ser editada.');
    const res = await call(`${e.api}/${safeId(id)}`, { method: 'PUT', body: JSON.stringify(body(key, values)) });
    if (!res.ok) return fail(await message(res));
    revalidatePath(`/${e.path}`);
    return ok((await res.json()) as Row);
  });
}

async function simple(key: string, id: string | number, method: string, suffix: string, fallback: string): Promise<Result> {
  return guard(async () => {
    const e = entity(key);
    const res = await call(`${e.api}/${safeId(id)}${suffix}`, { method });
    if (!res.ok) return fail((await message(res)) || fallback);
    revalidatePath(`/${e.path}`);
    revalidatePath(`/${e.path}/trash`);
    return ok(undefined);
  });
}

export async function deleteRow(key: string, id: string | number) {
  return simple(key, id, 'DELETE', '', 'Não foi possível mover para a lixeira.');
}
export async function restoreRow(key: string, id: string | number) {
  const e = entity(key);
  if (!e.restore) return fail('Esta entidade não pode ser restaurada.');
  return simple(key, id, e.restore.method, e.restore.suffix, 'Não foi possível restaurar.');
}
export async function purgeRow(key: string, id: string | number) {
  const e = entity(key);
  if (!e.purge) return fail('Esta entidade não pode ser eliminada definitivamente.');
  return simple(key, id, 'DELETE', e.purge.suffix, 'Não foi possível eliminar definitivamente.');
}

// ── accounts: roles ─────────────────────────────────────────────────────────
export async function accountRoles(accountId: number): Promise<Result<Row[]>> {
  return guard(async () => {
    const res = await call(`/api/v1/accounts/${safeId(accountId)}/roles`);
    if (!res.ok) return fail(await message(res));
    return ok((await res.json()) as Row[]);
  });
}
export async function setAccountRole(accountId: number, roleId: number, assigned: boolean): Promise<Result> {
  return guard(async () => {
    const res = await call(`/api/v1/accounts/${safeId(accountId)}/roles/${safeId(roleId)}`, { method: assigned ? 'POST' : 'DELETE' });
    if (!res.ok) return fail(await message(res));
    return ok(undefined);
  });
}

// ── statements: moderation ──────────────────────────────────────────────────
export async function listStatements(filter: 'all' | 'review' | 'ocr' | 'trash'): Promise<Result<Row[]>> {
  return guard(async () => {
    const path = { all: '', review: '/review', ocr: '/from-ocr', trash: '/trash' }[filter];
    const res = await call(`/api/v1/statements${path}`);
    if (!res.ok) return fail(await message(res));
    return ok((await res.json()) as Row[]);
  });
}
export async function approveStatement(id: number): Promise<Result> {
  return guard(async () => {
    const res = await call(`/api/v1/statements/${safeId(id)}/approve`, { method: 'POST' });
    if (!res.ok) return fail(await message(res));
    revalidatePath('/statements');
    return ok(undefined);
  });
}
export async function setStatementVisible(id: number, visible: boolean): Promise<Result> {
  return guard(async () => {
    const res = await call(`/api/v1/statements/${safeId(id)}/visibility?visible=${visible ? 'true' : 'false'}`, { method: 'PATCH' });
    if (!res.ok) return fail(await message(res));
    revalidatePath('/statements');
    return ok(undefined);
  });
}
export async function getStatementFull(id: number): Promise<Result<Row>> {
  return guard(async () => {
    const res = await call(`/api/v1/statements/${safeId(id)}/full`);
    if (!res.ok) return fail(await message(res));
    return ok((await res.json()) as Row);
  });
}

// ── dashboard ───────────────────────────────────────────────────────────────
export async function dashboardCounts(): Promise<Result<Record<string, number>>> {
  return guard(async () => {
    const keys = Object.keys(ENTITIES) as EntityKey[];
    const entries = await Promise.all(
      keys.map(async (k) => {
        const res = await call(ENTITIES[k].api).catch(() => null);
        if (!res?.ok) return [k, -1] as const;
        const rows = (await res.json()) as Row[];
        return [k, rows.length] as const;
      }),
    );
    const counts: Record<string, number> = Object.fromEntries(entries);
    const review = await call('/api/v1/statements/review').catch(() => null);
    counts.review = review?.ok ? ((await review.json()) as Row[]).length : -1;
    return ok(counts);
  });
}

// ── institutions: affiliations, teacher access, manual statements ───────────
export type LinkKind = 'subjects' | 'teachers' | 'students';

export async function institutionLinks(institutionId: number, kind: LinkKind): Promise<Result<Row[]>> {
  return guard(async () => {
    const res = await call(`/api/v1/institutions/${safeId(institutionId)}/${kind}`);
    if (!res.ok) return fail(await message(res));
    return ok((await res.json()) as Row[]);
  });
}
export async function setInstitutionLink(institutionId: number, kind: LinkKind, targetId: number, linked: boolean): Promise<Result> {
  return guard(async () => {
    const res = await call(`/api/v1/institutions/${safeId(institutionId)}/${kind}/${safeId(targetId)}`, { method: linked ? 'POST' : 'DELETE' });
    if (!res.ok) return fail(await message(res));
    return ok(undefined);
  });
}
/** Schools the current account may build statements for (admin: all; teacher: affiliated ones). */
export async function myInstitutions(): Promise<Result<Row[]>> {
  return guard(async () => {
    const res = await call('/api/v1/institutions/mine');
    if (!res.ok) return fail(await message(res));
    return ok((await res.json()) as Row[]);
  });
}
export async function grantTeacherAccess(teacherId: number, values: { username: string; email: string; password: string }): Promise<Result> {
  return guard(async () => {
    const res = await call(`/api/v1/teachers/${safeId(teacherId)}/account`, { method: 'POST', body: JSON.stringify(values) });
    if (!res.ok) return fail(await message(res));
    revalidatePath('/teachers');
    return ok(undefined);
  });
}
export async function revokeTeacherAccess(teacherId: number): Promise<Result> {
  return guard(async () => {
    const res = await call(`/api/v1/teachers/${safeId(teacherId)}/account`, { method: 'DELETE' });
    if (!res.ok) return fail(await message(res));
    revalidatePath('/teachers');
    return ok(undefined);
  });
}
export async function createManualStatement(values: Row): Promise<Result<Row>> {
  return guard(async () => {
    const res = await call('/api/v1/statements/manual', { method: 'POST', body: JSON.stringify(values) });
    if (!res.ok) return fail(await message(res));
    return ok((await res.json()) as Row);
  });
}
