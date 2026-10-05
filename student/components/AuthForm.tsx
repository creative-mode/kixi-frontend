'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Field, Icon } from './ui';
import { cadastroAction, entrarAction, type FormState } from '@/lib/auth-actions';

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn--lg btn--block" disabled={pending} aria-busy={pending}>
      {pending ? 'A processar…' : children}
    </button>
  );
}

function ErrorBox({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return (
    <p role="alert" className="alert"><Icon name="info" size={18} /><span>{state.error}</span></p>
  );
}

export function EntrarForm() {
  const [state, action] = useActionState(entrarAction, undefined);
  return (
    <>
      <form action={action} className="form" noValidate>
        <ErrorBox state={state} />
        <Field name="usernameOrEmail" label="Utilizador ou email" placeholder="ex.: 12345" autoComplete="username" defaultValue={state?.fields?.usernameOrEmail} required />
        <Field name="password" label="Palavra-passe" type="password" autoComplete="current-password" required />
        <Submit>Entrar</Submit>
      </form>
      <p className="auth__alt">Ainda não tens conta? <Link href="/cadastro">Criar conta</Link></p>
    </>
  );
}

export function CadastroForm() {
  const [state, action] = useActionState(cadastroAction, undefined);
  const v = state?.fields ?? {};
  return (
    <>
      <form action={action} className="form" noValidate>
        <ErrorBox state={state} />
        <div className="form__row">
          <Field name="firstName" label="Nome" autoComplete="given-name" defaultValue={v.firstName} required />
          <Field name="lastName" label="Apelido" autoComplete="family-name" defaultValue={v.lastName} required />
        </div>
        <Field name="username" label="Utilizador" hint="Número de processo ou o nome que preferires." autoComplete="username" defaultValue={v.username} required />
        <Field name="email" label="Email" type="email" autoComplete="email" defaultValue={v.email} required />
        <Field name="password" label="Palavra-passe" type="password" hint="Pelo menos 8 caracteres." autoComplete="new-password" required />
        <Field name="confirm" label="Repetir palavra-passe" type="password" autoComplete="new-password" required />
        <Submit>Criar conta</Submit>
      </form>
      <p className="auth__alt">Já tens conta? <Link href="/entrar">Entrar</Link></p>
    </>
  );
}
