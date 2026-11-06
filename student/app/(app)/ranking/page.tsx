import { RankingView } from '@/components/ranking-view';
import { getLeaderboard } from '@/lib/ranking';

export const metadata = { title: 'Ranking · Kixi' };

/** Busca-se a aba Turma no servidor (a que abre por omissão); Escola é pedida
 *  do cliente ao mudar de aba, via lib/ranking-actions.ts. */
export default async function RankingPage() {
  const result = await getLeaderboard('class');
  return <RankingView initial={result.ok ? result.data : null} error={result.ok ? null : result.message} />;
}
