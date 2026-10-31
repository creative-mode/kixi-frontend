'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { studentRecoveryMessage } from '@/lib/recovery';

export function RecoverForm() {
  const [identifier, setIdentifier] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="grid gap-6">
      <form
        method="post"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
        }}
        noValidate
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="identifier">Utilizador ou email</FieldLabel>
            <Input
              id="identifier"
              name="identifier"
              placeholder="ex.: 12345"
              autoComplete="username email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          </Field>
          <Button type="submit" size="lg" className="w-full">Continuar</Button>
        </FieldGroup>
      </form>

      {submitted ? (
        <div role="status" aria-live="polite" className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{studentRecoveryMessage(identifier)}</span>
        </div>
      ) : null}

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/entrar" className="inline-flex min-h-11 items-center px-1 font-semibold text-primary underline-offset-4 hover:underline">
          Voltar a entrar
        </Link>
      </p>
    </div>
  );
}
