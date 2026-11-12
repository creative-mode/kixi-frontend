'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Ico } from '@/components/ui/ico';
import { UserAvatar } from '@/components/user-avatar';
import { sairAction } from '@/lib/auth-actions';
import { cn } from '@/lib/utils';

/**
 * O menu da conta, no avatar da barra: abre o perfil e termina a sessão. É a única porta para o
 * perfil na barra (não há separador "Perfil" a duplicar), e o sítio onde se espera encontrar «Sair».
 *
 * O menu é desenhado num portal em `document.body` e posicionado a partir do botão (#752). Dentro
 * da barra lateral `sticky` o `z-50` ficava preso no contexto de empilhamento dela, e o feed e as
 * caixas de comentários, que vêm depois no DOM, pintavam por cima do menu.
 */
export function AccountMenu({ name, photo, placement, landingOrigin, subtitle }: { name: string; photo: string | null; placement: 'side' | 'top'; landingOrigin: string | null; subtitle?: string }) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }, []);

  // Mudar de página fecha o menu, venha a navegação de um clique, do teclado ou do botão Voltar.
  useEffect(() => { setOpen(false); }, [pathname]);

  // O menu vive fora da barra, por isso a posição é calculada a partir do botão: por cima dele na
  // barra lateral (o avatar está no fundo), por baixo dele na barra do telemóvel.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition(placement === 'side'
        ? { left: rect.left, bottom: window.innerHeight - rect.top + 8 }
        : { right: window.innerWidth - rect.right, top: rect.bottom + 4 });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, placement]);

  useEffect(() => {
    if (!open || !position) return;
    const frame = window.requestAnimationFrame(() => menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!trigger.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => { document.removeEventListener('pointerdown', away); };
  }, [open]);

  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const menuItems = items();
    const current = menuItems.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }
    // Tab sai do menu: fecha-o e devolve o foco ao botão. No portal, o Tab seguinte ia parar ao
    // fim do documento, longe do sítio de onde o menu abriu.
    if (event.key === 'Tab') {
      event.preventDefault();
      close(true);
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
  const entries = (
    <>
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
    </>
  );
  return (
    <div className="relative">
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
      {open && position ? createPortal(
        <div
          ref={menu}
          role="menu"
          aria-label="Conta"
          data-testid="menu-conta"
          onKeyDown={onMenuKeyDown}
          onBlur={(event) => {
            const next = event.relatedTarget as Node | null;
            if (!event.currentTarget.contains(next) && !trigger.current?.contains(next)) setOpen(false);
          }}
          style={position}
          // `z-50`: por cima do conteúdo, das barras (z-20/z-30) e dos menus do compositor (z-40),
          // abaixo da barra de progresso da navegação (z-[60]).
          className="rise fixed z-50 w-60 overflow-hidden rounded-2xl border bg-background shadow-lg"
        >
          {entries}
        </div>,
        document.body,
      ) : (
        // Fechado, o menu continua no HTML do servidor, escondido, como sempre esteve: o
        // formulário de «Terminar sessão» é o que o fluxo HTTP (`scripts/flow.mjs`) submete,
        // e é o logout que funciona antes de o JavaScript carregar. Só vai para o portal ao abrir.
        <div hidden role="menu" aria-label="Conta">{entries}</div>
      )}
    </div>
  );
}
