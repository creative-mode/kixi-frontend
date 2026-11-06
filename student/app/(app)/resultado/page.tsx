import { CountUp } from '@/components/count-up';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Award, Check, MessageCircle, X } from 'lucide-react';
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
import { entrarUrl } from '@/lib/guard';
import { getResultView } from '@/lib/result';
import { getCommunityStats } from '@/lib/community';
import { badgesUnlockedIn, gradeReading } from '@/lib/result-motivation';
import { getBadges, getStats } from '@/lib/stats';
import { CorrecaoEmCurso } from '@/components/correcao-em-curso';
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
  observation,
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
          {v === 'pending' && <p className="text-muted-foreground">Esta resposta ainda está a ser corrigida.</p>}
        </div>
      )}

      {question.scoreObtained != null && question.maxScore != null && (
        <p className="pl-[46px] text-[13px] text-muted-foreground tabular-nums">
          {formatScore(question.scoreObtained)} de {formatScore(question.maxScore)} valores
        </p>
      )}
      {observation(question) && <p className="pl-[46px] text-[13px] text-muted-foreground">{observation(question)}</p>}
    </li>
  );
}

export default async function Resultado({ searchParams }: { searchParams: Promise<{ prova?: string | string[] }> }) {
  const raw = (await searchParams).prova;
  const id = Number(Array.isArray(raw) ? raw[0] : raw);
  // Sem tentativa não há resultado para mostrar: a lista de provas é onde se escolhe.
  if (!Number.isInteger(id) || id <= 0) redirect('/provas');

  const view = await getResultView(id);
  if (view.kind === 'unauthorized') redirect(await entrarUrl('session-expired'));
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
                {correcao.kind === 'a-corrigir' && <CorrecaoEmCurso />}
                {correcao.kind === 'incompleta' && (
                  <p role="status" className="text-sm">
                    {correcao.semGabarito
                      ? 'Esta prova ainda não tem gabarito nas questões abertas, por isso não conseguimos dar-te nota. Fala com o teu professor.'
                      : 'Não encontrámos respostas legíveis para corrigir esta prova, por isso não há nota. Podes refazê-la.'}
                  </p>
                )}
                {/* O motor atrasou-se: para o aluno é só mais tempo, com a prova guardada. Nunca um erro. */}
                {correcao.kind === 'falhou' && <CorrecaoEmCurso desdeMs={3 * 60_000} />}
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

  // A leitura da nota (#492) só usa números do servidor: a média da turma vem da
  // comunidade da prova, e o XP, a sequência e as medalhas vêm de /me. Cada bloco
  // que falha fica omisso em vez de derrubar o resultado.
  const [stats, badges, community] = await Promise.all([
    getStats(),
    getBadges(),
    statementId != null ? getCommunityStats(statementId) : Promise.resolve(null),
  ]);
  const reading = gradeReading({
    score: result.finalScore,
    totalMax,
    meanScore: community?.ok ? community.data.meanScore : null,
    sampleSize: community?.ok ? community.data.sampleSize : null,
    delta: comparison?.delta ?? null,
  });
  const medalhasNovas = badgesUnlockedIn(badges, view.startedAt, view.finishedAt);

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
        <section className="flex items-center gap-[22px] px-1 pb-2 pt-1">
          <div className="relative size-[132px] shrink-0" role="img" aria-label={`${score ?? '—'} de ${totalMax != null ? formatScore(totalMax) : '—'} valores`}>
            <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#eef0ec" strokeWidth="10" />
              <circle cx="60" cy="60" r="52" fill="none" stroke="#1f5a2c" strokeWidth="10" strokeLinecap="round" strokeDasharray="326.7" strokeDashoffset={326.7 * (1 - Math.min(1, Math.max(0, totalMax ? (result.finalScore ?? 0) / totalMax : 0)))} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[38px] leading-none font-extrabold tracking-[-0.03em] tabular-nums">{score ? <CountUp value={score} /> : '—'}</span>
              {totalMax != null && <span className="text-[13px] font-semibold text-[#5f6b63]">de {formatScore(totalMax)}</span>}
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[15px] font-semibold text-[#1f5a2c]">{view.title}</span>
            <h1 className="m-0 text-[28px] leading-[1.15] font-extrabold tracking-[-0.02em]">{me?.first_name ? `Bom trabalho, ${me.first_name}.` : 'Bom trabalho.'}</h1>
            <span data-testid={reading ? 'resultado-leitura' : undefined} role={reading ? 'status' : undefined} className="text-[15px] leading-[1.4] text-[#3d4a41]">
              {reading ? reading.text : `${result.correctAnswers ?? '—'}${result.totalQuestions != null ? ` de ${result.totalQuestions}` : ''} respostas certas${time ? ` em ${time}` : ''}.`}
            </span>
            <div className="mt-1 flex flex-wrap gap-2" aria-label="O que ganhaste" role="group">
              {stats != null && <span className="flex h-[30px] items-center rounded-full bg-[#eef6ea] px-3 text-[13px] font-bold text-[#1b4d27]">{stats.xp} XP · nível {stats.level}</span>}
              {stats != null && <span className="flex h-[30px] items-center rounded-full bg-[#fbe9ea] px-3 text-[13px] font-bold text-[#8a2a2e]">{stats.streak} {stats.streak === 1 ? 'dia' : 'dias'} de sequência</span>}
              {comparison && <span className="flex h-[30px] items-center rounded-full bg-[#fbf1d6] px-3 text-[13px] font-bold text-[#8a5a00]">{formatDelta(comparison.delta)} face à anterior</span>}
            </div>
          </div>
        </section>
        {pending > 0 && (
          <p className="-mt-2 text-sm text-muted-foreground" role="status">
            {pending === 1 ? '1 resposta aberta ainda está' : `${pending} respostas abertas ainda estão`} a ser corrigida{pending === 1 ? '' : 's'}: a nota pode mudar quando terminar.
          </p>
        )}
        {medalhasNovas.map((badge) => (
          <div key={badge.code} className="flex items-start gap-3 rounded-2xl bg-[#fef8e8] px-4 py-3.5">
            <Award className="mt-0.5 size-5 shrink-0 text-[#9a6400]" aria-hidden />
            <div className="leading-snug"><b className="block text-sm">Medalha nova: {badge.name}</b><span className="text-[13px] text-[#617066]">{badge.description}</span></div>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-2.5">
          {statementId != null && hasMistakes && (
            <Button asChild size="lg">
              <Link href={`/tutor?statementId=${statementId}&questoes=${wholeNumbers(toReview(result.questions)).join(',')}${wrongAnswersParam(givenAnswers(result.questions))}&de=resultado&simulacao=${result.simulationId}`}><MessageCircle aria-hidden />Estudar os erros com o tutor</Link>
            </Button>
          )}
          {statementId != null && <RefazerSimulacao statementId={statementId} />}
          <Button asChild variant="ghost" className="text-primary"><Link href="/provas">Voltar às provas</Link></Button>
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
          <CardHeader className="pt-5 pb-3"><CardTitle>{questions.filter((q) => ['wrong', 'blank'].includes(verdict(q))).length > 0 ? 'As que falhaste e as que acertaste' : 'Revisão questão a questão'}</CardTitle></CardHeader>
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
              simulationId: result.simulationId,
              statementId,
              schoolName: me?.school?.name ?? null,
              statementTitle: view.title,
              paperKind: paperMeta.kind,
              grade: paperMeta.grade,
              subject: paperMeta.subject,
              durationMinutes: paperMeta.durationMinutes,
              schoolYear: paperMeta.schoolYear,
              variant: paperMeta.variant,
              finalScore: result.finalScore,
              maxScore: totalMax,
              correctAnswers: result.correctAnswers ?? null,
              totalQuestions: result.totalQuestions ?? null,
              timeSpentSeconds: result.timeSpentSeconds ?? null,
            }}
          />
        )}

      </Column>
    </Page>
  );
}
