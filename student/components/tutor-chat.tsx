'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FileText, Loader2, RefreshCw, Send, Square, TriangleAlert } from 'lucide-react';
import { Column, Page, PageHeader } from '@/components/page';
import { UserAvatar } from '@/components/user-avatar';
import { TutorText } from '@/components/tutor-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { track } from '@/lib/analytics';
import { BASE_PATH } from '@/lib/base-path';
import { useMe } from '@/lib/me-context';
import { fullName, photoUrl } from '@/lib/profile';
import {
  MAX_MESSAGE,
  SUGGESTIONS,
  answerTo,
  applyEvent,
  buildMessagePayload,
  buildSessionPayload,
  canSendMessage,
  composerAction,
  describeHttpFailure,
  modeNeedsQuestion,
  parseRetryAfter,
  parseSse,
  preselectQuestion,
  questionOptions,
  type ChatMessage,
  type ChatMode,
  type PaperQuestion,
} from '@/lib/tutor-rules';

/** What survives a reload, per paper: the session id (the backend keeps the history on
 *  its side and uses it as context) and the messages the student already saw. The
 *  backend has no endpoint to list a session's messages, so what is shown after a
 *  reload is what this browser kept; the tutor itself still remembers all of it. */
interface Saved {
  sessionId: number | null;
  messages: ChatMessage[];
}

const key = (statementId: number) => `kixi.tutor.${statementId}`;

function load(statementId: number): Saved {
  try {
    const raw = sessionStorage.getItem(key(statementId));
    if (!raw) return { sessionId: null, messages: [] };
    const parsed = JSON.parse(raw) as Saved;
    return {
      sessionId: typeof parsed.sessionId === 'number' ? parsed.sessionId : null,
      // An answer that was still arriving when the page closed is not a finished one.
      messages: Array.isArray(parsed.messages)
        ? parsed.messages.map((m) => (m.streaming ? { ...m, streaming: false, failed: 'A resposta foi interrompida.' } : m))
        : [],
    };
  } catch {
    return { sessionId: null, messages: [] };
  }
}

function save(statementId: number, value: Saved) {
  try {
    sessionStorage.setItem(key(statementId), JSON.stringify(value));
  } catch {
    /* private window or full: the conversation just will not survive a reload */
  }
}

class HttpFailure extends Error {
  constructor(readonly status: number, readonly retryAfter: number | null) {
    super(`HTTP ${status}`);
  }
}

/**
 * The tutor, bound to one paper.
 *
 * The backend scopes a session to a statement (`ChatSessionRequest.statementId` is
 * required) — there is nothing the tutor may answer from without one — so without a
 * paper this screen asks for one instead of pretending to chat. The answer streams in
 * over server-sent events, read with `fetch` because `EventSource` cannot POST.
 *
 * Each turn carries its mode and, when the student picked a question, that question
 * with the answer they gave it (kixi#115). Sources arrive with the final SSE event
 * and are kept on the tutor message, so a reload preserves the provenance shown.
 */
