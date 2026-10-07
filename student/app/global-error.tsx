'use client';

import { useEffect } from 'react';

/**
 * Última rede de segurança do app do aluno: apanha falhas no próprio
 * root layout, onde `app/error.tsx` não chega. Por isso traz o seu
 * próprio <html>/<body> e estilos inline (o globals.css do layout
 * pode não ter carregado).
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#f7f5ef', color: '#1c1a15' }}>
        <main style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: 16 }}>
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              background: '#fff',
              border: '1px solid #e5e0d3',
              borderRadius: 12,
              padding: '24px 20px',
              textAlign: 'center',
              display: 'grid',
              gap: 8,
              justifyItems: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Algo falhou, mas não perdeste nada</p>
            <p style={{ margin: 0, fontSize: 14, opacity: 0.75 }}>
              Verifica a ligação à internet e tenta de novo. Se continuar, fala com o teu professor.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 8,
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid #1f5a2c',
                background: '#1f5a2c',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Tentar de novo
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
