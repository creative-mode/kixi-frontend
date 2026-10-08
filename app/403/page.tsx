import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { appOrigin, originFromRequest } from '@/lib/origin';

export const metadata = {
  title: '403 · Acesso não permitido',
  description: 'Área restrita do Kixi. A porta não abre para esta conta.',
};

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The canonical 403 lives at the end of the address (`/403`), served by the landing, so
 * the project has a single door. The student app already forwards here; this does the
 * same, keeping the query intact, instead of importing the landing's scene into the
 * manager — which made one app able to break the other's build.
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
