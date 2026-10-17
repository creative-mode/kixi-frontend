import type { ReactNode } from 'react';
import { parse, type Block } from './markdown-parse.ts';

/** De Markdown para React, sobre os blocos que `markdown-parse.ts` leu. */

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
  return parse(markdown).map((block: Block, index: number) => {
    const key = `${keyPrefix}-${index}`;
    if (block.kind === 'h1') return <h1 key={key}>{inline(block.text, key)}</h1>;
    if (block.kind === 'h2') return <h2 key={key}>{inline(block.text, key)}</h2>;
    if (block.kind === 'p') {
      // Uma linha que é só negrito é um subtítulo, não um parágrafo de uma palavra.
      const only = block.lines.join(' ').trim();
      if (/^\*\*.*\*\*$/.test(only)) return <p key={key}>{inline(block.lines.join(' '), key)}</p>;
      return <p key={key}>{block.lines.map((l: string, j: number) => inline(l, `${key}-${j}`)).flat()}</p>;
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