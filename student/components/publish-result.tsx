'use client';

import Link from 'next/link';
import { useId, useState, useTransition } from 'react';
import { Check, Loader2, Share2 } from 'lucide-react';
import { SimulationCard, type SimulationCardData } from '@/components/simulation-card';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
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
}: {
  classId: number;
  simulationId: number;
  card: SimulationCardData;
}) {
  const fieldId = useId();
  const [reflection, setReflection] = useState('');
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const publish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPublishReflection(reflection)) return;
    setError(null);
    startTransition(async () => {
      const result = await publishSimulationAction(classId, simulationId, reflection);
      if (result.ok) setPublished(true);
      else setError(result.message);
    });
  };

  return (
    <Card className="gap-0 py-0" aria-label="Publicar o resultado no feed">
      <CardHeader className="pt-5 pb-3"><CardTitle>Partilhar com a turma</CardTitle></CardHeader>
      <div className="grid gap-4 border-t px-5 py-4">
        <SimulationCard card={card} />
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
