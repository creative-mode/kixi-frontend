'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileImage, FileText, ScanText, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { importStatementOcr } from '@/app/actions/media';
import { ENTITIES } from '@/lib/crud/entities';
import { PageHead } from './page-head';
import { Spinner } from '@/components/ui/spinner';

const ACCEPT = 'image/*,application/pdf';
const size = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

/** Upload photos or scans of an exam; the OCR turns them into a statement that waits for review. */
export function OcrImport() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function add(list: FileList | File[]) {
    const incoming = Array.from(list).filter((f) => /^image\/|^application\/pdf$/.test(f.type));
    if (incoming.length < Array.from(list).length) toast.error('Só são aceites imagens e PDF.');
    const tooBig = incoming.find((f) => f.size > 15 * 1024 * 1024);
    if (tooBig) toast.error(`«${tooBig.name}» ultrapassa os 15 MB e foi ignorado.`);
    setFiles((cur) => [...cur, ...incoming.filter((f) => f.size <= 15 * 1024 * 1024)].slice(0, 20));
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) { setError('Escolha pelo menos um ficheiro.'); return; }
    const form = new FormData();
    files.forEach((f) => form.append('files', f, f.name));
    setBusy(true);
    setError(null);
    setStage('A enviar ficheiros…');
    const started = Date.now();
    const timer = window.setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000);
      setElapsed(s);
      // FE-11: sem progresso real do servidor; mostra a fase provável.
      setStage(s < 5 ? 'A enviar ficheiros…' : s < 30 ? 'A extrair o texto (OCR)…' : 'A guardar o enunciado…');
    }, 1000);
    try {
      const res = await importStatementOcr(form);
      if (res.ok) {
        toast.success('Prova importada. Falta rever o texto extraído.');
        router.push(`/statements/${res.data.id}`);
      } else setError(res.error);
    } finally {
      window.clearInterval(timer);
      setBusy(false);
      setStage(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <PageHead entity={ENTITIES.statements} title="Importar prova" subtitle="Fotografias ou PDF do enunciado: o OCR extrai as questões" back={{ href: '/statements', label: 'Voltar à lista' }} />
      <form onSubmit={submit} className="grid gap-5" noValidate>
        <Card>
          <CardContent className="grid gap-4 p-6">
            <div
              onDragOver={(e) => { e.preventDefault(); setOver(true); }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
              className={`grid place-items-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center transition-colors ${over ? 'border-primary bg-accent' : 'border-border'}`}
            >
              <UploadCloud className="size-8 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">Arraste os ficheiros para aqui</p>
              <p className="text-xs text-muted-foreground">Imagens ou PDF, até 15 MB cada, no máximo 20. As páginas são lidas pela ordem em que as adicionar.</p>
              <input ref={inputRef} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ''; }} aria-label="Escolher ficheiros" />
              <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>Escolher ficheiros</Button>
            </div>

            {files.length > 0 && (
              <ol className="grid gap-2" aria-label="Ficheiros a importar">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm">
                    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-primary">{f.type === 'application/pdf' ? <FileText size={16} aria-hidden /> : <FileImage size={16} aria-hidden />}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{i + 1}. {f.name}</span><span className="text-xs text-muted-foreground">{size(f.size)}</span></span>
                    <Button type="button" size="icon" variant="ghost" className="size-8" aria-label={`Remover ${f.name}`} disabled={busy} onClick={() => setFiles((cur) => cur.filter((_, k) => k !== i))}><X size={14} /></Button>
                  </li>
                ))}
              </ol>
            )}
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            {busy && stage ? (
              <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2 text-sm" role="status" aria-live="polite">
                <Spinner className="size-4" />
                <span className="font-medium">{stage}</span>
                <span className="ml-auto text-xs text-muted-foreground">{elapsed}s · limite 180s</span>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <div className="flex justify-end gap-3">
          <Button asChild variant="outline"><Link href="/statements">Cancelar</Link></Button>
          <Button type="submit" disabled={busy || files.length === 0}>
            {busy ? (<><Spinner className="size-4" />A ler a prova…</>) : (<><ScanText size={16} />Importar e extrair</>)}
          </Button>
        </div>
      </form>
    </div>
  );
}
