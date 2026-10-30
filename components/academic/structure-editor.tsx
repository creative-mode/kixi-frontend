'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, BookOpen, CheckCircle2, GraduationCap, Plus, Trash2, UserPlus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton } from '@/components/ui/skeleton';
import { Confirm, type ConfirmState } from '@/components/crud/confirm';
import { createRow, deleteRow, listRows, setInstitutionLink } from '@/app/actions/crud';
import { addToCurriculum, assignTeacher, getStructure, removeFromCurriculum, unassignTeacher } from '@/app/actions/academic';
import type { InstitutionStructure, StructureClass, StructureCourse } from '@/lib/academic/types';
import { curriculumLabel, gradeLabel, isComplete, warningText, subjectsToAdd, teachersToAffiliate, teachersToAssign, warningsOf } from '@/lib/academic/structure';
import type { Row } from '@/lib/crud/entities';

type Opts = { subjects: Row[]; teachers: Row[]; years: Row[] };

/**
 * Assistente da estrutura de uma escola: cursos → currículo (disciplinas) → turmas → professor por disciplina,
 * mais os professores afiliados. Cada passo grava logo e recarrega a estrutura, que o backend devolve já agregada.
 */
export function StructureEditor({ institutionId, created }: { institutionId: number; created?: boolean }) {
  const [data, setData] = useState<InstitutionStructure | null>(null);
  const [opts, setOpts] = useState<Opts>({ subjects: [], teachers: [], years: [] });
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [pending, setPending] = useState(false);
  const running = useRef(false);

  const load = useCallback(async () => {
    const res = await getStructure(institutionId);
    if (res.ok) {
      setData(res.data);
      setError(null);
    } else setError(res.error);
  }, [institutionId]);

  useEffect(() => {
    const task = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(task);
  }, [load]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [subjects, teachers, years] = await Promise.all([listRows('subjects'), listRows('teachers'), listRows('school-years')]);
      if (alive) setOpts({ subjects: subjects.ok ? subjects.data : [], teachers: teachers.ok ? teachers.data : [], years: years.ok ? years.data : [] });
    })();
    return () => { alive = false; };
  }, []);

  /**
   * Corre uma escrita, mostra o erro do servidor tal como veio e recarrega. Só corre uma de cada vez:
   * um segundo envio (duplo clique, Enter repetido) chega antes de o estado mudar, por isso a trava é um ref.
   * Devolve `false` quando o recusa, e o formulário não limpa os campos.
   */
  const act = useCallback(async (run: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    if (running.current) return false;
    running.current = true;
    setPending(true);
    try {
      const r = await run();
      if (!r.ok) {
        toast.error(r.error ?? 'Não foi possível guardar.');
        return false;
      }
      toast.success(done);
      await load();
      return true;
    } finally {
      running.current = false;
      setPending(false);
    }
  }, [load]);

  if (error) {
    return (
      <Shell title="Estrutura">
        <p className="mb-3 text-sm text-destructive" role="alert">{error}</p>
        <Button variant="outline" size="sm" onClick={() => { setError(null); void load(); }}>Tentar de novo</Button>
      </Shell>
    );
  }
  if (!data) return <Shell title="Estrutura"><StructureSkeleton /></Shell>;

  const w = warningsOf(data.warnings);
  const yearId = data.schoolYear?.id;

  return (
    <Pending.Provider value={pending}>
    <Shell title={`Estrutura · ${data.institution.name}`} subtitle={data.schoolYear ? `Ano letivo ${data.schoolYear.startYear}–${data.schoolYear.endYear}` : 'Sem ano letivo definido'}>
      {created ? (
        <p role="status" className="mb-4 rounded-md border border-primary/30 bg-accent p-3 text-sm">
          Instituição criada. Falta montar a estrutura: comece por um curso, ponha-lhe disciplinas, crie as turmas e atribua os professores.
        </p>
      ) : null}

      <section aria-label="Resumo" className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {([['Cursos', data.counts.courses], ['Turmas', data.counts.classes], ['Disciplinas', data.counts.subjects], ['Professores', data.counts.teachers], ['Alunos', data.counts.students]] as const).map(([label, n]) => (
          <Card key={label}><CardContent className="p-4"><div className="text-2xl font-bold" data-testid={`count-${label}`}>{n}</div><div className="text-xs text-muted-foreground">{label}</div></CardContent></Card>
        ))}
      </section>

      <section aria-label="Completude" className="mb-6">
        {isComplete(data.warnings) && data.counts.courses > 0 ? (
          <p className="flex items-center gap-2 rounded-md border border-success/40 bg-success-soft p-3 text-sm" data-testid="complete"><CheckCircle2 size={16} /> Estrutura completa: todas as disciplinas têm professor.</p>
        ) : data.warnings.length > 0 || data.counts.courses === 0 ? (
          <div className="rounded-md border border-warning/40 bg-warning-soft p-3 text-sm" data-testid="warnings">
            <p className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle size={16} /> {data.counts.courses === 0 ? 'Ainda não há cursos.' : `${w.total} ${w.total === 1 ? 'ponto por completar' : 'pontos por completar'}`}</p>
            <ul className="ml-6 list-disc space-y-0.5">
              {data.warnings.slice(0, 8).map((x, i) => <li key={i}>{warningText(x, data)}</li>)}
              {data.warnings.length > 8 ? <li>… e mais {data.warnings.length - 8}.</li> : null}
            </ul>
          </div>
        ) : null}
      </section>

      <NewCourse institutionId={institutionId} act={act} />

      <div className="grid gap-4">
        {data.courses.map((c) => (
          <CourseCard key={c.id} course={c} data={data} opts={opts} yearId={yearId} act={act} ask={setConfirm} />
        ))}
      </div>

      <TeachersCard data={data} opts={opts} institutionId={institutionId} act={act} ask={setConfirm} />
      <Confirm state={confirm} onClose={() => setConfirm(null)} />
    </Shell>
    </Pending.Provider>
  );
}

