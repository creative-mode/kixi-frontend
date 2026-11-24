'use server';

import { revalidatePath } from 'next/cache';

import { requireStudent } from './guard';
import { apiDelete, apiGet, apiPost } from './api';
import { forgetVisitedPages } from './refresh';
import { readBlockedPeople, readBlockState, validateReport, type BlockedPerson } from './moderation';

/**
 * Denúncia e bloqueio de perfil ou de escola (#323).
 *
 * A regra toda está em `lib/moderation.ts`, que é testada; aqui fica só o
 * transporte, para que mudar a regra não obrigue a tocar numa server action.
 */

/** O estado do bloqueio com esta pessoa: `blocked` nos dois sentidos, `blockedByMe` se fui eu (só eu desbloqueio). */
export async function blockStateAction(accountId: number): Promise<{ blocked?: boolean; blockedByMe?: boolean; error?: string }> {
  const who = await requireStudent();
  if (who.accountId === null) return { error: 'Entra na tua conta.' };
  const res = await apiGet<unknown>(`/profiles/accounts/${accountId}/block`);
  if (!res.ok) return { error: res.message };
  return readBlockState(res.data);
}

/**
 * Bloquear ou desbloquear com as rotas explícitas (`POST` e `DELETE`): idempotentes, ao contrário do `PUT` antigo que
 * alternava e, com dois cliques seguidos, desfazia o que o aluno acabara de fazer.
 */
export async function setBlockAction(
  accountId: number,
  block: boolean,
): Promise<{ blocked?: boolean; blockedByMe?: boolean; error?: string }> {
  const who = await requireStudent();
  if (who.accountId === null) return { error: 'Entra na tua conta.' };
  // Bloquear-se a si não é um bloqueio: nem o botão deixa, mas o servidor também
  // tem de recusar, porque o botão é o que se pode enganar.
  if (who.accountId === accountId) return { error: 'Não podes bloquear-te a ti.' };
  const path = `/profiles/accounts/${accountId}/block`;
  const res = block ? await apiPost<unknown>(path, {}) : await apiDelete<unknown>(path);
  if (!res.ok) return { error: res.message };
  // Bloquear termina a amizade: as ligações e os perfis já vistos deixam de valer.
  forgetVisitedPages();
  revalidatePath(`/u/${accountId}`);
  revalidatePath('/perfil');
  return readBlockState(res.data);
}

/** «Pessoas bloqueadas»: quem bloqueei, para o poder desbloquear. */
export async function listBlockedAction(): Promise<{ people: BlockedPerson[]; error?: string }> {
  await requireStudent();
  const res = await apiGet<unknown>('/profiles/blocks');
  if (!res.ok) return { people: [], error: res.message };
  return { people: readBlockedPeople(res.data) };
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