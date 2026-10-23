export type ReactionResult =
  | { ok: true; reacted: boolean }
  | { ok: false; message?: string };

export type ReactionSnapshot = {
  reacted: boolean;
  pending: boolean;
  error: string | null;
};

const FALLBACK_ERROR = 'Não foi possível guardar o aplauso. Verifica a ligação e tenta de novo.';

/** Mantém o estado confirmado pelo servidor e coordena uma única escrita por publicação. */
export class FeedReaction {
  private confirmed: boolean;
  private current: ReactionSnapshot;
  private pendingRequest: Promise<void> | null = null;
  private retryTarget: boolean | null = null;
  private listeners = new Set<(snapshot: ReactionSnapshot) => void>();
  private readonly send: (target: boolean) => Promise<ReactionResult>;

  constructor(initialReacted: boolean, send: (target: boolean) => Promise<ReactionResult>) {
    this.confirmed = initialReacted;
    this.current = { reacted: initialReacted, pending: false, error: null };
    this.send = send;
  }

  get snapshot(): ReactionSnapshot {
    return this.current;
  }

  subscribe(listener: (snapshot: ReactionSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  toggle(): Promise<void> {
    if (this.pendingRequest) return this.pendingRequest;
    return this.submit(!this.confirmed);
  }

  retry(): Promise<void> {
    if (this.pendingRequest || this.retryTarget === null) return this.pendingRequest ?? Promise.resolve();
    return this.submit(this.retryTarget);
  }

  syncConfirmed(reacted: boolean): void {
    if (this.pendingRequest || this.confirmed === reacted) return;
    this.confirmed = reacted;
    this.retryTarget = null;
    this.update({ reacted, pending: false, error: null });
  }

  private submit(target: boolean): Promise<void> {
    this.retryTarget = target;
    this.update({ reacted: target, pending: true, error: null });

    const request = Promise.resolve()
      .then(() => this.send(target))
      .then((result) => {
        if (!result.ok) {
          this.update({
            reacted: this.confirmed,
            pending: false,
            error: result.message?.trim() || FALLBACK_ERROR,
          });
          return;
        }
        this.confirmed = result.reacted;
        this.retryTarget = null;
        this.update({ reacted: result.reacted, pending: false, error: null });
      })
      .catch(() => {
        this.update({ reacted: this.confirmed, pending: false, error: FALLBACK_ERROR });
      })
      .finally(() => {
        this.pendingRequest = null;
      });

    this.pendingRequest = request;
    return request;
  }

  private update(snapshot: ReactionSnapshot): void {
    this.current = snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }
}
