'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { institutionLinks, listOptions } from '@/app/actions/crud';
import { assignTeacher, classesOfInstitution, classSubjects, type ClassOption, type ClassSubjectOption } from '@/app/actions/academic';
import { getRow } from '@/app/actions/crud';
import { PageHead } from '@/components/crud/page-head';
import { ENTITIES } from '@/lib/crud/entities';
import { teachersToAssign } from '@/lib/academic/structure';

type Options = { value: number; label: string }[];
type Teacher = { id: number; firstName: string; lastName: string; assignments: number };

/** Atribuição (só ADMIN) em cascata: escola → turma → disciplina do currículo → professor da escola.
 *
 * Cada passo só oferece o que o anterior permite, que é o que o backend valida (422): a turma é da escola,
 * a disciplina faz parte do currículo do curso dela e o professor está afiliado a essa escola. O ano letivo
 * vem da turma.
 */
export function QuickAssign() {
  const entity = ENTITIES['teaching-assignments'];
  const [schools, setSchools] = useState<Options>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<ClassSubjectOption[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [loading, setLoading] = useState(true);
  const [stepLoading, setStepLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [done, setDone] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = await listOptions('institutions');
      if (!alive) return;
      if (s.ok) setSchools(s.data);
      else setLoadError(s.error);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  async function pickSchool(v: string) {
    setSchoolId(v); setClassId(''); setSubjectId(''); setTeacherId(''); setClasses([]); setSubjects([]); setTeachers([]);
    if (!v) return;
    setStepLoading(true);
    const [c, t] = await Promise.all([classesOfInstitution(Number(v)), institutionLinks(Number(v), 'teachers')]);
    setStepLoading(false);
    if (c.ok) setClasses(c.data); else toast.error(c.error);
    if (t.ok) setTeachers(t.data.map((x) => ({ id: x.id, firstName: x.firstName, lastName: x.lastName, assignments: 0 }))); else toast.error(t.error);
  }

  async function pickClass(v: string) {
    setClassId(v); setSubjectId(''); setTeacherId(''); setSubjects([]);
    if (!v) return;
    setStepLoading(true);
    const r = await classSubjects(Number(v));
    setStepLoading(false);
    if (r.ok) setSubjects(r.data); else toast.error(r.error);
  }

  const subject = subjects.find((s) => String(s.subjectId) === subjectId);
  const free = useMemo(() => (subject ? teachersToAssign(teachers, subject) : teachers), [teachers, subject]);

  async function schoolYearOf(id: string): Promise<number | null> {
    const res = await getRow('classes', id);
    if (!res.ok) return null;
    const y = res.data.schoolYear?.id ?? res.data.schoolYearId;
    return Number.isInteger(y) ? y : null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!schoolId || !classId || !subjectId || !teacherId) return toast.error('Escolha escola, turma, disciplina e professor.');
    setSaving(true);
    const schoolYearId = await schoolYearOf(classId);
    if (schoolYearId == null) {
      setSaving(false);
      return toast.error('Não foi possível ler o ano letivo da turma.');
    }
    const res = await assignTeacher({ teacherId: Number(teacherId), classId: Number(classId), subjectId: Number(subjectId), schoolYearId });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    setDone((n) => n + 1);
    toast.success('Atribuição criada');
    setTeacherId('');
    await pickClass(classId); // recarrega os professores já atribuídos
  }

  const field = (id: string, label: string, value: string, set: (v: string) => void, children: React.ReactNode, disabled = false) => (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label} *</Label>
      <NativeSelect id={id} value={value} onChange={(e) => set(e.target.value)} disabled={saving || disabled}>
        <option value="">Escolher…</option>
        {children}
      </NativeSelect>
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <PageHead entity={entity} title="Atribuir professor" subtitle="Escola, turma, disciplina e professor. Só se oferece o que a estrutura da escola permite." back={{ href: '/teaching-assignments', label: 'Ver atribuições' }} />
      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div role="status" aria-label="A carregar" className="grid gap-5"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
          ) : loadError ? (
            <p className="py-8 text-center text-sm text-destructive">{loadError}</p>
          ) : (
            <form onSubmit={onSubmit} className="grid gap-5">
              {field('school', 'Escola', schoolId, pickSchool, schools.map((o) => <option key={o.value} value={o.value}>{o.label}</option>))}
              {field('class', 'Turma', classId, pickClass, classes.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.grade}.ª · {c.courseName} ({c.schoolYear})</option>), !schoolId || stepLoading)}
              {schoolId && classes.length === 0 && !stepLoading ? <p className="-mt-3 text-xs text-muted-foreground">Esta escola ainda não tem turmas. <Link className="underline" href={`/institutions/${schoolId}/structure`}>Montar a estrutura</Link>.</p> : null}
              {field('subject', 'Disciplina', subjectId, (v) => { setSubjectId(v); setTeacherId(''); }, subjects.map((s) => <option key={s.subjectId} value={s.subjectId}>{s.name} ({s.code})</option>), !classId || stepLoading)}
              {classId && subjects.length === 0 && !stepLoading ? <p className="-mt-3 text-xs text-muted-foreground">O curso desta turma não tem disciplinas para a classe dela. <Link className="underline" href={`/institutions/${schoolId}/structure`}>Preencher o currículo</Link>.</p> : null}
              {field('teacher', 'Professor', teacherId, setTeacherId, free.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>), !subjectId)}
              {subjectId && free.length === 0 ? <p className="-mt-3 text-xs text-muted-foreground">Não há professores afiliados a esta escola por atribuir. Afilie-os na <Link className="underline" href={`/institutions/${schoolId}/structure`}>estrutura da escola</Link>.</p> : null}
              {subject && subject.teachers.length > 0 ? <p className="text-sm text-muted-foreground">Já dão esta disciplina na turma: {subject.teachers.map((t) => `${t.firstName} ${t.lastName}`).join(', ')}.</p> : null}
              <div className="flex items-center justify-between gap-3 pt-2">
                <span className="text-sm text-muted-foreground">{done === 0 ? 'Ainda sem atribuições nesta sessão.' : `${done} atribuição(ões) criada(s).`}</span>
                <Button type="submit" disabled={saving || !teacherId}>{saving ? 'A gravar…' : 'Atribuir'}</Button>
              </div>
              <p className="text-sm"><Link href="/teaching-assignments" className="text-primary underline-offset-4 hover:underline">Ver todas as atribuições</Link></p>
            </form>
          )}
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Como funciona</CardTitle>
          <CardDescription>Um professor pode dar aulas em várias escolas, desde que esteja afiliado a cada uma. O ano letivo é herdado da turma.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
