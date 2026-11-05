'use client';

/**
 * A miniatura de um ficheiro do original. É só consulta: a imagem vem por object URL
 * e a página 1 de um PDF é renderizada uma vez para um `dataURL` — abrir o documento
 * inteiro de novo, a cada lista que muda, era desperdício.
 *
 * Sem PDF legível fica o ícone do tipo; a lista nunca falha por causa disto.
 */
import { useEffect, useState } from 'react';
import { FileImage, FileText } from 'lucide-react';
import { loadPdf } from '@/lib/exam/pdf';
import type { SourceKind } from '@/lib/exam/draft';

export function SourceThumb({ file, kind, page = 1, className = 'h-12 w-12 rounded-md border' }: { file: File; kind: SourceKind; page?: number; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    if (kind === 'image') {
      objectUrl = URL.createObjectURL(file);
      setSrc(objectUrl);
    } else {
      loadPdf(file)
        .then(async (doc) => {
          if (!doc || !alive) return;
          const canvas = document.createElement('canvas');
          try {
            await doc.renderPage(page, canvas, 0.6);
            const url = canvas.toDataURL('image/jpeg', 0.8);
            if (alive) setSrc(url);
          } finally {
            canvas.width = 0;
            canvas.height = 0;
          }
        })
        .catch(() => undefined);
    }
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file, kind, page]);

  if (!src) {
    return (
      <span className={`grid ${className} shrink-0 place-items-center bg-accent text-muted-foreground`} aria-hidden>
        {kind === 'pdf' ? <FileText size={18} /> : <FileImage size={18} />}
      </span>
    );
  }
  return <img src={src} alt="" aria-hidden className={`${className} shrink-0 object-cover`} />;
}
