'use client';

import { useEffect } from 'react';

/**
 * Última rede de segurança do gestor: apanha falhas no próprio root layout,
 * onde `app/error.tsx` não chega. Por isso traz o seu próprio <html>/<body> e
 * estilos inline (o globals.css do layout pode não ter carregado) — com os
 * valores dos tokens do design system, para a página de erro ter a mesma cara.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-AO">
      <body
        style={{
          margin: 0,
          fontFamily: 'var(--ff-sans, system-ui, sans-serif)',
          background: 'var(--background, #f6f8f5)',
          color: 'var(--foreground, #121c15)',
        }}
      >
        <main style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', padding: 16 }}>
          <div
            role="alert"
            style={{
              width: '100%',
              maxWidth: 480,
              background: 'var(--card, white)',
              border: '1px solid var(--border, #e1e7de)',
              borderRadius: 12,
              padding: '24px 20px',
              textAlign: 'center',
              display: 'grid',
              gap: 8,
              justifyItems: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Algo falhou.</p>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--muted-foreground, #617066)' }}>
              Tente de novo. Se continuar, feche e volte a entrar.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 8,
                padding: '10px 16px',
                borderRadius: 8,
                border: '1px solid var(--primary, #1f5a2c)',
                background: 'var(--primary, #1f5a2c)',
                color: 'var(--primary-foreground, white)',
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
