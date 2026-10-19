'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Ico } from '@/components/ui/ico';
import { UserAvatar } from '@/components/user-avatar';
import { sairAction } from '@/lib/auth-actions';
import { cn } from '@/lib/utils';

/**
 * O menu da conta, no avatar da barra: abre o perfil e termina a sessão. É a única porta para o
 * perfil na barra (não há separador "Perfil" a duplicar), e o sítio onde se espera encontrar «Sair».
 */
export function AccountMenu({ name, photo, active, placement }: { name: string; photo: string | null; active: boolean; placement: 'side' | 'top' }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const item = 'flex min-h-12 w-full items-center gap-3 px-4 text-left text-[15px] font-semibold outline-none hover:bg-secondary focus-visible:bg-secondary';
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label={`Conta de ${name}`}
        title={name}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn('grid size-12 place-items-center rounded-full outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/40')}
      >
        <UserAvatar name={name} src={photo} size={36} />
      </button>
      {(
        <div
          hidden={!open}
          role="menu"
          aria-label="Conta"
          className={cn('rise absolute z-50 w-60 overflow-hidden border bg-background shadow-lg', placement === 'side' ? 'bottom-0 left-full ml-2' : 'left-0 top-full mt-1')}
        >
          <Link role="menuitem" href="/perfil" className={item} onClick={() => setOpen(false)} autoFocus>
            <Ico name="user" size={22} />O meu perfil
          </Link>
          <form action={sairAction} className="border-t">
            <button role="menuitem" type="submit" className={cn(item, 'text-destructive')}>
              <Ico name="logout" size={22} />Terminar sessão
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
