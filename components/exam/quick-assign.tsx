'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { createRow, getRow, listMine, listOptions } from '@/app/actions/crud';
import type { Row } from '@/lib/crud/entities';
import { PageHead } from '@/components/crud/page-head';
import { ENTITIES } from '@/lib/crud/entities';

type Options = { value: number; label: string }[];

/** Atribuição rápida: professor → turma + disciplina, numa só tela.
 *
 * Ao contrário do CRUD genérico, o ano letivo não se escolhe: vem da turma,
 * como o backend exige (TeachingAssignmentRequest.schoolYearId @NotNull).
 * Contra a API real, só ADMIN e professores afiliados conseguem gravar —
 * o servidor responde 403 e o erro aparece aqui.
 */
export function QuickAssign() {
  const entity = ENTITIES['teaching-assignments'];
  const [teachers, setTeachers] = useState<Options>([]);
  const [lockedTeacher, setLockedTeacher] = useState<string | null>(null);
  const [classes, setClasses] = useState<Options>([]);
  const [subjects, setSubjects] = useState<Options>([]);
  const [teacherId, setTeacherId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [done, setDone] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [t, c, s] = await Promise.all([
        listOptions('teachers'),
        listOptions('classes'),
        listOptions('subjects'),
      ]);
      if (!alive) return;
      if (t.ok) {
        setTeachers(t.data);
      } else {
        // A lista de professores é só de ADMIN no backend real: um professor
        // cai aqui e resolve o seu próprio registo via /me. Com um só
        // registo, o professor fica fixo em vez de mostrar erro.
        const mine = await listMine('teaching-assignments');
        if (!alive) return;
        if (mine.ok) {
          const ids = [...new Set(mine.data.map((a) => Number(a.teacherId)).filter((n) => Number.isInteger(n)))];
          if (ids.length === 1) {
            setTeacherId(String(ids[0]));
            setLockedTeacher(`Professor #${ids[0]} (o teu registo)`);
          } else {
            setLoadError(t.error);
          }
        } else {
          setLoadError(t.error);
        }
      }
      if (!c.ok) setLoadError(c.error);
      else setClasses(c.data);
      if (!s.ok) setLoadError(s.error);
      else setSubjects(s.data);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function schoolYearOf(classId: string): Promise<number | null> {
    const res: { ok: boolean; data?: Row; error?: string } = await getRow('classes', classId);
    if (!res.ok || !res.data) return null;
    const row = res.data as Row;
    const embedded = row.schoolYear as Row | undefined;
    const id = embedded?.id ?? row.schoolYearId;
    return typeof id === 'number' && Number.isInteger(id) ? id : null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!teacherId || !classId || !subjectId) {
      toast.error('Escolhe professor, turma e disciplina.');
      return;
    }
    setSaving(true);
    const schoolYearId = await schoolYearOf(classId);
    if (schoolYearId == null) {
      setSaving(false);
      toast.error('Não foi possível ler o ano letivo da turma.');
      return;
    }
    const res = await createRow('teaching-assignments', {
      teacherId: Number(teacherId),
      classId: Number(classId),
      subjectId: Number(subjectId),
      schoolYearId,
    });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    setDone((n) => n + 1);
    toast.success('Atribuição criada');
  }

  const select = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    options: Options,
  ) => (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label} *</Label>
      <NativeSelect id={id} value={value} onChange={(e) => set(e.target.value)} disabled={saving}>
        <option value="">Escolher…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <PageHead
        entity={entity}
        title="Atribuição rápida"
        subtitle="Professor, turma e disciplina numa só tela. O ano letivo vem da turma."
        back={{ href: '/teaching-assignments', label: 'Ver atribuições' }}
      />
      <Card>
        <CardContent className="p-6">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">A carregar listas…</p>
          ) : loadError ? (
            <p className="py-8 text-center text-sm text-destructive">{loadError}</p>
          ) : (
            <form onSubmit={onSubmit} className="grid gap-5">
              {lockedTeacher ? (
                <p className="rounded-md border bg-accent px-3 py-2 text-sm text-accent-foreground" role="note">
                  A atribuir como {lockedTeacher}.
                </p>
              ) : (
                select('teacher', 'Professor', teacherId, setTeacherId, teachers)
              )}
              {select('class', 'Turma', classId, setClassId, classes)}
              {select('subject', 'Disciplina', subjectId, setSubjectId, subjects)}
              <div className="flex items-center justify-between gap-3 pt-2">
                <span className="text-sm text-muted-foreground">
                  {done === 0 ? 'Ainda sem atribuições nesta sessão.' : `${done} atribuição(ões) criada(s).`}
                </span>
                <Button type="submit" disabled={saving}>
                  {saving ? 'A gravar…' : 'Atribuir'}
                </Button>
              </div>
              <p className="text-sm">
                <Link href="/teaching-assignments" className="text-primary underline-offset-4 hover:underline">
                  Ver todas as atribuições
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Como funciona</CardTitle>
          <CardDescription>O ano letivo é herdado da turma, tal como o backend exige.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
