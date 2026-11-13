'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Ico } from '@/components/ui/ico';
import { DonateLink } from '@/components/donate-link';
import { UserAvatar } from '@/components/user-avatar';
import { sairAction } from '@/lib/auth-actions';
import { cn } from '@/lib/utils';

/**
 * O menu da conta, no avatar da barra: abre o perfil e termina a sessão. É a única porta para o
 * perfil na barra (não há separador "Perfil" a duplicar), e o sítio onde se espera encontrar «Sair».
 */
export function AccountMenu({ name, photo, placement, landingOrigin, subtitle }: { name: string; photo: string | null; active: boolean; placement: 'side' | 'top'; landingOrigin: string | null; subtitle?: string }) {
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
        className={cn('outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40', placement === 'side' ? 'flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-secondary' : 'grid size-12 place-items-center rounded-full hover:bg-secondary')}
      >
        <UserAvatar name={name} src={photo} size={placement === 'side' ? 38 : 32} />
        {placement === 'side' && (
          <span className="flex min-w-0 flex-col">
            <strong className="truncate text-sm">{name}</strong>
            {subtitle && <span className="truncate text-[13px] text-muted-foreground">{subtitle}</span>}
          </span>
        )}
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
          className={cn('rise absolute z-50 w-60 overflow-hidden rounded-2xl border bg-background shadow-lg', placement === 'side' ? 'bottom-full left-0 mb-2' : 'right-0 top-full mt-1')}
        >
          <Link role="menuitem" tabIndex={-1} href="/perfil" className={item} onClick={() => setOpen(false)}>
            <Ico name="user" size={22} />O meu perfil
          </Link>
          {/* #762: a doação fica a um toque em qualquer ecrã. Um 5.º separador partia
              a barra inferior (ver lib/shell-nav.ts), e o menu já é o sítio dos destinos
              que não cabem lá. */}
          <DonateLink role="menuitem" tabIndex={-1} href={`${landingOrigin ?? ''}/doar`} origem="student-menu" className={item} onClick={() => setOpen(false)}>
            <Ico name="file" size={22} />Doar um enunciado
          </DonateLink>
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
