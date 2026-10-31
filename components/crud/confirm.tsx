'use client';

import { useState } from 'react';
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
  destructive?: boolean;
  /** Return false (or throw) to leave the dialog open so the user can recover. */
  run: () => unknown | Promise<unknown>;
  busyLabel?: string;
  cancelRun?: () => unknown | Promise<unknown>;
  cancelLabel?: string;
}

/** One confirmation dialog for a whole list: set `state` to open it, null to close. */
export function Confirm({ state, onClose }: { state: ConfirmState | null; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const close = () => { if (!busy) onClose(); };
  return (
    <AlertDialog open={!!state} onOpenChange={(open) => !open && close()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state?.title}</AlertDialogTitle>
          <AlertDialogDescription>{state?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy} onClick={async (event) => {
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
          }}>{busy && state?.cancelLabel ? state.cancelLabel : 'Cancelar'}</AlertDialogCancel>
          <AlertDialogAction
            className={state?.destructive ? 'bg-destructive text-destructive-foreground' : undefined}
            disabled={busy}
            onClick={async (event) => {
              event.preventDefault();
              const run = state?.run;
              if (!run || busy) return;
              setBusy(true);
              try {
                const result = await run();
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
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
