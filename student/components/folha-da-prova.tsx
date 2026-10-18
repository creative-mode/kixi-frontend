'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Check, X } from 'lucide-react';
import { buildPaper, containsLeaf, leafNumber, type PaperAnswer, type PaperItem, type PaperMark, type PaperMeta, type PaperQuestion, type PaperStamp } from '@/lib/folha-da-prova';
import type { ExamOption, ExamQuestion } from '@/lib/exam-rules';
import type { QuestionImage } from '@/lib/exam';
import { BASE_PATH } from '@/lib/base-path';
import { cn } from '@/lib/utils';
import { assetUrl } from '@/lib/assets';

export type { PaperAnswer, PaperMark, PaperStamp };

const fmt = (n: number) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(n);

/** Verde e vermelho de caneta de correcção, escuros o bastante para se lerem sobre o branco do papel. */
const INK = { correct: 'text-green-700', wrong: 'text-red-700', pending: 'text-neutral-600', blank: 'text-neutral-500' } as const;

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
  marks,
  stamp,
  current,
  onSelect,
  className,
  scrollRef,
}: {
  meta: PaperMeta;
  questions: readonly ExamQuestion[];
  images?: Record<number, QuestionImage[]>;
  answers?: Record<number, PaperAnswer>;
  /** Na página de resultado: a correcção de cada questão. Sem isto a folha é a da sala, para responder. */
  marks?: Record<number, PaperMark>;
  /** Na página de resultado: a nota, estampada no topo. */
  stamp?: PaperStamp;
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
      className={cn('relative mx-auto w-full max-w-[794px] bg-white p-[6%] text-[14px] leading-relaxed text-black shadow-sm [font-family:Arial,Helvetica,sans-serif] md:text-[15px]', className)}
    >
      {stamp && <Stamp stamp={stamp} />}
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
              marks={marks}
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

/** Uma folha da prova (uma questão ou uma alínea): realça-se quando é a aberta e, na sala, abre-se ao tocar. Na página
 *  de resultado ganha o fundo e a nota da correcção. */
function Leaf({
  id,
  label,
  current,
  onSelect,
  mark,
  children,
}: {
  id: number;
  label: string;
  current?: number | null;
  onSelect?: (id: number) => void;
  mark?: PaperMark;
  children: React.ReactNode;
}) {
  const active = current === id;
  const interactive = onSelect != null;
  return (
    <div
      data-leaf={id}
      data-verdict={mark?.verdict}
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
        'relative -mx-2 rounded-md px-2 py-1 transition-colors',
        interactive && 'cursor-pointer hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-black',
        active && 'bg-amber-100 ring-2 ring-amber-500/70',
      )}
    >
      {mark && <Correction mark={mark} />}
      {children}
    </div>
  );
}

/** A nota à margem, como um professor a escreve: «2/2» a verde, «0/2» a vermelho, «por corrigir» a âmbar. */
function Correction({ mark }: { mark: PaperMark }) {
  const text =
    mark.verdict === 'pending' ? 'por corrigir'
    : mark.verdict === 'blank' ? 'sem resposta'
    : mark.maxScore != null ? `${fmt(mark.scoreObtained ?? (mark.verdict === 'correct' ? mark.maxScore : 0))}/${fmt(mark.maxScore)}`
    : mark.verdict === 'correct' ? 'certa' : 'errada';
  return (
    <span
      className={cn('float-right ml-3 rotate-[-4deg] whitespace-nowrap text-[15px] font-bold [font-family:\'Segoe_Print\',\'Comic_Sans_MS\',cursive]', INK[mark.verdict])}
      aria-label={`Correcção: ${text}`}
    >
      {mark.verdict === 'correct' ? <Check aria-hidden className="mr-0.5 inline size-4 align-[-2px]" /> : mark.verdict === 'wrong' ? <X aria-hidden className="mr-0.5 inline size-4 align-[-2px]" /> : null}{text}
    </span>
  );
}

/** A nota estampada: carimbo inclinado, verde se positiva e vermelho se negativa. */
function Stamp({ stamp }: { stamp: PaperStamp }) {
  const tone = stamp.passed === null ? 'border-neutral-600 text-neutral-700' : stamp.passed ? 'border-green-700 text-green-700' : 'border-red-700 text-red-700';
  const word = stamp.passed === null ? (stamp.provisional ? 'Em correcção' : 'Sem cotação') : stamp.passed ? 'Positiva' : 'Negativa';
  return (
    <div
      role="img"
      aria-label={`Nota: ${stamp.score}${stamp.max ? ` de ${stamp.max} valores` : ''}, ${word.toLowerCase()}${stamp.provisional ? ', provisória' : ''}`}
      className={cn('pointer-events-none absolute right-[4%] top-[3%] z-10 grid rotate-[-9deg] place-items-center rounded-lg border-[3px] border-double px-4 py-1.5 text-center opacity-90 mix-blend-multiply', tone)}
    >
      <span className="text-[34px] font-black leading-none tabular-nums md:text-[44px]">{stamp.score}</span>
      <span className="text-[11px] font-bold uppercase tracking-wider">{stamp.max ? `de ${stamp.max} valores` : 'valores'}</span>
      <span className="mt-0.5 text-[12px] font-black uppercase tracking-[0.2em]">{word}</span>
      {stamp.provisional && <span className="text-[10px] font-semibold uppercase">nota provisória</span>}
    </div>
  );
}

