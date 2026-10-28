'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/states';

/** A falha de uma sala de prova não pode ser contada como a falha de qualquer
 *  página: as respostas já confirmadas estão no servidor e as que iam a caminho
 *  ficam no rascunho local. O texto diz isso, em vez do genérico «não perdeste
 *  nada» do error boundary global (#485). */
export function RoomError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-[760px] place-items-center p-4 py-16 md:p-7">
      <div className="w-full rounded-xl border bg-card px-5 py-6">
        <ErrorState
          title="A sala de prova não abriu"
          message="As respostas que já chegaram ao servidor estão guardadas. As que estavam por enviar ficam neste aparelho e seguem quando reabrires a prova."
          onRetry={reset}
          retryLabel="Tentar abrir outra vez"
        />
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/provas">Voltar às provas</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
