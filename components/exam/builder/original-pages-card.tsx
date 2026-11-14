'use client';

import type { MutableRefObject } from 'react';
import { FileText } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SourceThumb } from '../source-thumb';
import type { OriginalPage } from '../exam-importer';

/** As páginas lidas pelo OCR, vistas lado a lado com o rascunho. */
export function OriginalPagesCard({
  originais, pdfs, pdfFiles, relendo, paginasOriginais, onRepetirLeitura, onOpenOriginal,
}: {
  originais: OriginalPage[] | null;
  pdfs: Map<string, number>;
  pdfFiles: MutableRefObject<Map<string, File>>;
  relendo: string | null;
  paginasOriginais: { sourceIndex: number; pageIndex: number; page: number }[];
  onRepetirLeitura: (o: OriginalPage, page: number, pageIndex: number) => void;
  onOpenOriginal: (o: OriginalPage) => void;
}) {
  if (!originais || originais.length === 0) return null;
  return (
    <Card className="print:hidden" data-testid="ocr-originais">
      <CardHeader>
        <CardTitle>Páginas originais</CardTitle>
        <CardDescription>As páginas lidas, na ordem da leitura. Toque para ver em tamanho real.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-wrap gap-4">
          {originais.map((o, oi) => (
            <li key={o.url} className="grid gap-1">
              <button
                type="button"
                onClick={() => onOpenOriginal(o)}
                aria-label={`Ver ${o.name} em tamanho real`}
                className="grid w-24 gap-1 rounded-lg border bg-card p-1.5 text-left transition-colors hover:border-primary"
              >
                {o.kind === 'image' ? (
                  <img src={o.url} alt="" aria-hidden className="h-20 w-full rounded object-cover" />
                ) : (
                  /* Página 1 renderizada: o File veio do URL no efeito de contagem. */
                  pdfFiles.current.has(o.url)
                    ? <SourceThumb file={pdfFiles.current.get(o.url)!} kind="pdf" className="h-20 w-full rounded object-cover" />
                    : <span className="grid h-20 w-full place-items-center rounded bg-accent text-primary"><FileText size={20} aria-hidden /></span>
                )}
                <span className="truncate text-[11px] text-muted-foreground">{o.name}</span>
              </button>
              {/* Páginas de um PDF: cada uma pode ser relida sozinha — o rascunho
                  troca só as questões que vieram dela (`mergePageRetry`). */}
              {o.kind === 'pdf' && pdfFiles.current.has(o.url) && (pdfs.get(o.url) ?? 0) > 1 && (
                <div className="flex flex-wrap gap-1">
                  {paginasOriginais.filter((p) => p.sourceIndex === oi).map((p) => (
                    <button
                      key={p.pageIndex}
                      type="button"
                      className="grid w-12 gap-0.5 rounded-md border bg-card p-0.5 text-center transition-colors hover:border-primary disabled:opacity-60"
                      disabled={relendo !== null}
                      aria-label={`Repetir a leitura da página ${p.page} de ${o.name}`}
                      onClick={() => onRepetirLeitura(o, p.page, p.pageIndex)}
                    >
                      <SourceThumb file={pdfFiles.current.get(o.url)!} kind="pdf" page={p.page} className="h-10 w-full rounded object-cover" />
                      <span className="grid h-3.5 place-items-center text-[10px] tabular-nums text-muted-foreground">
                        {relendo === `${o.url}#${p.page}` ? <Spinner className="size-3" /> : p.page}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
