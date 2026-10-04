'use client';

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
  run: () => void | Promise<void>;
}

/** One confirmation dialog for a whole list: set `state` to open it, null to close. */
export function Confirm({ state, onClose }: { state: ConfirmState | null; onClose: () => void }) {
  return (
    <AlertDialog open={!!state} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state?.title}</AlertDialogTitle>
          <AlertDialogDescription>{state?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className={state?.destructive ? 'bg-destructive text-destructive-foreground' : undefined}
            onClick={async () => {
              const run = state?.run;
              onClose();
              await run?.();
            }}
          >
            {state?.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
