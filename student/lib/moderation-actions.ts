'use server';

import { revalidatePath } from 'next/cache';

import { requireStudent } from './guard';
import { apiGet, apiPost, apiPut, type Result } from './api';
import { validateReport } from './moderation';

/**
 * Denúncia e bloqueio de perfil ou de escola (#323).
 *
 * A regra toda está em `lib/moderation.ts`, que é testada; aqui fica só o
 * transporte, para que mudar a regra não obrigue a tocar numa server action.
 */

/** O perfil está bloqueado por mim? Sai no próprio perfil, para o botão saber o que dizer. */
export async function blockStateAction(accountId: number): Promise<{ blocked?: boolean; error?: string }> {
  const who = await requireStudent();
  if (who.accountId === null) return { error: 'Entra na tua conta.' };
  const res = await apiGet<{ blocked: boolean }>(`/profiles/accounts/${accountId}/block`);
  if (!res.ok) return { error: res.message };
  return { blocked: res.data.blocked };
}

export async function toggleBlockAction(accountId: number): Promise<{ blocked?: boolean; error?: string }> {
  const who = await requireStudent();
  if (who.accountId === null) return { error: 'Entra na tua conta.' };
  // Bloquear-se a si não é um bloqueio: nem o botão deixa, mas o servidor também
  // tem de recusar, porque o botão é o que se pode enganar.
  if (who.accountId === accountId) return { error: 'Não podes bloquear-te a ti.' };
  const res = await apiPut<{ blocked: boolean }>(`/profiles/accounts/${accountId}/block`, {});
  if (!res.ok) return { error: res.message };
  // O próprio e o outro deixam de se ver: o perfil que estava aberto já não é o mesmo.
  revalidatePath(`/u/${accountId}`);
  return { blocked: res.data.blocked };
}

export async function reportAccountAction(
  accountId: number,
  reason: string,
  note: string,
): Promise<{ ok?: boolean; error?: string }> {
  const who = await requireStudent();
  if (who.accountId === null) return { error: 'Entra na tua conta.' };
  const checked = validateReport({ target: 'ACCOUNT', reason, note, reporterId: who.accountId, targetId: accountId });
  if (!checked.ok) return { error: checked.error };
  const res = await apiPost(`/profiles/accounts/${accountId}/reports`, { reason: checked.reason, note: checked.note });
  if (!res.ok) return { error: res.message };
  return { ok: true };
}

export async function reportSchoolAction(
  institutionId: number,
  reason: string,
  note: string,
): Promise<{ ok?: boolean; error?: string }> {
  const who = await requireStudent();
  if (who.accountId === null) return { error: 'Entra na tua conta.' };
  const checked = validateReport({ target: 'INSTITUTION', reason, note, reporterId: who.accountId, targetId: institutionId });
  if (!checked.ok) return { error: checked.error };
  const res = await apiPost(`/institutions/${institutionId}/reports`, { reason: checked.reason, note: checked.note });
  if (!res.ok) return { error: res.message };
  return { ok: true };
}