'use client';

import { useState } from 'react';
import { Check, Info, Lightbulb, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_LABEL, type CalloutTone, type PostBlock } from '@/lib/post-blocks';
import { assetUrl } from '@/lib/assets';

const TONE: Record<CalloutTone, { box: string; Icon: typeof Info }> = {
  info: { box: 'border-info/30 bg-info-soft', Icon: Info },
  tip: { box: 'border-primary/30 bg-accent', Icon: Lightbulb },
  warning: { box: 'border-warning/40 bg-warning-soft', Icon: TriangleAlert },
};

/** Uma pergunta com opções: o aluno escolhe, vê se acertou e lê a explicação. Fica só no ecrã, não guarda nada. */
function Choice({ block }: { block: PostBlock }) {
  const [picked, setPicked] = useState<number | null>(null);
  const items = block.items ?? [];
  const right = block.correct ?? -1;
  const done = picked !== null;
  return (
    <section className="grid gap-2.5 rounded-xl border bg-card p-3.5" aria-label="Desafio">
      <p className="font-semibold">{block.text}</p>
      <ul className="grid gap-2">
        {items.map((item, i) => {
          const isRight = done && i === right;
          const isWrong = done && i === picked && i !== right;
          return (
            <li key={i}>
              <button
                type="button"
                disabled={done}
                onClick={() => setPicked(i)}
                className={cn(
                  'flex min-h-11 w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-[15px] transition-colors',
                  !done && 'hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/40 outline-none',
                  isRight && 'border-primary bg-accent font-semibold',
                  isWrong && 'border-destructive bg-danger-soft',
                )}
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full border text-xs font-bold" aria-hidden="true">
                  {isRight ? <Check className="size-3.5" /> : isWrong ? <X className="size-3.5" /> : String.fromCharCode(65 + i)}
                </span>
                <span className="min-w-0 flex-1 break-words">{item}</span>
                {isRight && <span className="sr-only">, resposta certa</span>}
                {isWrong && <span className="sr-only">, a tua resposta, errada</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <div role="status" aria-live="polite">
        {done && (
          <p className="grid gap-1 text-sm">
            <b>{picked === right ? 'Certo!' : `Não é essa. A certa é a ${String.fromCharCode(65 + right)}.`}</b>
            {block.explanation && <span className="text-muted-foreground">{block.explanation}</span>}
          </p>
        )}
      </div>
    </section>
  );
}

function Gallery({ images }: { images: PostBlock[] }) {
  return (
    <div className={cn('grid gap-2', images.length > 1 && 'sm:grid-cols-2')}>
      {images.map((b, i) => (
        <figure key={i} className="grid gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assetUrl(b.url, 768)} alt={b.alt ?? ''} loading="lazy" className="max-h-[420px] w-full rounded-lg border bg-secondary object-contain" />
          {b.caption && <figcaption className="text-[13px] text-muted-foreground">{b.caption}</figcaption>}
        </figure>
      ))}
    </div>
  );
}

/** Os blocos de uma publicação, no feed e na pré-visualização do construtor. As imagens seguidas formam uma galeria. */
export function PostBlocksView({ blocks }: { blocks: PostBlock[] }) {
  const out: React.ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === 'image') {
      const group = [b];
      while (blocks[i + 1]?.type === 'image') group.push(blocks[++i]);
      out.push(<Gallery key={i} images={group} />);
      continue;
    }
    switch (b.type) {
      case 'heading':
        out.push(<h4 key={i} className="text-lg leading-snug font-bold">{b.text}</h4>);
        break;
      case 'text':
        out.push(<p key={i} className="max-w-[62ch] leading-relaxed break-words whitespace-pre-wrap">{b.text}</p>);
        break;
      case 'formula':
        out.push(<code key={i} className="block overflow-x-auto rounded-lg border bg-secondary px-3 py-2 text-center font-mono text-[15px] whitespace-pre-wrap">{b.text}</code>);
        break;
      case 'list': {
        const List = b.ordered ? 'ol' : 'ul';
        out.push(
          <List key={i} className={cn('grid max-w-[62ch] gap-1 pl-5 leading-relaxed', b.ordered ? 'list-decimal' : 'list-disc')}>
            {(b.items ?? []).map((item, j) => <li key={j} className="break-words">{item}</li>)}
          </List>,
        );
        break;
      }
      case 'callout': {
        const tone = TONE[b.tone ?? 'info'];
        out.push(
          <aside key={i} className={cn('flex max-w-[62ch] gap-2.5 rounded-xl border p-3', tone.box)}>
            <tone.Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="min-w-0 break-words"><b>{TONE_LABEL[b.tone ?? 'info']}: </b>{b.text}</p>
          </aside>,
        );
        break;
      }
      case 'choice':
        out.push(<Choice key={i} block={b} />);
        break;
    }
  }
  return <div className="grid gap-3">{out}</div>;
}
