import 'server-only';

import { getPerson } from './profiles';
import { safePhoto } from './profile';

/** Quantas fotos se pedem de uma vez; o resto fica com as iniciais. */
const MAX_PHOTOS = 24;

/**
 * As fotos de outras contas, por id (uma leitura por conta). Amigos, comentários e pesquisas só
 * trazem o nome, por isso a foto vem do perfil. Um perfil privado nunca mostra foto, e um
 * perfil que não responde fica sem ela: as iniciais ocupam o lugar.
 */
export async function loadPhotos(ids: Array<number | null | undefined>): Promise<Record<number, string>> {
  const unique = [...new Set(ids.filter((id): id is number => typeof id === 'number'))].slice(0, MAX_PHOTOS);
  const found = await Promise.all(
    unique.map(async (id) => {
      const r = await getPerson(id).catch(() => null);
      if (!r?.ok || r.data.restricted) return null;
      const photo = safePhoto(r.data.photo);
      return photo ? ([id, photo] as const) : null;
    }),
  );
  return Object.fromEntries(found.filter((x): x is NonNullable<typeof x> => x != null));
}
