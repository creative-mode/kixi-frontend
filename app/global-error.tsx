'use client';

import { useEffect } from 'react';

/** Última fronteira de erro do gestor, incluindo falhas no layout principal. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-AO">
      <body style={{ margin: 0, minHeight: '100dvh', display: 'grid', placeItems: 'center', fontFamily: 'system-ui, sans-serif', background: '#f6f8f5', color: '#172017' }}>
        <main style={{ maxWidth: 480, padding: 24, textAlign: 'center' }}>
          <h1>Ocorreu um erro</h1>
          <p>Não foi possível carregar esta página. Volte a tentar.</p>
          <button type="button" onClick={reset}>Tentar novamente</button>
        </main>
      </body>
    </html>
  );
}
