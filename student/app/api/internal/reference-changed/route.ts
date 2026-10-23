import { NextResponse } from 'next/server';
import { SIGNATURE_HEADER, verifySignal } from '@/lib/cache-signal';
import { forgetCatalogNames } from '@/lib/catalog';
import { getJwtSecretValue } from '@/lib/dev-secret';

/** O gestor avisa aqui que mudou uma disciplina, um ano letivo ou uma escola (#389), e o aluno esquece os nomes
 *  em cache em vez de esperar que expirem. Só o gestor chega cá: a assinatura é feita com o `JWT_SECRET`
 *  partilhado e o gateway não encaminha este caminho. */
export async function POST(req: Request) {
  const body = await req.text();
  const tags = verifySignal(body, req.headers.get(SIGNATURE_HEADER), getJwtSecretValue());
  if (!tags) return new NextResponse(null, { status: 403 });
  forgetCatalogNames();
  return new NextResponse(null, { status: 204 });
}
