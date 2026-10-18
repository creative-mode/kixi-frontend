import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Page, PageHeader } from '@/components/page';
import { PostBuilder } from '@/components/post-builder';
import { getProfile } from '@/lib/me';

export const metadata = { title: 'Criar publicação · Kixi' };

/** O construtor de publicações da turma (#388). Sem turma não há onde publicar: volta ao início. */
export default async function PublicarPage() {
  const profile = await getProfile();
  const classId = profile.kind === 'ok' ? profile.me.currentClass?.id : undefined;
  if (!classId) redirect('/inicio');
  return (
    <Page className="gap-5">
      <PageHeader title="Criar publicação" description="Junta texto, imagens e perguntas para a tua turma." back="/inicio" />
      <PostBuilder classId={classId} />
      <p className="text-sm"><Link href="/inicio" className="text-primary hover:underline">Voltar ao início</Link></p>
    </Page>
  );
}
