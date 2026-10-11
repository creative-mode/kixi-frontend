/** The tutor's rules, with no server and no React, so `node --test` can reach them.
 *
 *  The wire format is the backend's (ChatController, creative-mode/kixi#114): the
 *  answer to a message is `text/event-stream`, with three kinds of event, each a JSON
 *  `ChatStreamEvent` discriminated by `type`:
 *
 *  - `delta { content }`   a fragment of the answer, in order;
 *  - `final { messageId, model }`  the answer is complete and stored;
 *  - `error { code, message }`     the provider failed AFTER the stream began, so the
 *                                  HTTP status was already 200 — the only place a
 *                                  mid-answer failure can travel.
 *
 *  Anything wrong BEFORE the first byte is an ordinary HTTP status instead: 404 (the
 *  session is not this account's), 429 + `Retry-After` (the per-account window is
 *  spent), 503 (no provider key configured). `EventSource` cannot POST, so the client
 *  reads the body with `fetch` and this parser. */

export type StreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'final'; messageId: number | null; model: string | null }
  | { type: 'error'; code: string; message: string };

/** Splits what has arrived so far into complete events and the unfinished remainder.
 *
 *  A chunk from the network can end anywhere, including in the middle of an event or of
 *  a multi-byte character, so the caller keeps `rest` and prepends it to the next
 *  chunk. An event ends at a blank line (`\n\n`, or `\r\n\r\n`). Lines that are not
 *  `data:` (comments, `event:`, `id:`) are skipped: the JSON payload carries its own
 *  `type`, so the `event:` name adds nothing. A payload that is not JSON, or has an
 *  unknown `type`, is dropped rather than thrown on — one bad event must not take the
 *  rest of the answer with it. */
export function parseSse(buffer: string): { events: StreamEvent[]; rest: string } {
  const normalised = buffer.replace(/\r\n/g, '\n');
  const parts = normalised.split('\n\n');
  const rest = parts.pop() ?? '';
  const events: StreamEvent[] = [];

  for (const block of parts) {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n');
    if (!data) continue;
    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      continue;
    }
    const event = toEvent(payload);
    if (event) events.push(event);
  }
  return { events, rest };
}

function toEvent(payload: unknown): StreamEvent | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (p.type === 'delta' && typeof p.content === 'string') return { type: 'delta', content: p.content };
  if (p.type === 'final') {
    return {
      type: 'final',
      messageId: typeof p.messageId === 'number' ? p.messageId : null,
      model: typeof p.model === 'string' ? p.model : null,
    };
  }
  if (p.type === 'error') {
    return {
      type: 'error',
      code: typeof p.code === 'string' ? p.code : 'UNKNOWN',
      message: typeof p.message === 'string' ? p.message : '',
    };
  }
  return null;
}

export type Role = 'student' | 'tutor';

export interface ChatMessage {
  id: number;
  role: Role;
  text: string;
  /** The tutor's answer is still arriving. */
  streaming?: boolean;
  /** The answer broke off; `text` is what arrived. */
  failed?: string;
}

/** Applies one event to the answer being written, which is always the last message. */
export function applyEvent(messages: ChatMessage[], event: StreamEvent): ChatMessage[] {
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'tutor') return messages;
  const head = messages.slice(0, -1);
  if (event.type === 'delta') return [...head, { ...last, text: last.text + event.content, streaming: true }];
  if (event.type === 'final') return [...head, { ...last, streaming: false }];
  return [...head, { ...last, streaming: false, failed: translateChatError(event.code, event.message) }];
}

/** What the student reads for each way the tutor can fail. The codes are the backend's
 *  (`CHAT_RATE_LIMITED`, ...); anything unknown falls back to a sentence that is true
 *  for all of them instead of showing the English text the provider sent. */
export function translateChatError(code: string, _message = ''): string {
  switch (code) {
    case 'CHAT_RATE_LIMITED':
      return 'Fizeste muitas perguntas seguidas. Espera um pouco antes de voltar a perguntar.';
    case 'CHAT_PROVIDER_TIMEOUT':
    case 'GATEWAY_TIMEOUT':
      return 'O tutor demorou demasiado a responder.';
    case 'CHAT_UNAVAILABLE':
    case 'SERVICE_UNAVAILABLE':
      return 'O tutor não está disponível de momento.';
    default:
      return 'A resposta do tutor foi interrompida.';
  }
}

/** What to tell the student for a failure before the stream began. `retryAfter` is the
 *  `Retry-After` header, in seconds. */
export function describeHttpFailure(status: number, retryAfter: number | null): string {
  if (status === 429) {
    const wait = retryAfter != null && retryAfter > 0 ? ` Tenta de novo ${formatWait(retryAfter)}.` : '';
    return `Atingiste o limite de mensagens para o tutor.${wait}`;
  }
  if (status === 503) return 'O tutor não está disponível de momento. Tenta mais tarde.';
  if (status === 504) return 'O tutor demorou demasiado a responder.';
  if (status === 404) return 'Esta conversa já não existe.';
  if (status === 401) return 'A sessão expirou. Entra novamente.';
  return 'Não conseguimos falar com o tutor. Tenta de novo.';
}

/** `em 30 s`, `em 4 min`, `em 2 h`. Rounded up: telling someone to retry earlier than
 *  the server allows just earns them another 429. */
export function formatWait(seconds: number): string {
  if (seconds < 60) return `em ${Math.ceil(seconds)} s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `em ${minutes} min`;
  return `em ${Math.ceil(minutes / 60)} h`;
}

/** `Retry-After` is either seconds or an HTTP date; only seconds are used here, which
 *  is what the backend sends (ChatRateLimitException). */
export function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** The question numbers a link may carry (`?questoes=2,3`): positive integers, no
 *  repeats, in order, and capped — the value comes from the address bar. */
export function parseQuestionNumbers(raw: string | string[] | undefined): number[] {
  const text = Array.isArray(raw) ? raw[0] : raw;
  if (!text) return [];
  const numbers = text
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n > 0 && n <= 999);
  return [...new Set(numbers)].sort((a, b) => a - b).slice(0, 20);
}

/** The first message of "estudar os erros": written for the student to read and send,
 *  not sent for them. */
export function studyPrompt(numbers: number[]): string {
  if (numbers.length === 0) return '';
  const list =
    numbers.length === 1
      ? `a questão ${numbers[0]}`
      : `as questões ${numbers.slice(0, -1).join(', ')} e ${numbers[numbers.length - 1]}`;
  return `Errei ${list} desta prova. Explica-me, passo a passo, onde posso ter errado.`;
}

/** Prompts offered as chips. They are plain questions, because the backend does not
 *  have the tutor's modes yet (BE-19, kixi#115): there is nothing to select. */
export const SUGGESTIONS = [
  'Explica-me a primeira questão passo a passo',
  'Quais são os conceitos principais desta prova?',
  'Dá-me uma dica para a questão mais difícil, sem dizer a resposta',
] as const;

export const MAX_MESSAGE = 4000;
