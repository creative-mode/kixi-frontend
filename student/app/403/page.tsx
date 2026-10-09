import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveOrigin } from '@/lib/origin';

export const metadata = {
  title: '403 · Acesso não permitido',
  description: 'Área restrita do Kixi. A porta não abre para esta conta.',
};

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * A página 403 canónica mora no fim do endereço (/403), servida pela landing, para haver
 * uma só porta no projecto inteiro. Aqui só encaminhamos, com a query original.
 *
 * O destino é uma origem completa porque a página vive noutra app — a landing — e não por
 * causa do basePath. Não leva `/aluno` porque não é uma rota desta app, e o Next também
 * não mexeria: um URL absoluto com outra origem passa intacto. Ver `README.md`, "basePath".
 */
export default async function ForbiddenPage({ searchParams }: PageProps) {
  const [head, params] = await Promise.all([headers(), searchParams]);
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => search.append(key, item));
    else if (value !== undefined) search.set(key, value);
  }

  // Sem origem configurada em produção, o destino relativo mantém o utilizador
  // na mesma origem — um redirect relativo nunca é um open redirect.
  const origin = resolveOrigin(head, 'http');
  const query = search.toString();
  const target = `/403${query ? `?${query}` : ''}`;
  redirect(origin ? `${origin}${target}` : target);
}
