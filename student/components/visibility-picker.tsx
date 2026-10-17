'use client';

import { useState, useTransition } from 'react';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { definirVisibilidadeAction } from '@/lib/profile-actions';
import type { Visibility } from '@/lib/profiles';

const OPTIONS: { value: Visibility; label: string }[] = [
  { value: 'public', label: 'Toda a gente na Kixi' },
  { value: 'school', label: 'Só a minha escola' },
  { value: 'private', label: 'Só eu' },
];

/** Quem vê o resto do meu perfil (escolas, nível, medalhas). O nome e a foto veem-se sempre. */
export function VisibilityPicker({ initial }: { initial: Visibility }) {
  const [value, setValue] = useState<Visibility>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function change(next: Visibility) {
    const before = value;
    setValue(next);
    setError(null);
    start(async () => {
      const result = await definirVisibilidadeAction(next);
      if (result.error) {
        setValue(before);
        setError(result.error);
      }
    });
  }

  return (
    <div className="grid gap-2 py-3.5 last:pb-0">
      <Label htmlFor="def-visibilidade" className="grid gap-0.5 leading-snug">
        <span className="text-[15px]">Quem vê o meu perfil</span>
        <span className="text-[13px] font-normal text-muted-foreground">O nome e a foto veem-se sempre. O resto, só a quem escolheres.</span>
      </Label>
      <NativeSelect id="def-visibilidade" value={value} disabled={pending} onChange={(e) => change(e.target.value as Visibility)}>
        {OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </NativeSelect>
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
    </div>
  );
}
