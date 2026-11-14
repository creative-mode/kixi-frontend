'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';

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
  const [text, setText] = useState(value === '' ? '' : String(value).replace('.', ','));
  // Quando o pai muda a cotação por fora (OCR, «copiar cotação»), o campo segue-o — derivado durante a renderização, não num efeito.
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setText(value === '' ? '' : String(value).replace('.', ','));
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        const raw = event.target.value.replace(',', '.').trim();
        if (raw === '') {
          onChange('');
          return;
        }
        const parsed = Number(raw);
        if (Number.isFinite(parsed) && parsed >= 0) onChange(parsed);
      }}
      {...rest}
    />
  );
}
