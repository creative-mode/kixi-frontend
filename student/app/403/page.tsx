import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { appOrigin, originFromRequest } from '@/lib/origin';

export const metadata = {
  title: '403 · Acesso não permitido',
  description: 'Área restrita do Kixi. A porta não abre para esta conta.',
};

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * A página 403 canónica mora no fim do endereço (/403), servida pela landing, para haver
 * uma só porta no projecto inteiro. Aqui só encaminhamos, com a query original.
 * O destino é uma origem completa porque a página vive noutra app, não porque o Next
 * acrescente o basePath: `redirect()` não o faz, ao contrário de <Link> e router.push().
 * Ver `lib/paths.ts`, que é o que cobre essa diferença nos redirects daqui.
 */
export default async function ForbiddenPage({ searchParams }: PageProps) {
  const [head, params] = await Promise.all([headers(), searchParams]);
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => search.append(key, item));
    else if (value !== undefined) search.set(key, value);
  }

  const origin = appOrigin() ?? originFromRequest(head, 'http') ?? 'http://localhost:3000';
  const query = search.toString();
  redirect(`${origin}/403${query ? `?${query}` : ''}`);
}
