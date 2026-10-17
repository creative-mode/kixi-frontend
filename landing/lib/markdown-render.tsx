/**
 * De Markdown para React, só o subconjunto que a landing usa (#218).
 *
 * As páginas de confiança têm de existir em HTML e em Markdown, e o texto vive num
 * sítio só. Escrever o conteúdo duas vezes é como as duas versões passam a divergir;
 * um leitor de Markdown completo em dependências seria um jogo de dependências
 * para cabeçalhos e listas.
 *
 * O que sabe: `#` e `##`, listas `- ` com um nível de sub-item, parágrafos separados
 * por linha em branco, e dentro do texto `**negrito**`, `` `código` `` e endereços
 * soltos. O que não sabe,lança em vez de mostrar: um bloco desconhecido não pode
 * passar em silêncio e parecer texto normal.
 */

import type { ReactNode } from 'react';

type Block =
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'p'; lines: string[] }
  | { kind: 'ul'; items: { text: string; sub: string[] }[] };

function parse(markdown: string): Block[] {
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
      !lines[i + 1].startsWith('- ')
    ) {
      paragraph.push(lines[i + 1]);
      i += 1;
    }
    blocks.push({ kind: 'p', lines: paragraph });
  }
  return blocks;
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s<>()]+)/g;

/** Negrito, `código` e endereços. O ponto e vírgula e o ponto final ficam de fora do
 *  endereço, senão o link aponta para o sítio errado. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={key}>{part.slice(1, -1)}</code>;
    if (/^https?:\/\//.test(part)) {
      const href = part.replace(/[.,;:]+$/, '');
      const rest = part.slice(href.length);
      return <span key={key}><a href={href}>{href}</a>{rest}</span>;
    }
    // React renderiza strings nuas dentro de um array: um <span> por palavra seria
    // ruído no DOM sem ganhar nada.
    return part;
  });
}

/** O mesmo texto, em React. */
export function markdownToReact(markdown: string, keyPrefix = 'md'): ReactNode[] {
  return parse(markdown).map((block, index) => {
    const key = `${keyPrefix}-${index}`;
    if (block.kind === 'h1') return <h1 key={key}>{inline(block.text, key)}</h1>;
    if (block.kind === 'h2') return <h2 key={key}>{inline(block.text, key)}</h2>;
    if (block.kind === 'p') {
      // Uma linha que é só negrito é um subtítulo, não um parágrafo de uma palavra.
      const only = block.lines.join(' ').trim();
      if (/^\*\*.*\*\*$/.test(only)) return <p key={key}>{inline(block.lines.join(' '), key)}</p>;
      return <p key={key}>{block.lines.map((l, j) => inline(l, `${key}-${j}`)).flat()}</p>;
    }
    return (
      <ul key={key}>
        {block.items.map((item, j) => (
          <li key={`${key}-${j}`}>
            {inline(item.text, `${key}-${j}`)}
            {item.sub.map((sub, k) => (
              <p key={`${key}-${j}-${k}`}>{inline(sub, `${key}-${j}-${k}`)}</p>
            ))}
          </li>
        ))}
      </ul>
    );
  });
}