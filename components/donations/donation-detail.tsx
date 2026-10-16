'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Download, FilePen, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { BASE_PATH } from '@/lib/constants';
import { getDonation, reviewDonation } from '@/app/actions/donations';
import { canOpenInBuilder, canReview, fileSize, isImage, type DonationDetail } from '@/lib/donations/model';
import { DonationStatusBadge } from './donations-list';

const when = (iso: string | null) => (iso ? iso.slice(0, 16).replace('T', ' ') : '—');

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{children || '—'}</dd>
    </div>
  );
}

export function DonationDetailView({ id }: { id: number }) {
  const [donation, setDonation] = useState<DonationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const res = await getDonation(id);
    if (res.ok) {
      setDonation(res.data);
      setNote(res.data.reviewNote ?? '');
    } else setError(res.error);
  }, [id]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  async function decide(status: 'approved' | 'rejected') {
    setBusy(true);
    const res = await reviewDonation(id, status, note);
    setBusy(false);
    if (!res.ok) return toast.error(res.error);
    setDonation(res.data);
    toast.success(status === 'approved' ? 'Doação aprovada.' : 'Doação rejeitada.');
  }

  const back = (
    <Link href="/donations" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <ArrowLeft size={14} /> Doações
    </Link>
  );

  if (error) {
    return (
      <div className="mx-auto max-w-5xl p-4 md:p-8">
        {back}
        <Card><CardContent className="py-12 text-center">
          <p className="mb-3 text-sm text-destructive" role="alert">{error}</p>
          <Button size="sm" variant="outline" onClick={load}>Tentar de novo</Button>
        </CardContent></Card>
      </div>
    );
  }
  if (!donation) {
    return <div className="mx-auto max-w-5xl p-4 md:p-8">{back}<Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      {back}
      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold md:text-3xl">{donation.subjectName} · {donation.examType}</h1>
          <p className="text-sm text-muted-foreground">{donation.institutionName} · <span className="tabular-nums">{donation.reference}</span></p>
        </div>
        <DonationStatusBadge status={donation.status} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="grid gap-4">
          <Card>
            <CardHeader><CardTitle>Ficheiros ({donation.files.length})</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {donation.files.map((file) => {
                const src = `${BASE_PATH}/api/donations/${donation.id}/files/${file.id}`;
                return (
                  <figure key={file.id} className="grid min-w-0 grid-cols-1 gap-2 rounded-lg border p-3">
                    {isImage(file.contentType) ? (
                      <img src={src} alt={`Página enviada: ${file.originalName}`} className="h-auto max-h-72 w-full max-w-full rounded object-contain bg-muted" loading="lazy" />
                    ) : (
                      <div className="grid h-24 place-items-center rounded bg-muted text-muted-foreground"><FileText aria-hidden /></div>
                    )}
                    <figcaption className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate" title={file.originalName}>{file.originalName} · {fileSize(file.sizeBytes)}</span>
                      <Button asChild size="sm" variant="outline" className="shrink-0">
                        <a href={src} download={file.originalName}><Download size={14} aria-hidden /> Descarregar</a>
                      </Button>
                    </figcaption>
                  </figure>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Dados</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Fact label="Classe ou turma">{donation.classGrade}</Fact>
                <Fact label="Ano lectivo">{donation.schoolYear}</Fact>
                <Fact label="Doador">{donation.donorName}</Fact>
                <Fact label="E-mail">{donation.donorEmail}</Fact>
                <Fact label="Recebida">{when(donation.createdAt)}</Fact>
                <Fact label="Consentimento">{donation.consentAt ? `${when(donation.consentAt)} · v${donation.consentVersion}` : null}</Fact>
              </dl>
              {donation.notes ? <p className="mt-4 whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{donation.notes}</p> : null}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Revisão</CardTitle>
              <CardDescription>
                {donation.reviewedAt ? `Revista em ${when(donation.reviewedAt)}.` : 'Ainda não foi revista.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {canReview(donation.status) ? (
                <>
                  <label htmlFor="review-note" className="text-sm font-medium">Nota (opcional)</label>
                  <Textarea id="review-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} disabled={busy} />
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => decide('approved')} disabled={busy || donation.status === 'approved'}><Check size={16} aria-hidden /> Aprovar</Button>
                    <Button variant="outline" onClick={() => decide('rejected')} disabled={busy || donation.status === 'rejected'}><X size={16} aria-hidden /> Rejeitar</Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Esta doação já virou prova e não se revê de novo.</p>
              )}
              {donation.reviewNote && !canReview(donation.status) ? <p className="text-sm">{donation.reviewNote}</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prova</CardTitle>
              <CardDescription>O OCR lê os ficheiros no construtor, onde se corrige antes de publicar.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              {canOpenInBuilder(donation.status) ? (
                <Button asChild><Link href={`/exam-builder?donation=${donation.id}`}><FilePen size={16} aria-hidden /> Abrir no construtor</Link></Button>
              ) : null}
              {donation.statementId ? (
                <Button asChild variant="outline"><Link href={`/statements/${donation.statementId}`}><FileText size={16} aria-hidden /> Ver a prova criada</Link></Button>
              ) : null}
              {!canOpenInBuilder(donation.status) && !donation.statementId ? (
                <p className="text-sm text-muted-foreground">Uma doação rejeitada não vai para o construtor.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
