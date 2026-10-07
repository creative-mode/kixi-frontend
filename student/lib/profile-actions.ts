'use server';

import { revalidatePath } from 'next/cache';
import { apiPut } from './api';
import type { Me } from './types';

export type ProfileState = { error?: string; saved?: boolean } | undefined;

const MAX_NAME = 100;
/** The backend stores `photo` as a string and caps it at 500 characters; there is no
 *  upload endpoint, so the student points at an image already hosted somewhere. */
const MAX_PHOTO = 500;
const HTTP_URL = /^https?:\/\/\S+$/i;

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
  if (photo && !HTTP_URL.test(photo)) {
    return { error: 'A foto tem de ser um endereço começando por http:// ou https://' };
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
