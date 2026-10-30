import { Column, Page, PageHeader } from '@/components/page';
import { EmptyState, ErrorState } from '@/components/states';
import { PautasView } from '@/components/pautas-view';
import { getMyTermSheets } from '@/lib/pautas';

export const metadata = { title: 'Pautas · Kixi' };

/** As minhas pautas: só a minha linha, só de pautas fechadas pela escola (kixi#506). Os PDFs ainda não estão aqui. */
export default async function PautasPage() {
  const result = await getMyTermSheets();
  return (
    <Page>
      <Column>
        <PageHeader title="As minhas pautas" description="As tuas notas de cada trimestre, depois de a escola fechar a pauta." />
        {!result.ok ? (
          <ErrorState title="Não foi possível carregar as pautas" message={result.message} />
        ) : result.data.length === 0 ? (
          <EmptyState title="Ainda não há pautas fechadas" message="Quando a escola fechar a pauta de um trimestre, as tuas notas aparecem aqui." />
        ) : (
          <PautasView sheets={result.data} />
        )}
      </Column>
    </Page>
  );
}
