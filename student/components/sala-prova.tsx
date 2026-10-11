'use client';

import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Clock, Flag, Loader2, TriangleAlert } from 'lucide-react';
import { responderAction, submeterAction, type AnswerState } from '@/lib/exam-actions';
import {
  cellState,
  formatClock,
  isChoice,
  remainingMs,
  timer,
  type CellState,
  type ExamQuestion,
} from '@/lib/exam-rules';
import type { RoomData } from '@/lib/exam';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const CELL = {
  done: 'border-transparent bg-accent text-accent-foreground',
  flag: 'border-transparent bg-warning-soft text-warning',
  empty: 'bg-card text-muted-foreground',
} as const;

/** The id of the one form that delivers the proof. Both submit buttons point at
 *  it, so there is a single `simulationId` and no nested form. */
const SUBMIT_FORM = 'entregar-prova';

const CELL_LABEL: Record<CellState, string> = {
  done: 'respondida',
  flag: 'marcada para rever',
  empty: 'por responder',
};

const CELL_TEXT: Record<CellState, string> = {
  done: 'Respondida',
  flag: 'Para rever',
  empty: 'Por responder',
};

/** One question's draft, plus the id of the row on the server once it exists.
 *  `answerId` decides POST vs PUT on the next save; see exam-rules.ts. */
interface Draft {
  optionId: number | null;
  text: string;
  answerId: number | null;
}

function draftFrom(data: RoomData): Record<number, Draft> {
  return Object.fromEntries(
    data.questions.map((q) => {
      const saved = data.saved[q.id];
      return [
        q.id,
        saved
          ? { optionId: saved.optionId, text: saved.text, answerId: saved.answerId }
          : { optionId: null, text: '', answerId: null },
      ];
    }),
  );
}

function isAnswered(question: ExamQuestion, draft: Draft | undefined): boolean {
  if (!draft) return false;
  return isChoice(question) ? draft.optionId !== null : draft.text.trim().length > 0;
}

/** Confirmation before handing the proof in, and the place where the student is
 *  told what is still unanswered: a submission cannot be undone.
 *
 *  It does not carry its own `<form>`. The submitting form lives once in the room
 *  and this button joins it through `form=`, because a form inside a form is
 *  invalid HTML and the browser drops the inner one — the delivery would silently
 *  never reach the server. */
