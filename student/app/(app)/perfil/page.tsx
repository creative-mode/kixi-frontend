import { PerfilView } from '@/components/perfil-view';
import { getMe } from '@/lib/me';
import { getStats, getBadges } from '@/lib/stats';
import { getCatalog, getCatalogNames } from '@/lib/catalog';
import { getPerformance } from '@/lib/performance';

export default async function PerfilPage() {
  const me = await getMe();

  // Sem matrícula, não há turma nem catálogo para pedir — mostra o perfil vazio em
  // vez de três chamadas a um endpoint que ia devolver sempre nada.
  if (!me) return <PerfilView me={null} stats={null} badges={[]} history={[]} performance={{ mastery: [], activity: [] }} />;

  const [stats, badges, names, performance] = await Promise.all([getStats(), getBadges(), getCatalogNames(), getPerformance()]);
  const catalog = await getCatalog({ size: 50 }, names);
  const history = catalog.ok ? catalog.items.filter((item) => item.state === 'done') : [];

  return <PerfilView me={me} stats={stats} badges={badges} history={history} performance={performance} />;
}
