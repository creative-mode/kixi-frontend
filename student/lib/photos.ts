import 'server-only';

import { viewerKey } from './api';
import { getPerson } from './profiles';
import { safePhoto } from './profile';
import { TtlCache } from './ttl-cache';

/** Quantas fotos se pedem de uma vez; o resto fica com as iniciais. */
const MAX_PHOTOS = 24;

/** A foto de quem se vê, por quem vê (a privacidade do perfil depende de quem olha). Dez minutos: uma foto nova
 *  aparece sem esperar muito, e a lista de amigos deixa de custar um pedido por pessoa em cada página (#393).
 *  Guarda também "sem foto" (null), que é a resposta mais comum. */
const photoCache = new TtlCache<string | null>(10 * 60_000, 2000);

/**
 * As fotos de outras contas, por id. Amigos, comentários e pesquisas só trazem o nome, por isso a foto vem do
 * perfil. Um perfil privado nunca mostra foto, e um perfil que não responde fica sem ela e não fica guardado:
 * as iniciais ocupam o lugar até à próxima leitura.
 */
export async function loadPhotos(ids: Array<number | null | undefined>): Promise<Record<number, string>> {
  const unique = [...new Set(ids.filter((id): id is number => typeof id === 'number'))].slice(0, MAX_PHOTOS);
  const viewer = await viewerKey();
  const found = await Promise.all(
    unique.map(async (id) => {
      const photo = await photoCache.remember(`${viewer}:${id}`, async () => {
        const r = await getPerson(id).catch(() => null);
        if (!r?.ok) return { value: null, keep: false };
        return { value: r.data.restricted ? null : safePhoto(r.data.photo), keep: true };
      });
      return photo ? ([id, photo] as const) : null;
    }),
  );
  return Object.fromEntries(found.filter((x): x is NonNullable<typeof x> => x != null));
}
