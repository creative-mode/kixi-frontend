'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { addCommentAction } from '@/lib/feed-actions';

export function Responder({ postId }: { postId: number }) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);
    start(async () => {
      const r = await addCommentAction(postId, text);
      if (!r.ok) { setError(r.message); return; }
      setText('');
      router.refresh();
    });
  };
  return (
    <form onSubmit={send} className="mt-5 flex flex-col gap-2">
      <label htmlFor="resposta" className="sr-only">A tua resposta</label>
      <div className="flex items-center gap-2.5">
        <input id="resposta" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Escreve uma resposta" className="h-[54px] min-w-0 flex-1 rounded-full border-[1.5px] border-[#dde3da] px-5 text-base outline-none focus:border-[#1f5a2c]" />
        <button type="submit" disabled={pending || !text.trim()} aria-label="Enviar resposta" className="flex size-[54px] items-center justify-center rounded-full bg-[#1f5a2c] text-white disabled:opacity-50">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
        </button>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-[#c2383e]">{error}</p>}
    </form>
  );
}
