/** Cache curta em memória (#393), sem servidor e sem React.
 *
 *  Serve para o que quase não muda e se pede em cada navegação: as disciplinas, os anos lectivos,
 *  as escolas, as fotos de outras contas. Tem prazo, tem limite de entradas (não cresce com o que o
 *  cliente variar) e junta pedidos iguais em curso, para dez pessoas a abrir a mesma página não
 *  fazerem dez leituras. O que falhou nunca fica guardado. */
export class TtlCache<T> {
  private entries = new Map<string, { value: T; until: number }>();
  private inflight = new Map<string, { promise: Promise<T>; generation: number }>();
  private generation = 0;

  private readonly ttlMs: number;
  private readonly maxEntries: number;
  private readonly now: () => number;

  constructor(ttlMs: number, maxEntries: number, now: () => number = Date.now) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
    this.now = now;
  }

  get size(): number {
    return this.entries.size;
  }

  /** O valor guardado, ou o que `load` devolver. `keep: false` devolve o valor sem o guardar. */
  async remember(key: string, load: () => Promise<{ value: T; keep: boolean }>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && hit.until > this.now()) return hit.value;
    const running = this.inflight.get(key);
    if (running?.generation === this.generation) return running.promise;

    const generation = this.generation;
    const started = load()
      .then(({ value, keep }) => {
        if (keep && generation === this.generation) this.store(key, value);
        return value;
      })
      .finally(() => {
        if (this.inflight.get(key)?.promise === started) this.inflight.delete(key);
      });
    this.inflight.set(key, { promise: started, generation });
    return started;
  }

  private store(key: string, value: T) {
    if (!this.entries.has(key) && this.entries.size >= this.maxEntries) {
      // Sai primeiro o que está guardado há mais tempo (a ordem de inserção do Map).
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, until: this.now() + this.ttlMs });
  }

  clear(): void {
    this.generation++;
    this.entries.clear();
    this.inflight.clear();
  }
}
