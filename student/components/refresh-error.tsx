'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isRetryable } from '@/lib/error-messages';
import { Button } from '@/components/ui/button';
import { ErrorState } from './states';

/** ErrorState with a retry wired to a server re-render: used where the failure
 *  happened while fetching, so there is no client state to retry.
 *  `status` decides se "Tentar de novo" faz sentido (num 404 não faz) e `back` dá sempre
 *  uma saída, para as páginas que vivem fora da barra de navegação. */
export function RefreshError({
  title,
  message,
  status,
  back,
}: {
  title?: string;
  message?: string;
  status?: number;
  back?: { href: string; label: string };
}) {
  const router = useRouter();
  const retry = status === undefined || isRetryable(status);

  return (
    <div className="grid justify-items-center">
      <ErrorState title={title} message={message} onRetry={retry ? () => router.refresh() : undefined} />
      {back && (
        <Button asChild variant="outline">
          <Link href={back.href}>{back.label}</Link>
        </Button>
      )}
    </div>
  );
}
