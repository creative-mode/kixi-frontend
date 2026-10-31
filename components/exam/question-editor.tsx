'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { convertKind, emptyItem, groupScore, invalidateReviewOnContentChange, sourceItemLabel, kindOf, move, type LeafKind, type QuestionKind } from '@/lib/exam/draft';
import type { ExamItem } from '@/lib/exam/schools';
import { ItemEditor, LEAF_LABELS, LeafBody } from './item-editor';
import { hasMathContent } from '@/student/lib/shared/math-content';
import { mathNeedsReview, serializeMathText } from '@/student/lib/shared/math-types';
import { FormulaInput } from './formula-input';
import { useState } from 'react';
import { Confirm, type ConfirmState } from '@/components/crud/confirm';

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
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const setItems = (next: typeof items) => onChange({ items: next });

  function changeKind(next: QuestionKind) {
    // Largar as alíneas apaga o que o professor escreveu nelas: pergunta-se antes.
    if (kind === 'group' && items.some((i) => i.text.trim())) {
      setConfirm({ title: 'Apagar alíneas?', description: 'Passar para outro tipo apaga as alíneas desta questão.', action: 'Continuar', destructive: true, run: () => { onChange(convertKind(item, next)); } });
      return;
    }
    onChange(convertKind(item, next));
  }

  return (
    <fieldset className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 rounded-lg border p-3">
      <Confirm state={confirm} onClose={() => setConfirm(null)} />
      <legend className="sr-only">Questão {n}</legend>
      <div className="flex min-w-0 flex-wrap items-start gap-2 sm:flex-nowrap">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent text-[12px] font-bold text-accent-foreground">{n}</span>
        <FormulaInput
          value={serializeMathText(item.text, item.formulas, item.blocks)}
          label={kind === 'group' ? `Enunciado comum da questão ${n}` : `Questão ${n}`}
          rows={2}
          className="min-h-14"
          // The ordered blocks describe the old text layout; formula evidence is
          // independent provenance and must survive text corrections.
          onChange={(value) => {
            const next = { ...item, text: value, blocks: undefined };
            onChange(invalidateReviewOnContentChange(item, next));
          }}
          placeholder={kind === 'group' ? `Enunciado comum da questão ${n}` : `Questão ${n}`}
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
      {hasMathContent(item.text, item.formulas, item.blocks) && item.rawText && item.rawText !== item.text ? (
        <details className="ml-8 text-xs text-muted-foreground"><summary>Texto OCR original</summary><p className="mt-1 whitespace-pre-wrap">{item.rawText}</p></details>
      ) : null}
      {(item.images ?? []).length > 0 && (
        <ul aria-label={`Figuras da questão ${n}`} className="flex flex-wrap gap-2 sm:pl-8">
          {(item.images ?? []).map((image, k) => (
            <li key={`${image.caption}-${k}`} className="grid gap-1 rounded-lg border bg-card p-1.5">
              <img src={image.dataUrl} alt={image.caption} className="max-h-44 max-w-full rounded object-contain" />
              <span className="flex items-center justify-between gap-2 px-1 text-[11px] text-muted-foreground">
                <span className="truncate">{image.caption}</span>
                <Button type="button" variant="ghost" size="sm" aria-label={`Retirar ${image.caption}`} onClick={() => onChange({ images: (item.images ?? []).filter((_, j) => j !== k) })}>
                  <Trash2 size={14} aria-hidden />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2 pl-8">
        <NativeSelect value={kind} onChange={(e) => changeKind(e.target.value as QuestionKind)} aria-label={`Tipo da questão ${n}`} className="h-9 w-auto min-w-44">
          {(Object.keys(KIND_LABELS) as QuestionKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
        </NativeSelect>
        {item.review && (
          <>
            <Badge variant="warning">rever</Badge>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ review: false, reviewed: true })}>Já revi</Button>
          </>
        )}
        {mathNeedsReview(item.formulas, item.blocks) && !item.reviewed ? <Badge variant="warning">fórmula a rever</Badge> : null}
      </div>

      {kind === 'group' ? (
        <div className="grid gap-2 pl-8">
          {items.map((it, j) => (
            <div key={j} className={it.label?.includes('.') ? 'ml-5' : undefined}>
              <ItemEditor
                item={it}
                label={sourceItemLabel(it, j)}
                index={j}
                total={items.length}
                where={`${n}${sourceItemLabel(it, j)}`}
                onChange={(next) => setItems(items.map((x, k) => (k === j ? next : x)))}
                onRemove={() => setItems(items.filter((_, k) => k !== j))}
                onMove={(direction) => setItems(move(items, j, direction))}
              />
            </div>
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
