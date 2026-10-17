import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Page, PageHeader } from '@/components/page';
import { RefreshError } from '@/components/refresh-error';
import { UserAvatar } from '@/components/user-avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getSchool, getSchoolStatements, getSchoolTeachers } from '@/lib/profiles';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const school = await getSchool(Number((await params).id));
  return { title: `${school.ok ? school.data.name : 'Escola'} · Kixi` };
}

/** O perfil público de uma escola: identidade, selo, números, professores e enunciados. */
export default async function EscolaPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const school = await getSchool(id);
  if (!school.ok) {
    if (school.status === 404) notFound();
    return <RefreshError title="Não foi possível carregar a escola" message={school.message} status={school.status} back={{ href: "/pesquisa", label: "Pesquisar escolas" }} />;
  }
  const [teachers, statements] = await Promise.all([getSchoolTeachers(id), getSchoolStatements(id)]);
  const s = school.data;

  return (
    <Page>
      <PageHeader title={s.name} kicker={s.code} back="/pesquisa" />
      <section aria-label="Escola" className="flex items-center gap-4">
        <UserAvatar name={s.shortName ?? s.name} src={s.logo} size={72} />
        <div className="grid gap-1">
          <p className="flex items-center gap-1.5 text-lg font-semibold">
            {s.name}
            {s.verified && <VerifiedBadge />}
          </p>
          <p className="text-sm text-muted-foreground">
            {s.verified ? 'Escola verificada pela Kixi.' : 'Escola ainda não verificada.'}
          </p>
        </div>
      </section>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ['Professores', s.teacherCount],
          ['Alunos', s.studentCount],
          ['Enunciados', s.statementCount],
        ].map(([label, value]) => (
          <Card key={label} className="gap-0 py-3">
            <dd className="text-xl font-bold">{value}</dd>
            <dt className="text-[13px] text-muted-foreground">{label}</dt>
          </Card>
        ))}
      </dl>
      <Card>
        <CardHeader><CardTitle>Professores</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {!teachers.ok || teachers.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum professor listado.</p>
          ) : (
            teachers.data.map((t) => {
              const row = (
                <>
                  <UserAvatar name={t.displayName} src={t.photo} size={40} />
                  <span className="grid min-w-0">
                    <span className="flex items-center gap-1 truncate font-medium">{t.displayName}{t.verified && <VerifiedBadge label="Professor verificado" />}</span>
                    {t.specialty && <span className="truncate text-[13px] text-muted-foreground">{t.specialty}</span>}
                  </span>
                </>
              );
              return t.accountId ? (
                <Link key={t.id} href={`/u/${t.accountId}`} className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">{row}</Link>
              ) : (
                <div key={t.id} className="flex items-center gap-3">{row}</div>
              );
            })
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Enunciados desta escola</CardTitle></CardHeader>
        <CardContent className="grid gap-2">
          {statements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há enunciados publicados.</p>
          ) : (
            statements.map((e) => (
              <Link key={e.id} href={`/prova/${e.id}`} className="flex items-center justify-between gap-3 rounded-md py-1.5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
                <span className="truncate font-medium">{e.title}</span>
                <span className="shrink-0 text-[13px] text-muted-foreground">{e.subject}</span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </Page>
  );
}
