'use client';

import { useRouter } from 'next/navigation';
import { ErrorState } from './states';

/** ErrorState with a retry wired to a server re-render: used where the failure
 *  happened while fetching, so there is no client state to retry. */
export function RefreshError({ title, message }: { title?: string; message?: string }) {
  const router = useRouter();

  return (
    <ErrorState
      title={title}
      message={message}
      onRetry={() => router.refresh()}
    />
  );
}
