import { BACKEND } from '@/lib/session';
import { MOCK } from '@/lib/mock/backend';

/** Imagens enviadas (fotos, logótipos, imagens de posts e de questões), lidas do backend em `/uploads/...`.
 *  Só os caminhos que o backend serve: nada de passar um caminho qualquer ao backend. */
const ALLOWED = /^(?:images\/(?:avatar|logo|post)\/[A-Za-z0-9._-]+|questions\/\d+\/[A-Za-z0-9._-]+)$/;

/** 1x1 transparente: no modo simulado não há ficheiros, mas a imagem tem de carregar. */
const PIXEL = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 218, 99, 252, 207, 192, 80, 15, 0, 4, 133, 1, 128, 132, 169, 140, 33, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const rel = path.join('/');
  if (!ALLOWED.test(rel)) return new Response('Not found', { status: 404 });
  if (MOCK) return new Response(PIXEL, { headers: { 'content-type': 'image/png', 'cache-control': 'no-store' } });

  const origin = new URL(BACKEND).origin;
  const res = await fetch(`${origin}/uploads/${rel}`, { cache: 'no-store' }).catch(() => null);
  if (!res || !res.ok || !res.body) return new Response('Not found', { status: 404 });
  return new Response(res.body, {
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
      'x-content-type-options': 'nosniff',
      // O nome do ficheiro é aleatório e um ficheiro novo ganha outro nome: nunca muda de conteúdo, por isso o browser não precisa de voltar a perguntar.
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
