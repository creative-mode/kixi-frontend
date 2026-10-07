'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { ArrowLeft, Check, CircleAlert, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { NativeSelect } from '@/components/ui/native-select';
import { EmptyState } from '@/components/states';
import { matricularAction } from '@/lib/enrollment-actions';
import { cn } from '@/lib/utils';
import type { Class, Course } from '@/lib/types';

const STEPS = ['Curso', 'Turma'] as const;

function Submit({ disabled, children }: { disabled: boolean; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={disabled || pending} aria-busy={pending}>
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
              {done ? <Check className="size-3.5" aria-hidden /> : index + 1}
            </span>
            <span className={cn('text-[13px] font-semibold', active ? 'text-foreground' : 'text-muted-foreground')}>
              {label}
            </span>
            {index === 0 && <span className="h-px w-6 bg-border" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

export function OnboardingForm({
  courses,
  classes,
  yearLabel,
}: {
  courses: Course[];
  classes: Class[];
  yearLabel?: string;
}) {
  const [state, action] = useActionState(matricularAction, undefined);
  const [step, setStep] = useState(0);
  const [courseId, setCourseId] = useState('');
  const [classId, setClassId] = useState('');

  const available = useMemo(
    () => classes.filter((item) => item.course?.id === Number(courseId)),
    [classes, courseId],
  );
  const chosen = available.find((item) => item.id === Number(classId));
  const courseName = courses.find((course) => course.id === Number(courseId))?.name;

  return (
    <form action={action} className="grid gap-6">
      <Steps current={step} />

      {/* Kept outside the steps: without JavaScript the form posts and re-renders at
          step one, and the answer still has to be readable. */}
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

      {step === 0 ? (
        <>
          <Field>
            <FieldLabel htmlFor="courseId">Em que curso estás?</FieldLabel>
            <NativeSelect
              id="courseId"
              name="courseId"
              value={courseId}
              onChange={(event) => {
                setCourseId(event.target.value);
                setClassId('');
              }}
            >
              <option value="">Escolhe o teu curso</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </NativeSelect>
            <FieldDescription>É o curso que frequentas na escola, não a disciplina.</FieldDescription>
          </Field>
          <Button type="button" size="lg" className="w-full" disabled={!courseId} onClick={() => setStep(1)}>
            Continuar
          </Button>
        </>
      ) : (
        <>
          {/* The class carries its own school year, so the pair sent to /enrollments
              always matches and the backend's consistency check never fires. */}
          <input type="hidden" name="classId" value={classId} />
          <input type="hidden" name="schoolYearId" value={chosen?.schoolYear?.id ?? ''} />

          {available.length === 0 ? (
            <EmptyState
              title="Sem turmas para este curso"
              message={`Não há turmas de ${courseName ?? 'este curso'}${yearLabel ? ` em ${yearLabel}` : ''}. Escolhe outro curso ou pergunta ao teu professor.`}
            />
          ) : (
            <Field>
              <FieldLabel htmlFor="classId">E em que turma?</FieldLabel>
              <NativeSelect
                id="classId"
                name="classId"
                value={classId}
                onChange={(event) => setClassId(event.target.value)}
              >
                <option value="">Escolhe a tua turma</option>
                {available.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.grade ? `${item.grade}ª · ` : ''}
                    {item.code}
                  </option>
                ))}
              </NativeSelect>
              <FieldDescription>
                {yearLabel ? `Ano letivo ${yearLabel}.` : 'A turma onde estás matriculado.'}
              </FieldDescription>
            </Field>
          )}

          <div className="grid gap-2">
            <Submit disabled={!classId}>Entrar na turma</Submit>
            <Button type="button" variant="ghost" onClick={() => setStep(0)}>
              <ArrowLeft aria-hidden />
              Voltar ao curso
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
