'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '../builder-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { KINDS, type ExamDraft } from '@/lib/exam/schools';

/** Título e cabeçalho da prova: o que aparece na primeira página. */
export function CabecalhoCard({ draft, onPatch, subject }: { draft: ExamDraft; onPatch: (patch: Partial<ExamDraft>) => void; subject: string }) {
  return (
    <Card id="builder-cabecalho" className="scroll-mt-24">
      <CardHeader><CardTitle>Cabeçalho</CardTitle></CardHeader>
      <CardContent className="grid gap-4">
        <Field label="Título"><Input value={draft.title} onChange={(e) => onPatch({ title: e.target.value })} placeholder={subject ? `${draft.kind} – ${subject}` : 'Tipo – disciplina'} /></Field>
        <div className="grid gap-4 sm:grid-cols-[1fr_1.5fr_1fr]">
          <Field label="Classe"><Input value={draft.grade} onChange={(e) => onPatch({ grade: e.target.value })} /></Field>
          <Field label="Tipo">
            <NativeSelect value={draft.kind} onChange={(e) => onPatch({ kind: e.target.value })}>{KINDS.map((k) => <option key={k}>{k}</option>)}</NativeSelect>
          </Field>
          <Field label="Fase"><Input value={draft.phase} onChange={(e) => onPatch({ phase: e.target.value })} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Duração (min)">
            <Input type="number" min={1} step={5} value={draft.duration} onChange={(e) => onPatch({ duration: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="90" />
          </Field>
          <Field label="Série"><Input value={draft.variant} onChange={(e) => onPatch({ variant: e.target.value })} placeholder="B" /></Field>
          <Field label="Ano letivo"><Input value={draft.schoolYear} onChange={(e) => onPatch({ schoolYear: e.target.value })} placeholder="2024/2025" /></Field>
        </div>
      </CardContent>
    </Card>
  );
}
