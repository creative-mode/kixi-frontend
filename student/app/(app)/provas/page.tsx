import Link from 'next/link';
import { ArrowLeft, ArrowRight, Camera, Search } from 'lucide-react';
import { Column, Page, PageHeader } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/states';
import { RefreshError } from '@/components/refresh-error';
import { getCatalog, type CatalogItem, type ExamState } from '@/lib/catalog';

type Params = Promise<Record<string, string | string[] | undefined>>;

const PAGE_SIZE = 10;

function one(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? '').trim();
}

function State({ item }: { item: CatalogItem }) {
  const state: ExamState = item.state;
  if (state === 'progress') {
    return (
      <div className="grid gap-1.5">
        <Badge variant="warning" className="justify-self-start">
          Em curso{item.done != null && item.total != null ? ` · ${item.done}/${item.total}` : ''}
        </Badge>
        {item.done != null && item.total ? (
          <Progress value={(item.done / item.total) * 100} indicatorClassName="bg-chart-2" aria-label="Progresso" />
        ) : null}
      </div>
    );
  }
  if (state === 'done') {
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

function distinct(items: CatalogItem[], pick: (item: CatalogItem) => string): string[] {
  return [...new Set(items.map(pick).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt'));
}

function Filters({
  values,
  subjects,
  kinds,
  years,
  schools,
}: {
  values: Record<string, string>;
  subjects: string[];
  kinds: string[];
  years: string[];
  schools: string[];
}) {
  const select = (
    name: string,
    label: string,
    allLabel: string,
    options: string[],
  ) => (
    <label className="grid min-w-36 flex-1 gap-1 text-xs font-semibold text-muted-foreground">
      {label}
      <NativeSelect name={name} defaultValue={values[name] ?? ''} aria-label={label}>
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </NativeSelect>
    </label>
  );

  return (
    <form method="get" className="grid gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name="q"
          aria-label="Procurar provas"
          className="pl-10"
          placeholder="Procurar por disciplina, escola ou ano"
          defaultValue={values.q ?? ''}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        {select('disciplina', 'Disciplina', 'Todas', subjects)}
        {select('tipo', 'Tipo de prova', 'Todos', kinds)}
        {select('ano', 'Ano letivo', 'Todos', years)}
        {select('escola', 'Escola', 'Todas', schools)}
      </div>
      <div>
        <Button type="submit" variant="outline" size="sm">
          Filtrar
        </Button>
      </div>
    </form>
  );
}

/** Real exam catalog: reads `/statements/catalog` (BE-108) with fallback to
 *  `/statements`. Filters live in the URL, so each view asks the server only
 *  for what it shows — no mock data on this page. */
export default async function Provas({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const filters = {
    q: one(params.q),
    subject: one(params.disciplina),
    examType: one(params.tipo),
    year: one(params.ano),
    school: one(params.escola),
  };
  const page = Math.max(1, Number(one(params.pagina)) || 1);

  const result = await getCatalog(filters);
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

  // Option lists come from the catalog itself, so they never offer dead ends.
  const unfiltered = await getCatalog({});
  const pool = unfiltered.ok ? unfiltered.items : result.items;
  const total = result.items.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const list = result.items.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const href = (pagina: number) => {
    const search = new URLSearchParams();
    if (filters.q) search.set('q', filters.q);
    if (filters.subject) search.set('disciplina', filters.subject);
    if (filters.examType) search.set('tipo', filters.examType);
    if (filters.year) search.set('ano', filters.year);
    if (filters.school) search.set('escola', filters.school);
    if (pagina > 1) search.set('pagina', String(pagina));
    const query = search.toString();
    return query ? `/provas?${query}` : '/provas';
  };

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
            disciplina: filters.subject,
            tipo: filters.examType,
            ano: filters.year,
            escola: filters.school,
          }}
          subjects={distinct(pool, (item) => item.subject)}
          kinds={distinct(pool, (item) => item.kind)}
          years={distinct(pool, (item) => item.year)}
          schools={distinct(pool, (item) => item.school)}
        />

        <Card className="gap-0 divide-y overflow-hidden py-0" aria-label="Provas disponíveis">
          {list.map((item) => (
            <Link key={item.id} href={`/prova/${item.id}`} aria-label={`${actionOf(item.state)}: ${item.kind} ${item.title}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-5 py-3.5 transition-colors hover:bg-secondary/60 sm:grid-cols-[minmax(0,1fr)_170px_120px]">
              <div className="min-w-0"><div className="leading-snug font-bold">{item.kind} · {item.title}</div><div className="mt-0.5 text-[13px] text-muted-foreground">{[item.school, item.year, item.subject].filter(Boolean).join(' · ')}</div></div>
              <div className="order-3 col-span-2 sm:order-none sm:col-span-1"><State item={item} /></div>
              <span className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-card px-3 text-sm font-semibold shadow-xs">{actionOf(item.state)}</span>
            </Link>
          ))}
          {list.length === 0 && (
            <EmptyState
              title="Nenhuma prova encontrada"
              message="Muda os filtros ou carrega a prova que procuras."
            />
          )}
        </Card>

        {pages > 1 ? (
          <nav className="flex items-center justify-between text-sm" aria-label="Paginação">
            {current > 1 ? (
              <Button asChild variant="outline" size="sm"><Link href={href(current - 1)}><ArrowLeft aria-hidden /> Anteriores</Link></Button>
            ) : <span />}
            <span className="text-muted-foreground">Página {current} de {pages} · {total} provas</span>
            {current < pages ? (
              <Button asChild variant="outline" size="sm"><Link href={href(current + 1)}>Seguintes <ArrowRight aria-hidden /></Link></Button>
            ) : <span />}
          </nav>
        ) : null}
      </Column>
    </Page>
  );
}
