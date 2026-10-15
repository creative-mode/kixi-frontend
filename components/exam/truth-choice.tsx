'use client';

import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trueFalseAnswer, trueFalseOptions, type DraftOption } from '@/lib/exam/draft';

/**
 * A resposta de uma afirmação de verdadeiro/falso: dois botões, um marcado.
 *
 * O backend não tem uma resposta booleana: corrige pela opção marcada como certa, por isso a afirmação
 * leva duas opções (Verdadeiro, Falso) e esta escolha decide qual delas é a correcta.
 */
export function TruthChoice({
  options,
  where,
  onChange,
}: {
  options: DraftOption[];
  where: string;
  onChange: (options: DraftOption[]) => void;
}) {
  const answer = trueFalseAnswer(options);
  const pick = (value: 'V' | 'F') => onChange(trueFalseOptions(value));
  return (
    <div role="radiogroup" aria-label={`Resposta da questão ${where}`} className="flex flex-wrap items-center gap-2">
      <Button type="button" role="radio" aria-checked={answer === 'V'} size="sm" variant={answer === 'V' ? 'default' : 'outline'} onClick={() => pick('V')}>
        <Check aria-hidden />Verdadeiro
      </Button>
      <Button type="button" role="radio" aria-checked={answer === 'F'} size="sm" variant={answer === 'F' ? 'default' : 'outline'} onClick={() => pick('F')}>
        <X aria-hidden />Falso
      </Button>
      {answer === null && <span className="text-[13px] text-muted-foreground">Falta marcar a resposta.</span>}
    </div>
  );
}
