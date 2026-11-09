import { redirect } from 'next/navigation';
import { PostBuilder } from '@/components/post-builder';
import { getProfile } from '@/lib/me';

export const metadata = { title: 'Criar publicação · Kixi' };

/** Um só sítio para todas as publicações: pergunta, dica, cartão, resolução ou desafio, com os blocos à mão. Sem turma não há onde publicar. */
export default async function PublicarPage() {
  const profile = await getProfile();
  const classId = profile.kind === 'ok' ? profile.me.currentClass?.id : undefined;
  if (!classId) redirect('/inicio');
  return <PostBuilder classId={classId} />;
}
