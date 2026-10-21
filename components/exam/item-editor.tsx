'use client';

import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { convertItemKind, invalidateReviewOnContentChange, kindOf, type DraftItem, type LeafKind } from '@/lib/exam/draft';
import { OptionEditor } from './option-editor';
import { TruthChoice } from './truth-choice';
import { MathText } from '@/student/lib/shared/math-text';
import { hasMathContent } from '@/student/lib/shared/math-content';
import { mathNeedsReview, serializeMathText } from '@/student/lib/shared/math-types';
import { FormulaInput } from './formula-input';

export const LEAF_LABELS: Record<LeafKind, string> = {
  open: 'Dissertativa',
  multiple_choice: 'Escolha múltipla',
  true_false: 'Verdadeiro/Falso',
};

/** O corpo de uma folha, conforme o tipo: nada para a dissertativa, opções ou o par Verdadeiro/Falso. */
export function LeafBody({ kind, options, where, onChange }: { kind: LeafKind; options: DraftItem['options']; where: string; onChange: (options: DraftItem['options']) => void }) {
  if (kind === 'multiple_choice') return <OptionEditor options={options} where={where} onChange={onChange} />;
  if (kind === 'true_false') return <TruthChoice options={options} where={where} onChange={onChange} />;
  return null;
}

/** Uma alínea (a, b, c…) de uma questão com alíneas: tem o seu texto, tipo, cotação e resposta. */
export function ItemEditor({
  item,
  label,
  index,
  total,
  where,
  onChange,
  onRemove,
  onMove,
}: {
  item: DraftItem;
  /** a, b, c… */
  label: string;
  index: number;
  total: number;
  /** «3a»: como se chama a alínea nos rótulos de acessibilidade. */
  where: string;
  onChange: (next: DraftItem) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const kind = kindOf(item) as LeafKind;
  return (
    <fieldset className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2.5 rounded-md border border-dashed p-2.5">
      <legend className="sr-only">Alínea {where}</legend>
      <div className="flex min-w-0 flex-wrap items-start gap-2 sm:flex-nowrap">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-secondary text-[12px] font-bold" aria-hidden>{label}</span>
        <FormulaInput
          value={serializeMathText(item.text, item.formulas, item.blocks)}
          label={`Texto da alínea ${where}`}
          rows={2}
          className="min-h-12"
          // The ordered blocks describe the old text layout; formula evidence is
          // independent provenance and must survive text corrections.
          onChange={(value) => {
            const next = { ...item, text: value, blocks: undefined };
            onChange(invalidateReviewOnContentChange(item, next));
          }}
          placeholder={`Alínea ${label})`}
        />
        <Input
          type="number"
          min={0}
          step="0.5"
          value={item.points}
          onChange={(e) => onChange({ ...item, points: e.target.value === '' ? '' : Number(e.target.value) })}
          placeholder="Val."
          aria-label={`Cotação da questão ${where}`}
          className="w-20 shrink-0"
        />
      </div>
      {hasMathContent(item.text, item.formulas, item.blocks) ? (
        <div className="ml-8 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm" aria-label={`Pré-visualização matemática da alínea ${where}`}>
          <MathText text={item.text} formulas={item.formulas} blocks={item.blocks} />
          {item.rawText && item.rawText !== item.text ? <details className="mt-2 text-xs text-muted-foreground"><summary>Texto OCR original</summary><p className="mt-1 whitespace-pre-wrap">{item.rawText}</p></details> : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 pl-8">
        <NativeSelect
          value={kind}
          onChange={(e) => onChange(convertItemKind(item, e.target.value as LeafKind))}
          aria-label={`Tipo da alínea ${where}`}
          className="h-9 w-auto min-w-44"
        >
          {(Object.keys(LEAF_LABELS) as LeafKind[]).map((k) => <option key={k} value={k}>{LEAF_LABELS[k]}</option>)}
        </NativeSelect>
        {item.review && (
          <>
            <Badge variant="warning">rever</Badge>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...item, review: false, reviewed: true })}>Já revi</Button>
          </>
        )}
        {mathNeedsReview(item.formulas, item.blocks) && !item.reviewed ? <Badge variant="warning">fórmula a rever</Badge> : null}
        <span className="ml-auto flex gap-1">
          <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Mover a alínea ${where} para cima`} disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp /></Button>
          <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Mover a alínea ${where} para baixo`} disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown /></Button>
          <Button type="button" variant="ghost" size="icon" className="size-8 hover:bg-danger-soft hover:text-destructive" aria-label={`Remover a alínea ${where}`} onClick={onRemove}><Trash2 /></Button>
        </span>
      </div>
      <div className="pl-8">
        <LeafBody kind={kind} options={item.options} where={where} onChange={(options) => onChange({ ...item, options })} />
      </div>
    </fieldset>
  );
}
