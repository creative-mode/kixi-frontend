'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** O rodapé original recortado, para conferência: fica fora das questões e fora do PDF. */
export function FooterPreviewCard({ footerPreview }: { footerPreview: { dataUrl: string; pageIndex: number | null; text: string[] } | null }) {
  if (!footerPreview) return null;
  return (
    <Card data-testid="ocr-footer-preview" id="ocr-rodape" className="scroll-mt-20">
      <CardHeader>
        <CardTitle>Rodapé original — fora das questões</CardTitle>
        <CardDescription>
          Recorte da página {(footerPreview.pageIndex ?? 0) + 1}, mantido para conferência. Não será impresso como parte das perguntas.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <img src={footerPreview.dataUrl} alt="Rodapé original da prova, incluindo contacto e coordenação" className="max-h-72 w-full rounded-lg border object-contain object-left-top" />
        {footerPreview.text.length > 0 && <p className="text-sm text-muted-foreground">Texto reconhecido: {footerPreview.text.join(' · ')}</p>}
      </CardContent>
    </Card>
  );
}
