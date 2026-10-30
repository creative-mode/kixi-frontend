'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KixiLogo } from '@/components/kixi-logo';
import { managerRecoveryMessage } from '@/lib/recovery';

export default function RecuperarPage() {
  const [identifier, setIdentifier] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const message = managerRecoveryMessage(identifier);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10">
      <div className="flex items-center gap-3">
        <KixiLogo size={28} wordmark />
        <span className="rounded-full border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">Manager</span>
      </div>
      <div className="grid w-full max-w-[400px] gap-6 rounded-xl border bg-card p-6 shadow-xs sm:p-8">
        <div className="grid gap-1.5">
          <h1 className="text-2xl leading-tight font-bold tracking-tight">Recuperar palavra-passe</h1>
          <p className="text-sm text-muted-foreground">Indica o utilizador ou email da conta.</p>
        </div>

        <form
          method="post"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
          }}
          className="grid gap-5"
        >
          <div className="grid gap-2">
            <Label htmlFor="identifier">Username ou email</Label>
            <Input
              id="identifier"
              name="identifier"
              type="text"
              placeholder="admin@kixi.ao"
              autoComplete="username email"
              autoFocus
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          </div>
          <Button type="submit" size="lg" className="w-full">Continuar</Button>
        </form>

        {submitted ? (
          <div role="status" aria-live="polite" className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{message}</span>
          </div>
        ) : null}

        <Link
          href="/login"
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Voltar a iniciar sessão
        </Link>
      </div>
      <p className="text-center text-xs text-muted-foreground">Problemas no acesso? Contacte o suporte técnico.</p>
    </main>
  );
}
