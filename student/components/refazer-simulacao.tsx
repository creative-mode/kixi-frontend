'use client';

import { useActionState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { iniciarAction } from '@/lib/exam-actions';
import { Button } from '@/components/ui/button';

/** Starts a new attempt of the same paper. It reuses `iniciarAction` on purpose: it is
 *  the same `POST /simulations`, and the room then opens the attempt in progress
 *  (an attempt in progress always wins over a finished one). A refusal — the paper is
 *  now only for an exam room, say — lands next to the button. */
export function RefazerSimulacao({ statementId }: { statementId: number }) {
  const [state, action, pending] = useActionState(iniciarAction, undefined);
  return (
    <form action={action} className="grid gap-1.5">
      <input type="hidden" name="statementId" value={String(statementId)} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <RotateCcw aria-hidden />}
        Refazer simulação
      </Button>
      {state?.error && <p role="alert" className="text-[13px] font-medium text-destructive">{state.error}</p>}
    </form>
  );
}
