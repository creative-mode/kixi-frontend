'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { uploadImage } from '@/app/actions/media';

/**
 * Uma imagem escolhida do dispositivo, em vez de um endereço colado: o ficheiro é enviado ao escolher e o valor que o
 * formulário guarda continua a ser o endereço que o servidor devolve (`photo`, `logo`), por isso nada mais muda.
 */
export function ImageField({
  id,
  name,
  kind,
  value,
  onChange,
  disabled,
}: {
  id: string;
  name: string;
  kind: 'avatar' | 'logo';
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);

  async function choose(file: File | undefined) {
    if (!file) return;
    setSending(true);
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    const res = await uploadImage(form);
    setSending(false);
    if (input.current) input.current.value = '';
    if (!res.ok) return toast.error(res.error);
    onChange(res.data.url);
  }

  return (
    <div className="flex items-center gap-4">
      <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={kind === 'logo' ? 'Logótipo escolhido' : 'Foto escolhida'} className="size-full object-contain" />
        ) : (
          <ImagePlus className="size-6 text-muted-foreground" aria-hidden />
        )}
      </span>
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          disabled={disabled || sending}
          onChange={(e) => void choose(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" size="sm" disabled={disabled || sending} onClick={() => input.current?.click()}>
          {sending ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
          {value ? 'Trocar imagem' : 'Escolher imagem'}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" disabled={disabled || sending} onClick={() => onChange('')}>
            <Trash2 aria-hidden />Remover
          </Button>
        )}
      </div>
      {/* O valor que vai no pedido: o endereço devolvido pelo servidor. */}
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
