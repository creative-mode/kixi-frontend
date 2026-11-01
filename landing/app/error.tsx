'use client';

import { useEffect } from 'react';

/** Fronteira de erro pública em português de Angola. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="lp-stack" style={{ maxWidth: 640, margin: '10vh auto', padding: 24, textAlign: 'center' }}>
      <h1>Ocorreu um erro</h1>
      <p>Não foi possível carregar esta página. Volta a tentar.</p>
      <button type="button" onClick={reset}>Tentar novamente</button>
    </main>
  );
}
