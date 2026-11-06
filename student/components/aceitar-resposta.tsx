'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { acceptCommentAction } from '@/lib/feed-actions';

/** Só o autor da pergunta o vê: aceita a resposta que o ajudou, ou retira a que aceitou. */
export function AceitarResposta({ postId, commentId, accepted }: { postId: number; commentId: number; accepted: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="flex flex-col items-start">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          setError(null);
          const r = await acceptCommentAction(postId, commentId);
          if (!r.ok) { setError(r.message); return; }
          router.refresh();
        })}
        className="h-[34px] rounded-full bg-[#f5f6f4] px-3.5 text-[13px] font-bold text-[#1b4d27] disabled:opacity-50"
      >
        {accepted ? 'Retirar como resposta' : 'Aceitar como resposta'}
      </button>
      {error && <span role="alert" className="mt-1 text-[13px] font-semibold text-[#c2383e]">{error}</span>}
    </span>
  );
}
