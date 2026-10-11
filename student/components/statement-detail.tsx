'use client';

import Link from 'next/link';
import { ArrowLeft, BookOpen, Clock, FileText, History, Play, Target, Users } from 'lucide-react';
import { Column, Page, PageHeader } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/states';
import type { AttemptRow, StatementSummaryView } from '@/lib/statement-detail';

/** The detail screen: what this paper is, what the student already did with it, and
 *  the ways into it. */
export function StatementDetailView({
  summary,
  attempts,
  current,
}: {
  summary: StatementSummaryView;
  /** null when the history could not be loaded: the banner below says so, rather than
   *  the card claiming the student never attempted this. */
  attempts: AttemptRow[] | null;
  current: AttemptRow | null;
}) {
  const id = summary.id;
  const duration = summary.durationMinutes;
  const list = attempts ?? [];

  return (
    <Page>
      <Column className="gap-5">
        <Button asChild variant="ghost" size="sm" className="-ml-2 self-start text-muted-foreground">
          <Link href="/provas"><ArrowLeft aria-hidden />Voltar às provas</Link>
        </Button>

        <PageHeader
          kicker={summary.kind}
          title={summary.title}
          description={[summary.subject, summary.school, summary.year].filter(Boolean).join(' · ')}
        />

        <Card>
          <CardHeader><h2 className="leading-none font-bold tracking-tight text-base">Como é esta prova</h2></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Fact icon={FileText} label="Tipo" value={summary.kind} />
            <Fact icon={Target} label="Cotação" value={summary.totalMaxScore != null ? `${summary.totalMaxScore} valores` : undefined} />
            <Fact icon={Clock} label="Duração" value={duration != null ? `${duration} min` : undefined} />
            <Fact icon={Users} label="Escola" value={summary.school} />
          </CardContent>
          {/* The question count is not here: neither StatementSummary nor the catalog
              carries one — it is being added in kixi#178. Fetching /full to count a
              number would pull the whole paper into the browser for it. */}
        </Card>

        <Card className="gap-4 p-5">
          <div>
            <h2 className="text-[17px] font-bold tracking-tight">Como queres estudar esta prova?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Podes simular, ou estudar com o tutor a falar desta prova.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="gap-3 p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground"><Play aria-hidden /></span>
                <div className="min-w-0">
                  <b className="block">Simular</b>
                  <span className="text-[13px] text-muted-foreground">
                    {duration != null ? `Fazes a prova em ${duration} minutos, com o tempo do enunciado.` : 'Fazes a prova com o tempo do enunciado.'}
                  </span>
                </div>
              </div>
              <Button asChild className="w-full"><Link href={`/prova/${id}`}>{current?.label === 'unfinished' ? 'Continuar' : 'Começar'}</Link></Button>
            </Card>

            <Card className="gap-3 p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground"><BookOpen aria-hidden /></span>
                <div className="min-w-0">
                  <b className="block">Estudo assistido</b>
                  <span className="text-[13px] text-muted-foreground">O tutor responde só sobre esta prova, e cita de onde tirou a resposta.</span>
                </div>
              </div>
              <Button asChild variant="outline" className="w-full"><Link href={`/tutor?statementId=${id}`}>Abrir o tutor</Link></Button>
            </Card>

            {/* "Ver como outros resolveram" is deliberately absent. The endpoint is
                kixi#119 (BE-23), still open, and the issue says to hide the CTA when
                there is no data. A button that leads nowhere teaches the student that
                this screen cannot be trusted. It appears with #32. */}
          </div>
        </Card>

        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row items-center gap-2.5 pb-3">
            <History className="size-4 text-muted-foreground" aria-hidden />
            <h2 className="leading-none font-bold tracking-tight text-base">As tuas tentativas</h2>
            {list.length > 0 && <span className="ml-auto text-sm text-muted-foreground">{list.length}</span>}
          </CardHeader>
          <CardContent className="p-0">
            {list.length === 0 ? (
              <EmptyState
                title={attempts ? "Ainda não tentaste esta prova" : "O teu histórico não está disponível"}
                message={attempts
                  ? "Quando a fizeres, aparece aqui com a nota e a data. Podes repeti-la as vezes que quiseres."
                  : "Não conseguimos buscar as tuas tentativas agora. Tenta outra vez daqui a pouco."}
                action={attempts ? <Button asChild variant="outline"><Link href={`/prova/${id}`}>Fazer a prova</Link></Button> : undefined}
              />
            ) : (
              <ul className="divide-y border-t">
                {list.map((a) => (
                  <li key={a.id} className="flex items-center gap-3.5 px-5 py-3.5">
                    {/* A nota é curta e cabe num círculo; «Em curso» não cabia e
                        transbordava. O estado agora vive num badge, que cresce. */}
                    {a.label === 'corrected' ? (
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success-soft text-sm font-bold text-success tabular-nums">
                        {a.score ?? '—'}
                      </span>
                    ) : (
                      <Badge variant={a.label === 'cancelled' ? 'secondary' : 'warning'}>
                        {a.label === 'cancelled' ? 'Cancelada' : 'Em curso'}
                      </Badge>
                    )}
                    <div className="min-w-0 flex-1 leading-snug">
                      <b className="block text-sm">
                        {a.label === 'corrected' ? 'Prova corrigida' : a.label === 'cancelled' ? 'Prova cancelada' : 'Prova por terminar'}
                      </b>
                      <span className="text-[13px] text-muted-foreground">
                        {a.since ?? 'sem data'}
                        {a.label === 'corrected' && a.score != null ? ` · ${a.score} valores` : ''}
                        {a.label === 'cancelled' ? ' · não foi corrigida' : ''}
                      </span>
                    </div>
                    {/* Uma tentativa cancelada não tem nada para continuar: o botão
                        era o que a mostrava como «por terminar». */}
                    {a.label === 'unfinished' && (
                      <Button asChild variant="outline" size="sm"><Link href={`/prova/${id}`}>Continuar</Link></Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </Column>
    </Page>
  );
}

function Fact({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border px-4 py-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground"><Icon className="size-[18px]" aria-hidden /></span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-semibold">{value ?? <span className="text-muted-foreground">—</span>}</p>
      </div>
    </div>
  );
}
