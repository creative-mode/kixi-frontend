import { ProvasTemas } from '@/components/provas-temas';
import { getCatalog, getCatalogNames } from '@/lib/catalog';

export const metadata = { title: 'O que sai na prova · Kixi' };

/** «O que sai na prova»: abre-se a partir do calendário (a prova de cada disciplina) e mostra os temas a treinar. */
export default async function PrepararPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).materia;
  const materia = (Array.isArray(raw) ? raw[0] : raw) ?? null;
  const names = await getCatalogNames();
  const catalog = await getCatalog({ size: 50 }, names);
  return <ProvasTemas items={catalog.ok ? catalog.items : []} total={catalog.ok ? catalog.totalElements : 0} materia={materia} />;
}
