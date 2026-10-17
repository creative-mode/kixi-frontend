import Link from 'next/link';
import { Page, PageHeader } from '@/components/page';
import { UserAvatar } from '@/components/user-avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import { Card } from '@/components/ui/card';
import { searchColleagues } from '@/lib/friends';
import { getProfile } from '@/lib/me';
import { getSchoolTeachers, searchSchools, type SchoolCard, type TeacherCard } from '@/lib/profiles';
import { MIN_QUERY, isSearchable, matchesName, normalizeQuery, uniqueBy } from '@/lib/search-rules';

export const metadata = { title: 'Pesquisar · Kixi' };

/** Quantas escolas se consultam à procura de professores com aquele nome. */
const SCHOOLS_FOR_TEACHERS = 5;

function Section({ title, empty, children, count }: { title: string; empty: string; count: number; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="grid gap-2">
      <h2 className="text-[15px] font-bold">{title}</h2>
      {count === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : <ul className="grid gap-2">{children}</ul>}
    </section>
  );
}

function Row({ href, name, sub, photo, verified }: { href: string; name: string; sub?: string | null; photo?: string | null; verified?: boolean }) {
  return (
    <li>
      <Card className="py-0">
        <Link href={href} className="flex min-h-12 items-center gap-3 rounded-xl p-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
          <UserAvatar name={name} src={photo} size={40} />
          <span className="grid min-w-0">
            <span className="flex items-center gap-1 truncate font-medium">{name}{verified && <VerifiedBadge />}</span>
            {sub && <span className="truncate text-[13px] text-muted-foreground">{sub}</span>}
          </span>
        </Link>
      </Card>
    </li>
  );
}

/**
 * Pesquisa de perfis: escolas, professores e alunos. As escolas vêm da pesquisa do servidor. Os
 * professores procuram-se pelo nome nas escolas encontradas e na tua. Os alunos são os colegas
 * que o servidor deixa pesquisar (nomes abreviados), porque não há pesquisa pública de alunos.
 */
export default async function PesquisaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = normalizeQuery((await searchParams).q);
  const ready = isSearchable(q);

  const [profile, schoolsResult, students] = await Promise.all([
    getProfile(),
    searchSchools(q),
    ready ? searchColleagues(q) : Promise.resolve([]),
  ]);
  const schools: SchoolCard[] = schoolsResult.ok ? schoolsResult.data : [];
  const mySchoolId = profile.kind === 'ok' ? (profile.me.school?.id ?? null) : null;

  let teachers: TeacherCard[] = [];
  if (ready) {
    const ids = uniqueBy([...(mySchoolId ? [mySchoolId] : []), ...schools.map((s) => s.id)], (id) => id).slice(0, SCHOOLS_FOR_TEACHERS);
    const lists = await Promise.all(ids.map(async (id) => {
      const r = await getSchoolTeachers(id);
      return r.ok ? r.data : [];
    }));
    teachers = uniqueBy(lists.flat(), (t) => t.accountId ?? `t${t.id}`).filter((t) => t.accountId != null && matchesName(q, t.displayName));
  }

  return (
    <Page>
      <PageHeader title="Pesquisar" description="Encontra escolas, professores e alunos." />
      <form role="search" action="" className="flex gap-2">
        <label htmlFor="q" className="sr-only">Nome de uma escola, de um professor ou de um aluno</label>
        <input id="q" name="q" type="search" defaultValue={q} minLength={MIN_QUERY} placeholder="Ex.: ITEL, Ana ou Prof. Costa" className="h-11 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30" />
        <button type="submit" className="h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">Pesquisar</button>
      </form>

      {q.length > 0 && !ready && <p className="text-sm text-muted-foreground">Escreve pelo menos {MIN_QUERY} letras.</p>}
      {!schoolsResult.ok && ready && <p role="alert" className="text-sm text-destructive">{schoolsResult.message}</p>}

      {ready && (
        <div className="grid gap-5">
          <Section title="Escolas" count={schools.length} empty={`Nenhuma escola encontrada para «${q}».`}>
            {schools.map((s) => <Row key={s.id} href={`/escola/${s.id}`} name={s.name} sub={s.code} photo={s.logo} verified={s.verified} />)}
          </Section>
          <Section title="Professores" count={teachers.length} empty={`Nenhum professor encontrado para «${q}».`}>
            {teachers.map((t) => <Row key={t.accountId} href={`/u/${t.accountId}`} name={t.displayName} sub={t.specialty} photo={t.photo} verified={t.verified} />)}
          </Section>
          <Section title="Alunos" count={students.length} empty={`Nenhum colega encontrado para «${q}».`}>
            {students.map((s) => <Row key={s.accountId} href={`/u/${s.accountId}`} name={s.displayName} sub="Colega" />)}
          </Section>
        </div>
      )}
    </Page>
  );
}
