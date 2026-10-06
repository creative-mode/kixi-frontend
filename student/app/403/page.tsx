import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const metadata = {
  title: '403 · Acesso não permitido',
  description: 'Área restrita do Kixi. A porta não abre para esta conta.',
};

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * A página 403 canónica mora no fim do endereço (/403), servida pela landing, para haver
 * uma só porta no projeto inteiro. Aqui só encaminhamos, com a query original.
 * O Next prefixa o basePath do aluno aos caminhos, por isso o destino é absoluto.
 */
export default async function ForbiddenPage({ searchParams }: PageProps) {
  const [head, params] = await Promise.all([headers(), searchParams]);
  const host = head.get('x-forwarded-host') ?? head.get('host') ?? 'localhost:3003';
  const proto = head.get('x-forwarded-proto') ?? 'http';
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => search.append(key, item));
    else if (value !== undefined) search.set(key, value);
  }

  const query = search.toString();
  redirect(`${proto}://${host}/403${query ? `?${query}` : ''}`);
}
