'use client';

import { useOptimistic } from 'react';
import { Alert } from '@/components/ui/alert';
import { Page, PageHeader } from '@/components/page';
import { PostCard } from '@/components/post-card';
import { PostComposer } from '@/components/post-composer';
import { SalasDeProva } from '@/components/salas-de-prova';
import { EmptyState } from '@/components/states';
import Link from 'next/link';
import { FileText, MessageCircle, Trophy } from 'lucide-react';
import { phaseOf } from '@/lib/exam-room-rules';
import { useMe } from '@/lib/me-context';
import { fullName, photoUrl } from '@/lib/profile';
import type { Invitation } from '@/lib/exam-room-rules';
import type { FeedPost } from '@/lib/feed';
import type { FeedAuthor } from '@/lib/feed-rules';

/** O centro do início: as salas de prova, o compositor e o feed da turma. Os dados vêm por props:
 *  este ficheiro é cliente e tudo se lê no servidor, com o cookie da sessão (ver ./page.tsx). */
export function InicioFeed({
  invitations = [],
  invitationsError,
  myAccountId,
  classId,
  posts,
  authors = {},
  firstSteps = false,
  feedError,
}: {
  invitations?: Invitation[];
  invitationsError?: { message: string; status: number | null } | null;
  myAccountId: number | null;
  classId: number | null;
  posts: FeedPost[];
  authors?: Record<number, FeedAuthor>;
  /** Ainda sem nenhuma prova entregue: mostra os primeiros passos. */
  firstSteps?: boolean;
  feedError?: string | null;
}) {
  const me = useMe();
  // A publicação nova aparece no instante em que se carrega em Publicar e é substituída pela do servidor quando chega.
  const [shown, addOptimistic] = useOptimistic(posts, (current: FeedPost[], post: FeedPost) => [post, ...current]);
  // O início só mostra as salas que pedem ação (a decorrer, abertas, por abrir); as já entregues ou
  // terminadas ficam em Provas, para o feed não ficar enterrado debaixo do histórico.
  const pending = invitations.filter((inv) => ['live', 'lobby', 'scheduled'].includes(phaseOf(inv)));
  const hidden = invitations.length - pending.length;

  return (
    <Page className="gap-0 p-0 pb-24 md:pb-10">
      <PageHeader title="Início" className="m-0" />

      {firstSteps && (
        <section aria-label="Primeiros passos" className="mx-4 mt-3 grid gap-2 rounded-xl border bg-secondary/50 p-4">
          <h2 className="text-[15px] font-bold">Começa por aqui</h2>
          <ol className="grid gap-1">
            {[
              { href: '/provas', icon: FileText, title: 'Faz a tua primeira prova', hint: 'Escolhe um enunciado e simula.' },
              { href: '/tutor', icon: MessageCircle, title: 'Estuda os erros com o tutor', hint: 'Depois da prova, o tutor explica onde falhaste.' },
              { href: '/ranking', icon: Trophy, title: 'Compara-te com a turma', hint: 'Entras no ranking com a primeira prova corrigida.' },
            ].map((step, i) => (
              <li key={step.href}>
                <Link href={step.href} className="-mx-2 flex min-h-12 items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-background">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-accent-foreground">{i + 1}</span>
                  <span className="grid min-w-0 leading-tight">
                    <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold"><step.icon className="size-4 text-primary" aria-hidden />{step.title}</span>
                    <span className="text-[13px] text-muted-foreground">{step.hint}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="grid gap-3 px-4 pt-3 empty:hidden">
      <SalasDeProva invitations={pending} invitationsError={invitationsError} />
      {hidden > 0 && (
        <p className="text-[13px] text-muted-foreground">
          {hidden === 1 ? '1 sala já entregue ou terminada' : `${hidden} salas já entregues ou terminadas`} · <Link href="/provas" className="font-semibold text-primary hover:underline">ver em Provas</Link>
        </p>
      )}
      </div>

      {classId && <PostComposer classId={classId} onOptimistic={addOptimistic} />}

      {feedError ? (
        <div className="p-4"><Alert variant="destructive">{feedError}</Alert></div>
      ) : !classId ? (
        <EmptyState title="Matricula-te para veres o feed" message="As publicações da tua turma aparecem aqui depois da matrícula." />
      ) : shown.length === 0 ? (
        <EmptyState title="Ainda não há nada por aqui" message="Sê o primeiro a partilhar uma dúvida ou um tema com a turma." />
      ) : (
        shown.map((p) => <PostCard key={p.id} post={p} author={authors[p.authorAccountId]} myClassId={classId} myAccountId={myAccountId} myName={fullName(me)} myPhoto={photoUrl(me)} />)
      )}
    </Page>
  );
}
