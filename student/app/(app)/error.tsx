'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/states';

/** Fronteira de erro dentro da área autenticada (mantém o Shell visível). */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorState onRetry={reset} />;
}
