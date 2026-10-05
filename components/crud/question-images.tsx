'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Pencil, Trash2, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { deleteQuestionImage, listQuestionImages, updateQuestionImage, uploadQuestionImage } from '@/app/actions/media';
import type { Row } from '@/lib/crud/entities';
import { Confirm, type ConfirmState } from './confirm';

/** Images that illustrate one question: upload, caption, reorder by number, remove. */
export function QuestionImages({ questionId }: { questionId: number }) {
  const [images, setImages] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [caption, setCaption] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await listQuestionImages(questionId);
    if (res.ok) { setImages(res.data); setError(null); } else { setImages([]); setError(res.error); }
  }, [questionId]);
  useEffect(() => { load(); }, [load]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const form = new FormData();
    form.set('file', file);
    form.set('questionId', String(questionId));
    form.set('orderIndex', String(images?.length ?? 0));
    setUploading(true);
    const res = await uploadQuestionImage(form);
    setUploading(false);
    if (res.ok) { toast.success('Imagem adicionada'); load(); } else toast.error(res.error);
  }

  async function saveCaption(img: Row) {
    const res = await updateQuestionImage(img.id, questionId, caption, img.orderIndex ?? null);
    if (res.ok) { toast.success('Legenda guardada'); setEditing(null); load(); } else toast.error(res.error);
  }

  return (
    <div className="mt-4 border-t pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">Imagens da questão{images ? ` (${images.length})` : ''}</p>
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onPick} aria-label="Escolher imagem" />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          <ImagePlus size={14} aria-hidden />{uploading ? 'A enviar…' : 'Adicionar imagem'}
        </Button>
      </div>
      {error ? <p className="text-xs text-muted-foreground">{error}</p> : null}
      {images === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3"><Skeleton className="aspect-video" /><Skeleton className="aspect-video" /></div>
      ) : images.length === 0 ? (
        <p className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">Sem imagens. PNG, JPG ou WEBP até 5 MB.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img) => (
            <li key={img.id} className="grid gap-1.5 rounded-lg border bg-card p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.imageUrl} alt={img.caption ?? `Imagem ${img.orderIndex + 1} da questão`} className="aspect-video w-full rounded-md bg-muted object-contain" />
              {editing === img.id ? (
                <div className="flex gap-1">
                  <Input autoFocus value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Legenda" maxLength={255} className="h-8" onKeyDown={(e) => { if (e.key === 'Enter') saveCaption(img); if (e.key === 'Escape') setEditing(null); }} />
                  <Button type="button" size="icon" variant="ghost" className="size-8" aria-label="Guardar legenda" onClick={() => saveCaption(img)}><Check size={14} /></Button>
                  <Button type="button" size="icon" variant="ghost" className="size-8" aria-label="Cancelar" onClick={() => setEditing(null)}><X size={14} /></Button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{img.caption ?? 'Sem legenda'}</p>
                  <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Editar legenda" onClick={() => { setEditing(img.id); setCaption(img.caption ?? ''); }}><Pencil size={13} /></Button>
                  <Button
                    type="button" size="icon" variant="ghost" className="size-7 hover:bg-danger-soft hover:text-destructive" aria-label="Remover imagem"
                    onClick={() => setConfirm({ title: 'Remover imagem?', description: 'A imagem deixa de aparecer na questão.', action: 'Remover', destructive: true, run: async () => { const r = await deleteQuestionImage(img.id); if (r.ok) { toast.success('Imagem removida'); load(); } else toast.error(r.error); } })}
                  ><Trash2 size={13} /></Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Confirm state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
