'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { CircleAlert, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Progress } from '@/components/ui/progress';
import { cadastroAction, entrarAction, type FormState } from '@/lib/auth-actions';

type Errors = Record<string, string>;

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? 'A processar…' : children}
    </Button>
  );
}

function ServerError({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return (
    <Alert variant="destructive">
      <CircleAlert />
      <AlertDescription>{state.error}</AlertDescription>
    </Alert>
  );
}

/** Valida no cliente antes de enviar; o servidor volta a validar. Devolve só os campos com erro. */
function check(form: HTMLFormElement, rules: Record<string, (v: string, all: FormData) => string | undefined>): Errors {
  const data = new FormData(form);
  const out: Errors = {};
  for (const [name, rule] of Object.entries(rules)) {
    const msg = rule(String(data.get(name) ?? '').trim(), data);
    if (msg) out[name] = msg;
  }
  return out;
}

const required = (msg: string) => (v: string) => (v ? undefined : msg);

export function EntrarForm() {
  const [state, action] = useActionState(entrarAction, undefined);
  const [errors, setErrors] = useState<Errors>({});

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const found = check(e.currentTarget, {
      usernameOrEmail: required('Indica o teu utilizador ou email.'),
      password: required('Indica a tua palavra-passe.'),
    });
    setErrors(found);
    if (Object.keys(found).length) e.preventDefault();
  };

  return (
    <div className="grid gap-6">
      <form action={action} onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <ServerError state={state} />
          <Field>
            <FieldLabel htmlFor="usernameOrEmail">Utilizador ou email</FieldLabel>
            <Input id="usernameOrEmail" name="usernameOrEmail" placeholder="ex.: 12345" autoComplete="username" defaultValue={state?.fields?.usernameOrEmail} aria-invalid={!!errors.usernameOrEmail} aria-describedby={errors.usernameOrEmail ? 'usernameOrEmail-err' : undefined} autoFocus />
            <FieldError id="usernameOrEmail-err">{errors.usernameOrEmail}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Palavra-passe</FieldLabel>
            <PasswordInput id="password" name="password" autoComplete="current-password" aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-err' : undefined} />
            <FieldError id="password-err">{errors.password}</FieldError>
          </Field>
          <Submit>Entrar</Submit>
        </FieldGroup>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Ainda não tens conta? <Link href="/cadastro" className="font-semibold text-primary underline-offset-4 hover:underline">Criar conta</Link>
      </p>
    </div>
  );
}

/** 0-4: comprimento, maiúscula e minúscula, número, símbolo. */
function strength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
const LEVELS = [
  { label: 'Muito fraca', tone: 'bg-destructive' },
  { label: 'Fraca', tone: 'bg-destructive' },
  { label: 'Razoável', tone: 'bg-chart-2' },
  { label: 'Boa', tone: 'bg-primary' },
  { label: 'Forte', tone: 'bg-primary' },
];

export function CadastroForm() {
  const [state, action] = useActionState(cadastroAction, undefined);
  const [errors, setErrors] = useState<Errors>({});
  const [pw, setPw] = useState('');
  const v = state?.fields ?? {};
  const level = LEVELS[strength(pw)];

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const found = check(e.currentTarget, {
      firstName: required('Indica o teu nome.'),
      lastName: required('Indica o teu apelido.'),
      username: required('Escolhe um utilizador.'),
      email: (x) => (!x ? 'Indica o teu email.' : /^\S+@\S+\.\S+$/.test(x) ? undefined : 'Este email não parece válido.'),
      password: (x) => (!x ? 'Escolhe uma palavra-passe.' : x.length < 8 ? 'Usa pelo menos 8 caracteres.' : undefined),
      confirm: (x, all) => (x === String(all.get('password') ?? '') ? undefined : 'As palavras-passe não coincidem.'),
    });
    setErrors(found);
    if (Object.keys(found).length) e.preventDefault();
  };
  const bad = (n: string) => ({ 'aria-invalid': !!errors[n], 'aria-describedby': errors[n] ? `${n}-err` : undefined }) as const;

  return (
    <div className="grid gap-6">
      <form action={action} onSubmit={onSubmit} noValidate>
        <FieldGroup className="gap-4">
          <ServerError state={state} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="firstName">Nome</FieldLabel>
              <Input id="firstName" name="firstName" autoComplete="given-name" defaultValue={v.firstName} {...bad('firstName')} />
              <FieldError id="firstName-err">{errors.firstName}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="lastName">Apelido</FieldLabel>
              <Input id="lastName" name="lastName" autoComplete="family-name" defaultValue={v.lastName} {...bad('lastName')} />
              <FieldError id="lastName-err">{errors.lastName}</FieldError>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="username">Utilizador</FieldLabel>
            <Input id="username" name="username" autoComplete="username" defaultValue={v.username} {...bad('username')} />
            {errors.username ? <FieldError id="username-err">{errors.username}</FieldError> : <FieldDescription>O número de processo ou o nome que preferires.</FieldDescription>}
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" name="email" type="email" autoComplete="email" defaultValue={v.email} {...bad('email')} />
            <FieldError id="email-err">{errors.email}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Palavra-passe</FieldLabel>
            <PasswordInput id="password" name="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} {...bad('password')} />
            {pw ? (
              <div className="grid gap-1.5" aria-live="polite">
                <Progress value={(strength(pw) / 4) * 100} indicatorClassName={level.tone} aria-label="Força da palavra-passe" />
                <span className="text-[13px] text-muted-foreground">{level.label}</span>
              </div>
            ) : null}
            {errors.password ? <FieldError id="password-err">{errors.password}</FieldError> : !pw && <FieldDescription>Pelo menos 8 caracteres.</FieldDescription>}
          </Field>
          <Field>
            <FieldLabel htmlFor="confirm">Repetir palavra-passe</FieldLabel>
            <PasswordInput id="confirm" name="confirm" autoComplete="new-password" {...bad('confirm')} />
            <FieldError id="confirm-err">{errors.confirm}</FieldError>
          </Field>
          <Submit>Criar conta</Submit>
        </FieldGroup>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Já tens conta? <Link href="/entrar" className="font-semibold text-primary underline-offset-4 hover:underline">Entrar</Link>
      </p>
    </div>
  );
}
