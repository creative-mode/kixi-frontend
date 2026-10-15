'use server';

// Doações de enunciados (#177), sobre o `DonationController`. Só o ADMIN as vê: o backend recusa os outros
// e o `proxy.ts` manda o professor para a 403, mas verifica-se aqui também, porque uma action é um
// endpoint que se chama sem passar pela página.

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth.server';
import { call, fail, guard, message, ok, type Result } from '@/lib/crud/http';
import type { ExamExtraction } from '@/lib/exam/extraction';
import {
  PAGE_SIZE,
  isDonationStatus,
  isId,
  type DonationDetail,
  type DonationPage,
  type DonationStatus,
} from '@/lib/donations/model';

const BASE = '/api/v1/donations';

async function admin(): Promise<Result<undefined>> {
  const user = await getCurrentUser();
  if (!user) return fail('Sessão expirada. Inicie sessão novamente.');
  if (!user.roles.includes('ADMIN')) return fail('Só o administrador gere as doações.');
  return ok(undefined);
}

export async function listDonations(status: DonationStatus | null, page: number): Promise<Result<DonationPage>> {
  return guard(async () => {
    const allowed = await admin();
    if (!allowed.ok) return allowed;
    if (status !== null && !isDonationStatus(status)) return fail('Estado inválido.');
    const safePage = Number.isInteger(page) && page >= 1 ? page : 1;
    const query = new URLSearchParams({ page: String(safePage), limit: String(PAGE_SIZE) });
    if (status) query.set('status', status);
    const res = await call(`${BASE}?${query}`);
    if (!res.ok) return fail(await message(res));
    return ok((await res.json()) as DonationPage);
  });
}

export async function getDonation(id: number): Promise<Result<DonationDetail>> {
  return guard(async () => {
    const allowed = await admin();
    if (!allowed.ok) return allowed;
    if (!isId(id)) return fail('Doação inválida.');
    const res = await call(`${BASE}/${id}`);
    if (!res.ok) return fail(await message(res));
    return ok((await res.json()) as DonationDetail);
  });
}

export async function reviewDonation(id: number, status: 'approved' | 'rejected', note: string): Promise<Result<DonationDetail>> {
  return guard(async () => {
    const allowed = await admin();
    if (!allowed.ok) return allowed;
    if (!isId(id)) return fail('Doação inválida.');
    if (status !== 'approved' && status !== 'rejected') return fail('Decisão inválida.');
    const trimmed = note.trim();
    if (trimmed.length > 500) return fail('A nota tem no máximo 500 caracteres.');
    const res = await call(`${BASE}/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note: trimmed || null }),
    });
    if (!res.ok) return fail(await message(res));
    revalidatePath('/donations');
    return ok((await res.json()) as DonationDetail);
  });
}

/** O OCR sobre os ficheiros da doação, como o importador do construtor o lê. Não grava nada. */
export async function extractDonation(id: number): Promise<Result<ExamExtraction>> {
  return guard(async () => {
    const allowed = await admin();
    if (!allowed.ok) return allowed;
    if (!isId(id)) return fail('Doação inválida.');
    const res = await call(`${BASE}/${id}/extract`, { method: 'POST', signal: AbortSignal.timeout(180_000) });
    // 207 (parcial) vem com corpo: o construtor mostra o que foi lido e o que falhou.
    if (!res.ok && res.status !== 207) return fail(await message(res));
    return ok((await res.json()) as ExamExtraction);
  });
}

/** A prova criada a partir da doação: a doação passa a «convertida» e aponta para ela. */
export async function linkDonationStatement(id: number, statementId: number): Promise<Result<DonationDetail>> {
  return guard(async () => {
    const allowed = await admin();
    if (!allowed.ok) return allowed;
    if (!isId(id) || !isId(statementId)) return fail('Identificador inválido.');
    const res = await call(`${BASE}/${id}/link-statement`, { method: 'POST', body: JSON.stringify({ statementId }) });
    if (!res.ok) return fail(await message(res));
    revalidatePath('/donations');
    return ok((await res.json()) as DonationDetail);
  });
}
