'use server';

import { revalidatePath } from 'next/cache';
import { apiPut, authHeaders, problem } from './api';
import type { Visibility } from './profiles';
import { BACKEND } from './session';
import type { Me } from './types';

export type ProfileState = { error?: string; saved?: boolean } | undefined;

const MAX_NAME = 100;
/** The backend stores `photo` as a string and caps it at 500 characters. The photo is chosen from the device and
 *  sent to `/images` (see `enviarFotoAction`), which returns the address kept here; an address already online
 *  still works. */
const MAX_PHOTO = 500;
const PHOTO_ADDRESS = /^(?:https?:\/\/\S+|\/uploads\/images\/avatar\/[A-Za-z0-9._-]+)$/i;

/** Sends the photo the student chose to the server and returns the address to keep in the profile. */
export async function enviarFotoAction(form: FormData): Promise<{ url?: string; error?: string }> {
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Escolhe uma imagem.' };
  if (!file.type.startsWith('image/')) return { error: 'O ficheiro tem de ser uma imagem (PNG, JPG ou WEBP).' };
  if (file.size > 2 * 1024 * 1024) return { error: 'A imagem deve ter no máximo 2 MB.' };
  const out = new FormData();
  out.append('file', file, file.name);
  try {
    const res = await fetch(`${BACKEND}/images?kind=avatar`, { method: 'POST', headers: await authHeaders(), body: out, cache: 'no-store' });
    if (!res.ok) return { error: (await problem(res)).message };
    const body = (await res.json()) as { url?: string };
    return body.url ? { url: body.url } : { error: 'O servidor não devolveu a imagem.' };
  } catch {
    return { error: 'Não foi possível enviar a imagem agora. Tenta outra vez.' };
  }
}

/** Updates the student's own name and photo. /users is ADMIN-only, so PUT /me is the
 *  only route a student has to their profile. */
export async function atualizarPerfilAction(
  _: ProfileState,
  form: FormData,
): Promise<ProfileState> {
  const firstName = String(form.get('firstName') ?? '').trim();
  const lastName = String(form.get('lastName') ?? '').trim();
  const photo = String(form.get('photo') ?? '').trim();

  if (!firstName || !lastName) {
    return { error: 'Preenche o nome e o apelido.' };
  }
  if (firstName.length > MAX_NAME || lastName.length > MAX_NAME) {
    return { error: `O nome e o apelido podem ter no máximo ${MAX_NAME} caracteres.` };
  }
  if (photo.length > MAX_PHOTO) {
    return { error: 'O endereço da foto é demasiado longo.' };
  }
  if (photo && !PHOTO_ADDRESS.test(photo)) {
    return { error: 'A foto tem de ser uma imagem escolhida do dispositivo.' };
  }

  const result = await apiPut<Me>('/me', {
    first_name: firstName,
    last_name: lastName,
    photo,
  });

  if (!result.ok) return { error: result.message };

  revalidatePath('/perfil');
  revalidatePath('/inicio');
  return { saved: true };
}

/** Quem pode ver o meu perfil: toda a gente, a minha escola ou só eu (#336). */
export async function definirVisibilidadeAction(value: Visibility): Promise<{ error?: string }> {
  if (!['public', 'school', 'private'].includes(value)) return { error: 'Escolha inválida.' };
  const result = await apiPut<{ visibility: string }>('/profiles/me/visibility', { visibility: value });
  if (!result.ok) return { error: result.message };
  revalidatePath('/perfil');
  return {};
}