type Act = (run: () => Promise<{ ok: boolean; error?: string }>, done: string) => Promise<boolean>;

/** Há uma escrita a correr: todos os formulários da estrutura ficam ocupados até ela acabar e a estrutura recarregar. */
const Pending = createContext(false);

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <Link href="/institutions" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={14} /> Instituições</Link>
      <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
      {subtitle ? <p className="mb-6 text-sm text-muted-foreground">{subtitle}</p> : <div className="mb-6" />}
      {children}
    </div>
  );
}

/** Esqueleto só do conteúdo: a casca (título, ligação) já está na página. */
function StructureSkeleton() {
  return (
    <div role="status" aria-label="A carregar" className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-20" />)}</div>
      <Skeleton className="h-14" />
      <Skeleton className="h-56" />
      <Skeleton className="h-56" />
    </div>
  );
}

function NewCourse({ institutionId, act }: { institutionId: number; act: Act }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const pending = useContext(Pending);
  const first = useRef<HTMLInputElement>(null);
  return (
    <form
      className="mb-4 grid gap-3 rounded-lg border border-dashed p-4 sm:grid-cols-[8rem_1fr_auto]"
      aria-label="Novo curso"
      aria-busy={pending}
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await act(() => createRow('courses', { code: code.trim(), name: name.trim(), institutionId, description: '' }), 'Curso criado');
        if (ok) { setCode(''); setName(''); }
        first.current?.focus();
      }}
    >
      <Input ref={first} aria-label="Código do curso" placeholder="Código (TISM)" value={code} onChange={(e) => setCode(e.target.value)} required minLength={2} maxLength={50} />
      <Input aria-label="Nome do curso" placeholder="Nome do curso" value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={255} />
      <Button type="submit" disabled={pending || !code.trim() || !name.trim()}>{pending ? 'A criar…' : <><Plus size={16} className="mr-1" /> Novo curso</>}</Button>
    </form>
  );
}

