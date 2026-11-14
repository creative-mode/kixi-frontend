'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { formatCotação, parseCotação } from '@/lib/exam/cotacao';

/**
 * A cotação de uma pergunta ou alínea, com a vírgula que o professor escreve (#760):
 * «1,5» e «1.5» valem o mesmo, e o que não é um número fica no campo — não salta
 * de volta para o vazio enquanto o professor está a escrever.
 */
export function CotaçãoInput({
  value,
  onChange,
  ...rest
}: {
  value: number | '';
  onChange: (value: number | '') => void;
  'aria-label': string;
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(formatCotação(value));
  // Quando o pai muda a cotação por fora (OCR, «copiar cotação»), o campo segue-o — derivado durante a renderização, não num efeito.
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setText(formatCotação(value));
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        const parsed = parseCotação(event.target.value);
        if (!parsed.ok) return; // texto a meio — o rascunho fica como estava
        onChange(parsed.value);
      }}
      {...rest}
    />
  );
}
