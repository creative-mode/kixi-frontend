import { PerfilView } from '@/components/perfil-view';
import { getHistory } from '@/lib/exam';
import { getMe } from '@/lib/me';
import { historyRows } from '@/lib/simulation-history';

export default async function PerfilPage() {
  const [me, simulations] = await Promise.all([getMe(), getHistory()]);

  return <PerfilView me={me} history={simulations ? historyRows(simulations) : null} />;
}
