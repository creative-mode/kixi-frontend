import { ProvasTemas } from '@/components/provas-temas';
import { getCatalog, getCatalogNames } from '@/lib/catalog';

export const metadata = { title: 'O que sai na prova · Kixi' };

/** «O que sai na prova»: abre-se a partir do calendário (a prova de cada disciplina) e mostra os temas a treinar. */
export default async function PrepararPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const names = await getCatalogNames();
  const catalog = await getCatalog({ size: 50 }, names);
  const items = catalog.ok ? catalog.items : [];
  // `?prova=<statementId>` (do calendário) diz a disciplina pela própria prova; `?materia=` é o separador escolhido.
  const daProva = items.find((i) => i.id === um(sp.prova))?.subject ?? null;
  return <ProvasTemas items={items} total={catalog.ok ? catalog.totalElements : 0} materia={um(sp.materia) ?? daProva} />;
}
