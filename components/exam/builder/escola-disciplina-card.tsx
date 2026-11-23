'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '../builder-field';
import { NativeSelect } from '@/components/ui/native-select';

/** Escola e disciplina: a prova pertence a um sítio. */
export function EscolaDisciplinaCard({
  ready, schools, schoolId, choices, chosenClassId, subject, subjectOptions, classOptions, admin, onSchool, onSubject, onClass,
}: {
  ready: boolean;
  schools: { id: string; name: string }[];
  schoolId: string | undefined;
  choices: { subjects: { label: string; value: number }[] } | null;
  chosenClassId: string;
  subject: string;
  subjectOptions: { value: number | string; label: string }[];
  classOptions: { value: number | string; label: string }[];
  admin: boolean | null;
  onSchool: (value: string) => void;
  onSubject: (value: string) => void;
  onClass: (value: string) => void;
}) {
  return (
    <Card id="builder-dados" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Escola e disciplina</CardTitle>
        <CardDescription>A prova pertence a uma escola e a uma disciplina dessa escola.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {ready && schools.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Não está afiliado a nenhuma escola. Peça a um administrador que o associe a uma <Link href="/institutions" className="underline">instituição</Link>.
          </p>
        ) : (
          <>
            <Field label="Escola">
              <NativeSelect value={schoolId ?? ''} onChange={(e) => onSchool(e.target.value)}>
                {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </NativeSelect>
            </Field>
            <Field label="Disciplina">
              <NativeSelect value={subject} onChange={(e) => onSubject(e.target.value)}>
                <option value="">Escolher…</option>
                {subjectOptions.map((x) => <option key={x.value} value={x.label}>{x.label}</option>)}
              </NativeSelect>
            </Field>
            <Field label={admin ? 'Turma (opcional)' : 'Turma'}>
              <NativeSelect value={chosenClassId} onChange={(e) => onClass(e.target.value)} disabled={!choices}>
                <option value="">Escolher…</option>
                {classOptions.map((c) => <option key={c.value} value={String(c.value)}>{c.label}</option>)}
              </NativeSelect>
            </Field>
          </>
        )}
      </CardContent>
    </Card>
  );
}
