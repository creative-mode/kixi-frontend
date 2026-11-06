import { redirect } from 'next/navigation';
import { PostBuilder } from '@/components/post-builder';
import { PublicarSimples } from '@/components/publicar-simples';
import { getProfile } from '@/lib/me';

export const metadata = { title: 'Criar publicação · Kixi' };

/** O construtor de publicações da turma (#388). Sem turma não há onde publicar: volta ao início. */
export default async function PublicarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const avancado = (await searchParams).avancado;
  const profile = await getProfile();
  const classId = profile.kind === 'ok' ? profile.me.currentClass?.id : undefined;
  if (!classId) redirect('/inicio');
  if (!avancado) return <PublicarSimples classId={classId} turma={profile.kind === 'ok' ? (profile.me.currentClass?.code ?? '') : ''} />;
  return <PostBuilder classId={classId} />;
}
