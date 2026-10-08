import { PerfilView } from '@/components/perfil-view';
import { getMe } from '@/lib/me';

export default async function PerfilPage() {
  const me = await getMe();

  return <PerfilView me={me} />;
}