function Confirmar({
  unanswered,
  pending,
  error,
  onCancel,
}: {
  unanswered: number;
  pending: boolean;
  error?: string;
  onCancel: () => void;
}) {
  return (
    <Card className="gap-4 border-warning/50 bg-warning-soft/40 p-5" role="alertdialog" aria-labelledby="confirmar">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id="confirmar" className="text-[15px] font-bold">Entregar a prova?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {unanswered === 0
              ? 'Depois de entregar não dá para alterar as respostas.'
              : unanswered === 1
                ? 'Ficou 1 questão por responder. Depois de entregar não dá para alterar.'
                : `Ficaram ${unanswered} questões por responder. Depois de entregar não dá para alterar.`}
          </p>
        </div>
      </div>
      {error && <p role="alert" className="text-[13px] font-medium text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2.5">
        <Button type="submit" form={SUBMIT_FORM} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Entregar
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Continuar a responder
        </Button>
      </div>
    </Card>
  );
}

export function SalaProva({ data, extraTime }: { data: RoomData; extraTime: boolean }) {
  const questions = data.questions;
  const [index, setIndex] = useState(0);
  const [flagged, setFlagged] = useState<ReadonlySet<number>>(() => new Set());
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() => draftFrom(data));
  const [feedback, setFeedback] = useState<Record<number, AnswerState>>({});
  const [confirming, setConfirming] = useState(false);
  /** The countdown ticks only once mounted, on purpose.
   *
   *  `Date.now()` during render would give a different value on the server and on the
   *  client — o cronómetro é calculado a partir de `now` — e o React accuse a
   *  divergência na hidratação. Renderiza-se sem prazo e o primeiro `setNow` no
   *  efeito é que o faz aparecer. */
  const [now, setNow] = useState<number | null>(null);
  const [pendingSave, startSave] = useTransition();
  /** `useActionState` for the same reason as the rest of the app: the error the
   *  server sends back has to land next to the button that caused it. */
  const [submitState, submit, submitting] = useActionState(submeterAction, undefined);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const current = questions[index];
  /** `null` enquanto o relógio não arrancou: sem ele não se sabe o que falta, e
   *  inventar um número no primeiro render seria pior do que um traço. */
  const left = now === null ? null : remainingMs(data.deadline, now);
  /** The same two conditions the server enforces on a write (SimulationAnswerService
   *  :107 and :125): not IN_PROGRESS, or past the deadline. Stopping the form here is
   *  what keeps the student from answering into a 409. `acceptsAnswers` is the tested
   *  rule, and it reads a missing deadline as "no limit" — which is what
   *  SimulationDeadlineService.java:89 means by a null deadline. Before the clock
   *  starts there is no reason to lock the form, so the room stays open. */
  const closed =
    (data.status ?? '').toUpperCase() !== 'IN_PROGRESS' ||
    (now !== null && left !== null && left <= 0);

  /** What the header shows. 'a-contar' only exists during the first render, before
   *  the browser's clock starts ticking — the server rendered this component too, and
   *  its `Date.now()` is not the student's. 'sem-limite' is a real state: a statement
   *  without `durationMinutes` has no deadline and never expires. */
  const tempo = timer(data.deadline, now);

  const answered = useMemo(
    () => new Set(questions.filter((q) => isAnswered(q, drafts[q.id])).map((q) => q.id)),
    [questions, drafts],
  );

  function patch(questionId: number, change: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...change } }));
  }

  /** Writes the answer to the server. The draft is passed in rather than read from
   *  state: a tap calls `patch` and `guardar` in the same tick, so the state the
   *  closure sees is the one from before the tap, and the option just chosen would
   *  be lost. Choices go on the tap; open text goes when the student leaves the
   *  question — a request per keystroke is the wrong shape for an answer that is
   *  still being written. */
  function guardar(question: ExamQuestion, draft: Draft | undefined = drafts[question.id]) {
    if (!draft || closed) return;
    if (!isAnswered(question, draft) && draft.answerId === null) return;

    const form = new FormData();
    form.set('simulationId', String(data.simulationId));
    form.set('statementId', String(data.statementId));
    form.set('questionId', String(question.id));
    form.set('optionId', draft.optionId === null ? '' : String(draft.optionId));
    form.set('answerText', draft.text);
    form.set('answerId', draft.answerId === null ? '' : String(draft.answerId));

    startSave(async () => {
      const result = await responderAction(undefined, form);
      setFeedback((prev) => ({ ...prev, [question.id]: result }));
      if (result?.status === 'saved') patch(question.id, { answerId: result.answerId });
    });
  }

  function sairDaQuestao() {
    if (current) guardar(current);
  }

  function toggleFlag(questionId: number) {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }
  function openConfirm() {
    // O texto aberto só é gravado ao sair da questão, por isso a saída é forçada
    // antes de confirmar: caso contrário a última resposta escrita não chegava ao
    // servidor e a prova saía sem ela.
    sairDaQuestao();
    setConfirming(true);
  }

  function fecharConfirm() {
    setConfirming(false);
  }

  if (!current) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <p className="text-muted-foreground">Esta prova não tem questões.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-card px-4 py-2.5 md:px-5">
        <Button asChild variant="ghost" size="icon" aria-label="Sair da prova">
          <Link href="/provas"><ChevronLeft /></Link>
        </Button>
        <div className="min-w-0 leading-tight">
          <div className="truncate text-[15px] font-bold">{data.title}</div>
          <div className="text-xs text-muted-foreground">{data.subtitle}</div>
        </div>
        <div
          className={cn('ml-auto flex items-center gap-2 text-lg font-bold', closed && 'text-destructive')}
          role="timer"
          aria-label={tempo === 'sem-limite' ? 'Sem limite de tempo' : 'Tempo restante'}
        >
          <Clock className="size-[18px]" aria-hidden />
          {/* Três estados, e não dois: sem limite é uma coisa real (uma prova sem
              `durationMinutes` nunca expira), e "ainda a contar" é o primeiro render,
              em que o relógio do browser ainda não arrancou. Dizer "Sem tempo" nos
              dois casos mentiria ao aluno sobre uma prova que está a contar. */}
          <span className="tabular-nums">
            {tempo === 'restante' ? formatClock(left ?? 0) : tempo === 'sem-limite' ? 'Sem tempo' : '—:—'}
          </span>
          {extraTime && (
            <small className="hidden text-xs font-semibold text-muted-foreground sm:inline">+25% de tempo</small>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={openConfirm} disabled={closed}>Entregar</Button>
      </header>

      <div className="mx-auto grid w-full max-w-[1040px] flex-1 items-start gap-6 p-4 md:grid-cols-[minmax(0,1fr)_280px] md:p-6">
        <div className="grid min-w-0 gap-4">
          {/* One form for the whole room: the confirmation's submit button joins it
              through `form=`, and so does the "deliver what is saved" button shown
              once the time is up. */}
          <form id={SUBMIT_FORM} action={submit}>
            <input type="hidden" name="simulationId" value={String(data.simulationId)} />
          </form>

          {confirming && (
            <Confirmar
              unanswered={questions.length - answered.size}
              pending={submitting}
              error={submitState?.error}
              onCancel={fecharConfirm}
            />
          )}

          {closed && (
            <Card className="gap-1 border-destructive/40 bg-destructive/5 p-4" role="status">
              <p className="text-[15px] font-bold text-destructive">O tempo desta prova terminou</p>
              <p className="text-sm text-muted-foreground">
                O servidor já não aceita respostas. Entrega o que está guardado para veres a nota.
              </p>
              <Button type="submit" form={SUBMIT_FORM} size="sm" className="mt-2 justify-self-start" disabled={submitting}>
                Entregar o que está guardado
              </Button>
            </Card>
          )}

          <Card className="gap-5 p-5 md:p-6" aria-labelledby="q-text">
            <div className="flex justify-between gap-3 text-[13px] font-semibold text-muted-foreground">
              <span>Questão {index + 1} de {questions.length}</span>
              <span>{current.maxScore != null ? `${current.maxScore} valores` : ''}</span>
            </div>
            <p id="q-text" className="max-w-[60ch] text-[17px] leading-relaxed md:text-[19px]">{current.text}</p>

            {isChoice(current) ? (
              <fieldset className="grid gap-2.5" aria-label="Respostas" disabled={closed}>
                {current.options.map((option, i) => (
                  <label
                    key={option.id}
                    className="relative flex min-h-14 cursor-pointer items-center gap-3.5 rounded-lg border border-input bg-card px-4 py-3 text-base transition-colors hover:bg-secondary has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40"
                  >
                    <input
                      className="peer sr-only"
                      type="radio"
                      name={`opcao-${current.id}`}
                      checked={drafts[current.id]?.optionId === option.id}
                      onChange={() => {
                        const draft = { ...drafts[current.id], optionId: option.id };
                        patch(current.id, { optionId: option.id });
                        guardar(current, draft);
                      }}
                    />
                    <span className="grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] border-input text-[13px] font-bold text-muted-foreground peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground">
                      {option.optionLabel?.trim() || String.fromCharCode(65 + i)}
                    </span>
                    <span className="tabular-nums">{option.optionText}</span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor={`texto-${current.id}`}>A tua resposta</Label>
                <Textarea
                  id={`texto-${current.id}`}
                  rows={5}
                  value={drafts[current.id]?.text ?? ''}
                  disabled={closed}
                  onChange={(e) => patch(current.id, { text: e.target.value })}
                  onBlur={sairDaQuestao}
                />
                <p className="text-[13px] text-muted-foreground">As respostas abertas são corrigidas pelo professor.</p>
              </div>
            )}

            <p aria-live="polite" role="status" className="min-h-5 text-sm text-muted-foreground">
              {feedback[current.id]?.status === 'error'
                ? feedback[current.id]?.error
                : feedback[current.id]?.status === 'saved'
                  ? pendingSave
                    ? 'A guardar…'
                    : 'Resposta guardada. Podes mudá-la até entregares a prova.'
                  : ''}
            </p>

            {data.images[current.id]?.length > 0 && (
              <div className="grid gap-2">
                {data.images[current.id].map((image) => (
                  <figure key={image.id} className="grid gap-1">
                    {/* A URL vem do armazenamento do backend, por isso é um img simples:
                        next/image exigiria o domínio na lista e um tamanho configurado
                        do lado de quem guarda a imagem. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.imageUrl} alt={image.caption ?? ''} className="w-full rounded-lg border" />
                    {image.caption && (
                      <figcaption className="text-[13px] text-muted-foreground">{image.caption}</figcaption>
                    )}
                  </figure>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                disabled={index === 0}
                onClick={() => { sairDaQuestao(); setIndex((i) => Math.max(0, i - 1)); }}
              >
                <ChevronLeft />Anterior
              </Button>
              <Button
                variant="ghost"
                className="text-primary"
                aria-pressed={flagged.has(current.id)}
                onClick={() => toggleFlag(current.id)}
              >
                <Flag />{flagged.has(current.id) ? 'Marcada para rever' : 'Marcar para rever'}
              </Button>
              <span className="flex-1" />
              <Button
                disabled={index === questions.length - 1}
                onClick={() => { sairDaQuestao(); setIndex((i) => Math.min(questions.length - 1, i + 1)); }}
              >
                Seguinte<ChevronRight />
              </Button>
            </div>
          </Card>
        </div>

        <Card className="gap-4" aria-label="Questões">
          <CardHeader><CardTitle>Questões</CardTitle></CardHeader>
          <CardContent className="grid gap-3.5">
            <div className="grid grid-cols-6 gap-2">
              {questions.map((question, i) => {
                const status = cellState(question.id, answered, flagged);
                return (
                  <button
                    key={question.id}
                    type="button"
                    aria-current={i === index}
                    aria-label={`Questão ${i + 1}, ${CELL_LABEL[status]}`}
                    onClick={() => { sairDaQuestao(); setIndex(i); }}
                    className={cn('grid aspect-square place-items-center rounded-md border text-[13px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-[current=true]:outline-2 aria-[current=true]:outline-offset-1 aria-[current=true]:outline-primary', CELL[status])}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground">
              {(['done', 'flag', 'empty'] as const).map((key) => (
                <span key={key} className="inline-flex items-center gap-1.5">
                  <i className={cn('inline-block size-2.5 rounded-[3px] border', CELL[key])} aria-hidden />
                  {CELL_TEXT[key]}
                </span>
              ))}
            </div>
            <p className="text-[13px] text-muted-foreground">{answered.size} de {questions.length} respondidas</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
