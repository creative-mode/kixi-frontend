'use client';

import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { convertItemKind, kindOf, type DraftItem, type LeafKind } from '@/lib/exam/draft';
import { OptionEditor } from './option-editor';
import { TruthChoice } from './truth-choice';

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
    <fieldset className="grid gap-2.5 rounded-md border border-dashed p-2.5">
      <legend className="sr-only">Alínea {where}</legend>
      <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-secondary text-[12px] font-bold" aria-hidden>{label}</span>
        <Textarea
          rows={2}
          value={item.text}
          onChange={(e) => onChange({ ...item, text: e.target.value })}
          placeholder={`Alínea ${label})`}
          aria-label={`Texto da alínea ${where}`}
          className="min-h-12 min-w-0 flex-1"
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
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...item, review: false })}>Já revi</Button>
          </>
        )}
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
