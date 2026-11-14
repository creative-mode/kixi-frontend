'use client';

import Link from 'next/link';
import { Gift, ScanText } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DonationDetail } from '@/lib/donations/model';

/** O contexto «esta prova vem de uma doação», com o passo para a ler com o OCR. */
export function DonationCard({
  donationId, donation, reading, onRead, ready,
}: {
  donationId: number;
  donation: DonationDetail | null;
  reading: boolean;
  onRead: () => void;
  ready: boolean;
}) {
  return (
    <Card className="print:hidden" role="region" aria-label="Doação de origem">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Gift className="size-4 text-primary" aria-hidden />Doação {donation?.reference ?? `#${donationId}`}</CardTitle>
        <CardDescription>
          {donation
            ? `${donation.subjectName} · ${donation.examType} · ${donation.institutionName}. ${donation.files.length} ficheiro(s).`
            : 'A carregar a doação…'}
          {' '}O OCR lê os ficheiros e preenche o construtor; ao guardar, a doação fica ligada à prova.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button onClick={onRead} disabled={!donation || reading || !ready}>
          {reading ? <Spinner className="size-4" /> : <ScanText aria-hidden />}
          {reading ? 'A ler a prova…' : 'Ler os ficheiros com o OCR'}
        </Button>
        <Button asChild variant="outline"><Link href={`/donations/${donationId}`}>Ver a doação</Link></Button>
      </CardContent>
    </Card>
  );
}
