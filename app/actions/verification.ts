'use server';

// Verificação de escolas (#322), sobre o `InstitutionVerificationController`. Só o ADMIN aprova, recusa
// e revoga: o backend recusa os outros, e verifica-se aqui também, porque uma action é um endpoint.

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth.server';
import { call, fail, guard, message, ok, type Result } from '@/lib/crud/http';
import { isId, isStatus, noteError, type VerificationRequest, type VerificationStatus } from '@/lib/verification/model';

async function admin(): Promise<Result<undefined>> {
  const user = await getCurrentUser();
  if (!user) return fail('Sessão expirada. Inicie sessão novamente.');
  if (!user.roles.includes('ADMIN')) return fail('Só o administrador gere a verificação das escolas.');
  return ok(undefined);
}

export async function listVerificationRequests(status: VerificationStatus | null): Promise<Result<VerificationRequest[]>> {
  return guard(async () => {
    const allowed = await admin();
    if (!allowed.ok) return allowed;
    if (status !== null && !isStatus(status)) return fail('Estado inválido.');
    const res = await call(`/api/v1/verification-requests${status ? `?status=${status}` : ''}`);
    if (!res.ok) return fail(await message(res));
    return ok((await res.json()) as VerificationRequest[]);
  });
}

export async function reviewVerification(id: number, decision: 'approve' | 'reject', note: string): Promise<Result<VerificationRequest>> {
  return guard(async () => {
    const allowed = await admin();
    if (!allowed.ok) return allowed;
    if (!isId(id)) return fail('Pedido inválido.');
    if (decision !== 'approve' && decision !== 'reject') return fail('Decisão inválida.');
    const invalid = noteError(decision, note);
    if (invalid) return fail(invalid);
    const res = await call(`/api/v1/verification-requests/${id}/${decision}`, {
      method: 'POST',
      body: JSON.stringify({ note: note.trim() || null }),
    });
    if (!res.ok) return fail(await message(res));
    revalidatePath('/verification');
    return ok((await res.json()) as VerificationRequest);
  });
}

export async function revokeVerification(institutionId: number): Promise<Result<undefined>> {
  return guard(async () => {
    const allowed = await admin();
    if (!allowed.ok) return allowed;
    if (!isId(institutionId)) return fail('Escola inválida.');
    const res = await call(`/api/v1/institutions/${institutionId}/verification/revoke`, { method: 'POST' });
    if (!res.ok) return fail(await message(res));
    revalidatePath('/verification');
    return ok(undefined);
  });
}