function Question({
  paper,
  images,
  answers,
  marks,
  current,
  onSelect,
}: {
  paper: PaperQuestion;
  images: Record<number, QuestionImage[]>;
  answers?: Record<number, PaperAnswer>;
  marks?: Record<number, PaperMark>;
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
              <Leaf id={item.id} label={leafNumber(paper, item)} current={current} onSelect={onSelect} mark={marks?.[item.id]}>
                <ItemBody item={item} images={images[item.id]} answer={answers?.[item.id]} mark={marks?.[item.id]} />
              </Leaf>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <Leaf id={paper.id} label={leafNumber(paper)} current={current} onSelect={onSelect} mark={marks?.[paper.id]}>
      <p><span className="mr-2 font-bold">{paper.number}.</span>{paper.text}{score}</p>
      <Figures images={images[paper.id]} />
      <Answer options={paper.options} answer={answers?.[paper.id]} mark={marks?.[paper.id]} lines={3} />
    </Leaf>
  );
}

function ItemBody({ item, images, answer, mark }: { item: PaperItem; images?: QuestionImage[]; answer?: PaperAnswer; mark?: PaperMark }) {
  return (
    <div className="flex gap-2">
      <span className="font-semibold">{item.label})</span>
      <span className="min-w-0 flex-1">
        {item.text}
        {item.maxScore != null && <span className="whitespace-nowrap"> ({item.maxScore} val.)</span>}
        <Figures images={images} />
        <Answer options={item.options} answer={answer} mark={mark} lines={2} />
      </span>
    </div>
  );
}

/** A resposta: as opções (com a marcada, e na correcção a certa) ou as linhas com o que o aluno escreveu. */
function Answer({ options, answer, mark, lines }: { options: ExamOption[]; answer?: PaperAnswer; mark?: PaperMark; lines: number }) {
  if (options.length > 0) return <Options options={options} chosen={answer?.optionId ?? null} correct={mark?.correctOptionId ?? null} reviewed={mark != null} />;
  return (
    <>
      <Lines text={answer?.text} count={lines} />
      {mark?.modelAnswer?.trim() ? (
        <span className="mt-1 block text-[12.5px] text-green-800"><b>Resposta esperada:</b> {mark.modelAnswer.trim()}</span>
      ) : null}
    </>
  );
}

function Figures({ images }: { images?: QuestionImage[] }) {
  if (!images || images.length === 0) return null;
  return (
    <span className="my-1.5 flex flex-wrap gap-2">
      {images.map((image) => (
        <figure key={image.id} className="m-0 max-w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assetUrl(image.imageUrl)} alt={image.caption ?? 'Figura da questão'} className="max-h-72 max-w-full object-contain" />
        </figure>
      ))}
    </span>
  );
}

/** A opção marcada tem o círculo cheio, como o aluno a assinalaria no papel. Corrigida: a certa a verde com visto, e a
 *  errada que o aluno marcou a vermelho com cruz (e a dizer-lo por palavras, para quem não distingue cores). */
function Options({ options, chosen, correct, reviewed }: { options: ExamOption[]; chosen: number | null; correct: number | null; reviewed: boolean }) {
  return (
    <ul className="mt-1 list-none space-y-0.5 pl-4">
      {options.map((o, i) => {
        const right = reviewed && o.id === correct;
        const wrong = reviewed && o.id === chosen && o.id !== correct;
        return (
          <li key={o.id} className={cn('flex items-baseline gap-2', right && 'font-semibold text-green-700', wrong && 'text-red-700 line-through decoration-red-700/60')}>
            <span aria-hidden className={cn('inline-block size-3 shrink-0 translate-y-[1px] rounded-full border border-black', chosen === o.id && 'bg-black', right && 'border-green-700', right && chosen === o.id && 'bg-green-700', wrong && 'border-red-700 bg-red-700')} />
            <span className="font-semibold">{o.optionLabel?.trim() || String.fromCharCode(65 + i)})</span>
            <span>{o.optionText}</span>
            {right && <span className="no-underline"><Check aria-hidden className="inline size-4 align-[-2px]" /><span className="sr-only"> resposta certa</span></span>}
            {wrong && <span className="no-underline"><span className="sr-only">a tua resposta, errada</span></span>}
            {!reviewed && chosen === o.id && <span className="sr-only">(a tua resposta)</span>}
          </li>
        );
      })}
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
