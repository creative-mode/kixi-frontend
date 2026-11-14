'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '../builder-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ExamDraft } from '@/lib/exam/schools';

/** As regras e o rodapé: instruções da prova e metadados de lugar, data e professor. */
export function RegrasCard({ draft, onPatch }: { draft: ExamDraft; onPatch: (patch: Partial<ExamDraft>) => void }) {
  const setRule = (i: number, value: string) => onPatch({ rules: draft.rules.map((x, j) => (j === i ? value : x)) });
  return (
    <Card id="builder-regras" className="scroll-mt-24">
      <CardHeader><CardTitle>Regras e rodapé</CardTitle></CardHeader>
      <CardContent className="grid gap-3">
        {draft.rules.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={r} onChange={(e) => setRule(i, e.target.value)} aria-label={`Regra ${i + 1}`} />
            <Button variant="ghost" size="icon" aria-label={`Remover regra ${i + 1}`} onClick={() => onPatch({ rules: draft.rules.filter((_, j) => j !== i) })}><Trash2 aria-hidden /></Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="justify-self-start" onClick={() => onPatch({ rules: [...draft.rules, ''] })}><Plus aria-hidden /> Regra</Button>
        <Field label="Observação"><Input value={draft.note} onChange={(e) => onPatch({ note: e.target.value })} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Local"><Input value={draft.place} onChange={(e) => onPatch({ place: e.target.value })} /></Field>
          <Field label="Data"><Input type="date" value={draft.date} onChange={(e) => onPatch({ date: e.target.value })} /></Field>
        </div>
        <Field label="Professor"><Input value={draft.teacher} onChange={(e) => onPatch({ teacher: e.target.value })} /></Field>
      </CardContent>
    </Card>
  );
}
