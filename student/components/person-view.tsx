'use client';

import Link from 'next/link';
import { Award, Building2, GraduationCap } from 'lucide-react';
import { Page, PageHeader } from '@/components/page';
import { PostCard } from '@/components/post-card';
import { EmptyState } from '@/components/states';
import { ProfileHero } from '@/components/profile-hero';
import { VerifiedBadge } from '@/components/verified-badge';
import { Badge as Pill } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CLASSMATE_LABEL, type FeedAuthor } from '@/lib/feed-rules';
import type { FeedPost } from '@/lib/feed';
import type { PersonProfile } from '@/lib/profiles';

/**
 * O perfil de outra pessoa, no mesmo modelo do teu: faixa, foto grande sobreposta, nome, factos,
 * etiquetas de nível e separadores. Só mostra o que a visibilidade dessa pessoa deixa ver, e
 * os separadores que existem para ela (as publicações da tua turma e as medalhas).
 */
export function PersonView({
  person,
  posts,
  classmate,
  myAccountId,
  myName,
  myPhoto,
  myClassId,
}: {
  person: PersonProfile & { accountId: number };
  posts: FeedPost[];
  classmate: boolean;
  myAccountId: number | null;
  myName: string;
  myPhoto: string | null;
  myClassId: number | null;
}) {
  const teacher = person.kind === 'TEACHER';
  const author: FeedAuthor = { name: person.displayName, photo: person.photo, verified: person.verified };

  return (
    <Page className="gap-0 p-0 pb-24 md:pb-10">
      <PageHeader title={person.displayName} kicker={teacher ? 'Professor' : 'Aluno'} back="/inicio" className="m-0" />

      <ProfileHero name={person.displayName} photo={person.photo} verified={person.verified} verifiedLabel={teacher ? 'Professor verificado' : 'Perfil verificado'}>
        {person.restricted ? (
          <p className="mt-1 text-[15px] text-muted-foreground">Esta pessoa escolheu não mostrar mais do que o nome e a foto.</p>
        ) : (
          <>
            {person.schools.length === 0 ? (
              <p className="mt-1 text-[15px] text-muted-foreground">Sem escola associada.</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {person.schools.map((s) => (
                  <li key={s.id} className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
                    <Building2 className="size-4 shrink-0" aria-hidden />
                    <Link href={`/escola/${s.id}`} className="min-w-0 truncate py-1 font-medium hover:underline focus-visible:underline">{s.name}</Link>
                    {s.verified && <VerifiedBadge />}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {teacher && <Pill variant="secondary"><GraduationCap className="size-3" aria-hidden />Professor</Pill>}
              {classmate && <Pill variant="outline"><GraduationCap className="size-3" aria-hidden />{CLASSMATE_LABEL}</Pill>}
              {person.level !== null && <Pill variant="secondary"><Award className="size-3" aria-hidden />Nível {person.level}</Pill>}
              {person.level !== null && <Pill variant="outline">{person.xp ?? 0} XP</Pill>}
            </div>
          </>
        )}
      </ProfileHero>

      {!person.restricted && (
        <Tabs defaultValue="Publicações">
          <TabsList aria-label="Perfil">
            <TabsTrigger value="Publicações">Publicações</TabsTrigger>
            <TabsTrigger value="Medalhas">Medalhas</TabsTrigger>
          </TabsList>

          <TabsContent value="Publicações" className="flex flex-col">
            {posts.length === 0 ? (
              <EmptyState title="Sem publicações para ver" message="Aqui aparecem as publicações desta pessoa na tua turma." />
            ) : (
              posts.map((p) => (
                <PostCard key={p.id} post={p} author={author} myClassId={myClassId} myAccountId={myAccountId} myName={myName} myPhoto={myPhoto} />
              ))
            )}
          </TabsContent>

          <TabsContent value="Medalhas" className="p-4">
            {person.badges.length === 0 ? (
              <Card className="grid justify-items-center gap-1 px-5 py-10 text-center text-sm text-muted-foreground">
                <b className="text-foreground">Ainda sem medalhas</b>
                <span>As medalhas desbloqueadas aparecem aqui.</span>
              </Card>
            ) : (
              <div className="grid gap-3.5 sm:grid-cols-2">
                {person.badges.map((b) => (
                  <Card key={b} className="flex-row items-center gap-3.5 px-5 py-3.5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Award className="size-5" /></span>
                    <b className="text-sm leading-snug">{b}</b>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </Page>
  );
}
