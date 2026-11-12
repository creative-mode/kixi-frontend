'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type ToastTone = 'success' | 'error';
type Toast = { id: number; message: string; tone: ToastTone };
type PushToast = (message: string, tone?: ToastTone) => void;

const ToastContext = createContext<PushToast>(() => {});

/**
 * Os avisos breves do aluno (#753). O app não usa `sonner` como o gestor: uma faixa
 * no fundo do ecrã, que se anuncia a leitores de ecrã e desaparece sozinha, chega
 * para confirmar que a publicação ou o comentário foi eliminado.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const push = useCallback<PushToast>((message, tone = 'success') => {
    const id = nextId.current += 1;
    setToasts((list) => [...list, { id, message, tone }]);
    const timer = setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, 4000);
    timers.current.set(id, timer);
  }, []);

  useEffect(() => {
    const running = timers.current;
    return () => { for (const timer of running.values()) clearTimeout(timer); };
  }, []);

  return (
    <ToastContext value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--ck-banner-h,0px)+96px)] z-50 flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
        {toasts.map((toast) => (
          <p
            key={toast.id}
            className={cn(
              'toast pointer-events-auto m-0 max-w-[min(440px,100%)] rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(18,28,21,0.22)]',
              toast.tone === 'error' ? 'bg-[#a52a2f]' : 'bg-[#1f5a2c]',
            )}
          >
            {toast.message}
          </p>
        ))}
      </div>
    </ToastContext>
  );
}

export const useToast = (): PushToast => useContext(ToastContext);
