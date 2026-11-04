'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/states';
import { ErrorView } from '@/components/analytics/trackers';

/** Fronteira de erro dentro da área autenticada (mantém o Shell visível). */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <ErrorView app="student" kind="unexpected" />
      <ErrorState onRetry={reset} />
    </>
  );
}
