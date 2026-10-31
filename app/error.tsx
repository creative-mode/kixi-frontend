'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

/** Fronteira de erro do gestor com mensagens em português de Angola. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-[70vh] place-items-center p-6">
      <section className="grid max-w-lg justify-items-center gap-4 rounded-xl border bg-card p-8 text-center">
        <h1 className="text-2xl font-bold">Ocorreu um erro</h1>
        <p className="text-muted-foreground">Não foi possível carregar esta página. Volte a tentar.</p>
        <Button onClick={reset}>Tentar novamente</Button>
      </section>
    </main>
  );
}
