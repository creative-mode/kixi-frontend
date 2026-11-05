import { Page, PageHeader } from '@/components/page';
import { EmptyState } from '@/components/states';

export const metadata = { title: 'Notificações · Kixi' };

/** Só a barra lateral do computador liga aqui por agora (#728): o centro de notificações
 *  em si — respostas, medalhas, lembretes de prova — fica para uma próxima fase, com o
 *  seu próprio modelo de dados no backend. Isto evita um link morto entretanto. */
export default function NotificacoesPage() {
  return (
    <Page>
      <PageHeader title="Notificações" />
      <EmptyState title="Ainda sem notificações" message="Respostas às tuas dúvidas, medalhas e lembretes de prova vão aparecer aqui." />
    </Page>
  );
}
