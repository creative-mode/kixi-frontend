'use client';

import Link from 'next/link';
import { ArrowLeft, BookOpen, ChevronDown, History, Users } from 'lucide-react';
import { Column, Page, PageHeader } from '@/components/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/states';
import { StatementCommunity } from '@/components/statement-community';
import { ACTION_LABEL, VerResultado } from '@/components/ver-resultado';
import type { AttemptRow, StatementSummaryView } from '@/lib/statement-detail';
import type { CommunityStats, SharedSolution } from '@/lib/community';
import type { Named } from '@/lib/catalog';

/** The detail screen: what this paper is, what the student already did with it, and
 *  the ways into it.
 *
 *  A ordem segue o que se vem cá fazer (#820): a ação (ver o resultado, continuar, ou
 *  começar) e as tentativas — com a nota — ficam à vista; a comunidade e o enunciado,
 *  que são consulta e não decisão, abrem só quando o aluno os pede. Antes disto eram
 *  quatro cartões e a folha inteira de uma vez, e no telemóvel não se via a nota sem
 *  rolar duas ecrãs. */
export function StatementDetailView({
  summary,
  attempts,
  current,
  community,
}: {
  summary: StatementSummaryView;
  /** null when the history could not be loaded: the banner below says so, rather than
   *  the card claiming the student never attempted this. */
  attempts: AttemptRow[] | null;
  current: AttemptRow | null;
  /** Null sem tentativa corrigida (#32/#119): a comunidade compara desempenhos, e sem
   *  um próprio não há "tu vs. a média" para mostrar. */
  community: { stats: CommunityStats | null; solutions: SharedSolution[]; schools: Named[]; locked?: boolean } | null;
}) {
  const id = summary.id;
  const duration = summary.durationMinutes;
  const list = attempts ?? [];
  // Tipo, cotação, duração e escola numa linha: era um cartão de quatro caixas para
  // dizer o mesmo, e empurrava a nota para fora do primeiro ecrã.
  // Só o que o cabeçalho ainda não diz: o tipo está no kicker, a escola e o ano na
  // descrição. Repeti-los era ruído com aparência de informação.
  const meta = [summary.totalMaxScore != null ? `${summary.totalMaxScore} valores` : null,
    duration != null ? `${duration} min` : null].filter((item): item is string => Boolean(item)).join(' · ');

  return (
    <Page>
      <Column>
        <Button asChild variant="ghost" size="sm" className="-ml-2 self-start text-muted-foreground">
          <Link href="/provas"><ArrowLeft aria-hidden />Voltar às provas</Link>
        </Button>

        <PageHeader
          kicker={summary.kind}
          title={summary.title}
          // A disciplina às vezes é o próprio título («Redes de Computadores»); repeti-la
          // logo abaixo fazia a linha parecer um erro.
          description={[summary.subject !== summary.title ? summary.subject : null, summary.school, summary.year]
            .filter(Boolean).join(' · ')}
        />

        {meta && <p className="-mt-1 text-[13px] text-muted-foreground">{meta}</p>}
        {/* The question count is not here: neither StatementSummary nor the catalog
            carries one — it is being added in kixi#178. Fetching /full to count a
            number would pull the whole paper into the browser for it. */}

        {/* Uma escolha, não dois cartões: a ação principal e a alternativa lado a lado. */}
        <Card className="gap-3 p-4">
          <div className="flex flex-wrap gap-2">
            {current?.label === 'corrected' || current?.label === 'correcting' ? (
              <VerResultado simulationId={current.id} variant="default" className="flex-1 sm:flex-none" />
            ) : (
              <Button asChild className={`${ACTION_LABEL} flex-1 sm:flex-none`}>
                <Link href={`/prova/${id}`}>{current?.label === 'unfinished' ? 'Continuar a prova' : 'Começar a simulação'}</Link>
              </Button>
            )}
            <Button asChild variant="outline" className="flex-1 sm:flex-none">
              <Link href={`/tutor?statementId=${id}`}><BookOpen aria-hidden />Estudar com o tutor</Link>
            </Button>
          </div>
          <p className="text-[13px] leading-snug text-muted-foreground">
            A simulação segue o tempo do enunciado. O tutor usa esta prova como contexto.
          </p>
        </Card>


        {/* `py-0` no cartão para a lista encostar ao fundo; o cabeçalho é que traz o
            espaço de cima (#761), senão o título ficava colado à borda. */}
        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row items-center gap-2.5 px-5 pt-5 pb-3">
            <History className="size-4 text-muted-foreground" aria-hidden />
            <h2 className="text-[17px] leading-none font-bold tracking-tight">As tuas tentativas</h2>
            {list.length > 0 && (
              <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                <span aria-hidden>{list.length}</span>
                <span className="sr-only">{list.length === 1 ? '1 tentativa' : `${list.length} tentativas`}</span>
              </span>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {list.length === 0 ? (
              <EmptyState
                title={attempts ? "Ainda não tentaste esta prova" : "O teu histórico não está disponível"}
                message={attempts
                  ? "Quando a fizeres, aparece aqui com a nota e a data."
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
                      <span role="img" aria-label={a.score != null ? `Nota ${a.score} valores` : 'Sem nota'}
                        className="grid size-9 shrink-0 place-items-center rounded-full bg-success-soft text-sm font-bold text-success tabular-nums">
                        {a.score ?? '—'}
                      </span>
                    ) : (
                      <Badge variant={a.label === 'cancelled' ? 'secondary' : 'warning'}>
                        {a.label === 'cancelled' ? 'Cancelada' : a.label === 'correcting' ? 'A corrigir' : 'Em curso'}
                      </Badge>
                    )}
                    <div className="min-w-0 flex-1 leading-snug">
                      <b className="block text-sm">
                        {a.label === 'corrected' ? 'Prova corrigida' : a.label === 'cancelled' ? 'Prova cancelada' : a.label === 'correcting' ? 'Prova entregue' : 'Prova por terminar'}
                      </b>
                      <span className="text-[13px] text-muted-foreground">
                        {a.since ?? 'sem data'}
                        {/* A nota já está no círculo: repeti-la aqui só fazia a linha quebrar
                            no telemóvel. */}
                        {a.label === 'cancelled' ? ' · não foi corrigida' : ''}
                        {/* #793: FAILED quer dizer que o motor não vai corrigir sozinho;
                            prometer a nota pelo sino aqui seria uma mentira. */}
                        {a.label === 'correcting' && a.failed ? ' · a correção falhou, fala com o professor' : ''}
                        {a.label === 'correcting' && !a.failed ? ' · a nota chega pelo sino' : ''}
                      </span>
                    </div>
                    {/* Uma tentativa cancelada não tem nada para continuar; uma por corrigir
                        ainda não tem resultado para ver — a nota aparece no sino (#793).
                        A tentativa que já é a ação do topo não repete o botão aqui. */}
                    {a.label === 'corrected' && a.id !== current?.id && (
                      <VerResultado simulationId={a.id} size="sm" />
                    )}
                    {a.label === 'unfinished' && (
                      <Button asChild variant="outline" size="sm" className={ACTION_LABEL}><Link href={`/prova/${id}`}>Continuar</Link></Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Consulta, não decisão: as estatísticas abrem a pedido. O componente traz o
            seu próprio cartão, por isso a divulgação é só a moldura. */}
        {community && current && (
          <details className="group rounded-xl border bg-card text-card-foreground">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
              <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-[15px] font-bold tracking-tight">Estatísticas da turma</span>
              <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="border-t p-3 sm:p-4">
              <StatementCommunity
                statementId={id}
                simulationId={current.id}
                stats={community.stats}
                solutions={community.solutions}
                schools={community.schools}
                locked={community.locked}
              />
            </div>
          </details>
        )}
      </Column>
    </Page>
  );
}
