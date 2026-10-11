import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Check, Clock, MessageCircle, X } from 'lucide-react';
import { Column, Page, PageHeader } from '@/components/page';
import { RefazerSimulacao } from '@/components/refazer-simulacao';
import { ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { getResultView } from '@/lib/result';
import {
  formatDelta,
  formatDuration,
  formatScore,
  inOrder,
  optionTag,
  verdict,
  type ResultQuestion,
  type Verdict,
} from '@/lib/result-rules';

export const metadata = { title: 'Resultado · Kixi' };

const VERDICT: Record<Verdict, { label: string; variant: 'success' | 'destructive' | 'warning' | 'secondary' }> = {
  correct: { label: 'Certa', variant: 'success' },
  wrong: { label: 'Errada', variant: 'destructive' },
  pending: { label: 'Por corrigir', variant: 'warning' },
  blank: { label: 'Sem resposta', variant: 'secondary' },
};

function Review({ question }: { question: ResultQuestion }) {
  const v = verdict(question);
  const options = question.options ?? [];
  return (
    <li className="grid gap-3 px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="grid size-[34px] shrink-0 place-items-center rounded-md bg-secondary text-[13px] font-bold">
          {question.number}
        </span>
        <p className="min-w-0 flex-1 text-sm leading-snug font-semibold">{question.text}</p>
        <Badge variant={VERDICT[v].variant}>{VERDICT[v].label}</Badge>
      </div>

      {options.length > 0 ? (
        <ul className="grid gap-1.5 pl-[46px]" aria-label={`Alternativas da questão ${question.number}`}>
          {options.map((option, i) => {
            const chosen = option.id === question.selectedOptionId;
            const right = option.id === question.correctOptionId;
            return (
              <li
                key={option.id}
                className={
                  'flex items-center gap-2.5 rounded-md border px-3 py-2 text-sm ' +
                  (right ? 'border-success/50 bg-success-soft' : chosen ? 'border-destructive/50 bg-danger-soft' : '')
                }
              >
                <span className="font-bold">{optionTag(option, i)}</span>
                <span className="min-w-0 flex-1">{option.optionText}</span>
                {/* Texto e não só cor: quem não distingue cores tem de saber qual era a certa. */}
                {right && <span className="inline-flex items-center gap-1 text-xs font-semibold text-success"><Check className="size-3.5" aria-hidden />Resposta certa</span>}
                {chosen && !right && <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive"><X className="size-3.5" aria-hidden />A tua resposta</span>}
                {chosen && right && <span className="text-xs text-muted-foreground">(a tua)</span>}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="grid gap-1.5 pl-[46px] text-sm">
          <p><span className="text-muted-foreground">A tua resposta: </span>{question.answerText?.trim() || 'Sem resposta'}</p>
          {question.modelAnswer && <p><span className="text-muted-foreground">Resposta esperada: </span>{question.modelAnswer}</p>}
          {v === 'pending' && <p className="text-muted-foreground">Esta resposta é corrigida pelo professor.</p>}
        </div>
      )}

      {question.scoreObtained != null && question.maxScore != null && (
        <p className="pl-[46px] text-[13px] text-muted-foreground tabular-nums">
          {formatScore(question.scoreObtained)} de {formatScore(question.maxScore)} valores
        </p>
      )}
    </li>
  );
}

export default async function Resultado({ searchParams }: { searchParams: Promise<{ prova?: string | string[] }> }) {
  const raw = (await searchParams).prova;
  const id = Number(Array.isArray(raw) ? raw[0] : raw);
  // Sem tentativa não há resultado para mostrar: a lista de provas é onde se escolhe.
  if (!Number.isInteger(id) || id <= 0) redirect('/provas');

  const view = await getResultView(id);
  if (view.kind === 'unauthorized') redirect('/entrar?reason=session-expired');
  if (view.kind === 'missing') notFound();
  if (view.kind === 'in-progress') redirect(view.statementId ? `/prova/${view.statementId}` : '/provas');
  if (view.kind === 'error') {
    return (
      <div className="mx-auto w-full max-w-[760px] p-4 md:p-7">
        <ErrorState title="Não conseguimos ler o resultado" message={view.message} />
      </div>
    );
  }

  const { result, statementId, comparison } = view;
  const questions = inOrder(result.questions);
  const score = formatScore(result.finalScore);
  const time = formatDuration(result.timeSpentSeconds);
  const pending = result.pendingReviewCount ?? 0;
  const hasMistakes = questions.some((q) => ['wrong', 'blank'].includes(verdict(q)));

  return (
    <Page>
      <Column className="gap-5">
        <PageHeader kicker="Resultado" title={view.title} />

        <div className="flex flex-wrap items-end gap-x-3.5 gap-y-2">
          <span className="text-[52px] leading-[.95] font-bold tracking-tighter tabular-nums md:text-[64px]">{score ?? '—'}</span>
          {view.totalMaxScore != null && (
            <span className="pb-1.5 text-lg font-semibold text-muted-foreground">de {formatScore(view.totalMaxScore)} valores</span>
          )}
          {comparison && (
            <Badge variant={comparison.delta >= 0 ? 'success' : 'warning'} className="mb-2">
              {formatDelta(comparison.delta)} face à tentativa anterior ({formatScore(comparison.previousScore)})
            </Badge>
          )}
        </div>
        {pending > 0 && (
          <p className="-mt-2 text-sm text-muted-foreground" role="status">
            {pending === 1 ? '1 resposta aberta ainda' : `${pending} respostas abertas ainda`} por corrigir pelo professor: a nota pode mudar.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="gap-0.5 px-4 py-3.5">
            <b className="text-[22px] tracking-tight tabular-nums">
              {result.correctAnswers ?? '—'}{result.totalQuestions != null ? ` de ${result.totalQuestions}` : ''}
            </b>
            <span className="text-[13px] text-muted-foreground">respostas certas</span>
          </Card>
          <Card className="gap-0.5 px-4 py-3.5">
            <b className="inline-flex items-center gap-2 text-[22px] tracking-tight tabular-nums">
              <Clock className="size-5 text-muted-foreground" aria-hidden />{time ?? '—'}
            </b>
            <span className="text-[13px] text-muted-foreground">tempo gasto</span>
          </Card>
        </div>

        <Card className="gap-0 py-0" aria-label="Revisão questão a questão">
          <CardHeader className="pt-5 pb-3"><CardTitle>Revisão questão a questão</CardTitle></CardHeader>
          {questions.length === 0 ? (
            <p className="border-t px-5 py-4 text-sm text-muted-foreground">Não respondeste a nenhuma questão desta prova.</p>
          ) : (
            <ul className="divide-y border-t">
              {questions.map((question) => <Review key={question.questionId} question={question} />)}
            </ul>
          )}
        </Card>

        <div className="flex flex-wrap items-start gap-2.5">
          {statementId != null && <RefazerSimulacao statementId={statementId} />}
          {statementId != null && hasMistakes && (
            <Button asChild>
              <Link href={`/tutor?statementId=${statementId}`}><MessageCircle aria-hidden />Estudar os erros com o tutor</Link>
            </Button>
          )}
          <Button asChild variant="ghost" className="text-primary"><Link href="/provas">Voltar às provas</Link></Button>
        </div>
      </Column>
    </Page>
  );
}
