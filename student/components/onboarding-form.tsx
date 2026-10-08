'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { Check, CircleAlert, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { NativeSelect } from '@/components/ui/native-select';
import { EmptyState } from '@/components/states';
import { matricularAction } from '@/lib/enrollment-actions';
import { cn } from '@/lib/utils';
import type { Class, Course, Institution } from '@/lib/types';

const STEPS = ['Escola', 'Curso', 'Turma'] as const;

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? 'A matricular…' : children}
    </Button>
  );
}

/** Progress: filled for the step already chosen, ring for the current one. */
function Steps({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progresso">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'grid size-6 place-items-center rounded-full border text-[11px] font-bold',
                done && 'border-transparent bg-primary text-primary-foreground',
                active && !done && 'border-primary text-primary',
                !done && !active && 'border-border text-muted-foreground',
              )}
            >
              {done ? <Check aria-hidden /> : index + 1}
            </span>
            <span className={cn('text-[13px] font-semibold', active ? 'text-foreground' : 'text-muted-foreground')}>
              {label}
            </span>
            {index < STEPS.length - 1 && <span className="h-px w-4 bg-border md:w-6" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

/** The school and the course are chosen with plain GET forms, so each step is a real
 * navigation: the server reloads with the choice in the URL and asks the backend only for
 * the schools, courses or classes that step shows. That is why there is no filtering in
 * the browser, and why the wizard also works with JavaScript turned off. */
export function OnboardingForm({
  schools,
  courses,
  classes,
  institutionId,
  courseId,
  yearLabel,
}: {
  schools: Institution[];
  courses: Course[];
  classes: Class[];
  institutionId: number | null;
  courseId: number | null;
  yearLabel?: string;
}) {
  const [state, action] = useActionState(matricularAction, undefined);
  const [classId, setClassId] = useState('');

  const step = institutionId === null ? 0 : courseId === null ? 1 : 2;
  const schoolName = schools.find((s) => s.id === institutionId)?.name;
  const courseName = courses.find((c) => c.id === courseId)?.name;
  const chosen = classes.find((c) => c.id === Number(classId));

  return (
    <div className="grid gap-6">
      <Steps current={step} />

      {/* Kept outside the steps: without JavaScript the form posts and re-renders on the
          same URL, and the answer still has to be readable. */}
      {state?.error && (
        <Alert variant="info">
          <CircleAlert />
          <AlertDescription>
            <span>{state.error}</span>
            {state.alreadyEnrolled && (
              <Button asChild variant="link" size="sm" className="h-auto justify-start p-0 text-foreground underline">
                <Link href="/perfil">Ver o teu perfil</Link>
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {step === 0 && (
        <form method="get" action="/onboarding" className="grid gap-6">
          <Field>
            <FieldLabel htmlFor="escola">Em que escola estudas?</FieldLabel>
            <NativeSelect id="escola" name="escola" defaultValue="">
              <option value="">Escolhe a tua escola</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </NativeSelect>
            <FieldDescription>É a escola onde frequentas, não o curso.</FieldDescription>
          </Field>
          <Button type="submit" size="lg" className="w-full">
            Continuar
          </Button>
        </form>
      )}

      {step === 1 && (
        <form method="get" action="/onboarding" className="grid gap-6">
          <input type="hidden" name="escola" value={institutionId ?? ''} />
          <Field>
            <FieldLabel htmlFor="curso">E em que curso?</FieldLabel>
            {courses.length === 0 ? (
              <EmptyState
                title="Sem cursos nesta escola"
                message={`${schoolName ?? 'Esta escola'} não tem cursos publicados${yearLabel ? ` em ${yearLabel}` : ''}. Escolhe outra escola ou pergunta ao teu professor.`}
                action={
                  <Button asChild variant="outline">
                    <Link href="/onboarding">Voltar à escola</Link>
                  </Button>
                }
              />
            ) : (
              <NativeSelect id="curso" name="curso" defaultValue="">
                <option value="">Escolhe o teu curso</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.name}
                  </option>
                ))}
              </NativeSelect>
            )}
            {courses.length > 0 && (
              <FieldDescription>É o curso que frequentas na escola, não a disciplina.</FieldDescription>
            )}
          </Field>
          <div className="grid gap-2">
            <Button type="submit" size="lg" className="w-full">
              Continuar
            </Button>
            <Button asChild variant="ghost">
              <Link href="/onboarding">Voltar à escola</Link>
            </Button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form action={action} className="grid gap-6">
          {/* The class carries its own school year, so the pair sent to /enrollments
              always matches and the backend's consistency check never fires. */}
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="schoolYearId" value={chosen?.schoolYear?.id ?? ''} />

          <Field>
            <FieldLabel htmlFor="classId">E em que turma?</FieldLabel>
            {classes.length === 0 ? (
              <EmptyState
                title="Sem turmas neste curso"
                message={`Não há turmas de ${courseName ?? 'este curso'}${yearLabel ? ` em ${yearLabel}` : ''}. Escolhe outro curso ou pergunta ao teu professor.`}
                action={
                  <Button asChild variant="outline">
                    <Link href={`/onboarding?escola=${institutionId}`}>Voltar ao curso</Link>
                  </Button>
                }
              />
            ) : (
              <>
                <NativeSelect
                  id="classId"
                  value={classId}
                  onChange={(event) => setClassId(event.target.value)}
                >
                  <option value="">Escolhe a tua turma</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.grade ? `${item.grade}ª · ` : ''}
                      {item.code}
                    </option>
                  ))}
                </NativeSelect>
                <FieldDescription>
                  {yearLabel ? `Ano letivo ${yearLabel}.` : 'A turma onde estás matriculado.'}
                </FieldDescription>
              </>
            )}
          </Field>

          <div className="grid gap-2">
            {classes.length > 0 && <Submit>Entrar na turma</Submit>}
            <Button asChild variant="ghost">
              <Link href={`/onboarding?escola=${institutionId}`}>Voltar ao curso</Link>
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}