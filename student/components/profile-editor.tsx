'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { CircleAlert, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { atualizarPerfilAction } from '@/lib/profile-actions';
import type { Me } from '@/lib/types';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? 'A guardar…' : 'Guardar'}
    </Button>
  );
}

/** Editor de nome e foto, no próprio cartão do perfil — sem modal, para não trazer o
 *  Dialog (e a dependência do Radix) para o app do aluno. */
export function ProfileEditor({ me, onDone }: { me: Me; onDone: () => void }) {
  const [state, action] = useActionState(atualizarPerfilAction, undefined);
  const router = useRouter();

  useEffect(() => {
    if (!state?.saved) return;
    onDone();
    // /me is fetched with no-store, so a refresh is what brings the new values back.
    router.refresh();
  }, [state?.saved, onDone, router]);

  return (
    <form action={action} className="grid gap-4 border-t px-5 py-5">
      <FieldGroup className="gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="firstName">Nome</FieldLabel>
            <Input
              id="firstName"
              name="firstName"
              defaultValue={me.first_name ?? ''}
              autoComplete="given-name"
              maxLength={100}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="lastName">Apelido</FieldLabel>
            <Input
              id="lastName"
              name="lastName"
              defaultValue={me.last_name ?? ''}
              autoComplete="family-name"
              maxLength={100}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="photo">Foto (endereço)</FieldLabel>
          <Input
            id="photo"
            name="photo"
            type="url"
            inputMode="url"
            defaultValue={me.photo ?? ''}
            placeholder="https://…"
            autoComplete="photo"
            maxLength={500}
          />
          <FieldDescription>
            O endereço de uma imagem que já esteja online. Sem foto, ficam as tuas iniciais.
          </FieldDescription>
        </Field>
      </FieldGroup>

      {state?.error && (
        <Alert variant="info">
          <CircleAlert />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-2">
        <Submit />
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
