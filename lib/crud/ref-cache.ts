/** Cache curta em memória para os dados de referência do gestor (#389): disciplinas, anos letivos, períodos,
 *  escolas, cursos, turmas e o currículo de cada turma. Eram pedidos outra vez em cada ecrã, em cada select e
 *  em cada abertura de uma lista.
 *
 *  - A chave leva sempre quem está a ler (`viewer`, um hash da sessão e nunca o token): o backend filtra
 *    o que cada papel vê, e uma entrada de um professor nunca serve outro utilizador.
 *  - Cada entrada leva etiquetas (`subjects`, `classes`, `curriculum`…). Uma escrita esquece a etiqueta para
 *    todos os utilizadores, e a leitura seguinte volta ao backend.
 *  - Tem prazo e limite de entradas, e junta leituras iguais em curso. O que falhou nunca fica guardado. */
export class RefCache<T = unknown> {
  private entries = new Map<string, { value: T; until: number; tags: readonly string[] }>();
  private inflight = new Map<string, { promise: Promise<T>; generation: number }>();
  /** Sobe a cada `forget`: uma leitura que começou antes de uma escrita não guarda o que trouxe. */
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

  /** O valor guardado para `viewer` + `key`, ou o que `load` devolver. `keep: false` devolve o valor sem o guardar. */
  async remember(
    viewer: string,
    key: string,
    tags: readonly string[],
    load: () => Promise<{ value: T; keep: boolean }>,
  ): Promise<T> {
    const id = `${viewer}\u0000${key}`;
    const hit = this.entries.get(id);
    if (hit && hit.until > this.now()) return hit.value;
    const running = this.inflight.get(id);
    if (running && running.generation === this.generation) return running.promise;

    const generation = this.generation;
    const promise = load()
      .then(({ value, keep }) => {
        if (keep && generation === this.generation) this.store(id, value, tags);
        return value;
      })
      .finally(() => {
        if (this.inflight.get(id)?.promise === promise) this.inflight.delete(id);
      });
    this.inflight.set(id, { promise, generation });
    return promise;
  }

  /** Esquece, para todos os utilizadores, as entradas com alguma destas etiquetas. */
  forget(...tags: string[]): void {
    this.generation++;
    for (const [id, entry] of this.entries) {
      if (entry.tags.some((t) => tags.includes(t))) this.entries.delete(id);
    }
  }

  clear(): void {
    this.generation++;
    this.entries.clear();
  }

  private store(id: string, value: T, tags: readonly string[]) {
    this.entries.delete(id);
    if (this.entries.size >= this.maxEntries) {
      // Sai primeiro o que está guardado há mais tempo (a ordem de inserção do Map).
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(id, { value, until: this.now() + this.ttlMs, tags });
  }
}
