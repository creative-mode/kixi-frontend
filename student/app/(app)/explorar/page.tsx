import Link from 'next/link';
import { Page, PageHeader } from '@/components/page';
import { UserAvatar } from '@/components/user-avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import { Icon } from '@/components/icon';
import { listFriends, listRequests, searchColleagues } from '@/lib/friends';
import { getProfile } from '@/lib/me';
import { getSchoolTeachers, searchSchools, type SchoolCard } from '@/lib/profiles';
import { MIN_QUERY, isSearchable, matchesName, normalizeQuery, uniqueBy } from '@/lib/search-rules';
import { curatedEnunciados, enunciadosBySubject, searchEnunciados } from '@/lib/explore';
import { mergePeople, schoolBadge } from '@/lib/explore-rules';
import type { CatalogItem } from '@/lib/catalog';

export const metadata = { title: 'Explorar · Kixi' };

/** Quantas escolas se consultam à procura de professores com aquele nome. */
const SCHOOLS_FOR_TEACHERS = 5;

type Tab = 'enunciados' | 'escolas' | 'pessoas';

function parseTab(raw: string | string[] | undefined): Tab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === 'escolas' || v === 'pessoas' ? v : 'enunciados';
}

/** Uma linha achatada, com traço no topo em vez de cartão — é como o protótipo desenha
 *  cada resultado do Explorar, diferente das `Card`s do resto da app. */
function Row({ href, logo, name, sub }: { href: string; logo: React.ReactNode; name: string; sub?: string | null }) {
  return (
    <li className="border-t first:border-t-0">
      <Link href={href} className="flex min-h-14 items-center gap-3 py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
        {logo}
        <span className="grid min-w-0 flex-1">
          <span className="truncate font-medium">{name}</span>
          {sub && <span className="truncate text-[13px] text-muted-foreground">{sub}</span>}
        </span>
        <Icon name="right" size={18} className="shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

function SchoolLogo({ name }: { name: string }) {
  const badge = schoolBadge(name);
  return (
    <span
      className="flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
      style={{ background: badge.bg, color: badge.fg }}
    >
      {badge.initials}
    </span>
  );
}

function EnunciadoRow({ item }: { item: CatalogItem }) {
  return <Row href={`/prova/${item.id}/detalhe`} logo={<SchoolLogo name={item.school || '?'} />} name={item.title} sub={item.school} />;
}

/**
 * O Explorar (#728): uma pesquisa só, com três abas — Enunciados, Escolas e Pessoas —
 * em vez de três secções sempre abertas. Sem nada escrito, a aba Enunciados sugere
 * enunciados de outras escolas sobre a disciplina mais fraca do aluno; as outras duas
 * só mostram resultados depois de uma pesquisa, porque não há "escola em destaque" ou
 * "pessoa em destaque" nenhuma a sugerir.
 */
export default async function ExplorarPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const tab = parseTab(sp.tab);
  const q = normalizeQuery(sp.q);
  const ready = isSearchable(q);
  const subjectIdRaw = Array.isArray(sp.subjectId) ? sp.subjectId[0] : sp.subjectId;
  const subjectId = subjectIdRaw && Number.isInteger(Number(subjectIdRaw)) ? Number(subjectIdRaw) : null;

  const profile = await getProfile();
  const mySchoolId = profile.kind === 'ok' ? (profile.me.school?.id ?? null) : null;

  const tabs: { id: Tab; label: string }[] = [
    { id: 'enunciados', label: 'Enunciados' },
    { id: 'escolas', label: 'Escolas' },
    { id: 'pessoas', label: 'Pessoas' },
  ];
  const tabHref = (id: Tab) => `/explorar?tab=${id}${q ? `&q=${encodeURIComponent(q)}` : ''}`;

  return (
    <Page>
      <PageHeader title="Explorar" />

      <form role="search" action="/explorar" className="flex">
        <input type="hidden" name="tab" value={tab} />
        <label htmlFor="q" className="sr-only">Pesquisar enunciados, escolas ou pessoas</label>
        <span className="flex h-12 w-full items-center gap-2 rounded-full border border-input bg-card px-4 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30">
          <Icon name="search" size={18} className="shrink-0 text-muted-foreground" />
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            minLength={MIN_QUERY}
            placeholder="Pesquisar enunciados, escolas ou pessoas"
            className="min-w-0 flex-1 bg-transparent text-base outline-none md:text-sm"
          />
        </span>
      </form>

      <div role="tablist" aria-label="Tipo de resultado" className="flex gap-1.5">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={tabHref(t.id)}
            role="tab"
            aria-selected={tab === t.id}
            className="rounded-full px-4 py-1.5 text-[13px] font-medium outline-none aria-selected:bg-primary aria-selected:text-primary-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 not-aria-selected:bg-muted not-aria-selected:text-muted-foreground"
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === 'enunciados' && <EnunciadosTab q={q} ready={ready} subjectId={subjectId} mySchoolId={mySchoolId} />}

      {tab === 'escolas' && <EscolasTab q={q} ready={ready} />}

      {tab === 'pessoas' && <PessoasTab q={q} ready={ready} mySchoolId={mySchoolId} />}
    </Page>
  );
}

