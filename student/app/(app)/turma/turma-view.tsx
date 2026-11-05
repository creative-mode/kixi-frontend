'use client';

import Link from 'next/link';
import { Page, PageHeader } from '@/components/page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/states';
import { PostCard } from '@/components/post-card';
import { PostComposer } from '@/components/post-composer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserAvatar } from '@/components/user-avatar';
import { formatAverage } from '@/lib/ranking-rules';
import type { FeedPost } from '@/lib/feed';
import type { FeedAuthor } from '@/lib/feed-rules';
import type { Leaderboard } from '@/lib/ranking';

/**
 * A Turma: "Dúvidas" (o feed filtrado a perguntas da turma, com o mesmo `PostCard` do
 * início) e "Médias" (a tabela da turma, como em `/ranking`, mas só esta aba — o ranking
 * completo, com escola/amigos/global, continua em `/ranking`).
 */
export function TurmaView({
  className,
  classId,
  myAccountId,
  myName,
  myPhoto,
  posts,
  authors,
  feedError,
  board,
  boardError,
}: {
  className: string | null;
  classId: number;
  myAccountId: number;
  myName: string;
  myPhoto: string | null;
  posts: FeedPost[];
  authors: Record<number, FeedAuthor>;
  feedError: string | null;
  board: Leaderboard | null;
  boardError: string | null;
}) {
  return (
    <Page className="gap-0 p-0 pb-24 md:pb-10">
      <PageHeader title={className ? `Turma ${className}` : 'Turma'} kicker={`${posts.length} ${posts.length === 1 ? 'dúvida' : 'dúvidas'} por responder ou já resolvidas`} className="m-0" />
      <Tabs defaultValue="duvidas">
        <TabsList aria-label="Turma">
          <TabsTrigger value="duvidas">Dúvidas</TabsTrigger>
          <TabsTrigger value="medias">Médias</TabsTrigger>
        </TabsList>

        <TabsContent value="duvidas" className="flex flex-col">
          <PostComposer classId={classId} />
          {feedError ? (
            <div className="p-4"><ErrorState title="Não foi possível carregar as dúvidas" message={feedError} /></div>
          ) : posts.length === 0 ? (
            <EmptyState title="Ainda não há dúvidas" message="Quando alguém da turma perguntar algo, aparece aqui." />
          ) : (
            posts.map((p) => <PostCard key={p.id} post={p} myAccountId={myAccountId} myName={myName} myPhoto={myPhoto} author={authors[p.authorAccountId]} myClassId={classId} />)
          )}
        </TabsContent>

        <TabsContent value="medias" className="p-4">
          {boardError ? (
            <ErrorState title="Não foi possível carregar as médias" message={boardError} />
          ) : !board || board.entries.length === 0 ? (
            <EmptyState title="Ainda não há médias" message="Aparecem aqui quando houver provas corrigidas nesta turma." />
          ) : (
            <Card className="gap-0 divide-y py-0">
              {board.entries.map((entry) => (
                <div key={entry.position} className={`flex items-center gap-3 px-4 py-3 ${entry.me ? 'bg-secondary/40' : ''}`}>
                  <span className="w-6 shrink-0 text-right text-sm font-bold tabular-nums text-muted-foreground">{entry.position}.º</span>
                  <UserAvatar name={entry.displayName} src={null} size={32} />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{entry.me ? 'Tu' : entry.displayName}</span>
                  <span className="text-[15px] font-bold tabular-nums">{formatAverage(entry.average)}</span>
                </div>
              ))}
            </Card>
          )}
          <Button asChild variant="outline" className="mt-4 w-full">
            <Link href="/ranking">Ver o ranking completo</Link>
          </Button>
        </TabsContent>
      </Tabs>
    </Page>
  );
}
