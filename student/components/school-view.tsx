'use client';

import Link from 'next/link';
import { BookOpen, GraduationCap, Users } from 'lucide-react';
import { Page, PageHeader } from '@/components/page';
import { ProfileHero } from '@/components/profile-hero';
import { EmptyState } from '@/components/states';
import { UserAvatar } from '@/components/user-avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import { Badge as Pill } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CatalogItem } from '@/lib/catalog';
import type { SchoolProfile, TeacherCard } from '@/lib/profiles';

/**
 * O perfil de uma escola, no mesmo padrão do teu: faixa, logótipo grande, nome com selo, etiquetas e
 * separadores. O que lhe é próprio são os números da escola e os separadores Professores e Enunciados.
 */
export function SchoolView({ school, teachers, statements }: { school: SchoolProfile; teachers: TeacherCard[]; statements: CatalogItem[] }) {
  return (
    <Page className="gap-0 p-0 pb-24 md:pb-10">
      <PageHeader title={school.name} kicker={school.code} back="/pesquisa" className="m-0" />
      <ProfileHero name={school.name} photoName={school.shortName ?? school.name} photo={school.logo} verified={school.verified} verifiedLabel="Escola verificada">
        <p className="mt-1 text-[15px] text-muted-foreground">{school.verified ? 'Escola verificada pela Kixi.' : 'Escola ainda não verificada.'}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Pill variant="secondary"><GraduationCap className="size-3" aria-hidden />{school.teacherCount} {school.teacherCount === 1 ? 'professor' : 'professores'}</Pill>
          <Pill variant="outline"><Users className="size-3" aria-hidden />{school.studentCount} {school.studentCount === 1 ? 'aluno' : 'alunos'}</Pill>
          <Pill variant="outline"><BookOpen className="size-3" aria-hidden />{school.statementCount} {school.statementCount === 1 ? 'enunciado' : 'enunciados'}</Pill>
        </div>
      </ProfileHero>

      <Tabs defaultValue="Professores">
        <TabsList aria-label="Escola">
          <TabsTrigger value="Professores">Professores</TabsTrigger>
          <TabsTrigger value="Enunciados">Enunciados</TabsTrigger>
        </TabsList>

        <TabsContent value="Professores" className="flex flex-col">
          {teachers.length === 0 ? (
            <EmptyState title="Nenhum professor listado" message="Os professores desta escola aparecem aqui." />
          ) : (
            teachers.map((t) => {
              const row = (
                <>
                  <UserAvatar name={t.displayName} src={t.photo} size={44} />
                  <span className="grid min-w-0">
                    <span className="flex items-center gap-1 truncate font-bold">{t.displayName}{t.verified && <VerifiedBadge label="Professor verificado" />}</span>
                    {t.specialty && <span className="truncate text-[14px] text-muted-foreground">{t.specialty}</span>}
                  </span>
                </>
              );
              const cls = 'flex min-h-14 items-center gap-3 border-b px-4 py-2.5';
              return t.accountId ? (
                <Link key={t.id} href={`/u/${t.accountId}`} className={`${cls} transition-colors hover:bg-secondary/40`}>{row}</Link>
              ) : (
                <div key={t.id} className={cls}>{row}</div>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="Enunciados" className="flex flex-col">
          {statements.length === 0 ? (
            <EmptyState title="Ainda não há enunciados" message="Os enunciados publicados por esta escola aparecem aqui." />
          ) : (
            statements.map((e) => (
              <Link key={e.id} href={`/prova/${e.id}`} className="flex min-h-14 items-center justify-between gap-3 border-b px-4 py-2.5 transition-colors hover:bg-secondary/40">
                <span className="truncate font-bold">{e.title}</span>
                <span className="shrink-0 text-[13px] text-muted-foreground">{e.subject}</span>
              </Link>
            ))
          )}
        </TabsContent>
      </Tabs>
    </Page>
  );
}
