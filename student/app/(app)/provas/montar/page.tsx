import { MontarTreino } from '@/components/montar-treino';
import { getCatalog, getCatalogNames } from '@/lib/catalog';

export const metadata = { title: 'Montar treino · Kixi' };

/** «Montar treino»: escolhe-se o tema (uma prova), quantas questões e quando ver a correção. */
export default async function MontarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const materia = um(sp.materia);
  const names = await getCatalogNames();
  const catalog = await getCatalog({ size: 50 }, names);
  const items = catalog.ok ? catalog.items : [];
  const doTema = materia ? items.filter((i) => i.subject === materia) : items;
  const temas = doTema.map((i) => ({
    id: i.id,
    title: i.title,
    total: null,
    estado: i.state === 'done' ? `Feita${i.score ? ` · ${i.score}` : ''}` : i.state === 'progress' ? 'Em curso' : 'Por treinar',
  }));
  return <MontarTreino disciplina={materia ?? ''} temas={temas} inicial={um(sp.statementId)} />;
}
