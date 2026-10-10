import Link from 'next/link';
import { Camera, Search } from 'lucide-react';
import { Column, Page, PageHeader } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { EmptyState } from '@/components/states';
import { RefreshError } from '@/components/refresh-error';
import { getCatalog, getCatalogNames, type CatalogItem, type ExamState } from '@/lib/catalog';

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

function actionOf(state: ExamState): string {
  return state === 'progress' ? 'Continuar' : state === 'done' ? 'Ver resultado' : 'Começar';
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
          aria-label="Procurar provas"
          className="pl-10"
          placeholder="Procurar por título ou tipo"
          defaultValue={values.q ?? ''}
        />
      </div>
      <div className="flex flex-wrap gap-3">
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
      </div>
      <div>
        <Button type="submit" variant="outline" size="sm">
          Filtrar
        </Button>
      </div>
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

  const names = await getCatalogNames();
  const result = await getCatalog({ ...filters, page, size: PAGE_SIZE }, names);
  if (!result.ok) {
    return (
      <Page variant="wide">
        <Column className="gap-5">
          <PageHeader title="Provas" description="Simula provas anteriores e vê onde precisas de reforçar." />
          <RefreshError
            title="Não foi possível carregar as provas"
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

        <div className="flex flex-wrap items-center gap-4 rounded-xl border-[1.5px] border-dashed border-input bg-card px-5 py-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Camera className="size-5" /></span>
          <p className="min-w-[200px] flex-1 text-sm text-muted-foreground"><b className="block text-[15px] text-foreground">Carregar uma prova</b>Tira uma foto ou envia o PDF. O Kixi lê as questões e cria a simulação.</p>
          <Button variant="outline">Escolher ficheiro</Button>
        </div>

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

        <Card className="gap-0 divide-y overflow-hidden py-0" aria-label="Provas disponíveis">
          {result.items.map((item) => (
            <Link key={item.id} href={`/prova/${item.id}`} aria-label={`${actionOf(item.state)}: ${item.kind} ${item.title}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-5 py-3.5 transition-colors hover:bg-secondary/60 sm:grid-cols-[minmax(0,1fr)_170px_120px]">
              <div className="min-w-0"><div className="leading-snug font-bold">{item.kind} · {item.title}</div><div className="mt-0.5 text-[13px] text-muted-foreground">{[item.school, item.year, item.subject].filter(Boolean).join(' · ')}</div></div>
              <div className="order-3 col-span-2 sm:order-none sm:col-span-1"><State item={item} /></div>
              <span className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-card px-3 text-sm font-semibold shadow-xs">{actionOf(item.state)}</span>
            </Link>
          ))}
          {result.items.length === 0 && (
            <EmptyState
              title="Nenhuma prova encontrada"
              message="Muda os filtros ou carrega a prova que procuras."
            />
          )}
        </Card>

        {result.totalPages > 1 ? (
          <nav className="flex items-center justify-between text-sm" aria-label="Paginação">
            {current > 1 ? (
              <Button asChild variant="outline" size="sm"><Link href={href(current - 1)}>Anteriores</Link></Button>
            ) : <span />}
            <span className="text-muted-foreground">Página {current} de {result.totalPages} · {result.totalElements} provas</span>
            {current < result.totalPages ? (
              <Button asChild variant="outline" size="sm"><Link href={href(current + 1)}>Seguintes</Link></Button>
            ) : <span />}
          </nav>
        ) : null}
      </Column>
    </Page>
  );
}
