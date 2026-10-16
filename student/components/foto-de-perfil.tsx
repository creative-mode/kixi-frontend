'use client';

import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { enviarFotoAction } from '@/lib/profile-actions';
import { Button } from '@/components/ui/button';

/** A foto de perfil escolhida do dispositivo: envia-se ao escolher, e o formulário leva o endereço que o servidor devolve. */
export function FotoDePerfil({ name, initial, defaultValue }: { name: string; initial: string; defaultValue: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(defaultValue);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setSending(true);
    setError(null);
    const form = new FormData();
    form.append('file', file);
    const res = await enviarFotoAction(form);
    setSending(false);
    if (input.current) input.current.value = '';
    if (res.error) setError(res.error);
    else if (res.url) setUrl(res.url);
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border bg-secondary text-lg font-bold text-muted-foreground">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="A tua foto" className="size-full object-cover" />
          ) : (
            initial
          )}
        </span>
        <div className="flex flex-wrap gap-2">
          <input ref={input} id={name} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={sending} onChange={(e) => void choose(e.target.files?.[0])} />
          <Button type="button" variant="outline" size="sm" disabled={sending} onClick={() => input.current?.click()}>
            {sending ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
            {url ? 'Trocar foto' : 'Escolher foto'}
          </Button>
          {url && (
            <Button type="button" variant="ghost" size="sm" disabled={sending} onClick={() => setUrl('')}>
              <Trash2 aria-hidden />Remover
            </Button>
          )}
        </div>
      </div>
      {error && <p role="alert" className="text-[13px] font-medium text-destructive">{error}</p>}
      <input type="hidden" name={name} value={url} />
    </div>
  );
}
