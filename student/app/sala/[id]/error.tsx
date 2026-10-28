'use client';

import { RoomError } from '@/components/room-error';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RoomError error={error} reset={reset} />;
}
