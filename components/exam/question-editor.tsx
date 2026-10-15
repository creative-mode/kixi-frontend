'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { convertKind, emptyItem, groupScore, itemLabel, kindOf, move, type LeafKind, type QuestionKind } from '@/lib/exam/draft';
import type { ExamItem } from '@/lib/exam/schools';
import { ItemEditor, LEAF_LABELS, LeafBody } from './item-editor';

const KIND_LABELS: Record<QuestionKind, string> = { ...LEAF_LABELS, group: 'Com alíneas' };

/**
 * Uma questão, do tipo que for: dissertativa, escolha múltipla, verdadeiro/falso ou com alíneas.
 *
 * Uma questão **com alíneas** tem um enunciado comum e cada alínea (a, b, c…) é uma pergunta com a sua
 * resposta, tipo e cotação; a questão não tem cotação própria, vale a soma das alíneas. É o caso do
 * «3) diga quais são verdadeiras ou falsas: a) … b) …» e do «5) dados… a) demonstre… b) calcule…».
 *
 * A reordenação é local e só vai ao servidor depois de gravar, no pedido de criação:
 * o rascunho ainda não tem ids, e `POST /statements/manual` guarda a ordem em que as
 * perguntas e opções chegam.
 */
export function QuestionEditor({
  item,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  item: ExamItem;
  index: number;
  total: number;
  onChange: (patch: Partial<ExamItem>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const n = index + 1;
  const kind = kindOf(item);
  const items = item.items ?? [];
  const setItems = (next: typeof items) => onChange({ items: next });

  function changeKind(next: QuestionKind) {
    // Largar as alíneas apaga o que o professor escreveu nelas: pergunta-se antes.
    if (kind === 'group' && items.some((i) => i.text.trim()) && !window.confirm('Passar para outro tipo apaga as alíneas desta questão. Continuar?')) return;
    onChange(convertKind(item, next));
  }

  return (
    <fieldset className="grid gap-3 rounded-lg border p-3">
      <legend className="sr-only">Questão {n}</legend>
      <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent text-[12px] font-bold text-accent-foreground">{n}</span>
        <Textarea
          rows={2}
          value={item.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder={kind === 'group' ? `Enunciado comum da questão ${n}` : `Questão ${n}`}
          aria-label={kind === 'group' ? `Enunciado comum da questão ${n}` : `Questão ${n}`}
          className="min-h-14 min-w-0 flex-1"
        />
        {kind === 'group' ? (
          <output aria-label={`Cotação da questão ${n}`} className="grid h-9 w-20 shrink-0 place-items-center rounded-md bg-secondary text-sm font-semibold tabular-nums" title="A cotação de uma questão com alíneas é a soma das alíneas">
            {groupScore(item)}
          </output>
        ) : (
          <Input
            type="number"
            min={0}
            step="0.5"
            value={item.points}
            onChange={(e) => onChange({ points: e.target.value === '' ? '' : Number(e.target.value) })}
            placeholder="Val."
            aria-label={`Cotação da questão ${n}`}
            className="w-20 shrink-0"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-8">
        <NativeSelect value={kind} onChange={(e) => changeKind(e.target.value as QuestionKind)} aria-label={`Tipo da questão ${n}`} className="h-9 w-auto min-w-44">
          {(Object.keys(KIND_LABELS) as QuestionKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
        </NativeSelect>
        {item.review && (
          <>
            <Badge variant="warning">rever</Badge>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ review: false })}>Já revi</Button>
          </>
        )}
      </div>

      {kind === 'group' ? (
        <div className="grid gap-2 pl-8">
          {items.map((it, j) => (
            <ItemEditor
              key={j}
              item={it}
              label={itemLabel(j)}
              index={j}
              total={items.length}
              where={`${n}${itemLabel(j)}`}
              onChange={(next) => setItems(items.map((x, k) => (k === j ? next : x)))}
              onRemove={() => setItems(items.filter((_, k) => k !== j))}
              onMove={(direction) => setItems(move(items, j, direction))}
            />
          ))}
          <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setItems([...items, emptyItem(items.at(-1)?.kind ?? 'open')])}>
            <Plus aria-hidden />Alínea
          </Button>
          {items.length === 0 && <p className="text-[13px] text-muted-foreground">Acrescente pelo menos uma alínea.</p>}
        </div>
      ) : (
        <div className="grid gap-2 pl-8">
          <LeafBody kind={kind as LeafKind} options={item.options} where={String(n)} onChange={(options) => onChange({ options })} />
        </div>
      )}

      <div className="flex justify-end gap-1 pl-8">
        <Button type="button" variant="ghost" size="sm" aria-label={`Mover a questão ${n} para cima`} disabled={n === 1} onClick={() => onMove(-1)}>
          <ArrowUp aria-hidden />Subir
        </Button>
        <Button type="button" variant="ghost" size="sm" aria-label={`Mover a questão ${n} para baixo`} disabled={n === total} onClick={() => onMove(1)}>
          <ArrowDown aria-hidden />Descer
        </Button>
        <Button type="button" variant="ghost" size="sm" className="hover:bg-danger-soft hover:text-destructive" aria-label={`Remover a questão ${n}`} disabled={total === 1} onClick={onRemove}>
          <Trash2 aria-hidden />Remover
        </Button>
      </div>
    </fieldset>
  );
}
