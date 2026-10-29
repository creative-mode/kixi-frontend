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
type Rules = Record<string, (value: string, all: FormData) => string | undefined>;
type ErrorSetter = React.Dispatch<React.SetStateAction<Errors>>;

function Submit({ children, testId }: { children: React.ReactNode; testId?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending} data-testid={testId}>
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
function check(form: HTMLFormElement, rules: Rules): Errors {
  const data = new FormData(form);
  const out: Errors = {};
  for (const [name, rule] of Object.entries(rules)) {
    const msg = rule(String(data.get(name) ?? '').trim(), data);
    if (msg) out[name] = msg;
  }
  return out;
}

const required = (msg: string) => (v: string) => (v ? undefined : msg);

function focusFirstError(form: HTMLFormElement, errors: Errors) {
  const first = Object.keys(errors)[0];
  if (!first) return;
  window.requestAnimationFrame(() => form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus());
}

function validateField(form: HTMLFormElement | null, name: string, rules: Rules, setErrors: ErrorSetter) {
  if (!form || !rules[name]) return;
  const found = check(form, { [name]: rules[name] });
  setErrors((current) => {
    const next = { ...current };
    if (found[name]) next[name] = found[name];
    else delete next[name];
    return next;
  });
}

const loginRules: Rules = {
  usernameOrEmail: required('Indica o teu utilizador ou email.'),
  password: required('Indica a tua palavra-passe.'),
};

const signupRules: Rules = {
  firstName: required('Indica o teu nome.'),
  lastName: required('Indica o teu apelido.'),
  username: required('Escolhe um utilizador.'),
  email: (x) => (!x ? 'Indica o teu email.' : /^\S+@\S+\.\S+$/.test(x) ? undefined : 'Este email não parece válido.'),
  password: (x) => (!x ? 'Escolhe uma palavra-passe.' : x.length < 8 ? 'Usa pelo menos 8 caracteres.' : undefined),
  confirm: (x, all) => (x === String(all.get('password') ?? '') ? undefined : 'As palavras-passe não coincidem.'),
};

export function EntrarForm() {
  const [state, action] = useActionState(entrarAction, undefined);
  const [errors, setErrors] = useState<Errors>({});

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;
    const found = check(form, loginRules);
    setErrors(found);
    if (Object.keys(found).length) {
      e.preventDefault();
      focusFirstError(form, found);
    }
  };

  return (
    <div className="grid gap-6">
      <form action={action} onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <ServerError state={state} />
          <Field>
            <FieldLabel htmlFor="usernameOrEmail">Utilizador ou email</FieldLabel>
            <Input id="usernameOrEmail" name="usernameOrEmail" placeholder="ex.: 12345" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} defaultValue={state?.fields?.usernameOrEmail} aria-invalid={!!errors.usernameOrEmail} aria-describedby={errors.usernameOrEmail ? 'usernameOrEmail-err' : undefined} onBlur={(e) => validateField(e.currentTarget.form, 'usernameOrEmail', loginRules, setErrors)} />
            <FieldError id="usernameOrEmail-err">{errors.usernameOrEmail}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Palavra-passe</FieldLabel>
            <PasswordInput id="password" name="password" autoComplete="current-password" aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-err' : undefined} onBlur={(e) => validateField(e.currentTarget.form, 'password', loginRules, setErrors)} />
            <FieldError id="password-err">{errors.password}</FieldError>
          </Field>
          <Submit testId="aluno-entrar-submeter">Entrar</Submit>
        </FieldGroup>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Ainda não tens conta? <Link href="/cadastro" className="inline-flex min-h-11 items-center px-1 font-semibold text-primary underline-offset-4 hover:underline">Criar conta</Link>
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
    const form = e.currentTarget;
    const found = check(form, signupRules);
    setErrors(found);
    if (Object.keys(found).length) {
      e.preventDefault();
      focusFirstError(form, found);
    }
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
              <Input id="firstName" name="firstName" autoComplete="given-name" autoCapitalize="words" defaultValue={v.firstName} onBlur={(e) => validateField(e.currentTarget.form, 'firstName', signupRules, setErrors)} {...bad('firstName')} />
              <FieldError id="firstName-err">{errors.firstName}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="lastName">Apelido</FieldLabel>
              <Input id="lastName" name="lastName" autoComplete="family-name" autoCapitalize="words" defaultValue={v.lastName} onBlur={(e) => validateField(e.currentTarget.form, 'lastName', signupRules, setErrors)} {...bad('lastName')} />
              <FieldError id="lastName-err">{errors.lastName}</FieldError>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="username">Utilizador</FieldLabel>
            <Input id="username" name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} defaultValue={v.username} onBlur={(e) => validateField(e.currentTarget.form, 'username', signupRules, setErrors)} {...bad('username')} />
            {errors.username ? <FieldError id="username-err">{errors.username}</FieldError> : <FieldDescription>O número de processo ou o nome que preferires.</FieldDescription>}
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" defaultValue={v.email} onBlur={(e) => validateField(e.currentTarget.form, 'email', signupRules, setErrors)} {...bad('email')} />
            <FieldError id="email-err">{errors.email}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Palavra-passe</FieldLabel>
            <PasswordInput id="password" name="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} onBlur={(e) => validateField(e.currentTarget.form, 'password', signupRules, setErrors)} {...bad('password')} />
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
            <PasswordInput id="confirm" name="confirm" autoComplete="new-password" onBlur={(e) => validateField(e.currentTarget.form, 'confirm', signupRules, setErrors)} {...bad('confirm')} />
            <FieldError id="confirm-err">{errors.confirm}</FieldError>
          </Field>
          <Submit testId="aluno-cadastro-submeter">Criar conta</Submit>
        </FieldGroup>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Já tens conta? <Link href="/entrar" className="inline-flex min-h-11 items-center px-1 font-semibold text-primary underline-offset-4 hover:underline">Entrar</Link>
      </p>
    </div>
  );
}
