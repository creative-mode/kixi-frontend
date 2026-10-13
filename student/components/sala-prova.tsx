'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Clock, Flag, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { guardarAction, submeterAction } from '@/lib/exam-actions';
import { createSaveQueue, type SaveQueue, type Snapshot } from '@/lib/save-queue';
import {
  backoffMs,
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
  unsaved: 'border-destructive/50 bg-destructive/10 text-destructive',
} as const;

/** The id of the one form that delivers the proof. Both submit buttons point at
 *  it, so there is a single `simulationId` and no nested form. */
const SUBMIT_FORM = 'entregar-prova';

const CELL_LABEL: Record<CellState, string> = {
  done: 'respondida',
  flag: 'marcada para rever',
  empty: 'por responder',
  unsaved: 'por guardar',
};

const CELL_TEXT: Record<CellState, string> = {
  done: 'Respondida',
  flag: 'Para rever',
  empty: 'Por responder',
  unsaved: 'Por guardar',
};

/** One question's draft: what is on screen, which may be ahead of the server. The
 *  `answerId` is not here — it belongs to the save queue, which reads it when a
 *  request leaves, not when the student taps. */
type Draft = Snapshot;

function draftFrom(data: RoomData): Record<number, Draft> {
  return Object.fromEntries(
    data.questions.map((q) => {
      const saved = data.saved[q.id];
      return [q.id, saved ? { optionId: saved.optionId, text: saved.text } : { optionId: null, text: '' }];
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
 *  never reach the server.
 *
 *  Handing in is blocked while an answer is still on its way or has failed: the
 *  server grades what it holds, so delivering now would grade a proof that is
 *  missing something the student believes they answered. */
function Confirmar({
  unanswered,
  saving,
  failed,
  pending,
  error,
  onCancel,
  onRetry,
}: {
  unanswered: number;
  saving: boolean;
  failed: number;
  pending: boolean;
  error?: string;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // O diálogo aparece por cima de uma página que pode estar rolada até ao mapa:
  // sem trazê-lo à vista e dar-lhe o foco, quem usa teclado ou leitor de ecrã não
  // sabe que abriu.
  useEffect(() => {
    ref.current?.focus();
    ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  const blocked = saving || failed > 0;
  return (
    <Card
      ref={ref}
      tabIndex={-1}
      className="gap-4 border-warning/50 bg-warning-soft/40 p-5"
      role="alertdialog"
      aria-labelledby="confirmar"
      aria-describedby="confirmar-texto"
    >
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id="confirmar" className="text-[15px] font-bold">Entregar a prova?</h2>
          <p id="confirmar-texto" className="mt-1 text-sm text-muted-foreground">
            {failed > 0
              ? `${failed === 1 ? '1 resposta não foi guardada' : `${failed} respostas não foram guardadas`}. Tenta de novo antes de entregar, senão a prova segue sem ${failed === 1 ? 'ela' : 'elas'}.`
              : saving
                ? 'A guardar as tuas respostas… Já podes entregar a seguir.'
                : unanswered === 0
                  ? 'Depois de entregar não dá para alterar as respostas.'
                  : unanswered === 1
                    ? 'Ficou 1 questão por responder. Depois de entregar não dá para alterar.'
                    : `Ficaram ${unanswered} questões por responder. Depois de entregar não dá para alterar.`}
          </p>
        </div>
      </div>
      {error && <p role="alert" className="text-[13px] font-medium text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2.5">
        {failed > 0 && (
          <Button type="button" variant="outline" onClick={onRetry}>
            <RefreshCw aria-hidden />Tentar de novo
          </Button>
        )}
        <Button type="submit" form={SUBMIT_FORM} disabled={pending || blocked}>
          {pending || (saving && failed === 0) ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Entregar
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Continuar a responder
        </Button>
      </div>
    </Card>
  );
}

/** Debounce of an open answer: long enough not to send a request per keystroke,
 *  short enough that closing the lid right after typing loses little. */
const TEXT_DEBOUNCE_MS = 800;
/** Flush of everything still unsent when this much time is left, so the last words
 *  typed reach the server before the deadline closes the room. */
const FLUSH_BEFORE_END_MS = 4000;

export function SalaProva({ data, extraTime }: { data: RoomData; extraTime: boolean }) {
  const questions = data.questions;
  const [index, setIndex] = useState(0);
  const [flagged, setFlagged] = useState<ReadonlySet<number>>(() => new Set());
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() => draftFrom(data));
  /** A synchronous mirror of `drafts`: a tap and a save happen in the same tick, and
   *  the state the closure sees is the one from before the tap. */
  const draftsRef = useRef(drafts);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const [, rerender] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  /** The countdown ticks only once mounted, on purpose.
   *
   *  `Date.now()` during render would give a different value on the server and on the
   *  client — o cronómetro é calculado a partir de `now` — e o React accuse a
   *  divergência na hidratação. Renderiza-se sem prazo e o primeiro `setNow` no
   *  efeito é que o faz aparecer. */
  const [now, setNow] = useState<number | null>(null);
  /** `useActionState` for the same reason as the rest of the app: the error the
   *  server sends back has to land next to the button that caused it. */
  const [submitState, submit, submitting] = useActionState(submeterAction, undefined);

  /** One queue per room: it serialises the writes of each question, retries the ones
   *  that fail for a transient reason, and is the only thing that knows which answers
   *  the server has confirmed. */
  const [queue] = useState<SaveQueue>(() => {
    const created = createSaveQueue({
      send: (questionId, snapshot, answerId) =>
        guardarAction({
          simulationId: data.simulationId,
          statementId: data.statementId,
          questionId,
          optionId: snapshot.optionId,
          text: snapshot.text,
          answerId,
          roomId: data.roomId ?? null,
        }),
      onChange: () => rerender((n) => n + 1),
      wait: (attempt) => new Promise((resolve) => setTimeout(resolve, backoffMs(attempt))),
    });
    for (const [questionId, saved] of Object.entries(data.saved)) {
      created.seed(Number(questionId), saved.answerId, { optionId: saved.optionId, text: saved.text });
    }
    return created;
  });

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
   *  what keeps the student from answering into a 409. `remainingMs` reads a missing
   *  deadline as "no limit" — which is what SimulationDeadlineService.java:89 means by
   *  a null deadline. Before the clock starts there is no reason to lock the form, so
   *  the room stays open. */
  const closed =
    (data.status ?? '').toUpperCase() !== 'IN_PROGRESS' ||
    (now !== null && left !== null && left <= 0);

  /** What the header shows. 'a-contar' only exists during the first render, before
   *  the browser's clock starts ticking — the server rendered this component too, and
   *  its `Date.now()` is not the student's. 'sem-limite' is a real state: a statement
   *  without `durationMinutes` has no deadline and never expires. */
  const tempo = timer(data.deadline, now);

  const snapshotOf = useCallback((id: number): Snapshot => draftsRef.current[id] ?? { optionId: null, text: '' }, []);

  /** Hands the latest value of a question to the queue, cancelling its debounce. */
  const guardar = useCallback(
    (questionId: number) => {
      const timer = timers.current.get(questionId);
      if (timer) clearTimeout(timer);
      timers.current.delete(questionId);
      void queue.request(questionId, snapshotOf(questionId));
    },
    [queue, snapshotOf],
  );

  const flushAll = useCallback(() => {
    for (const question of data.questions) guardar(question.id);
    return queue.settled();
  }, [data.questions, guardar, queue]);

  // O que ainda não saiu não pode ficar só neste separador: ao esconder ou fechar a
  // página, e pouco antes de o tempo acabar, tudo o que está por enviar é enviado.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flushAll(); };
    const onPageHide = () => void flushAll();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      for (const timer of timers.current.values()) clearTimeout(timer);
    };
  }, [flushAll]);

  const flushedAtEnd = useRef(false);
  useEffect(() => {
    if (left !== null && left <= FLUSH_BEFORE_END_MS && !flushedAtEnd.current) {
      flushedAtEnd.current = true;
      void flushAll();
    }
  }, [left, flushAll]);

  // Avisos falados aos 5 e a 1 minuto: o cronómetro visual não chega a quem usa
  // leitor de ecrã, e `role="timer"` não anuncia por si.
  const bucket = left === null ? null : left <= 0 ? 0 : left <= 60_000 ? 1 : left <= 300_000 ? 5 : 99;
  useEffect(() => {
    if (bucket === 5) setAnnouncement('Faltam 5 minutos para o fim da prova.');
    else if (bucket === 1) setAnnouncement('Falta 1 minuto para o fim da prova.');
    else if (bucket === 0) setAnnouncement('O tempo da prova terminou.');
  }, [bucket]);

  /** The map follows what the SERVER confirmed. A question whose latest value is not
   *  on the server (in flight, or failed) is `unsaved`, never `done`. */
  const unsaved = new Set(questions.filter((q) => queue.dirty(q.id, snapshotOf(q.id))).map((q) => q.id));
  const answered = new Set(
    questions.filter((q) => !unsaved.has(q.id) && isAnswered(q, drafts[q.id])).map((q) => q.id),
  );
  const failed = queue.failed();
  const saving = queue.busy() || unsaved.size > 0;

  function patch(questionId: number, change: Partial<Draft>) {
    const next = { ...draftsRef.current, [questionId]: { ...snapshotOf(questionId), ...change } };
    draftsRef.current = next;
    setDrafts(next);
  }

  function sairDaQuestao() {
    if (current) guardar(current.id);
  }

  function writeText(questionId: number, text: string) {
    patch(questionId, { text });
    const previous = timers.current.get(questionId);
    if (previous) clearTimeout(previous);
    timers.current.set(questionId, setTimeout(() => guardar(questionId), TEXT_DEBOUNCE_MS));
  }

  function retryAll() {
    for (const id of queue.failed()) void queue.retry(id);
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
    // Tudo o que está por enviar sai antes de confirmar: caso contrário a última
    // resposta escrita não chegava ao servidor e a prova saía sem ela.
    void flushAll();
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
          <Link href={data.roomId ? '/provas#salas' : '/provas'}><ChevronLeft /></Link>
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
      <p className="sr-only" role="status" aria-live="assertive">{announcement}</p>

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
              saving={saving && failed.length === 0}
              failed={failed.length}
              pending={submitting}
              error={submitState?.error}
              onCancel={fecharConfirm}
              onRetry={retryAll}
            />
          )}

          {closed && (
            <Card className="gap-1 border-destructive/40 bg-destructive/5 p-4" role="status">
              <p className="text-[15px] font-bold text-destructive">O tempo desta prova terminou</p>
              <p className="text-sm text-muted-foreground">
                O servidor já não aceita respostas. Entrega o que está guardado para veres a nota.
                {unsaved.size > 0 && ` ${unsaved.size === 1 ? '1 resposta' : `${unsaved.size} respostas`} não chegou ao servidor e vai ficar de fora.`}
              </p>
              {submitState?.error && (
                <p role="alert" className="text-[13px] font-medium text-destructive">{submitState.error}</p>
              )}
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
              <fieldset className="grid gap-2.5" aria-labelledby="q-text" disabled={closed}>
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
                        patch(current.id, { optionId: option.id });
                        guardar(current.id);
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
                  onChange={(e) => writeText(current.id, e.target.value)}
                  onBlur={sairDaQuestao}
                />
                <p className="text-[13px] text-muted-foreground">As respostas abertas são corrigidas pelo professor.</p>
              </div>
            )}

            <div aria-live="polite" role="status" className="flex min-h-5 flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {(() => {
                const state = queue.status(current.id);
                if (state.status === 'error') {
                  return (
                    <>
                      <span className="text-destructive">{state.error ?? 'Não foi possível guardar.'}</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => void queue.retry(current.id)}>
                        <RefreshCw aria-hidden />Tentar de novo
                      </Button>
                    </>
                  );
                }
                if (state.status === 'saving') return 'A guardar…';
                if (unsaved.has(current.id)) return 'Por guardar…';
                return answered.has(current.id) ? 'Resposta guardada. Podes mudá-la até entregares a prova.' : '';
              })()}
            </div>

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
                const status = cellState(question.id, answered, flagged, unsaved);
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
              {(['done', 'flag', 'empty', 'unsaved'] as const).map((key) => (
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
