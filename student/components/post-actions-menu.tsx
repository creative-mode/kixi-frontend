'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

export type ActionOutcome = { ok: true } | { ok: false; message: string };

/**
 * O menu «...» de uma publicação ou de um comentário (#753): Editar e Eliminar, com a
 * confirmação de eliminação no próprio sítio. Só é montado para o autor — quem decide
 * isso é o cartão, que compara `authorAccountId` com a conta da sessão.
 */
export function PostActionsMenu({
  what,
  onEdit,
  onDelete,
  deletedMessage,
  disabled = false,
  canEdit = true,
  className,
}: {
  /** «publicação» ou «comentário»: entra nos rótulos acessíveis e na confirmação. */
  what: 'publicação' | 'comentário';
  onEdit: () => void;
  onDelete: () => Promise<ActionOutcome>;
  deletedMessage: string;
  disabled?: boolean;
  /** Uma publicação de simulação ou automática não se edita (#753); ainda se pode eliminar. */
  canEdit?: boolean;
  className?: string;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const of = what === 'publicação' ? 'da publicação' : 'do comentário';
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);

  // Um clique fora fecha o menu; Escape fecha e devolve o foco ao «...».
  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  // A confirmação substitui a linha: quem usa teclado não fica sem saber onde está.
  useEffect(() => {
    if (confirming) cancel.current?.focus();
  }, [confirming]);

  const edit = () => {
    setOpen(false);
    onEdit();
  };

  const remove = () => {
    startTransition(async () => {
      setError(null);
      const result = await onDelete();
      if (!result.ok) { setError(result.message); return; }
      setConfirming(false);
      toast(deletedMessage);
    });
  };

  if (confirming) {
    return (
      <div
        ref={root}
        role="alertdialog"
        aria-labelledby={`eliminar-${what}-titulo`}
        aria-describedby={`eliminar-${what}-texto`}
        className={cn('grid gap-3 rounded-xl border border-[#e4c4c4] bg-[#fdf4f4] p-3', className)}
      >
        <div>
          <p id={`eliminar-${what}-titulo`} className="m-0 text-sm font-bold">Eliminar {what}?</p>
          <p id={`eliminar-${what}-texto`} className="mt-1 text-[13px] text-[#6b504f]">
            {what === 'publicação'
              ? 'A publicação e os comentários dela desaparecem para a turma. Não dá para desfazer.'
              : 'O comentário desaparece da conversa. Não dá para desfazer.'}
          </p>
        </div>
        {error && <Alert variant="destructive">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button ref={cancel} type="button" variant="outline" size="sm" disabled={pending} onClick={() => { setConfirming(false); setError(null); }}>
            Cancelar
          </Button>
          <Button type="button" variant="destructive" size="sm" disabled={pending} aria-busy={pending} onClick={remove}>
            {pending ? 'A eliminar…' : 'Eliminar'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div ref={root} className={cn('relative', className)}>
      <button
        ref={trigger}
        type="button"
        className="acao ml-auto"
        aria-label={`Acções ${of}`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={17} aria-hidden />
      </button>
      {open && (
        <div role="menu" aria-label={`Acções ${of}`} className="absolute right-0 bottom-full z-30 mb-1 grid min-w-[168px] gap-0.5 rounded-xl border border-[#e4e7e1] bg-white p-1.5 shadow-[0_12px_32px_rgba(18,28,21,0.14)]">
          {canEdit && (
            <button type="button" role="menuitem" className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold hover:bg-[#f5f6f4]" onClick={edit}>
              <Pencil size={15} aria-hidden />Editar
            </button>
          )}
          <button type="button" role="menuitem" className="flex min-h-10 items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-[#a52a2f] hover:bg-[#fdf4f4]" onClick={() => { setOpen(false); setConfirming(true); }}>
            <Trash2 size={15} aria-hidden />Eliminar
          </button>
        </div>
      )}
    </div>
  );
}