export function TutorChat({
  statementId,
  paperTitle,
  back,
  initialDraft = '',
  initialMode = 'CONCEPT',
  initialQuestionNumber = null,
  questions = [],
  wrongAnswers = new Map(),
}: {
  /** A prova da conversa. Obrigatória: o backend não abre sessão sem ela, por isso
   *  quem chega ao tutor sem prova vê o `TutorPicker`, não este componente. */
  statementId: number;
  paperTitle?: string | null;
  /** Para onde «Voltar» leva, já decidido no servidor: o resultado de onde o aluno
   *  veio, ou o detalhe da prova. */
  back: { href: string; label: string };
  /** Written into the box but never sent: "estudar os erros" opens with the question
   *  ready, and sending it is the second click. */
  initialDraft?: string;
  /** "Estudar os erros" arrives with the questions to review, so the mode it opens in
   *  is explaining one; a bare tutor opens on concepts. */
  initialMode?: ChatMode;
  /** The first question to review, by number: preselected so the first turn is about it. */
  initialQuestionNumber?: number | null;
  /** The paper's questions, so "explicar questão" can name one. Without them the
   *  mode still works, on the whole paper. */
  questions?: PaperQuestion[];
  /** What the student answered wrongly, by question number, from the result screen. */
  wrongAnswers?: Map<number, string>;
}) {
  const me = useMe();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState(initialDraft);
  const [busy, setBusy] = useState(false);
  const [answerAnnouncement, setAnswerAnnouncement] = useState('');
  const [mode, setMode] = useState<ChatMode>(initialMode);
  const [questionId, setQuestionId] = useState<number | null>(
    initialQuestionNumber == null
      ? null
      : questions.find((question) => question.number === initialQuestionNumber)?.id ?? null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  /** Se o «Tentar de novo» faz sentido para este aviso (a escolha da questão não se resolve tentando). */
  const [noticeRetry, setNoticeRetry] = useState(true);
  const sessionId = useRef<number | null>(null);
  const sessionContext = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const end = useRef<HTMLDivElement>(null);
  const lastSent = useRef('');

  useEffect(() => {
    const saved = load(statementId);
    sessionId.current = saved.sessionId;
    sessionContext.current = null;
    nextId.current = saved.messages.reduce((max, m) => Math.max(max, m.id), 0) + 1;
    setMessages(saved.messages);
  }, [statementId]);

  useEffect(() => {
    if (!busy) save(statementId, { sessionId: sessionId.current, messages });
  }, [messages, busy, statementId]);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages]);
  useEffect(() => () => abort.current?.abort(), []);

  const openSession = useCallback(async (
    signal: AbortSignal,
    payload: Record<string, unknown>,
    contextKey: string,
  ): Promise<number> => {
    const res = await fetch(`${BASE_PATH}/api/tutor/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) throw new HttpFailure(res.status, parseRetryAfter(res.headers.get('retry-after')));
    const created = (await res.json()) as { id: number };
    sessionId.current = created.id;
    sessionContext.current = contextKey;
    // #219 "tutor usado": o momento em que a sessão abre de verdade, não cada
    // mensagem — a conversa inteira é um só uso, por mais turnos que tenha.
    track('tutor_used');
    return created.id;
  }, []);

  const ask = useCallback(async (
    content: string,
    { repeat = false, asMode, asQuestionId }: { repeat?: boolean; asMode?: ChatMode; asQuestionId?: number | null } = {},
  ) => {
    const text = content.trim();
    if (!text || busy) return;
    // `asMode`/`asQuestionId` carry what the caller wants, not what the state still
    // says: setState is asynchronous, so a button that switched the mode and asked in
    // the same click would otherwise send the previous turn's context.
    const desiredMode = asMode ?? mode;
    const desiredQuestionId = asQuestionId === undefined ? questionId : asQuestionId;
    const selected = questions.find((question) => question.id === desiredQuestionId) ?? null;
    if (modeNeedsQuestion(desiredMode) && !selected) {
      setNotice('Escolhe uma questão para esse modo.');
      setNoticeRetry(false);
      return;
    }
    lastSent.current = text;
    setNotice(null);
    setNoticeRetry(true);
    setAnswerAnnouncement('');
    setBusy(true);

    const controller = new AbortController();
    abort.current = controller;

    const sessionPayload = buildSessionPayload({
      statementId,
      mode: desiredMode,
      questionId: selected?.id,
      studentAnswer: answerTo(wrongAnswers, selected?.number ?? null),
    });
    const messagePayload = buildMessagePayload(text);
    const contextKey = JSON.stringify(sessionPayload);

    const tutorId = nextId.current + (repeat ? 0 : 1);
    setMessages((prev) => {
      const base = repeat ? prev.filter((m) => !(m.role === 'tutor' && m.failed && m.text === '')) : prev;
      const withStudent = repeat ? base : [...base, { id: nextId.current, role: 'student' as const, text }];
      return [...withStudent, { id: tutorId, role: 'tutor' as const, text: '', streaming: true, questionId: selected?.id ?? null }];
    });
    nextId.current = tutorId + 1;
    if (!repeat) setDraft('');

    const send = async (id: number) => {
      const res = await fetch(`${BASE_PATH}/api/tutor/sessions/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messagePayload),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new HttpFailure(res.status, parseRetryAfter(res.headers.get('retry-after')));
      return res.body;
    };

    try {
      let id =
        sessionId.current != null && sessionContext.current === contextKey
          ? sessionId.current
          : await openSession(controller.signal, sessionPayload, contextKey);
      let body: ReadableStream<Uint8Array>;
      try {
        body = await send(id);
      } catch (error) {
        // The session is gone on the server's side (404): open a fresh one, once.
        if (!(error instanceof HttpFailure) || error.status !== 404) throw error;
        id = await openSession(controller.signal, sessionPayload, contextKey);
        body = await send(id);
      }

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      let answerText = '';
      let streamFailed = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const parsed = parseSse(pending);
        pending = parsed.rest;
        for (const event of parsed.events) {
          if (event.type === 'delta') answerText += event.content;
          if (event.type === 'error') streamFailed = true;
          setMessages((prev) => applyEvent(prev, event));
        }
      }
      // The stream ended without a `final`: close the answer rather than leave it
      // blinking forever.
      setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
      if (!streamFailed && answerText) setAnswerAnnouncement(`Resposta do tutor: ${answerText}`);
    } catch (error) {
      if (controller.signal.aborted) {
        setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
      } else {
        const status = error instanceof HttpFailure ? error.status : 0;
        const message = describeHttpFailure(status || 502, error instanceof HttpFailure ? error.retryAfter : null);
        // A failure before any text: the empty answer is dropped and the message
        // stays above the box, with the question still there to send again.
        setMessages((prev) => prev.filter((m) => !(m.role === 'tutor' && m.text === '' && m.streaming)));
        setNotice(message);
        setNoticeRetry(true);
        if (status === 401) window.location.assign(`${BASE_PATH}/entrar?reason=session-expired`);
      }
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }, [busy, mode, openSession, questionId, questions, statementId, wrongAnswers]);

  function stop() {
    abort.current?.abort();
  }

  function retryLast() {
    // The question is already on screen: asking again adds only a new answer.
    void ask(lastSent.current, { repeat: true });
  }

  const limit = draft.length > MAX_MESSAGE;
  const selectedQuestion = questions.find((question) => question.id === questionId) ?? null;
  // Only the latest finished answer offers it: asking again on every bubble would
  // stack copies of the same request. And only when that answer was about a question:
  // "exercises like this one" needs a "this one", and the request it opens is refused
  // without it.
  const lastAnswer = [...messages].reverse().find((m) => m.role === 'tutor' && !m.streaming);
  const lastAnswerQuestionId = lastAnswer?.questionId ?? null;
  const needsQuestion = modeNeedsQuestion(mode);

  useEffect(() => {
    if (!needsQuestion || questionId !== null) return;
    const pre = preselectQuestion(mode, questions, lastAnswerQuestionId);
    if (pre != null) setQuestionId(pre);
  }, [mode, needsQuestion, questionId, questions, lastAnswerQuestionId]);
  const selectedAnswer = answerTo(wrongAnswers, selectedQuestion?.number ?? null);

  return (
    <Page>
      <Column className="mx-auto w-full max-w-[1040px] gap-5">
        <PageHeader
          kicker={paperTitle ? 'Estudo assistido' : undefined}
          title="Tutor"
          description={paperTitle ? `Sobre ${paperTitle}.` : 'Pergunta o que quiseres sobre esta prova.'}
        />
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{answerAnnouncement}</p>
        <div className="-mt-2">
          <Button asChild variant="outline" size="sm">
            <Link href={back.href}><FileText aria-hidden />{back.label}</Link>
          </Button>
        </div>
        <Card className="min-h-[calc(100dvh-230px)] gap-0 border-0 bg-transparent py-0 shadow-none [--px-edge:transparent]" aria-label="Conversa com o tutor">
          <div className="flex flex-1 flex-col gap-4 p-4 md:p-5" role="log" aria-live="off" aria-busy={busy}>
            {messages.length === 0 && (
              <p className="m-auto max-w-[44ch] text-center text-sm text-muted-foreground">
                Pergunta sobre uma questão ou um conceito desta prova. O tutor explica o raciocínio, mas não dá a resposta feita.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={cn('flex max-w-[94%] gap-2.5 md:max-w-[88%]', m.role === 'student' ? 'flex-row-reverse self-end' : 'min-w-0')}>
                {m.role === 'tutor'
                  ? <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#e3efe0]" aria-hidden="true"><svg viewBox="0 0 24 20" width="18" height="15" shapeRendering="crispEdges"><path fill="#1f5a2c" d="M12 0h1v1h-1zM10 1h3v1h-3zM8 2h5v1h-5zM8 3h5v1h-5zM8 4h5v1h-5zM8 5h5v1h-5zM8 6h5v1h-5zM8 7h5v1h-5zM8 8h5v1h-5zM8 9h6v1h-6zM7 10h7v1h-7zM7 11h8v1h-8zM6 12h10v1h-10zM6 13h11v1h-11zM5 14h14v1h-14zM4 15h18v1h-18zM3 16h21v1h-21zM3 17h4v1h-4zM14 17h9v1h-9zM1 18h2v1h-2zM17 18h5v1h-5zM19 19h1v1h-1z" /></svg></span>
                  : <UserAvatar name={fullName(me)} src={photoUrl(me)} size={32} className="max-md:hidden" />}
                <div className={cn('min-w-0 leading-relaxed', m.role === 'student' ? 'whitespace-pre-wrap rounded-[18px] bg-[#f1f3ef] px-4 py-3 text-[#121c15]' : 'py-1')}>
                  {m.role === 'tutor' && m.text
                    ? <TutorText text={m.text} streaming={!!m.streaming} />
                    : m.text || (m.streaming ? <span className="text-muted-foreground">A pensar…</span> : null)}
                  {m.streaming && m.text && <span className="ml-0.5 inline-block h-4 w-1.5 motion-safe:animate-pulse bg-current align-middle" aria-hidden />}
                  {m.failed && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-destructive" role="alert">
                      <TriangleAlert className="size-3.5" aria-hidden />{m.failed}
                    </div>
                  )}
                  {m.id === lastAnswer?.id && !m.failed && lastAnswerQuestionId != null && (
                    <div className="mt-2 border-t pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        disabled={busy}
                        onClick={() => {
                          // The mode and the question travel in the call, not in the state:
                          // this is the same click that asks, and setState lands after it.
                          setMode('SIMILAR_EXERCISES');
                          setQuestionId(lastAnswerQuestionId);
                          void ask('Dá-me exercícios parecidos com esta questão, para eu tentar antes de ver as soluções.', {
                            asMode: 'SIMILAR_EXERCISES',
                            asQuestionId: lastAnswerQuestionId,
                          });
                        }}
                      >
                        Fazer exercício semelhante
                      </Button>
                    </div>
                  )}
                  {m.role === 'tutor' && m.sources && m.sources.length > 0 && !m.streaming && (
                    <details className="mt-3 border-t pt-2 text-xs">
                      <summary className="cursor-pointer font-semibold">Fonte da resposta</summary>
                      <div className="mt-2 grid gap-2 text-muted-foreground">
                        {m.sources.map((source, index) => (
                          <div key={`${source.statementId}-${source.questionId}-${index}`}>
                            <p className="font-medium text-foreground">
                              {source.kind === 'CATALOG_QUESTION'
                                ? `Exercício semelhante · ${source.statementTitle ?? 'Prova'}`
                                : source.questionNumber
                                  ? `Questão ${source.questionNumber}`
                                  : source.statementTitle ?? 'Enunciado'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            ))}
            <div ref={end} />
          </div>

          {/* Coluna flex e não `grid`: uma grelha de uma coluna dimensiona a pista
              pelo conteúdo e alargava a caixa do compositor para além do ecrã. */}
          <div className="flex flex-col gap-2.5 border-t border-[#eef0ec] p-3.5 md:px-0">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Modo do tutor">
              {([
                ['CONCEPT', 'Conceito'],
                ['EXPLAIN_QUESTION', 'Explicar questão'],
                ['SIMILAR_EXERCISES', 'Exercícios semelhantes'],
              ] as const).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant={mode === value ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={mode === value}
                  onClick={() => setMode(value)}
                  disabled={busy}
                >
                  {label}
                </Button>
              ))}
            </div>
            {needsQuestion && questions.length > 0 && (
              <div className="grid gap-1.5">
                <label htmlFor="tutor-question" className="text-xs font-medium text-muted-foreground">
                  {mode === 'SIMILAR_EXERCISES'
                    ? 'Qual questão queres usar como base?'
                    : 'Qual questão queres que eu explique?'}
                </label>
                <NativeSelect
                  id="tutor-question"
                  value={questionId ?? ''}
                  onChange={(e) => setQuestionId(e.target.value ? Number(e.target.value) : null)}
                  disabled={busy}
                  aria-describedby={`tutor-question-hint`}
                >
                  {questionOptions(mode, questions).map((option) => (
                    <option key={option.value || 'placeholder'} value={option.value} disabled={option.disabled}>
                      {option.label}
                    </option>
                  ))}
                </NativeSelect>
                <p id="tutor-question-hint" className="text-xs text-muted-foreground">
                  O modo {mode === 'EXPLAIN_QUESTION' ? '«Explicar questão»' : '«Exercícios semelhantes»'} precisa de uma questão específica da prova — a prova inteira fica disponível no modo «Conceito».
                </p>
                {selectedAnswer && (
                  <p className="text-xs text-muted-foreground">Incluo a tua resposta: {selectedAnswer}</p>
                )}
              </div>
            )}
            {needsQuestion && questions.length === 0 && (
              <p className="text-xs text-muted-foreground">Este modo precisa de uma questão da prova.</p>
            )}
            {notice && (
              <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <TriangleAlert className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">{notice}</span>
                {noticeRetry && (
                  <Button type="button" variant="outline" size="sm" onClick={retryLast} disabled={busy}>
                    <RefreshCw aria-hidden />Tentar de novo
                  </Button>
                )}
              </div>
            )}
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  /* `whitespace-normal` e `h-auto`: as sugestões são frases e num
                     telemóvel não cabem numa linha; sem isto a última saía do ecrã
                     e a página ganhava deslocamento horizontal. */
                  <Button key={suggestion} type="button" variant="outline" size="sm" className="h-auto min-h-11 max-w-full rounded-full text-left whitespace-normal text-muted-foreground" onClick={() => void ask(suggestion)} disabled={busy}>
                    {suggestion}
                  </Button>
                ))}
              </div>
            )}
            {messages.some((m) => m.failed) && !notice && (
              <div>
                <Button type="button" variant="outline" size="sm" onClick={retryLast} disabled={busy}>
                  <RefreshCw aria-hidden />Perguntar de novo
                </Button>
              </div>
            )}
            {/* O botão vive dentro do campo, no canto de baixo à direita (#761): ao lado,
                um botão de 36 px alinhado ao fundo de uma caixa de 2 a 4 linhas ficava
                desencontrado. `pr-14` reserva-lhe o espaço para o texto não passar por baixo. */}
            <form
              className="relative"
              onSubmit={(e) => { e.preventDefault(); void ask(draft); }}
            >
              <Textarea
                // `text-base` em todos os tamanhos: abaixo dos 16 px o iOS amplia a
                // página ao focar o campo (#495).
                className="min-w-0 pr-14 text-base md:text-base"
                value={draft}
                rows={draft.length > 120 ? 4 : 2}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Telemóvel: Enter muda de linha, e quem envia é o botão. Antes, o
                  // return do teclado mandava a pergunta a meio.
                  const desktop = window.matchMedia('(min-width: 768px)').matches;
                  if (composerAction(e, desktop) === 'send') {
                    e.preventDefault();
                    void ask(draft);
                  }
                }}
                placeholder="Escreve a tua dúvida"
                aria-label="Mensagem para o tutor"
                aria-invalid={limit}
              />
              {busy ? (
                <Button type="button" variant="outline" size="icon" className="absolute right-1.5 bottom-1.5" onClick={stop} aria-label="Parar">
                  <Square aria-hidden />
                </Button>
              ) : (
                <Button type="submit" size="icon" className="absolute right-1.5 bottom-1.5" disabled={!canSendMessage(draft, mode, questionId, limit)} aria-label="Enviar" aria-describedby={needsQuestion && questionId == null ? 'tutor-question-hint' : undefined}>
                  <Send aria-hidden />
                </Button>
              )}
            </form>
            <p className="text-xs text-muted-foreground md:hidden">Enter muda de linha. Usa o botão de enviar para mandar a pergunta.</p>
            {limit && <p role="alert" className="text-[13px] text-destructive">A mensagem passa os {MAX_MESSAGE} caracteres.</p>}
            {busy && <p className="sr-only" role="status"><Loader2 aria-hidden />O tutor está a responder</p>}
          </div>
        </Card>
      </Column>
    </Page>
  );
}
