import Link from 'next/link';
import { UserAvatar } from '@/components/user-avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import { listFriends, listRequests, searchColleagues } from '@/lib/friends';
import { getProfile } from '@/lib/me';
import { getSchoolTeachers, searchSchools, type SchoolCard, type TeacherCard } from '@/lib/profiles';
import { getCatalog, getCatalogNames } from '@/lib/catalog';
import { MIN_QUERY, isSearchable, matchesName, normalizeQuery, uniqueBy } from '@/lib/search-rules';

export const metadata = { title: 'Pesquisar · Kixi' };

/** Quantas escolas se consultam à procura de professores com aquele nome. */
const SCHOOLS_FOR_TEACHERS = 5;

function Section({ title, empty, children, count }: { title: string; empty: string; count: number; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="grid gap-1">
      <h2 className="m-0 text-xl font-extrabold tracking-[-0.01em]">{title}</h2>
      {count === 0 ? <p className="text-sm text-[#617066]">{empty}</p> : <ul className="m-0 grid list-none border-t border-[#eef0ec] p-0">{children}</ul>}
    </section>
  );
}

function Row({ href, name, sub, photo, verified }: { href: string; name: string; sub?: string | null; photo?: string | null; verified?: boolean }) {
  return (
    <li className="border-b border-[#eef0ec]">
      <Link href={href} className="flex min-h-[72px] items-center gap-3.5 text-[#121c15] no-underline outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
        <UserAvatar name={name} src={photo} size={46} />
        <span className="grid min-w-0 flex-1">
          <span className="flex items-center gap-1 truncate text-base font-bold">{name}{verified && <VerifiedBadge />}</span>
          {sub && <span className="truncate text-sm text-[#617066]">{sub}</span>}
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7a857d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
      </Link>
    </li>
  );
}

/**
 * Pesquisa de perfis: escolas, professores e alunos. As escolas vêm da pesquisa do servidor. Os
 * professores procuram-se pelo nome nas escolas encontradas e na tua. Os alunos são os colegas
 * que o servidor deixa pesquisar (nomes abreviados), porque não há pesquisa pública de alunos.
 */
export default async function PesquisaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = normalizeQuery(sp.q);
  const abaRaw = Array.isArray(sp.aba) ? sp.aba[0] : sp.aba;
  const aba = abaRaw === 'escolas' || abaRaw === 'pessoas' ? abaRaw : 'enunciados';
  const ready = isSearchable(q);

  // A pesquisa de colegas do servidor deixa de fora quem já é amigo ou tem um pedido em curso
  // (serve para convidar), por isso juntam-se essas ligações, filtradas pelo nome.
  const [profile, schoolsResult, found, friends, requests] = await Promise.all([
    getProfile(),
    searchSchools(q),
    ready ? searchColleagues(q) : Promise.resolve([]),
    ready ? listFriends() : Promise.resolve([]),
    ready ? listRequests() : Promise.resolve([]),
  ]);
  const students = uniqueBy(
    [...found, ...[...friends, ...requests].filter((f) => matchesName(q, f.displayName))],
    (s) => s.accountId,
  );
  const catalogo = ready || aba === 'enunciados' ? await getCatalog({ q: ready ? q : '', size: 8 }, await getCatalogNames()) : null;
  const enunciados = catalogo?.ok ? catalogo.items : [];
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
    <div className="flex min-w-0 flex-col gap-5 px-4 pt-3 pb-28 md:px-0 md:pt-7 md:pb-12">
      <h1 className="sr-only">Pesquisar</h1>
      <form role="search" action="" className="flex items-center gap-3 rounded-full bg-[#f5f6f4] px-[18px]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#617066" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <label htmlFor="q" className="sr-only">Nome de uma escola, de um professor ou de um aluno</label>
        <input id="q" name="q" type="search" defaultValue={q} minLength={MIN_QUERY} placeholder="Pesquisar escolas, professores ou alunos" className="h-[54px] min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[#617066]" />
        <button type="submit" className="sr-only">Pesquisar</button>
      </form>

      {q.length > 0 && !ready && <p className="text-sm text-muted-foreground">Escreve pelo menos {MIN_QUERY} letras.</p>}
      {!schoolsResult.ok && ready && <p role="alert" className="text-sm text-destructive">{schoolsResult.message}</p>}

      <nav role="tablist" aria-label="Tipo de resultado" className="flex gap-1">
        {([['enunciados', 'Enunciados'], ['escolas', 'Escolas'], ['pessoas', 'Pessoas']] as const).map(([id, label]) => (
          <Link key={id} href={`/pesquisa?aba=${id}${q ? `&q=${encodeURIComponent(q)}` : ''}`} role="tab" aria-selected={aba === id} className="rounded-full px-4 py-2.5 text-[15px] font-bold text-[#617066] no-underline aria-selected:bg-[#f5f6f4] aria-selected:text-[#121c15]">{label}</Link>
        ))}
      </nav>

      {aba === 'enunciados' && (
        <Section title={ready ? 'Enunciados' : 'Enunciados recentes'} count={enunciados.length} empty="Nenhum enunciado encontrado.">
          {enunciados.map((e) => <Row key={e.id} href={`/prova/${e.id}/detalhe`} name={`${e.kind} · ${e.title}`} sub={[e.school, e.subject].filter(Boolean).join(' · ')} />)}
        </Section>
      )}
      {ready && aba === 'escolas' && (
        <Section title="Escolas" count={schools.length} empty={`Nenhuma escola encontrada para «${q}».`}>
          {schools.map((s) => <Row key={s.id} href={`/escola/${s.id}`} name={s.name} sub={s.code} photo={s.logo} verified={s.verified} />)}
        </Section>
      )}
      {ready && aba === 'pessoas' && (
        <div className="grid gap-5">
          <Section title="Professores" count={teachers.length} empty={`Nenhum professor encontrado para «${q}».`}>
            {teachers.map((t) => <Row key={t.accountId} href={`/u/${t.accountId}`} name={t.displayName} sub={t.specialty} photo={t.photo} verified={t.verified} />)}
          </Section>
          <Section title="Alunos" count={students.length} empty={`Nenhum colega encontrado para «${q}».`}>
            {students.map((s) => <Row key={s.accountId} href={`/u/${s.accountId}`} name={s.displayName} sub="Colega" />)}
          </Section>
        </div>
      )}
      {!ready && aba !== 'enunciados' && <p className="text-sm text-[#617066]">Escreve pelo menos {MIN_QUERY} letras para procurar.</p>}
    </div>
  );
}
