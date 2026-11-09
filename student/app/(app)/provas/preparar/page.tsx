import { PrepararProva } from '@/components/preparar-prova';
import { ProvasTemas } from '@/components/provas-temas';
import { getTrainingPlan } from '@/lib/exam';
import { getCatalog, getCatalogNames } from '@/lib/catalog';

export const metadata = { title: 'O que sai na prova · Kixi' };

/** «O que sai na prova» (`?sala=`: a matriz da prova agendada; sem matriz, a lista de provas): abre-se a partir do calendário (a prova de cada disciplina) e mostra os temas a treinar. */
export default async function PrepararPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  // Com a matriz do professor, o ecrã é o da prova agendada; sem ela, cai na lista de provas da disciplina.
  const sala = Number(um(sp.sala));
  if (Number.isInteger(sala) && sala > 0) {
    const plan = await getTrainingPlan(sala);
    if (plan.ok && plan.data.items.length > 0) return <PrepararProva plan={plan.data} />;
  }
  const names = await getCatalogNames();
  const catalog = await getCatalog({ size: 50 }, names);
  const items = catalog.ok ? catalog.items : [];
  // `?prova=<statementId>` (do calendário) diz a disciplina pela própria prova; `?materia=` é o separador escolhido.
  const daProva = items.find((i) => i.id === um(sp.prova))?.subject ?? null;
  return <ProvasTemas items={items} total={catalog.ok ? catalog.totalElements : 0} materia={um(sp.materia) ?? daProva} />;
}
