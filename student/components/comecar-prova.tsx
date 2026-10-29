'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { iniciarAction } from '@/lib/exam-actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/** First run of a statement. Nothing starts until the student says so, because
 *  `POST /simulations` starts the server's clock the moment it lands — a room that
 *  began on render would burn the student's time on a page they never opened. */
export function Comecar({ statementId }: { statementId: number }) {
  const [state, action, pending] = useActionState(iniciarAction, undefined);

  return (
    <div className="mx-auto grid above-banner-min-h max-w-[760px] place-items-center p-6">
      <Card className="w-full max-w-md gap-4 p-6">
        <CardContent className="grid gap-4">
          <div className="grid gap-1.5">
            <h1 className="text-[20px] font-bold tracking-tight">Começar a prova</h1>
            <p className="text-sm text-muted-foreground">
              O tempo começa no servidor assim que carregares. Se saíres, voltas a esta prova
              mais tarde e continuas onde ficaste.
            </p>
          </div>
          {state?.error && (
            <p role="alert" className="text-[13px] font-medium text-destructive">{state.error}</p>
          )}
          <form action={action} className="grid gap-2.5">
            <input type="hidden" name="statementId" value={String(statementId)} />
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Começar
            </Button>
          </form>
          <Button asChild variant="ghost" className="text-primary">
            <Link href="/provas">Voltar às provas</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
