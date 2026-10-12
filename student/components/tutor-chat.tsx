'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FileText, Loader2, RefreshCw, Send, Square, TriangleAlert } from 'lucide-react';
import { Column, Page, PageHeader } from '@/components/page';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { BASE_PATH } from '@/lib/base-path';
import { useMe } from '@/lib/me-context';
import { fullName } from '@/lib/profile';
import {
  MAX_MESSAGE,
  SUGGESTIONS,
  applyEvent,
  describeHttpFailure,
  parseRetryAfter,
  parseSse,
  type ChatMessage,
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
 * Not here yet, on purpose: the three modes, "fonte da resposta" and "Fazer exercício
 * semelhante". They are BE-19 (kixi#115), still open, and the response carries no
 * `sources` to show. The chips are plain questions, not modes.
 */
export function TutorChat({
  statementId,
  paperTitle,
  initialDraft = '',
}: {
  statementId?: number;
  paperTitle?: string | null;
  /** Written into the box but never sent: "estudar os erros" opens with the question
   *  ready, and sending it is the second click. */
  initialDraft?: string;
}) {
  const me = useMe();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState(initialDraft);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const sessionId = useRef<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const end = useRef<HTMLDivElement>(null);
  const lastSent = useRef('');

  useEffect(() => {
    if (statementId == null) return;
    const saved = load(statementId);
    sessionId.current = saved.sessionId;
    nextId.current = saved.messages.reduce((max, m) => Math.max(max, m.id), 0) + 1;
    setMessages(saved.messages);
  }, [statementId]);

  useEffect(() => {
    if (statementId != null && !busy) save(statementId, { sessionId: sessionId.current, messages });
  }, [messages, busy, statementId]);

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages]);
  useEffect(() => () => abort.current?.abort(), []);

  const openSession = useCallback(async (signal: AbortSignal): Promise<number> => {
    const res = await fetch(`${BASE_PATH}/api/tutor/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statementId }),
      signal,
    });
    if (!res.ok) throw new HttpFailure(res.status, parseRetryAfter(res.headers.get('retry-after')));
    const created = (await res.json()) as { id: number };
    sessionId.current = created.id;
    return created.id;
  }, [statementId]);

  const ask = useCallback(async (content: string, { repeat = false }: { repeat?: boolean } = {}) => {
    const text = content.trim();
    if (!text || busy || statementId == null) return;
    lastSent.current = text;
    setNotice(null);
    setBusy(true);

    const controller = new AbortController();
    abort.current = controller;

    const tutorId = nextId.current + (repeat ? 0 : 1);
    setMessages((prev) => {
      const base = repeat ? prev.filter((m) => !(m.role === 'tutor' && m.failed && m.text === '')) : prev;
      const withStudent = repeat ? base : [...base, { id: nextId.current, role: 'student' as const, text }];
      return [...withStudent, { id: tutorId, role: 'tutor' as const, text: '', streaming: true }];
    });
    nextId.current = tutorId + 1;
    if (!repeat) setDraft('');

    const send = async (id: number) => {
      const res = await fetch(`${BASE_PATH}/api/tutor/sessions/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new HttpFailure(res.status, parseRetryAfter(res.headers.get('retry-after')));
      return res.body;
    };

    try {
      let id = sessionId.current ?? (await openSession(controller.signal));
      let body: ReadableStream<Uint8Array>;
      try {
        body = await send(id);
      } catch (error) {
        // The session is gone on the server's side (404): open a fresh one, once.
        if (!(error instanceof HttpFailure) || error.status !== 404) throw error;
        id = await openSession(controller.signal);
        body = await send(id);
      }

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let pending = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        const parsed = parseSse(pending);
        pending = parsed.rest;
        for (const event of parsed.events) setMessages((prev) => applyEvent(prev, event));
      }
      // The stream ended without a `final`: close the answer rather than leave it
      // blinking forever.
      setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
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
        if (status === 401) window.location.assign(`${BASE_PATH}/entrar?reason=session-expired`);
      }
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }, [busy, openSession, statementId]);

  function stop() {
    abort.current?.abort();
  }

  function retryLast() {
    // The question is already on screen: asking again adds only a new answer.
    void ask(lastSent.current, { repeat: true });
  }

  if (statementId == null) {
    return (
      <Page>
        <Column className="gap-5">
          <PageHeader title="Tutor" description="O tutor ajuda-te a estudar uma prova de cada vez." />
          <Card className="gap-3 p-6">
            <p className="font-semibold">Escolhe uma prova para estudar</p>
            <p className="text-sm text-muted-foreground">
              O tutor só responde sobre o enunciado da prova que abrires. Escolhe uma na lista e usa «Estudo assistido».
            </p>
            <Button asChild className="self-start"><Link href="/provas">Ver as provas</Link></Button>
          </Card>
        </Column>
      </Page>
    );
  }

  const limit = draft.length > MAX_MESSAGE;

  return (
    <Page>
      <Column className="gap-5">
        <PageHeader
          kicker={paperTitle ? 'Estudo assistido' : undefined}
          title="Tutor"
          description={paperTitle ? `Sobre ${paperTitle}.` : 'Pergunta o que quiseres sobre esta prova.'}
        />
        {paperTitle && (
          <div className="-mt-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/prova/${statementId}/detalhe`}><FileText aria-hidden />Voltar à prova</Link>
            </Button>
          </div>
        )}
        <Card className="min-h-[calc(100dvh-230px)] gap-0 py-0" aria-label="Conversa com o tutor">
          <div className="flex flex-1 flex-col gap-4 p-4 md:p-5" role="log" aria-live="polite" aria-busy={busy}>
            {messages.length === 0 && (
              <p className="m-auto max-w-[44ch] text-center text-sm text-muted-foreground">
                Pergunta sobre uma questão ou um conceito desta prova. O tutor explica o raciocínio, mas não dá a resposta feita.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={cn('flex max-w-[94%] gap-2.5 md:max-w-[86%]', m.role === 'student' && 'flex-row-reverse self-end')}>
                {m.role === 'tutor'
                  ? <span className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-[13px] font-bold text-background" aria-hidden="true">K</span>
                  : <UserAvatar name={fullName(me)} size={32} className="max-md:hidden" />}
                <div className={cn('whitespace-pre-wrap rounded-xl border px-3.5 py-2.5 leading-relaxed', m.role === 'student' ? 'border-primary bg-primary text-primary-foreground' : 'bg-secondary')}>
                  {m.text || (m.streaming ? <span className="text-muted-foreground">A pensar…</span> : null)}
                  {m.streaming && m.text && <span className="ml-0.5 inline-block h-4 w-1.5 motion-safe:animate-pulse bg-current align-middle" aria-hidden />}
                  {m.failed && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-destructive" role="alert">
                      <TriangleAlert className="size-3.5" aria-hidden />{m.failed}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={end} />
          </div>

          <div className="grid gap-2.5 border-t p-3.5 md:px-5">
            {notice && (
              <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <TriangleAlert className="size-4 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">{notice}</span>
                <Button type="button" variant="outline" size="sm" onClick={retryLast} disabled={busy}>
                  <RefreshCw aria-hidden />Tentar de novo
                </Button>
              </div>
            )}
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <Button key={suggestion} type="button" variant="outline" size="sm" className="rounded-full text-muted-foreground" onClick={() => void ask(suggestion)} disabled={busy}>
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
            <form
              className="flex items-end gap-2.5"
              onSubmit={(e) => { e.preventDefault(); void ask(draft); }}
            >
              <Textarea
                value={draft}
                rows={draft.length > 120 ? 4 : 2}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(draft); }
                }}
                placeholder="Escreve a tua dúvida"
                aria-label="Mensagem para o tutor"
                aria-invalid={limit}
              />
              {busy ? (
                <Button type="button" variant="outline" onClick={stop}><Square aria-hidden />Parar</Button>
              ) : (
                <Button type="submit" disabled={!draft.trim() || limit}>
                  <Send aria-hidden />Enviar
                </Button>
              )}
            </form>
            {limit && <p role="alert" className="text-[13px] text-destructive">A mensagem passa os {MAX_MESSAGE} caracteres.</p>}
            {busy && <p className="sr-only" role="status"><Loader2 aria-hidden />O tutor está a responder</p>}
          </div>
        </Card>
      </Column>
    </Page>
  );
}
