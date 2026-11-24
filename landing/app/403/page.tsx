import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';

export const metadata: Metadata = {
  title: '403 · Acesso não permitido',
  description: 'Área restrita do Kixi. A porta não abre para esta conta.',
  // Um 403 no índice é uma página de erro indexada: o buscador guarda-a, alguém
  // clica e leva a uma porta fechada. O `robots.txt` já a barra; isto é o pedido
  // explícito, para o que a busca já tenha guardado saber que já não vale.
  robots: { index: false, follow: false },
};

type PageProps = { searchParams: Promise<{ reason?: string | string[] }> };

/**
 * A porta fechada responde 403 a sério (G6/N7). Uma página não escolhe o estado, por isso `forbidden()` entrega a
 * resposta a `forbidden.tsx`, que o Next serve com 403. Antes o proxy reescrevia `/403` com `{ status: 403 }`, mas
 * atrás do gateway o anfitrião do pedido não coincide com o do servidor, o Next trata a reescrita como externa e
 * descarta o estado (200 na stack real).
 */
export default async function ForbiddenPage({ searchParams }: PageProps) {
  await searchParams;
  forbidden();
}
