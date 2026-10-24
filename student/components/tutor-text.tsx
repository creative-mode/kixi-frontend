'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import katex from 'katex';
import { parseInline, parseMarkdown, type Block, type Inline } from '@/lib/markdown';
import { advance } from '@/lib/typewriter';

/** Uma fórmula. O KaTeX escreve no elemento por si: o texto do modelo nunca passa por `__html` nosso. */
function Formula({ latex, display }: { latex: string; display: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(latex, ref.current, { displayMode: display, throwOnError: false, strict: 'ignore', trust: false });
    } catch {
      ref.current.textContent = latex;
    }
  }, [latex, display]);
  return <span ref={ref} className={display ? 'block overflow-x-auto py-1' : undefined} aria-label={latex} />;
}

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        switch (node.type) {
          case 'text':
            return <Fragment key={index}>{node.text}</Fragment>;
          case 'strong':
            return <strong key={index} className="font-semibold"><Inlines nodes={node.children} /></strong>;
          case 'em':
            return <em key={index}><Inlines nodes={node.children} /></em>;
          case 'code':
            return <code key={index} className="rounded bg-background/70 px-1 py-0.5 font-mono text-[0.9em]">{node.text}</code>;
          case 'link':
            return (
              <a key={index} href={node.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                <Inlines nodes={node.children} />
              </a>
            );
          case 'math':
            return <Formula key={index} latex={node.latex} display={node.display} />;
        }
      })}
    </>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case 'p':
      return <p><Inlines nodes={block.children} /></p>;
    case 'h':
      return <p className="font-semibold"><Inlines nodes={block.children} /></p>;
    case 'ul':
      return (
        <ul className="list-disc space-y-1 pl-5">
          {block.items.map((item, index) => <li key={index}><Inlines nodes={item} /></li>)}
        </ul>
      );
    case 'ol':
      return (
        <ol start={block.start} className="list-decimal space-y-1 pl-5">
          {block.items.map((item, index) => <li key={index}><Inlines nodes={item} /></li>)}
        </ol>
      );
    case 'quote':
      return <blockquote className="border-l-2 pl-3 text-muted-foreground"><Inlines nodes={block.children} /></blockquote>;
    case 'code':
      return <pre className="overflow-x-auto rounded-md bg-background/70 p-3 font-mono text-[0.85em] leading-snug"><code>{block.text}</code></pre>;
    case 'math':
      return <Formula latex={block.latex} display />;
    case 'hr':
      return <hr className="border-border" />;
  }
}

/** A resposta do tutor, em markdown, aparecendo ao ritmo da leitura enquanto chega. */
export function TutorText({ text, streaming }: { text: string; streaming: boolean }) {
  // O que já estava inteiro ao montar (a conversa guardada) mostra-se logo; o que chega por partes, pouco a pouco.
  const [shown, setShown] = useState(streaming ? 0 : text.length);
  const latest = useRef({ text, shown });
  latest.current = { text, shown };

  useEffect(() => {
    if (shown >= text.length) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = now - last;
      last = now;
      const { text: current, shown: have } = latest.current;
      const next = advance(have, current.length, elapsed, current);
      if (next !== have) setShown(next);
      if (next < current.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [shown >= text.length, text.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = text.slice(0, Math.min(shown, text.length));
  const blocks = parseMarkdown(visible);
  return (
    <div className="space-y-2.5 break-words [&_.katex-display]:my-1">
      {blocks.map((block, index) => <BlockView key={index} block={block} />)}
    </div>
  );
}
