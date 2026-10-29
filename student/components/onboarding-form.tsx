'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';
import { CircleAlert, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { matricularAction } from '@/lib/enrollment-actions';
import { sairAction } from '@/lib/auth-actions';

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? 'A matricular…' : children}
    </Button>
  );
}

/** O código é a única coisa que o aluno envia: é ele que resolve a turma e o ano letivo
 *  no backend (`EnrollmentService#resolveBySelfEnrollCode`, kixi#255). O ecrã deixou de
 *  pedir escola/curso/turma — escolhas que o servidor ignorava na auto-matrícula — e
 *  ficou com um campo. A server action devolve o erro na própria resposta, por isso o
 *  formulário também funciona sem JavaScript. */
export function OnboardingForm() {
  const [state, action] = useActionState(matricularAction, undefined);
  const [codeError, setCodeError] = useState('');

  const validateCode = (value: string) => (value.trim() ? '' : 'Indica o código de matrícula que a tua escola te deu.');
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    const error = validateCode(String(new FormData(form).get('codigo') ?? ''));
    setCodeError(error);
    if (error) {
      event.preventDefault();
      window.requestAnimationFrame(() => form.querySelector<HTMLInputElement>('#codigo')?.focus());
    }
  };

  return (
    <div className="grid gap-6">
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

      <form action={action} onSubmit={onSubmit} noValidate className="grid gap-6">
        <Field>
          <FieldLabel htmlFor="codigo">Código de matrícula</FieldLabel>
          <Input
            id="codigo"
            name="codigo"
            type="text"
            required
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="Ex.: AB3DK9F2"
            className="font-mono uppercase tracking-wider"
            aria-invalid={!!codeError}
            aria-describedby={codeError ? 'codigo-err' : undefined}
            onBlur={(event) => setCodeError(validateCode(event.currentTarget.value))}
            onChange={() => setCodeError('')}
          />
          <FieldError id="codigo-err">{codeError}</FieldError>
          <FieldDescription>
            O código que a tua escola te deu. É ele que decide a tua turma e o ano letivo.
          </FieldDescription>
        </Field>
        <Submit>Entrar na turma</Submit>
      </form>

      <div className="grid gap-3 text-sm text-muted-foreground">
        <p>Ainda não tens código? Pede-o à tua escola ou ao teu professor. É a escola que o emite.</p>
        <form action={sairAction}>
          <Button type="submit" variant="outline" className="w-full">Terminar sessão</Button>
        </form>
      </div>
    </div>
  );
}
