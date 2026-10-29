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
export function AccountMenu({ name, photo, placement, landingOrigin }: { name: string; photo: string | null; active: boolean; placement: 'side' | 'top'; landingOrigin: string | null }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', away);
    return () => { document.removeEventListener('pointerdown', away); };
  }, [open]);

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const menuItems = items();
    const current = menuItems.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (!menuItems.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const next = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? menuItems.length - 1
          : (current + (event.key === 'ArrowDown' ? 1 : -1) + menuItems.length) % menuItems.length;
      menuItems[next]?.focus();
    }
  };

  const item = 'flex min-h-12 w-full items-center gap-3 px-4 text-left text-[15px] font-semibold outline-none hover:bg-secondary focus-visible:bg-secondary';
  return (
    <div ref={box} className="relative">
      <button
        ref={trigger}
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
          ref={menu}
          hidden={!open}
          role="menu"
          aria-label="Conta"
          onKeyDown={onMenuKeyDown}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
          }}
          className={cn('rise absolute z-50 w-60 overflow-hidden border bg-background shadow-lg', placement === 'side' ? 'bottom-0 left-full ml-2' : 'left-0 top-full mt-1')}
        >
          <Link role="menuitem" tabIndex={-1} href="/perfil" className={item} onClick={() => setOpen(false)}>
            <Ico name="user" size={22} />O meu perfil
          </Link>
          <a role="menuitem" tabIndex={-1} href={`${landingOrigin ?? ''}/privacidade`} className={item} onClick={() => setOpen(false)}>
            Privacidade
          </a>
          <a role="menuitem" tabIndex={-1} href={`${landingOrigin ?? ''}/cookies`} className={item} onClick={() => setOpen(false)}>
            Cookies
          </a>
          <form action={sairAction} role="none" className="border-t">
            <button role="menuitem" tabIndex={-1} type="submit" className={cn(item, 'text-destructive')}>
              <Ico name="logout" size={22} />Terminar sessão
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
