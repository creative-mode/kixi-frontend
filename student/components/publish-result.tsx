'use client';

import Link from 'next/link';
import { useId, useState, useTransition } from 'react';
import { Check, Loader2, Share2, TriangleAlert, Users } from 'lucide-react';
import type { SimulationCardData } from '@/components/simulation-card';
import { PostPreview } from '@/components/post-parts';
import { useMe } from '@/lib/me-context';
import { fullName, photoUrl } from '@/lib/profile';
import { cardWithoutScore, classAudienceLabel, pendingReviews, postTypeLabel } from '@/lib/feed-rules';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { MAX_POST_LENGTH, REFLECTION_LABEL, canPublishReflection } from '@/lib/feed-rules';
import { publishSimulationAction } from '@/lib/feed-actions';

/** Depois de terminar, o aluno pode partilhar o resultado com a turma: o cartão da escola
 *  com a nota e, se quiser, a sua reflexão. A pré-visualização usa os números que o servidor
 *  já deu para este resultado; ao publicar, o servidor volta a lê-los, por isso um valor
 *  alterado aqui nunca chega ao feed. */
export function PublishResult({
  classId,
  simulationId,
  card,
  classGrade = null,
  classCode = null,
  classmateCount = null,
}: {
  classId: number;
  simulationId: number;
  card: SimulationCardData;
  /** A turma do aluno, do /me, para a linha «Visível para a turma …». */
  classGrade?: number | null;
  classCode?: string | null;
  /** Quantos colegas há na turma (sem contar o próprio). Sem este dado a linha fica sem número. */
  classmateCount?: number | null;
}) {
  const me = useMe();
  const fieldId = useId();
  const toggleId = useId();
  const toggleHintId = useId();
  const [reflection, setReflection] = useState('');
  const [showScore, setShowScore] = useState(true);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Ainda há abertas por corrigir: o cartão publicado vai dizer «A corrigir» até
  // a nota final chegar, e não a nota parcial do backend (kixi#788).
  const pendingReviewCount = pendingReviews(card);
  const provisional = pendingReviewCount > 0;

  const publish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPublishReflection(reflection)) return;
    setError(null);
    startTransition(async () => {
      const result = await publishSimulationAction(classId, simulationId, reflection, showScore);
      if (result.ok) setPublished(true);
      else setError(result.message);
    });
  };

  return (
    <Card className="gap-0 py-0" aria-label="Publicar o resultado no feed">
      <CardHeader className="pt-5 pb-3"><CardTitle>Partilhar com a turma</CardTitle></CardHeader>
      <div className="grid gap-4 border-t px-5 py-4">
        <div className="grid gap-2.5 rounded-xl border bg-secondary/40 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Users className="size-4 shrink-0 text-primary" aria-hidden />
            {classAudienceLabel(classGrade, classCode, classmateCount)}
          </p>
          <div className="flex items-start justify-between gap-4 border-t pt-2.5">
            <div className="grid gap-0.5">
              <label htmlFor={toggleId} className="text-sm font-semibold">Mostrar a nota</label>
              <p id={toggleHintId} className="text-[13px] leading-snug text-muted-foreground">
                {!showScore
                  ? 'A turma vê o cartão, mas sem a nota nem as respostas certas. Só tu continuas a vê-las.'
                  : provisional
                    ? 'A turma vê o cartão com «A corrigir». A nota aparece quando a correção terminar.'
                    : 'A turma vê a nota e as respostas certas.'}
              </p>
            </div>
            <Switch
              id={toggleId}
              checked={showScore}
              onCheckedChange={setShowScore}
              aria-describedby={toggleHintId}
              disabled={published || pending}
            />
          </div>
        </div>
        {provisional && showScore && (
          <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-[13px] font-medium text-warning" role="status">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Ainda {pendingReviewCount === 1 ? 'há 1 resposta aberta' : `há ${pendingReviewCount} respostas abertas`} por corrigir: o cartão vai mostrar «A corrigir» até a nota final chegar.
            </span>
          </p>
        )}
        {/* A pré-visualização é a publicação inteira, como a turma a vai ver: cabeçalho, cartão e reflexão. */}
        <PostPreview
          author={{ name: fullName(me) || 'Tu', photo: photoUrl(me) }}
          typeLabel={postTypeLabel('simulation')}
          post={{ title: null, content: reflection.trim(), simulation: showScore ? card : cardWithoutScore(card), blocks: null }}
        />
        {published ? (
          <div className="flex flex-wrap items-center gap-3" role="status">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-success"><Check className="size-4" aria-hidden />Publicado no feed da turma.</span>
            <Button asChild variant="outline" size="sm"><Link href="/inicio">Ver no início</Link></Button>
          </div>
        ) : (
          <form className="grid gap-2.5" onSubmit={publish}>
            <label htmlFor={fieldId} className="text-sm font-semibold">
              {REFLECTION_LABEL} <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <Textarea
              id={fieldId} value={reflection} onChange={(e) => setReflection(e.target.value)}
              placeholder="O que correu bem? Onde tropeçaste? O que vais rever?" maxLength={MAX_POST_LENGTH} rows={3}
            />
            {error && <p role="alert" className="text-[13px] font-medium text-destructive">{error}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={pending}>
                {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Share2 aria-hidden />}
                Publicar no feed
              </Button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
