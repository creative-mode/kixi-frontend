/** Memória de leituras de um pedido (#393), sem servidor e sem React.
 *
 *  Uma página do aluno junta várias partes (layout, coluna da direita, conteúdo) que leem o
 *  mesmo endereço, cada uma por si: no início, `/simulations` ia duas vezes ao backend. Dentro
 *  de um mesmo pedido a resposta é a mesma, por isso a segunda leitura espera pela primeira.
 *
 *  Uma escrita esvazia a memória: quem escreve e volta a ler no mesmo pedido tem de ver o que
 *  escreveu. Cada leitor recebe a sua cópia, para quem ordena a lista no sítio não estragar a de outro. */
export class ReadMemo {
  private reads = new Map<string, Promise<unknown>>();

  /** Quantas leituras diferentes este pedido já fez. */
  get size(): number {
    return this.reads.size;
  }

  async read<T>(key: string, load: () => Promise<T>): Promise<T> {
    let pending = this.reads.get(key);
    if (!pending) {
      pending = load();
      this.reads.set(key, pending);
    }
    return structuredClone(await pending) as T;
  }

  /** Chamar ao escrever: as leituras guardadas deixam de valer. */
  clear(): void {
    this.reads.clear();
  }
}