function CourseCard({ course, data, opts, yearId, act, ask }: { course: StructureCourse; data: InstitutionStructure; opts: Opts; yearId?: number; act: Act; ask: (s: ConfirmState) => void }) {
  const [subjectId, setSubjectId] = useState('');
  const [grade, setGrade] = useState('');
  const g = grade === '' ? null : Number(grade);
  const pending = useContext(Pending);
  const firstSubject = useRef<HTMLSelectElement>(null);
  const addable = useMemo(() => subjectsToAdd(opts.subjects as { id: number; name: string; code: string }[], course.curriculum, g), [opts.subjects, course.curriculum, g]);

  return (
    <Card data-testid={`course-${course.code}`}>
      <CardContent className="grid gap-5 p-4 md:p-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-accent p-2 text-primary"><GraduationCap size={18} /></div>
            <div><h2 className="font-semibold">{course.name}</h2><p className="font-mono text-xs text-muted-foreground">{course.code}</p></div>
          </div>
          <Button variant="ghost" size="sm" aria-label={`Apagar curso ${course.code}`} className="hover:bg-danger-soft hover:text-destructive"
            onClick={() => ask({
              title: 'Apagar este curso?', destructive: true, action: 'Apagar',
              description: `O curso «${course.name}» sai da escola. Só é possível se não tiver turmas com alunos ou professores.`,
              run: () => { void act(() => deleteRow('courses', course.id), 'Curso movido para a lixeira'); },
            })}>
            <Trash2 size={16} />
          </Button>
        </header>

        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><BookOpen size={15} /> Currículo <span className="font-normal text-muted-foreground">· disciplinas que o curso dá</span></h3>
          {course.curriculum.length === 0 ? (
            <p className="mb-2 text-sm text-muted-foreground">Ainda sem disciplinas. As turmas só têm disciplinas e professores depois de o currículo existir.</p>
          ) : (
            <ul className="mb-3 flex flex-wrap gap-2">
              {course.curriculum.map((e) => (
                <li key={e.linkId} className="inline-flex items-center gap-1 rounded-full border bg-card py-1 pr-1 pl-3 text-sm">
                  {curriculumLabel(e)}
                  <button type="button" aria-label={`Tirar ${e.name} do currículo`} className="rounded-full p-1 text-muted-foreground hover:bg-danger-soft hover:text-destructive"
                    onClick={() => ask({
                      title: 'Tirar do currículo?', destructive: true, action: 'Tirar',
                      description: `${e.name} deixa de fazer parte de ${course.name} (${gradeLabel(e.grade)}). Falha se houver professores atribuídos.`,
                      run: () => { void act(() => removeFromCurriculum(course.id, e.linkId), 'Disciplina retirada do currículo'); },
                    })}>
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <form className="grid gap-2 sm:grid-cols-[1fr_11rem_auto]" aria-label={`Adicionar disciplina a ${course.code}`} aria-busy={pending}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!subjectId) return;
              const ok = await act(() => addToCurriculum(course.id, Number(subjectId), g), 'Disciplina adicionada ao currículo');
              if (ok) setSubjectId('');
              firstSubject.current?.focus();
            }}>
            <NativeSelect ref={firstSubject} aria-label="Disciplina" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">Disciplina…</option>
              {addable.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
            </NativeSelect>
            <NativeSelect aria-label="Classe do currículo" value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">Todas as classes</option>
              {Array.from({ length: 13 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}.ª classe</option>)}
            </NativeSelect>
            <Button type="submit" variant="outline" disabled={pending || !subjectId}>{pending ? 'A adicionar…' : <><Plus size={16} className="mr-1" /> Adicionar</>}</Button>
          </form>
          {opts.subjects.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">Não há disciplinas no sistema. <Link className="underline" href="/subjects/new">Criar disciplina</Link>.</p> : null}
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Users size={15} /> Turmas</h3>
          <div className="grid gap-2">
            {course.classes.length === 0 ? <p className="text-sm text-muted-foreground">Ainda sem turmas neste ano letivo.</p> : null}
            {course.classes.map((k) => <ClassRow key={k.id} cls={k} data={data} yearId={yearId} act={act} ask={ask} />)}
          </div>
          <NewClass courseId={course.id} courseCode={course.code} yearId={yearId} years={opts.years} act={act} />
        </div>
      </CardContent>
    </Card>
  );
}

function NewClass({ courseId, courseCode, yearId, years, act }: { courseId: number; courseCode: string; yearId?: number; years: Row[]; act: Act }) {
  const [code, setCode] = useState('');
  const [grade, setGrade] = useState('');
  const [year, setYear] = useState('');
  const chosenYear = year || (yearId ? String(yearId) : '');
  const pending = useContext(Pending);
  const first = useRef<HTMLInputElement>(null);
  return (
    <form className="mt-3 grid gap-2 sm:grid-cols-[7rem_8rem_1fr_auto]" aria-label={`Nova turma de ${courseCode}`} aria-busy={pending}
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await act(() => createRow('classes', { code: code.trim(), grade: Number(grade), courseId, schoolYearId: Number(chosenYear) }), 'Turma criada');
        if (ok) { setCode(''); setGrade(''); }
        first.current?.focus();
      }}>
      <Input ref={first} aria-label="Código da turma" placeholder="Turma (12B)" value={code} onChange={(e) => setCode(e.target.value)} required maxLength={50} />
      <Input aria-label="Classe da turma" type="number" inputMode="numeric" min={1} max={13} placeholder="Classe" value={grade} onChange={(e) => setGrade(e.target.value)} required />
      <NativeSelect aria-label="Ano letivo" value={chosenYear} onChange={(e) => setYear(e.target.value)} required>
        <option value="">Ano letivo…</option>
        {years.map((y) => <option key={y.id} value={y.id}>{y.startYear}–{y.endYear}</option>)}
      </NativeSelect>
      <Button type="submit" variant="outline" disabled={pending || !code.trim() || !grade || !chosenYear}>{pending ? 'A criar…' : <><Plus size={16} className="mr-1" /> Turma</>}</Button>
    </form>
  );
}

function ClassRow({ cls, data, yearId, act, ask }: { cls: StructureClass; data: InstitutionStructure; yearId?: number; act: Act; ask: (s: ConfirmState) => void }) {
  const missing = cls.subjects.filter((s) => s.teachers.length === 0).length;
  return (
    <details className="rounded-md border" data-testid={`class-${cls.code}`}>
      <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
        <strong>{cls.code}</strong>
        <span className="text-muted-foreground">{cls.grade}.ª classe · {cls.studentCount} {cls.studentCount === 1 ? 'aluno' : 'alunos'}</span>
        {cls.subjects.length === 0 ? <span className="text-warning">sem disciplinas (currículo vazio para esta classe)</span> : missing > 0 ? <span className="text-warning">{missing} sem professor</span> : <span className="text-success">completa</span>}
        <Button type="button" variant="ghost" size="sm" className="ml-auto hover:bg-danger-soft hover:text-destructive" aria-label={`Apagar turma ${cls.code}`}
          onClick={(e) => {
            e.preventDefault();
            ask({
              title: 'Apagar esta turma?', destructive: true, action: 'Apagar',
              description: `A turma ${cls.code} sai da lista. Só é possível se não tiver matrículas nem professores atribuídos.`,
              run: () => { void act(() => deleteRow('classes', cls.id), 'Turma movida para a lixeira'); },
            });
          }}>
          <Trash2 size={15} />
        </Button>
      </summary>
      <ul className="grid gap-2 border-t p-3">
        {cls.subjects.map((s) => (
          <li key={s.subjectId} className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center" data-testid={`subject-${cls.code}-${s.code}`}>
            <div>
              <div className="text-sm font-medium">{s.name}</div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {s.teachers.length === 0 ? <span className="text-xs text-warning">Sem professor</span> : null}
                {s.teachers.map((t) => (
                  <span key={t.assignmentId} className="inline-flex items-center gap-1 rounded-full bg-accent py-0.5 pr-1 pl-2.5 text-xs">
                    {t.firstName} {t.lastName}
                    <button type="button" aria-label={`Retirar ${t.firstName} ${t.lastName} de ${s.name}`} className="rounded-full p-0.5 hover:bg-danger-soft hover:text-destructive"
                      onClick={() => ask({
                        title: 'Retirar o professor?', destructive: true, action: 'Retirar',
                        description: `${t.firstName} ${t.lastName} deixa de dar ${s.name} na turma ${cls.code}.`,
                        run: () => { void act(() => unassignTeacher(t.assignmentId), 'Professor retirado'); },
                      })}><X size={12} /></button>
                  </span>
                ))}
              </div>
            </div>
            <AssignTeacher cls={cls} subject={s} data={data} yearId={yearId} act={act} />
          </li>
        ))}
      </ul>
    </details>
  );
}

function AssignTeacher({ cls, subject, data, yearId, act }: { cls: StructureClass; subject: StructureClass['subjects'][number]; data: InstitutionStructure; yearId?: number; act: Act }) {
  const [teacherId, setTeacherId] = useState('');
  const options = teachersToAssign(data.teachers, subject);
  const pending = useContext(Pending);
  const first = useRef<HTMLSelectElement>(null);
  if (!yearId) return null;
  return (
    <form className="flex gap-2" aria-label={`Atribuir professor a ${subject.name} em ${cls.code}`} aria-busy={pending}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!teacherId) return;
        const ok = await act(() => assignTeacher({ teacherId: Number(teacherId), classId: cls.id, subjectId: subject.subjectId, schoolYearId: yearId }), 'Professor atribuído');
        if (ok) setTeacherId('');
        first.current?.focus();
      }}>
      <NativeSelect ref={first} aria-label={`Professor de ${subject.name}`} value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="min-w-44">
        <option value="">{options.length ? 'Professor…' : 'Sem professores livres'}</option>
        {options.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
      </NativeSelect>
      <Button type="submit" size="sm" variant="outline" disabled={pending || !teacherId}>{pending ? 'A atribuir…' : 'Atribuir'}</Button>
    </form>
  );
}

