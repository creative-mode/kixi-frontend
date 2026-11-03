'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/** Fronteira de erro do gestor: nenhuma falha de render parte o ecrã inteiro.
 *  Mostra o que falhou e dois caminhos — tentar de novo ou voltar ao início. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-7xl place-items-center p-6 md:p-8">
      <Card className="w-full max-w-lg">
        <CardContent>
          <div role="alert" className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
            <TriangleAlert className="size-5 text-warning" aria-hidden />
            <p className="text-base font-semibold text-foreground">Algo falhou, mas não perdeste nada</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Tenta de novo. Se continuar, volta ao início e segue a partir daí.
            </p>
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              <Button type="button" onClick={reset}>
                Tentar de novo
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Voltar ao início</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
