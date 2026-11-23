'use client';

import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface ConfirmState {
  title: string;
  description: string;
  action: string;
  /** Text of the cancel button (defaults to «Cancelar»). */
  cancelLabel?: string;
  /** Runs when the user explicitly picks the cancel button (not on Esc or outside click). */
  onCancel?: () => void;
  /** Block Esc so the dialog only closes through one of its two buttons. */
  requireChoice?: boolean;
  destructive?: boolean;
  /** Pede um motivo antes de confirmar (ações auditadas, kixi#596): a ação só se liga com `min` caracteres e `run` recebe-o. */
  reason?: { label: string; min: number };
  /** Return false (or throw) to leave the dialog open so the user can recover. */
  run: (reason: string) => unknown | Promise<unknown>;
  busyLabel?: string;
  cancelRun?: () => unknown | Promise<unknown>;
  /** Text of the cancel button while `cancelRun` is in progress. */
  cancelBusyLabel?: string;
}

/** One confirmation dialog for a whole list: set `state` to open it, null to close. */
export function Confirm({ state, onClose }: { state: ConfirmState | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  // Cada confirmação começa com o motivo vazio (a mesma instância serve a lista toda).
  const [seen, setSeen] = useState(state);
  if (state !== seen) { setSeen(state); setReason(''); }
  const close = () => { if (!busy) onClose(); };
  const needsReason = state?.reason;
  const reasonOk = !needsReason || reason.trim().length >= needsReason.min;
  return (
    <AlertDialog open={!!state} onOpenChange={(open) => !open && close()}>
      <AlertDialogContent onEscapeKeyDown={(event) => { if (state?.requireChoice) event.preventDefault(); }}>
        <AlertDialogHeader>
          <AlertDialogTitle>{state?.title}</AlertDialogTitle>
          <AlertDialogDescription>{state?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {needsReason ? (
          <div className="grid gap-1.5">
            <label htmlFor="confirm-reason" className="text-sm font-medium">{needsReason.label}</label>
            <Textarea
              id="confirm-reason"
              value={reason}
              maxLength={500}
              rows={3}
              onChange={(event) => setReason(event.target.value)}
              aria-describedby="confirm-reason-hint"
            />
            <p id="confirm-reason-hint" className="text-xs text-muted-foreground">
              Fica registado na auditoria, com o seu nome. Pelo menos {needsReason.min} caracteres.
            </p>
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} onClick={async (event) => {
            state?.onCancel?.();
            if (!state?.cancelRun) return;
            event.preventDefault();
            if (busy) return;
            setBusy(true);
            try {
              const result = await state.cancelRun();
              if (result !== false) onClose();
            } catch {
              // Keep the dialog open if the alternative action cannot complete.
            } finally { setBusy(false); }
          }}>{busy && state?.cancelBusyLabel ? state.cancelBusyLabel : (state?.cancelLabel ?? 'Cancelar')}</AlertDialogCancel>
          <AlertDialogAction
            className={state?.destructive ? 'bg-destructive text-destructive-foreground' : undefined}
            disabled={busy || !reasonOk}
            onClick={async (event) => {
              event.preventDefault();
              const run = state?.run;
              if (!run || busy || !reasonOk) return;
              setBusy(true);
              try {
                const result = await run(reason.trim());
                if (result !== false) onClose();
              } catch {
                // The calling action presents the error; retain the dialog for retry.
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? (state?.busyLabel ?? 'A processar…') : state?.action}
          </AlertDialogAction>
          {busy ? <span role="status" className="sr-only">{state?.busyLabel ?? 'A processar…'}</span> : null}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
