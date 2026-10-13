/** The answer-saving engine of the exam room, pure so `node --test` can drive it.
 *
 *  The problems it exists to prevent, all of them found in the room by hand:
 *
 *  - Two taps on a new question made two POSTs without an `answerId`; the second
 *    was a 409 and the server kept the first choice while the screen showed the
 *    second. So there is ONE request in flight per question, and `answerId` is read
 *    when the request leaves, not when the student tapped.
 *  - A request that failed left the map saying "respondida". So what counts as
 *    answered is what the server confirmed (`saved`), and a question whose latest
 *    value is not confirmed is `dirty`.
 *  - A network blip lost the answer. Transient failures are retried with a growing
 *    wait, and a failure that gives up stays visible (`error`) until `retry`.
 *
 *  Requests are coalesced: while one is in flight only the LATEST wanted value is
 *  kept, so a burst of taps costs two requests at most and the last tap always wins.
 */

export interface Snapshot {
  optionId: number | null;
  text: string;
}

export type SendResult =
  | { ok: true; answerId: number }
  | { ok: false; message: string; transient: boolean };

export type Send = (
  questionId: number,
  snapshot: Snapshot,
  answerId: number | null,
) => Promise<SendResult>;

export type SaveStatus = 'idle' | 'saving' | 'error';

interface Entry {
  answerId: number | null;
  /** What the server holds, as a key; null when nothing was ever confirmed. */
  saved: string | null;
  wanted: Snapshot | null;
  running: boolean;
  status: SaveStatus;
  error: string | null;
}

export const keyOf = (snapshot: Snapshot): string =>
  JSON.stringify([snapshot.optionId, snapshot.text.trim()]);

export const isBlank = (snapshot: Snapshot): boolean =>
  snapshot.optionId === null && snapshot.text.trim().length === 0;

export interface SaveQueueOptions {
  send: Send;
  /** Called after any state change, for the UI to re-read. */
  onChange?: () => void;
  /** Wait before retry `attempt`; injected so tests do not sleep. */
  wait?: (attempt: number) => Promise<void>;
  maxAttempts?: number;
}

export function createSaveQueue({ send, onChange, wait, maxAttempts = 4 }: SaveQueueOptions) {
  const entries = new Map<number, Entry>();
  const idle = new Set<() => void>();

  const entry = (id: number): Entry => {
    let found = entries.get(id);
    if (!found) {
      found = { answerId: null, saved: null, wanted: null, running: false, status: 'idle', error: null };
      entries.set(id, found);
    }
    return found;
  };

  const notify = () => {
    onChange?.();
    if (![...entries.values()].some((e) => e.running)) {
      for (const resolve of [...idle]) resolve();
      idle.clear();
    }
  };

  async function run(id: number): Promise<void> {
    const e = entry(id);
    if (e.running) return;
    e.running = true;
    e.status = 'saving';
    e.error = null;
    notify();

    try {
      while (e.wanted && keyOf(e.wanted) !== e.saved) {
        const snapshot = e.wanted;
        let attempt = 0;
        let done = false;
        while (!done) {
          attempt += 1;
          let result: SendResult;
          try {
            // `answerId` is read here, at the moment the request leaves.
            result = await send(id, snapshot, e.answerId);
          } catch {
            result = { ok: false, message: 'Não foi possível contactar o servidor.', transient: true };
          }
          if (result.ok) {
            e.answerId = result.answerId;
            e.saved = keyOf(snapshot);
            done = true;
          } else if (result.transient && attempt < maxAttempts) {
            await (wait ? wait(attempt) : Promise.resolve());
          } else {
            e.status = 'error';
            e.error = result.message;
            return;
          }
        }
      }
      e.status = 'idle';
    } finally {
      e.running = false;
      notify();
    }
  }

  return {
    /** Seeds what the server already has (the resumed attempt). */
    seed(id: number, answerId: number, snapshot: Snapshot) {
      const e = entry(id);
      e.answerId = answerId;
      e.saved = keyOf(snapshot);
      e.wanted = snapshot;
    },
    /** Asks for `snapshot` to reach the server. Blank values with nothing saved
     *  before are not worth a request. */
    request(id: number, snapshot: Snapshot): Promise<void> {
      const e = entry(id);
      e.wanted = snapshot;
      if (keyOf(snapshot) === e.saved) return Promise.resolve();
      if (e.saved === null && isBlank(snapshot)) return Promise.resolve();
      return run(id);
    },
    /** Tries again a question that gave up. */
    retry(id: number): Promise<void> {
      const e = entry(id);
      if (!e.wanted) return Promise.resolve();
      return run(id);
    },
    /** What the server confirmed for a question, or null. */
    confirmed(id: number): string | null {
      return entries.get(id)?.saved ?? null;
    },
    /** Whether the latest wanted value is not on the server yet. */
    dirty(id: number, current: Snapshot): boolean {
      const e = entries.get(id);
      const saved = e?.saved ?? null;
      if (saved === null) return !isBlank(current);
      return keyOf(current) !== saved;
    },
    status(id: number): { status: SaveStatus; error: string | null } {
      const e = entries.get(id);
      return { status: e?.status ?? 'idle', error: e?.error ?? null };
    },
    busy(): boolean {
      return [...entries.values()].some((e) => e.running);
    },
    failed(): number[] {
      return [...entries].filter(([, e]) => e.status === 'error').map(([id]) => id);
    },
    /** Resolves once nothing is in flight. */
    settled(): Promise<void> {
      if (![...entries.values()].some((e) => e.running)) return Promise.resolve();
      return new Promise((resolve) => idle.add(resolve));
    },
  };
}

export type SaveQueue = ReturnType<typeof createSaveQueue>;