function TeachersCard({ data, opts, institutionId, act, ask }: { data: InstitutionStructure; opts: Opts; institutionId: number; act: Act; ask: (s: ConfirmState) => void }) {
  const [teacherId, setTeacherId] = useState('');
  const free = teachersToAffiliate(opts.teachers as { id: number; firstName: string; lastName: string }[], data.teachers);
  const pending = useContext(Pending);
  const first = useRef<HTMLSelectElement>(null);
  return (
    <Card className="mt-6" data-testid="teachers-card">
      <CardContent className="grid gap-3 p-4 md:p-5">
        <h2 className="flex items-center gap-2 font-semibold"><UserPlus size={16} /> Professores da escola</h2>
        <p className="text-sm text-muted-foreground">Um professor pode dar aulas em várias escolas: afilie-o a cada uma e atribua-o às disciplinas das turmas.</p>
        {data.teachers.length === 0 ? <p className="text-sm text-muted-foreground">Ainda não há professores afiliados.</p> : (
          <ul className="grid gap-2">
            {data.teachers.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
                <span><strong>{t.firstName} {t.lastName}</strong> <span className="text-muted-foreground">· {t.assignments} {t.assignments === 1 ? 'disciplina' : 'disciplinas'} nesta escola</span></span>
                <Button variant="ghost" size="sm" className="hover:bg-danger-soft hover:text-destructive" aria-label={`Desafiliar ${t.firstName} ${t.lastName}`} disabled={t.assignments > 0} title={t.assignments > 0 ? 'Retire primeiro as atribuições' : undefined}
                  onClick={() => ask({
                    title: 'Desafiliar o professor?', destructive: true, action: 'Desafiliar',
                    description: `${t.firstName} ${t.lastName} deixa de pertencer a esta escola (continua nas outras).`,
                    run: () => { void act(() => setInstitutionLink(institutionId, 'teachers', t.id, false), 'Professor desafiliado'); },
                  })}><Trash2 size={15} /></Button>
              </li>
            ))}
          </ul>
        )}
        <form className="flex gap-2" aria-label="Afiliar professor" aria-busy={pending}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!teacherId) return;
            const ok = await act(() => setInstitutionLink(institutionId, 'teachers', Number(teacherId), true), 'Professor afiliado');
            if (ok) setTeacherId('');
            first.current?.focus();
          }}>
          <NativeSelect ref={first} aria-label="Professor a afiliar" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">{free.length ? 'Afiliar professor…' : 'Todos os professores já estão aqui'}</option>
            {free.map((t) => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
          </NativeSelect>
          <Button type="submit" variant="outline" disabled={pending || !teacherId}>{pending ? 'A afiliar…' : 'Afiliar'}</Button>
        </form>
        {opts.teachers.length === 0 ? <p className="text-xs text-muted-foreground">Não há professores no sistema. <Link className="underline" href="/teachers/new">Criar professor</Link>.</p> : null}
      </CardContent>
    </Card>
  );
}
