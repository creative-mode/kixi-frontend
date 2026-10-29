'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const BASE_INTERVAL_MS = 12_000;
const MAX_INTERVAL_MS = 60_000;

/** Revalidates server-rendered room state while it can still change. */
export function RoomRefreshPoller({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    let timeout: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    let disposed = false;

    const schedule = () => {
      if (disposed) return;
      if (timeout) clearTimeout(timeout);
      if (document.visibilityState !== 'visible') return;

      const delay = Math.min(BASE_INTERVAL_MS * 1.5 ** failures, MAX_INTERVAL_MS);
      timeout = setTimeout(() => {
        if (!navigator.onLine) {
          failures += 1;
          schedule();
          return;
        }

        // router.refresh() intentionally reuses the existing server data path.
        // Next does not expose its request outcome, so transport failures cannot
        // be observed here; offline state is the signal available to the client.
        try {
          router.refresh();
          failures = 0;
        } catch {
          failures += 1;
        }
        schedule();
      }, delay);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') schedule();
      else if (timeout) clearTimeout(timeout);
    };
    const onOnline = () => {
      failures = 0;
      schedule();
    };
    const onOffline = () => {
      failures += 1;
      schedule();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    schedule();

    return () => {
      disposed = true;
      if (timeout) clearTimeout(timeout);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [enabled, router]);

  return null;
}
