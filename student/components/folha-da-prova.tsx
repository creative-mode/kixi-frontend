'use client';

import { useEffect, useMemo, useRef } from 'react';
import { buildPaper, containsLeaf, leafNumber, type PaperItem, type PaperMeta, type PaperQuestion } from '@/lib/folha-da-prova';
import type { ExamOption, ExamQuestion } from '@/lib/exam-rules';
import type { QuestionImage } from '@/lib/exam';
import { BASE_PATH } from '@/lib/base-path';
import { cn } from '@/lib/utils';

/** O que o aluno tem escrito numa questão, para a folha o mostrar como o papel: a opção marcada e o texto. */
export type PaperAnswer = { optionId: number | null; text: string };

const cell = 'border border-black';

/**
 * A prova na folha oficial, como o professor a montou no construtor: cabeçalho da escola, questões numeradas,
 * enunciado comum com alíneas, opções, figuras e linhas de resposta. É um documento impresso (preto sobre
 * branco), por isso não usa os tokens do tema.
 *
 * Na sala de prova a folha acompanha o aluno: a questão que tem aberta fica realçada e a folha desliza até
 * ela, e tocar noutra questão da folha abre-a. Fora da sala (`current` vazio) é só leitura.
 */
export function FolhaDaProva({
  meta,
  questions,
  images = {},
  answers,
  current,
  onSelect,
  className,
  scrollRef,
}: {
  meta: PaperMeta;
  questions: readonly ExamQuestion[];
  images?: Record<number, QuestionImage[]>;
  answers?: Record<number, PaperAnswer>;
  /** O id da questão (ou alínea) aberta. */
  current?: number | null;
  onSelect?: (id: number) => void;
  className?: string;
  /** O contentor que desliza: a folha move-o, e não a página. */
  scrollRef?: React.RefObject<HTMLElement | null>;
}) {
  const paper = useMemo(() => buildPaper(questions), [questions]);
  const sheet = useRef<HTMLElement>(null);

  // A folha segue a questão aberta: desliza o seu contentor (e só ele) para a pôr a um terço do topo.
  useEffect(() => {
    if (current == null) return;
    const box = scrollRef?.current;
    const target = sheet.current?.querySelector<HTMLElement>(`[data-leaf="${current}"]`);
    if (!box || !target) return;
    const top = target.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    box.scrollTo({ top: Math.max(0, top - box.clientHeight / 3), behavior: reduced ? 'auto' : 'smooth' });
  }, [current, scrollRef]);

  const school = (meta.institution || 'Escola').toUpperCase();
  const head = [
    meta.durationMinutes != null ? `Duração: ${meta.durationMinutes} min` : '',
    meta.variant?.trim() ? `Série ${meta.variant.trim()}` : '',
    meta.schoolYear?.trim() ? `Ano letivo ${meta.schoolYear.trim()}` : '',
  ].filter(Boolean).join(' · ');
  const title = [meta.kind, meta.subject].filter(Boolean).join(' – ');
  const rules = (meta.rules ?? []).filter((r) => r.trim());

  return (
    <article
      ref={sheet}
      aria-label="A prova"
      className={cn('mx-auto w-full max-w-[794px] bg-white p-[6%] text-[14px] leading-relaxed text-black shadow-sm [font-family:Arial,Helvetica,sans-serif] md:text-[15px]', className)}
    >
      <table className="w-full border-collapse">
        <tbody>
          <tr>
            <td className={`${cell} w-[15%] p-1.5`} />
            <td className={`${cell} p-1.5 text-center align-middle [font-family:'Times_New_Roman',Times,serif] text-[11px] leading-snug`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${BASE_PATH}/exam/brasao.png`} alt="" className="mx-auto mb-1 h-10 w-auto" />
              <div>REPÚBLICA DE ANGOLA</div>
              <div>MINISTÉRIO DA EDUCAÇÃO</div>
              <div>{school}</div>
            </td>
            <td className={`${cell} w-[15%]`} />
          </tr>
          <tr className="text-center text-[12px]">
            <td className={`${cell} px-1 py-0.5 font-semibold uppercase`}>{meta.grade ?? ''}</td>
            <td className={`${cell} px-1 py-0.5 uppercase`}>{title}</td>
            <td className={`${cell} px-1 py-0.5 font-semibold uppercase`}>{meta.variant ? `Série ${meta.variant}` : ''}</td>
          </tr>
        </tbody>
      </table>

      {head && <p className="mt-2 text-center text-[12px] font-semibold uppercase">{head}</p>}

      <ol className="mt-5 list-none space-y-4 p-0 text-justify">
        {paper.map((p) => (
          <li key={p.number}>
            <Question
              paper={p}
              images={images}
              answers={answers}
              current={current}
              onSelect={onSelect}
            />
          </li>
        ))}
      </ol>

      {meta.totalMaxScore != null && <p className="mt-3 text-right text-xs font-semibold">Total: {meta.totalMaxScore} valores</p>}

      {rules.length > 0 && (
        <section className="mt-6">
          <p className="mb-1 font-bold">Regras:</p>
          <ol className="list-decimal space-y-1.5 pl-6">{rules.map((r, i) => <li key={i}>{r}</li>)}</ol>
        </section>
      )}
    </article>
  );
}

/** Uma folha da prova (uma questão ou uma alínea): realça-se quando é a aberta e, na sala, abre-se ao tocar. */
function Leaf({
  id,
  label,
  current,
  onSelect,
  children,
}: {
  id: number;
  label: string;
  current?: number | null;
  onSelect?: (id: number) => void;
  children: React.ReactNode;
}) {
  const active = current === id;
  const interactive = onSelect != null;
  return (
    <div
      data-leaf={id}
      aria-current={active ? 'true' : undefined}
      {...(interactive
        ? {
            role: 'button' as const,
            tabIndex: 0,
            'aria-label': `Ir para a questão ${label}`,
            onClick: () => onSelect(id),
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(id);
              }
            },
          }
        : {})}
      className={cn(
        '-mx-2 rounded-md px-2 py-1 transition-colors',
        interactive && 'cursor-pointer hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-black',
        active && 'bg-amber-100 ring-2 ring-amber-500/70',
      )}
    >
      {children}
    </div>
  );
}

function Question({
  paper,
  images,
  answers,
  current,
  onSelect,
}: {
  paper: PaperQuestion;
  images: Record<number, QuestionImage[]>;
  answers?: Record<number, PaperAnswer>;
  current?: number | null;
  onSelect?: (id: number) => void;
}) {
  const score = paper.maxScore != null ? <span className="whitespace-nowrap"> ({paper.maxScore} val.)</span> : null;

  if (paper.id == null) {
    // Questão com alíneas: o enunciado comum e, por baixo, cada alínea com a sua resposta.
    return (
      <div className={cn('rounded-md', containsLeaf(paper, current) && 'bg-amber-50/60')}>
        <p><span className="mr-2 font-bold">{paper.number}.</span>{paper.text}{score}</p>
        <ol className="mt-1.5 list-none space-y-1.5 pl-5">
          {paper.items.map((item) => (
            <li key={item.id}>
              <Leaf id={item.id} label={leafNumber(paper, item)} current={current} onSelect={onSelect}>
                <ItemBody item={item} images={images[item.id]} answer={answers?.[item.id]} />
              </Leaf>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <Leaf id={paper.id} label={leafNumber(paper)} current={current} onSelect={onSelect}>
      <p><span className="mr-2 font-bold">{paper.number}.</span>{paper.text}{score}</p>
      <Figures images={images[paper.id]} />
      {paper.options.length > 0 ? <Options options={paper.options} chosen={answers?.[paper.id]?.optionId ?? null} /> : <Lines text={answers?.[paper.id]?.text} />}
    </Leaf>
  );
}

function ItemBody({ item, images, answer }: { item: PaperItem; images?: QuestionImage[]; answer?: PaperAnswer }) {
  return (
    <div className="flex gap-2">
      <span className="font-semibold">{item.label})</span>
      <span className="min-w-0 flex-1">
        {item.text}
        {item.maxScore != null && <span className="whitespace-nowrap"> ({item.maxScore} val.)</span>}
        <Figures images={images} />
        {item.options.length > 0 ? <Options options={item.options} chosen={answer?.optionId ?? null} /> : <Lines text={answer?.text} count={2} />}
      </span>
    </div>
  );
}

function Figures({ images }: { images?: QuestionImage[] }) {
  if (!images || images.length === 0) return null;
  return (
    <span className="my-1.5 flex flex-wrap gap-2">
      {images.map((image) => (
        <figure key={image.id} className="m-0 max-w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.imageUrl} alt={image.caption ?? 'Figura da questão'} className="max-h-72 max-w-full object-contain" />
        </figure>
      ))}
    </span>
  );
}

/** A opção marcada tem o círculo cheio, como o aluno a assinalaria no papel. */
function Options({ options, chosen }: { options: ExamOption[]; chosen: number | null }) {
  return (
    <ul className="mt-1 list-none space-y-0.5 pl-4">
      {options.map((o, i) => (
        <li key={o.id} className="flex items-baseline gap-2">
          <span aria-hidden className={cn('inline-block size-3 shrink-0 translate-y-[1px] rounded-full border border-black', chosen === o.id && 'bg-black')} />
          <span className="font-semibold">{o.optionLabel?.trim() || String.fromCharCode(65 + i)})</span>
          <span>{o.optionText}</span>
          {chosen === o.id && <span className="sr-only">(a tua resposta)</span>}
        </li>
      ))}
    </ul>
  );
}

/** As linhas da resposta aberta; o que o aluno escreveu aparece nelas. */
function Lines({ text, count = 3 }: { text?: string; count?: number }) {
  const written = (text ?? '').trim();
  return written ? (
    <span className="mt-1 block whitespace-pre-wrap border-b border-black/40 pb-0.5 text-[13px] text-blue-800 [font-family:'Segoe_Print','Comic_Sans_MS',cursive]">{written}</span>
  ) : (
    <span aria-hidden className="mt-1 block">
      {Array.from({ length: count }, (_, i) => <span key={i} className="block h-5 border-b border-black/40" />)}
    </span>
  );
}
