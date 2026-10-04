'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, Field, Icon } from './kixi';
import { cadastroAction, entrarAction, type FormState } from '@/lib/auth-actions';

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" block disabled={pending} aria-busy={pending}>
      {pending ? 'A processar…' : children}
    </Button>
  );
}

function ErrorBox({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return (
    <p role="alert" className="kx-scope" style={{ margin: 0, display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', border: '2px solid var(--danger, #c0392b)', color: 'var(--danger, #c0392b)', font: '600 14px/20px var(--font-sans)' }}>
      <Icon name="cross" size={14} />
      <span>{state.error}</span>
    </p>
  );
}

export function EntrarForm() {
  const [state, action] = useActionState(entrarAction, undefined);
  return (
    <>
      <form action={action} className="stack" style={{ gap: 16 }} noValidate>
        <ErrorBox state={state} />
        <Field name="usernameOrEmail" label="Utilizador ou email" placeholder="ex.: 12345" autoComplete="username" defaultValue={state?.fields?.usernameOrEmail} required />
        <Field name="password" label="Palavra-passe" type="password" autoComplete="current-password" required />
        <Submit>Entrar</Submit>
      </form>
      <p style={{ margin: '24px 0 0', textAlign: 'center', font: '400 14px/22px var(--font-sans)' }} className="muted">
        Ainda não tens conta? <Link href="/cadastro" style={{ fontWeight: 600 }}>Criar conta</Link>
      </p>
    </>
  );
}

export function CadastroForm() {
  const [state, action] = useActionState(cadastroAction, undefined);
  const v = state?.fields ?? {};
  return (
    <>
      <form action={action} className="stack" style={{ gap: 14 }} noValidate>
        <ErrorBox state={state} />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12 }}>
          <Field name="firstName" label="Nome" autoComplete="given-name" defaultValue={v.firstName} required />
          <Field name="lastName" label="Apelido" autoComplete="family-name" defaultValue={v.lastName} required />
        </div>
        <Field name="username" label="Utilizador" hint="Número de processo ou o nome que preferires." autoComplete="username" defaultValue={v.username} required />
        <Field name="email" label="Email" type="email" autoComplete="email" defaultValue={v.email} required />
        <Field name="password" label="Palavra-passe" type="password" hint="Pelo menos 8 caracteres." autoComplete="new-password" required />
        <Field name="confirm" label="Repetir palavra-passe" type="password" autoComplete="new-password" required />
        <Submit>Criar conta</Submit>
      </form>
      <p style={{ margin: '20px 0 0', textAlign: 'center', font: '400 14px/22px var(--font-sans)' }} className="muted">
        Já tens conta? <Link href="/entrar" style={{ fontWeight: 600 }}>Entrar</Link>
      </p>
    </>
  );
}
