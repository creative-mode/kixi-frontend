import { RankingView } from '@/components/ranking-view';
import { getLeaderboard, loadRankingVisibility } from '@/lib/ranking';

export const metadata = { title: 'Ranking · Kixi' };

/** Busca-se a aba Turma no servidor (a que abre por omissão); Escola é pedida
 *  do cliente ao mudar de aba, via lib/ranking-actions.ts. A preferência de
 *  visibilidade (#611) chega com a página para o interruptor não piscar. */
export default async function RankingPage() {
  const [result, visibility] = await Promise.all([getLeaderboard('class'), loadRankingVisibility()]);
  return (
    <RankingView
      initial={result.ok ? result.data : null}
      error={result.ok ? null : result.message}
      initialVisibility={visibility.ok ? visibility.data : null}
    />
  );
}
