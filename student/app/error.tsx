'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/states';

/** Fronteira de erro global do app do aluno: nenhuma falha parte o ecrã. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto grid w-full max-w-[760px] place-items-center p-4 py-16 md:p-7">
      <div className="w-full rounded-xl border bg-card px-5 py-6">
        <ErrorState onRetry={reset} />
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/inicio">Voltar ao início</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
