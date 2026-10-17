/**
 * O subconjunto de Markdown que a landing usa, lido em blocos (#218).
 *
 * As páginas de confiança existem em HTML e em Markdown e o texto vive num sítio só;
 * escrever o conteúdo duas vezes é como as duas versões passam a divergir. Um leitor
 * de Markdown completo seria uma dependência para cabeçalhos e listas.
 *
 * O que sabe: `#` e `##`, listas `- ` com um nível de sub-item, e parágrafos separados
 * por linha em branco. O que não sabe lança em vez de mostrar: um bloco que não
 * percebe e passa em silêncio vira texto normal, e ninguém sabe que o Markdown está
 * errado.
 *
 * Fica em `.ts` e não em `.tsx` porque o `npm test` corre no node, que não transpila
 * JSX — e o parser é a parte com lógica, logo a parte que vale a pena testar.
 */

export type Block =
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'p'; lines: string[] }
  | { kind: 'ul'; items: { text: string; sub: string[] }[] };

export function parse(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') continue;

    if (line.startsWith('## ')) {
      blocks.push({ kind: 'h2', text: line.slice(3) });
      continue;
    }
    if (line.startsWith('# ')) {
      blocks.push({ kind: 'h1', text: line.slice(2) });
      continue;
    }
    if (line.startsWith('- ')) {
      const items: { text: string; sub: string[] }[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push({ text: lines[i].slice(2), sub: [] });
        i += 1;
        while (i < lines.length && lines[i].startsWith('  ') && lines[i].trim() !== '') {
          items[items.length - 1].sub.push(lines[i].trim());
          i += 1;
        }
      }
      i -= 1;
      blocks.push({ kind: 'ul', items });
      continue;
    }
    if (line.startsWith('  ')) {
      throw new Error(`Markdown sem lista antes de: ${line.trim()}`);
    }

    const paragraph: string[] = [line];
    while (
      i + 1 < lines.length &&
      lines[i + 1].trim() !== '' &&
      !lines[i + 1].startsWith('#') &&
      !lines[i + 1].startsWith('- ') &&
      // Uma linha indentada aqui é um sub-item sem lista. Sem esta condição o
      // parágrafo engolia-a e o erro de baixo nunca chegava a disparar.
      !lines[i + 1].startsWith('  ')
    ) {
      paragraph.push(lines[i + 1]);
      i += 1;
    }
    blocks.push({ kind: 'p', lines: paragraph });
  }
  return blocks;
}

