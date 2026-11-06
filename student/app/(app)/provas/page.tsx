import Link from 'next/link';
import { Search } from 'lucide-react';
import { Column, Page, PageHeader } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { CatalogFilters } from '@/components/catalog-filters';
import { NativeSelect } from '@/components/ui/native-select';
import { EmptyState } from '@/components/states';
import { RefreshError } from '@/components/refresh-error';
import { getCatalog, getCatalogNames, type CatalogItem, type ExamState } from '@/lib/catalog';
import { listInvitations } from '@/lib/exam-room';
import { invitationsErrorOf } from '@/lib/exam-room-rules';
import { SalasDeProva } from '@/components/salas-de-prova';

export const metadata = { title: 'Provas · Kixi' };

type Params = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 10;
/** Copied from the manager's KINDS (lib/exam/schools.ts): examType is free text
 *  in the backend and the catalog matches case-insensitively, so the filter
 *  must offer exactly what the manager writes. Kept as a copy because the apps
 *  do not share imports. */
const EXAM_TYPES = ['Trabalho prático', 'Teste', 'Prova', 'Exame'];

function one(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? '').trim();
}

function num(raw: string | string[] | undefined): number | null {
  const value = one(raw);
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function State({ item }: { item: CatalogItem }) {
  if (item.state === 'progress') {
    return (
      <div className="grid gap-1.5">
        <Badge variant="warning" className="justify-self-start">Em curso</Badge>
      </div>
    );
  }
  if (item.state === 'done') {
    return (
      <div className="grid gap-1.5">
        <Badge variant="success" className="justify-self-start">
          Concluída{item.score ? ` · ${item.score}` : ''}
        </Badge>
      </div>
    );
  }
  return (
    <div className="grid gap-1.5">
      <Badge variant="info" className="justify-self-start">Nova</Badge>
    </div>
  );
}

/**
 * The card's button label. It opens the detail (#19), not the room, so it cannot say
 * "Continuar": there is a choice of two modes in between and the label is the only
 * thing telling the student what a click will do.
 */
function actionOf(state: ExamState): string {
  return state === 'progress' ? 'Retomar' : state === 'done' ? 'Ver resultado' : 'Ver a prova';
}


type Aba = 'salas' | 'enunciados';

/** As duas abas da página: as salas de prova a que o professor convidou o aluno e os enunciados para simular.
 *  São ligações (a aba vive no URL), por isso funcionam sem JavaScript e o botão Voltar respeita-as. */
function Abas({ aba, salas, enunciados, convites }: { aba: Aba; salas: string; enunciados: string; convites: number }) {
  const item = (id: Aba, href: string, label: string) => (
    <Link
      key={id}
      href={href}
      aria-current={aba === id ? 'page' : undefined}
      className={`-mb-px flex min-h-11 items-center border-b-2 px-4 text-sm font-semibold transition-colors ${aba === id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Provas" className="flex gap-1 border-b">
      {item('enunciados', enunciados, 'Enunciados')}
      {item('salas', salas, convites > 0 ? `Salas de prova (${convites})` : 'Salas de prova')}
    </nav>
  );
}

function Filters({
  values,
  subjects,
  years,
  schools,
}: {
  values: Record<string, string>;
  subjects: { id: number; name: string }[];
  years: { id: number; label: string }[];
  schools: { id: number; name: string }[];
}) {
  return (
    <form method="get" className="grid gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name="q"
          aria-label="Procurar enunciados"
          className="pl-10"
          placeholder="Procurar por título ou tipo"
          defaultValue={values.q ?? ''}
        />
      </div>
      <CatalogFilters active={[values.disciplina, values.tipo, values.ano, values.escola].filter(Boolean).length}>
        <label className="grid min-w-36 flex-1 gap-1 text-xs font-semibold text-muted-foreground">
          Disciplina
          <NativeSelect name="disciplina" defaultValue={values.disciplina ?? ''} aria-label="Disciplina">
            <option value="">Todas</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid min-w-36 flex-1 gap-1 text-xs font-semibold text-muted-foreground">
          Tipo de prova
          <NativeSelect name="tipo" defaultValue={values.tipo ?? ''} aria-label="Tipo de prova">
            <option value="">Todos</option>
            {EXAM_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid min-w-36 flex-1 gap-1 text-xs font-semibold text-muted-foreground">
          Ano letivo
          <NativeSelect name="ano" defaultValue={values.ano ?? ''} aria-label="Ano letivo">
            <option value="">Todos</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>{y.label}</option>
            ))}
          </NativeSelect>
        </label>
        <label className="grid min-w-36 flex-1 gap-1 text-xs font-semibold text-muted-foreground">
          Escola
          <NativeSelect name="escola" defaultValue={values.escola ?? ''} aria-label="Escola">
            <option value="">Todas</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </NativeSelect>
        </label>
      </CatalogFilters>
      {/* Sem JavaScript os filtros não se aplicam ao mudar, por isso o botão fica nesse caso. */}
      <noscript>
        <Button type="submit" variant="outline" size="sm">
          Filtrar
        </Button>
      </noscript>
    </form>
  );
}

/** Real exam catalog (`StatementCatalogController`, BE-108): paged and filtered
 *  by the backend, with names resolved from /subjects, /school-years and
 *  /institutions. Filters live in the URL; no mock data on this page. */
export default async function Provas({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const filters = {
    q: one(params.q),
    subjectId: num(params.disciplina),
    examType: one(params.tipo),
    schoolYearId: num(params.ano),
    institutionId: num(params.escola),
  };
  const page = Math.max(0, (Number(one(params.pagina)) || 1) - 1);
  const aba: Aba = one(params.aba) === 'salas' ? 'salas' : 'enunciados';

  const [names, invResult] = await Promise.all([getCatalogNames(), listInvitations()]);
  const invitations = invResult.ok ? invResult.data : [];
  const invitationsError = invitationsErrorOf(invResult);
  const abas = <Abas aba={aba} salas="/provas?aba=salas" enunciados="/provas" convites={invitations.length} />;

  if (aba === 'salas') {
    return (
      <Page variant="wide">
        <Column className="gap-5">
          <PageHeader title="Provas" description="Simula provas anteriores e vê onde precisas de reforçar." />
          {abas}
          {invitations.length === 0 && !invitationsError ? (
            <EmptyState title="Ainda não tens salas de prova" message="Quando um professor te convidar para uma prova controlada, a sala aparece aqui." />
          ) : (
            <SalasDeProva invitations={invitations} invitationsError={invitationsError} />
          )}
        </Column>
      </Page>
    );
  }

  const result = await getCatalog({ ...filters, page, size: PAGE_SIZE }, names);
  if (!result.ok) {
    return (
      <Page variant="wide">
        <Column className="gap-5">
          <PageHeader title="Provas" description="Simula provas anteriores e vê onde precisas de reforçar." />
          {abas}
          <RefreshError
            title="Não foi possível carregar os enunciados"
            message="Verifica a ligação à internet e tenta de novo. As tuas simulações estão guardadas."
          />
        </Column>
      </Page>
    );
  }

  const href = (pagina: number) => {
    const search = new URLSearchParams();
    if (filters.q) search.set('q', filters.q);
    if (filters.subjectId) search.set('disciplina', String(filters.subjectId));
    if (filters.examType) search.set('tipo', filters.examType);
    if (filters.schoolYearId) search.set('ano', String(filters.schoolYearId));
    if (filters.institutionId) search.set('escola', String(filters.institutionId));
    if (pagina > 1) search.set('pagina', String(pagina));
    const query = search.toString();
    return query ? `/provas?${query}` : '/provas';
  };

  const current = result.page + 1;

  return (
    <Page variant="wide">
      <Column className="gap-5">
        <PageHeader title="Provas" description="Simula provas anteriores e vê onde precisas de reforçar." />

        {abas}

        <Filters
          values={{
            q: filters.q,
            disciplina: filters.subjectId ? String(filters.subjectId) : '',
            tipo: filters.examType,
            ano: filters.schoolYearId ? String(filters.schoolYearId) : '',
            escola: filters.institutionId ? String(filters.institutionId) : '',
          }}
          subjects={names.subjects}
          years={names.years}
          schools={names.schools}
        />

        <Card className="gap-0 divide-y overflow-hidden py-0" aria-label="Enunciados disponíveis">
          {result.items.map((item) => (
            // The card opens the detail (#19), not the room: the three modes live
            // there, and going straight to the room would make them unreachable from
            // the list — which is exactly what the acceptance criterion asks for.
            <Link key={item.id} prefetch={false} href={`/prova/${item.id}/detalhe`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-5 py-3.5 transition-colors hover:bg-secondary/60 sm:grid-cols-[minmax(0,1fr)_170px_120px]">
              <span className="sr-only">{actionOf(item.state)}: </span>
              <div className="min-w-0"><div className="leading-snug font-bold">{item.kind} · {item.title}</div><div className="mt-0.5 text-[13px] text-muted-foreground">{[item.school, item.year, item.subject].filter(Boolean).join(' · ')}</div></div>
              <div className="order-3 col-span-2 sm:order-none sm:col-span-1"><State item={item} /></div>
              <span className="px-btn inline-flex h-10 items-center justify-center px-4 text-sm font-semibold [--face:var(--card)] [--edge:var(--input)] [--txt:var(--foreground)]">{actionOf(item.state)}</span>
            </Link>
          ))}
          {result.items.length === 0 && (
            <EmptyState
              title="Nenhum enunciado encontrado"
              message="Muda os filtros ou carrega o enunciado que procuras."
            />
          )}
        </Card>

        {result.totalPages > 1 ? (
          <nav className="flex items-center justify-between text-sm" aria-label="Paginação">
            {current > 1 ? (
              <Button asChild variant="outline" size="sm"><Link prefetch={false} href={href(current - 1)}>Anteriores</Link></Button>
            ) : <span />}
            <span className="text-muted-foreground">Página {current} de {result.totalPages} · {result.totalElements} enunciados</span>
            {current < result.totalPages ? (
              <Button asChild variant="outline" size="sm"><Link prefetch={false} href={href(current + 1)}>Seguintes</Link></Button>
            ) : <span />}
          </nav>
        ) : null}
      </Column>
    </Page>
  );
}
