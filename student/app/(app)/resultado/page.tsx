import { CountUp } from '@/components/count-up';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Check, Clock, MessageCircle, X } from 'lucide-react';
import { FireEventOnce } from '@/components/analytics/fire-event-once';
import { ClearExamLocal } from '@/components/clear-exam-local';
import { Column, Page, PageHeader } from '@/components/page';
import { PublishResult } from '@/components/publish-result';
import { RefazerSimulacao } from '@/components/refazer-simulacao';
import { ErrorState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { getMe } from '@/lib/me';
import { getResultView } from '@/lib/result';
import { ACorrigir } from '@/components/a-corrigir';
import { listInvitations } from '@/lib/exam-room';
import { comCorrecao, eSimulacaoLivre } from '@/lib/schoolops/correcao-rules';
import { correcaoDaSimulacao, correcaoLigada } from '@/lib/schoolops/correcao';
import { getQuestionImages, getStatementFull, loadPaperMeta } from '@/lib/exam';
import { FolhaDaProva } from '@/components/folha-da-prova';
import { MathText } from '@/lib/shared/math-text';
import { answersOf, marksOf, paperQuestions, stampOf } from '@/lib/folha-do-resultado';
import {
  formatDelta,
  formatDuration,
  formatScore,
  givenAnswers,
  inOrder,
  optionTag,
  verdict,
  type ResultQuestion,
  showsContext,
  toReview,
  type Verdict,
} from '@/lib/result-rules';
import { displayNumber, topNumber, wholeNumbers } from '@/lib/question-number';
import { wrongAnswersParam } from '@/lib/tutor-rules';

export const metadata = { title: 'Resultado · Kixi' };

const VERDICT: Record<Verdict, { label: string; variant: 'success' | 'destructive' | 'warning' | 'secondary' }> = {
  correct: { label: 'Certa', variant: 'success' },
  wrong: { label: 'Errada', variant: 'destructive' },
  pending: { label: 'Por corrigir', variant: 'warning' },
  blank: { label: 'Sem resposta', variant: 'secondary' },
};

function Review({ question, context }: { question: ResultQuestion; context: boolean }) {
  const v = verdict(question);
  const options = question.options ?? [];
  const shown = displayNumber(question);
  return (
    <li className="grid gap-3 px-5 py-4">
      {context && question.parentText ? (
        // O enunciado comum da questão com alíneas, uma vez, acima da primeira alínea.
        <div className="grid gap-1 rounded-lg border border-dashed bg-secondary/60 px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground">Questão {topNumber(question.number)}</p>
          <p className="text-sm leading-relaxed"><MathText text={question.parentText} /></p>
        </div>
      ) : null}
      <div className="flex items-start gap-3">
        <span className="grid min-w-[34px] shrink-0 place-items-center rounded-md bg-secondary px-1.5 py-1.5 text-[13px] font-bold">
          {shown}
        </span>
        <p className="min-w-0 flex-1 text-sm leading-snug font-semibold"><MathText text={question.text} formulas={question.formulas} blocks={question.blocks} /></p>
        <Badge variant={VERDICT[v].variant}>{VERDICT[v].label}</Badge>
      </div>

      {options.length > 0 ? (
        <ul className="grid gap-1.5 pl-[46px]" aria-label={`Alternativas da questão ${shown}`}>
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
      {question.feedback && <p className="pl-[46px] text-[13px] text-muted-foreground">{question.feedback}</p>}
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

  const { result: resultadoDoBackend, statementId, comparison } = view;
  const me = await getMe();

  // Uma simulação (iniciativa do aluno) é corrigida em tempo real pelo SchoolOps e não tem nota até estar corrigida.
  // Uma prova de sala não: o professor valida e a nota vem da pauta. Se a lista de salas falhar, não se arrisca.
  let totalMax = view.totalMaxScore;
  let result = resultadoDoBackend;
  if (correcaoLigada() && me && statementId != null) {
    const salas = await listInvitations();
    if (salas.ok && eSimulacaoLivre(resultadoDoBackend.simulationId, salas.data)) {
      const correcao = await correcaoDaSimulacao({ me, simulationId: resultadoDoBackend.simulationId, statementId, statementTitle: view.title });
      if (correcao && correcao.kind !== 'corrigida') {
        return (
          <Page>
            <FireEventOnce param="submetida" event="exam_submitted" />
            <ClearExamLocal simulationId={id} />
            <Column className="gap-5">
              <PageHeader kicker="Resultado" title={view.title} back="/provas" />
              <Card className="px-5 py-6">
                {correcao.kind === 'a-corrigir' && <ACorrigir />}
                {correcao.kind === 'incompleta' && (
                  <p role="status" className="text-sm">
                    {correcao.semGabarito
                      ? 'Esta prova ainda não tem gabarito nas questões abertas, por isso não conseguimos dar-te nota. Fala com o teu professor.'
                      : 'Não encontrámos respostas legíveis para corrigir esta prova, por isso não há nota. Podes refazê-la.'}
                  </p>
                )}
                {correcao.kind === 'falhou' && (
                  <p role="status" className="text-sm">A correcção demorou mais do que o esperado. A tua prova está guardada: volta a abrir o resultado daqui a pouco.</p>
                )}
              </Card>
              <div className="flex flex-wrap items-start gap-2.5">
                {statementId != null && <RefazerSimulacao statementId={statementId} />}
                <Button asChild variant="ghost" className="text-primary"><Link href="/provas">Voltar às provas</Link></Button>
              </div>
            </Column>
          </Page>
        );
      }
      if (correcao?.kind === 'corrigida') {
        result = comCorrecao(resultadoDoBackend, correcao.resultado);
        totalMax = correcao.resultado.maximo ?? 20;
      }
    }
  }
  const classId = me?.currentClass?.id ?? null;
  const questions = inOrder(result.questions);
  const score = formatScore(result.finalScore);
  const time = formatDuration(result.timeSpentSeconds);
  const pending = result.pendingReviewCount ?? 0;
  const hasMistakes = questions.some((q) => ['wrong', 'blank'].includes(verdict(q)));

  // A prova entregue na folha, corrigida. O cabeçalho e as figuras são extras: se algum falhar, a folha leva o
  // molde em branco e a revisão questão a questão, mais abaixo, continua a ser a fonte de tudo.
  const statement = statementId != null ? await getStatementFull(statementId, { cached: true }) : null;
  const paperMeta = statement?.ok ? await loadPaperMeta(statement.data) : { kind: 'Prova', totalMaxScore: totalMax };
  const figures = Object.fromEntries(await Promise.all(questions.map(async (q) => [q.questionId, await getQuestionImages(q.questionId)] as const)));
  const stamp = stampOf(result.finalScore, totalMax, pending);

  return (
    <Page>
      <FireEventOnce param="submetida" event="exam_submitted" />
      <ClearExamLocal simulationId={id} />
      <Column className="gap-5">
        <PageHeader kicker="Resultado" title={view.title} back="/provas" />

        <div className="flex flex-wrap items-end gap-x-3.5 gap-y-2">
          <span className="text-[52px] leading-[.95] font-bold tracking-tighter tabular-nums md:text-[64px]">{score ? <CountUp value={score} /> : '—'}</span>
          {totalMax != null && (
            <span className="pb-1.5 text-lg font-semibold text-muted-foreground">de {formatScore(totalMax)} valores</span>
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

        {questions.length > 0 && (
          <Card className="gap-3 p-3 sm:p-5" aria-label="A tua prova corrigida">
            <div>
              <h2 className="text-[17px] font-bold tracking-tight">A tua prova corrigida</h2>
              <p className="text-sm text-muted-foreground">Como a entregaste: a verde o que acertaste, a vermelho o que falhaste, com a resposta certa.</p>
            </div>
            <div className="overflow-x-auto rounded-lg border bg-muted/50 p-2 sm:p-3">
              <FolhaDaProva
                meta={paperMeta}
                questions={paperQuestions(questions)}
                images={figures}
                answers={answersOf(questions)}
                marks={marksOf(questions)}
                stamp={stamp ?? undefined}
              />
            </div>
          </Card>
        )}

        <Card className="gap-0 py-0" aria-label="Revisão questão a questão">
          <CardHeader className="pt-5 pb-3"><CardTitle>Revisão questão a questão</CardTitle></CardHeader>
          {questions.length === 0 ? (
            <p className="border-t px-5 py-4 text-sm text-muted-foreground">Não respondeste a nenhuma questão desta prova.</p>
          ) : (
            <ul className="divide-y border-t">
              {questions.map((question, i) => <Review key={question.questionId} question={question} context={showsContext(questions, i)} />)}
            </ul>
          )}
        </Card>

        {classId != null && result.finalScore != null && (
          <PublishResult
            classId={classId}
            simulationId={result.simulationId}
            card={{
              schoolName: me?.school?.name ?? null,
              statementTitle: view.title,
              finalScore: result.finalScore,
              maxScore: totalMax,
              correctAnswers: result.correctAnswers ?? null,
              totalQuestions: result.totalQuestions ?? null,
              timeSpentSeconds: result.timeSpentSeconds ?? null,
            }}
          />
        )}

        <div className="flex flex-wrap items-start gap-2.5">
          {statementId != null && <RefazerSimulacao statementId={statementId} />}
          {statementId != null && hasMistakes && (
            <Button asChild>
              {/* `de=resultado&simulacao=` diz ao tutor que «Voltar» tem de regressar
                  a este resultado, e não ao detalhe da prova (#491). */}
              <Link href={`/tutor?statementId=${statementId}&questoes=${wholeNumbers(toReview(result.questions)).join(',')}${wrongAnswersParam(givenAnswers(result.questions))}&de=resultado&simulacao=${result.simulationId}`}><MessageCircle aria-hidden />Estudar os erros com o tutor</Link>
            </Button>
          )}
          <Button asChild variant="ghost" className="text-primary"><Link href="/provas">Voltar às provas</Link></Button>
        </div>
      </Column>
    </Page>
  );
}
