'use client';

import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { labelFor, type DraftOption } from '@/lib/exam/draft';
import type { ExamItem } from '@/lib/exam/schools';

/**
 * Uma pergunta com as suas opções.
 *
 * Os rótulos (A, B, C) são gerados e não se editam: `optionLabel` é a identidade da
 * opção dentro da pergunta e o backend recusa-o alterado. Pior, um rótulo liberta
 * continua tomada para sempre — o índice único não conhece as linhas removidas —,
 * por isso reciclar etiquetas aqui seria crear uma armadilha em que o professor
 * remove a opção B, tenta recriá-la e leva com um 409 que não explica nada.
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
  const setOption = (i: number, patch: Partial<DraftOption>) =>
    onChange({ options: item.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  /** Só pode haver uma resposta correcta: marcar uma desmarca as outras. */
  const markCorrect = (i: number) =>
    onChange({ options: item.options.map((o, j) => ({ ...o, correct: j === i })) });

  return (
    <fieldset className="grid gap-3 rounded-lg border p-3">
      <legend className="sr-only">Questão {n}</legend>
      <div className="flex items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-accent text-[12px] font-bold text-accent-foreground">{n}</span>
        <Textarea
          rows={2}
          value={item.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder={`Questão ${n}`}
          aria-label={`Questão ${n}`}
          className="min-h-14 flex-1"
        />
        <Input
          type="number"
          min={0}
          step="0.5"
          value={item.points}
          onChange={(e) => onChange({ points: e.target.value === '' ? '' : Number(e.target.value) })}
          placeholder="Val."
          aria-label={`Cotação da questão ${n}`}
          className="w-20"
        />
      </div>

      <div className="grid gap-2 pl-8">
        {item.options.map((option, i) => (
          <div key={option.label || i} className="flex items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-md border text-[12px] font-bold text-muted-foreground">{option.label || labelFor(i)}</span>
            <Input
              value={option.text}
              onChange={(e) => setOption(i, { text: e.target.value })}
              placeholder={`Opção ${option.label || labelFor(i)}`}
              aria-label={`Opção ${option.label || labelFor(i)} da questão ${n}`}
              className="flex-1"
            />
            <Button
              type="button"
              variant={option.correct ? 'default' : 'outline'}
              size="icon"
              className="size-9 shrink-0"
              aria-pressed={option.correct}
              aria-label={option.correct ? `Opção ${option.label} é a resposta correcta` : `Marcar a opção ${option.label} como resposta correcta`}
              title={option.correct ? 'É a resposta correcta' : 'Marcar como resposta correcta'}
              onClick={() => markCorrect(i)}
            >
              <Check />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              aria-label={`Mover a opção ${option.label} para cima`}
              disabled={i === 0}
              onClick={() => onChange({ options: [...item.options.slice(0, i - 1), item.options[i], item.options[i - 1], ...item.options.slice(i + 1)] })}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0"
              aria-label={`Mover a opção ${option.label} para baixo`}
              disabled={i === item.options.length - 1}
              onClick={() => onChange({ options: [...item.options.slice(0, i + 1), item.options[i + 1], item.options[i], ...item.options.slice(i + 2)] })}
            >
              <ArrowDown />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 hover:bg-danger-soft hover:text-destructive"
              aria-label={`Remover a opção ${option.label}`}
              disabled={item.options.length === 1}
              onClick={() => onChange({ options: item.options.filter((_, j) => j !== i) })}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => onChange({ options: [...item.options, { label: labelFor(item.options.length), text: '', correct: false }] })}
        >
          <Plus />Opção
        </Button>
        {item.options.length > 0 && !item.options.some((o) => o.correct) && (
          // O `/approve` devolve 422 a uma pergunta com opções e nenhuma marcada, e
          // só depois de o professor ter guardado a prova toda. Avisa-se aqui.
          <p className="text-[13px] text-muted-foreground">Falta marcar a resposta correcta.</p>
        )}
      </div>

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