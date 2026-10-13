'use client';

import { useRef, useState } from 'react';
import { FileImage, FileText, ScanText, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { extractExamOcr } from '@/app/actions/media';
import { addOcrFiles, OCR_ACCEPT, ocrFilesProblem } from '@/lib/crud/ocr-files';
import type { ExamExtraction } from '@/lib/exam/extraction';

const size = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

/**
 * Fotografias ou PDF de uma prova: o OCR lê-as e o construtor fica preenchido para o professor rever.
 *
 * Nada é guardado aqui. `onExtracted` recebe o que o motor leu e quem chama decide o que fazer com isso
 * (o construtor transforma-o em rascunho e avisa do que ficou por decidir).
 */
export function ExamImporter({ onExtracted, onClose }: { onExtracted: (extraction: ExamExtraction, names: string) => void; onClose: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function add(list: FileList | File[]) {
    const { files: next, rejected } = addOcrFiles(files, Array.from(list));
    rejected.forEach((r) => toast.error(r));
    setFiles(next);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = ocrFilesProblem(files);
    if (problem) { setError(problem); return; }
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
      setStage(s < 5 ? 'A enviar ficheiros…' : 'A ler a prova (OCR)…');
    }, 1000);
    try {
      const res = await extractExamOcr(form);
      if (res.ok) {
        onExtracted(res.data, files.map((f) => f.name).join(', '));
        setFiles([]);
      } else setError(res.error);
    } catch {
      // A action pode rebentar antes de correr (413 do limite de corpo, ligação cortada):
      // aí não há Result, e sem este catch a página ficava parada sem dizer nada.
      setError('Não foi possível enviar os ficheiros. Verifique a ligação e tente com menos ficheiros ou ficheiros mais leves.');
    } finally {
      window.clearInterval(timer);
      setBusy(false);
      setStage(null);
    }
  }

  return (
    <Card className="print:hidden">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Importar de imagem ou PDF</CardTitle>
            <CardDescription>O OCR lê a prova, descobre o tipo de cada questão e as alíneas, e preenche o construtor. Nada é guardado até clicar em Guardar ou Publicar.</CardDescription>
          </div>
          <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Fechar o importador" onClick={onClose} disabled={busy}><X size={16} /></Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
            className={`grid place-items-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors ${over ? 'border-primary bg-accent' : 'border-border'}`}
          >
            <UploadCloud className="size-7 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">Arraste os ficheiros para aqui</p>
            <p className="max-w-prose text-xs text-muted-foreground">JPG, PNG, PDF, WEBP, BMP ou TIFF, até 15 MB cada, no máximo 10 e 50 MB no total. As páginas são lidas pela ordem em que as adicionar. Uma foto de frente e bem iluminada lê melhor.</p>
            <input ref={inputRef} type="file" multiple accept={OCR_ACCEPT} className="sr-only" onChange={(e) => { if (e.target.files) add(e.target.files); e.target.value = ''; }} aria-label="Escolher ficheiros da prova" />
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy} data-testid="gestor-statements-import-ficheiro">Escolher ficheiros</Button>
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
          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={busy || files.length === 0} data-testid="gestor-statements-import-submeter">
              {busy ? (<><Spinner className="size-4" />A ler a prova…</>) : (<><ScanText size={16} aria-hidden />Ler e preencher</>)}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
