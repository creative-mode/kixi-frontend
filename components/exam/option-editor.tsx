'use client';

import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { labelAt, move, nextLabel, type DraftOption } from '@/lib/exam/draft';
import { FormulaInput } from './formula-input';

/**
 * As opções de uma questão de escolha múltipla (ou de uma alínea).
 *
 * Os rótulos (A, B, C) são gerados e não se editam: `optionLabel` é a identidade da
 * opção dentro da pergunta e o backend recusa-o alterado. Pior, um rótulo libertado
 * continua tomado para sempre — o índice único não conhece as linhas removidas —,
 * por isso reciclar etiquetas aqui seria criar uma armadilha em que o professor
 * remove a opção B, tenta recriá-la e leva com um 409 que não explica nada.
 *
 * `where` é como se chama a questão nos rótulos de acessibilidade («questão 3a»).
 */
export function OptionEditor({
  options,
  where,
  onChange,
}: {
  options: DraftOption[];
  where: string;
  onChange: (options: DraftOption[]) => void;
}) {
  const setOption = (i: number, patch: Partial<DraftOption>) => onChange(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  /** Só pode haver uma resposta correcta: marcar uma desmarca as outras. */
  const markCorrect = (i: number) => onChange(options.map((o, j) => ({ ...o, correct: j === i })));

  return (
    <div className="grid gap-2">
      {options.map((option, i) => (
        // O rótulo é único dentro da pergunta e atribuído uma vez — `normalizeItem`
        // garante que nenhum vem vazio — por isso serve de key.
        <div key={option.label || i} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <span className="grid size-7 shrink-0 place-items-center rounded-md border text-[12px] font-bold text-muted-foreground">{option.label || labelAt(i)}</span>
          <FormulaInput
            value={option.text}
            onChange={(value) => setOption(i, { text: value })}
            label={`Opção ${option.label || labelAt(i)} da questão ${where}`}
            rows={1}
            placeholder={`Opção ${option.label || labelAt(i)}`}
            className="min-w-0 flex-1"
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
          <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" aria-label={`Mover a opção ${option.label} para cima`} disabled={i === 0} onClick={() => onChange(move(options, i, -1))}>
            <ArrowUp />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0" aria-label={`Mover a opção ${option.label} para baixo`} disabled={i === options.length - 1} onClick={() => onChange(move(options, i, 1))}>
            <ArrowDown />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 hover:bg-danger-soft hover:text-destructive"
            aria-label={`Remover a opção ${option.label}`}
            disabled={options.length === 1}
            onClick={() => onChange(options.filter((_, j) => j !== i))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => onChange([...options, { label: nextLabel(options), text: '', correct: false }])}>
        <Plus />Opção
      </Button>
      {options.length > 0 && !options.some((o) => o.correct) && (
        // O `/approve` devolve 422 a uma pergunta com opções e nenhuma marcada, e
        // só depois de o professor ter guardado a prova toda. Avisa-se aqui.
        <p className="text-[13px] text-muted-foreground">Falta marcar a resposta correcta.</p>
      )}
    </div>
  );
}