async function EnunciadosTab({ q, ready, subjectId, mySchoolId }: { q: string; ready: boolean; subjectId: number | null; mySchoolId: number | null }) {
  if (subjectId != null) {
    const result = await enunciadosBySubject(subjectId, mySchoolId);
    if (!result || result.items.length === 0) {
      return <p className="text-sm text-muted-foreground">Ainda não há enunciados de outras escolas nesta disciplina.</p>;
    }
    return (
      <section aria-label={`Enunciados de ${result.subjectName}`} className="grid gap-1">
        <h2 className="text-[15px] font-bold">Enunciados de {result.subjectName}</h2>
        <ul className="grid">{result.items.map((item) => <EnunciadoRow key={item.id} item={item} />)}</ul>
      </section>
    );
  }

  if (ready) {
    const items = await searchEnunciados(q);
    return (
      <section aria-label="Enunciados" className="grid gap-1">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum enunciado encontrado para «{q}».</p>
        ) : (
          <ul className="grid">{items.map((item) => <EnunciadoRow key={item.id} item={item} />)}</ul>
        )}
      </section>
    );
  }
  if (q.length > 0) return <p className="text-sm text-muted-foreground">Escreve pelo menos {MIN_QUERY} letras.</p>;

  const curated = await curatedEnunciados(mySchoolId);
  if (!curated) return null;
  return (
    <section aria-label={`Para a tua prova de ${curated.subjectName}`} className="grid gap-1">
      <h2 className="text-[15px] font-bold">Para a tua prova de {curated.subjectName}</h2>
      <p className="text-[13px] text-muted-foreground">Enunciados de outras escolas sobre os mesmos temas</p>
      <ul className="grid">{curated.items.map((item) => <EnunciadoRow key={item.id} item={item} />)}</ul>
      <Link href={`/explorar?tab=enunciados&subjectId=${curated.subjectId}`} className="border-t py-3 text-sm font-medium text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
        Ver os {curated.total} enunciados de {curated.subjectName}
      </Link>
    </section>
  );
}

async function EscolasTab({ q, ready }: { q: string; ready: boolean }) {
  if (!ready) {
    return <p className="text-sm text-muted-foreground">{q.length > 0 ? `Escreve pelo menos ${MIN_QUERY} letras.` : 'Escreve o nome de uma escola.'}</p>;
  }
  const result = await searchSchools(q);
  if (!result.ok) return <p role="alert" className="text-sm text-destructive">{result.message}</p>;
  const schools: SchoolCard[] = result.data;
  if (schools.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma escola encontrada para «{q}».</p>;
  return (
    <ul className="grid">
      {schools.map((s) => (
        <Row key={s.id} href={`/escola/${s.id}`} logo={<UserAvatar name={s.name} src={s.logo} size={40} />} name={s.name} sub={s.code} />
      ))}
    </ul>
  );
}

async function PessoasTab({ q, ready, mySchoolId }: { q: string; ready: boolean; mySchoolId: number | null }) {
  if (!ready) {
    return <p className="text-sm text-muted-foreground">{q.length > 0 ? `Escreve pelo menos ${MIN_QUERY} letras.` : 'Escreve o nome de um professor ou de um aluno.'}</p>;
  }
  const [found, friends, requests, schoolsResult] = await Promise.all([
    searchColleagues(q),
    listFriends(),
    listRequests(),
    searchSchools(q),
  ]);
  const students = uniqueBy(
    [...found, ...[...friends, ...requests].filter((f) => matchesName(q, f.displayName))],
    (s) => s.accountId,
  );
  const schools: SchoolCard[] = schoolsResult.ok ? schoolsResult.data : [];
  const ids = uniqueBy([...(mySchoolId ? [mySchoolId] : []), ...schools.map((s) => s.id)], (id) => id).slice(0, SCHOOLS_FOR_TEACHERS);
  const lists = await Promise.all(ids.map(async (id) => {
    const r = await getSchoolTeachers(id);
    return r.ok ? r.data : [];
  }));
  const teachers = uniqueBy(lists.flat(), (t) => t.accountId ?? `t${t.id}`).filter((t) => t.accountId != null && matchesName(q, t.displayName));

  const people = mergePeople(teachers, students);
  if (people.length === 0) return <p className="text-sm text-muted-foreground">Nenhum resultado encontrado para «{q}».</p>;
  return (
    <ul className="grid">
      {people.map((p) => (
        <li key={p.accountId} className="border-t first:border-t-0">
          <Link href={`/u/${p.accountId}`} className="flex min-h-14 items-center gap-3 py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
            <UserAvatar name={p.displayName} src={p.photo} size={40} />
            <span className="grid min-w-0 flex-1">
              <span className="flex items-center gap-1 truncate font-medium">{p.displayName}{p.verified && <VerifiedBadge />}</span>
              {p.sub && <span className="truncate text-[13px] text-muted-foreground">{p.sub}</span>}
            </span>
            <Icon name="right" size={18} className="shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
