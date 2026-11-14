'use client';

import { Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ImportedNote } from '@/lib/exam/extraction';

/** O OCR não decidiu sozinho tudo o que mostrou: este cartão pede o veredito humano antes. */
export function OcrNotesCard({
  notes, onIrParaQuestao, onDismiss,
}: {
  notes: ImportedNote[];
  onIrParaQuestao: (question: number) => void;
  onDismiss: () => void;
}) {
  if (notes.length === 0) return null;
  return (
    <Card className="border-warning/40">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Sparkles className="size-4 text-warning" aria-hidden />Lido pelo OCR: reveja</CardTitle>
            <CardDescription>O OCR errou ou ficou inseguro nestes pontos. Corrija no rascunho antes de guardar.</CardDescription>
          </div>
          <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Dispensar as notas do OCR" onClick={onDismiss}><X size={16} aria-hidden /></Button>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2.5 text-sm">
          {notes.map((n, i) => (
            <li key={`${i}-${n.text.slice(0, 24)}`} className="grid gap-1">
              <span>{n.text}</span>
              {typeof n.question === 'number' ? (
                <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => onIrParaQuestao(n.question!)}>
                  Ir para a questão {n.question}
                </Button>
              ) : n.anchor === 'rodape' ? (
                <Button type="button" variant="outline" size="sm" className="justify-self-start" asChild>
                  <a href="#ocr-rodape">Ver rodapé original</a>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
