'use client';

import Link from 'next/link';
import { Ico } from '@/components/ui/ico';
import { Experience } from '@/components/experience';
import type { ExperienceEntry } from '@/lib/experience-rules';
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
import type { Friend } from '@/lib/friends';
import type { PersonProfile } from '@/lib/profiles';
import { PersonActions } from './person-actions';
import { PersonFriendButton } from './person-friend-button';

/**
 * O perfil de outra pessoa, no mesmo modelo do teu: faixa, foto grande sobreposta, nome, factos
 * e separadores. Só mostra o que a visibilidade dessa pessoa deixa ver.
 *
 * Um professor tem o seu próprio perfil, não uma cópia do do aluno (#427): a especialidade em vez
 * do nível/XP, sem separador de Medalhas e sem o botão de amizade — amizade é só entre alunos (#121).
 */
export function PersonView({
  person,
  posts,
  classmate,
  myAccountId,
  myName,
  myPhoto,
  myClassId,
  friend,
  experience = [],
}: {
  experience?: ExperienceEntry[];
  person: PersonProfile & { accountId: number };
  posts: FeedPost[];
  classmate: boolean;
  myAccountId: number | null;
  myName: string;
  myPhoto: string | null;
  myClassId: number | null;
  friend: Friend | null;
}) {
  // 'teacher'/'student' em minúsculas — o que o backend devolve desde a #336 (#427).
  const teacher = person.kind === 'teacher';
  const author: FeedAuthor = { name: person.displayName, photo: person.photo, verified: person.verified };

  const publications = (
    <div className="flex flex-col">
      {posts.length === 0 ? (
        <EmptyState
          title="Sem publicações para ver"
          message={teacher ? 'Aqui aparecem as publicações deste professor na tua turma.' : 'Aqui aparecem as publicações desta pessoa na tua turma.'}
        />
      ) : (
        posts.map((p) => (
          <PostCard key={p.id} post={p} author={author} myClassId={myClassId} myAccountId={myAccountId} myName={myName} myPhoto={myPhoto} />
        ))
      )}
    </div>
  );

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
                    <Ico name="building" size={16} className="shrink-0" />
                    <Link href={`/escola/${s.id}`} className="min-w-0 truncate py-1 font-medium hover:underline focus-visible:underline">{s.name}</Link>
                    {s.verified && <VerifiedBadge />}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {teacher ? (
                <>
                  <Pill variant="secondary"><Ico name="school" size={14} />Professor</Pill>
                  {person.specialty && <Pill variant="outline">{person.specialty}</Pill>}
                </>
              ) : (
                <>
                  {classmate && <Pill variant="outline"><Ico name="school" size={14} />{CLASSMATE_LABEL}</Pill>}
                  {person.level !== null && <Pill variant="secondary"><Ico name="award" size={14} />Nível {person.level}</Pill>}
                  {person.level !== null && <Pill variant="outline">{person.xp ?? 0} XP</Pill>}
                </>
              )}
            </div>
          </>
        )}
      </ProfileHero>

      {/* Amizade (#121): só entre alunos — o professor e quem já viu a regra "mesma
          escola e ano letivo" falhar fica sem o botão em vez de um pedido que o
          servidor recusa sempre. Não aparece no próprio perfil (a página redirige antes). */}
      {!teacher && myAccountId !== null && (
        <div className="border-t pt-4">
          <PersonFriendButton accountId={person.accountId} friend={friend} />
        </div>
      )}

      {/* Denunciar e bloquear (#323). Não aparece no próprio perfil: denunciar-se a si
          não tem moderação que resolva, e bloquear-se a si dá sempre erro. */}
      <div className="border-t pt-4">
        <PersonActions
          accountId={person.accountId}
          nome={person.displayName}
          podeBloquear={myAccountId !== null && myAccountId !== person.accountId}
        />
      </div>

      {/* Um professor não tem medalhas (é gamificação só do aluno, #371): sem separador
          nenhum a mostrar, as publicações aparecem sozinhas em vez de dentro de um Tabs
          de uma aba só — é a própria estrutura do perfil a ficar diferente, não só os dados. */}
      {!person.restricted && (teacher ? publications : (
        <Tabs defaultValue="Publicações">
          <TabsList aria-label="Perfil">
            <TabsTrigger value="Publicações">Publicações</TabsTrigger>
            <TabsTrigger value="Experiência">Experiência</TabsTrigger>
            <TabsTrigger value="Medalhas">Medalhas</TabsTrigger>
          </TabsList>

          <TabsContent value="Publicações" className="flex flex-col">
            {publications}
          </TabsContent>

          <TabsContent value="Experiência">
            <Experience entries={experience} teacher={teacher} own={false} />
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
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Ico name="award" filled size={22} /></span>
                    <b className="text-sm leading-snug">{b}</b>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      ))}
    </Page>
  );
}
