'use client';

import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { listAudit } from '@/app/actions/moderation';
import { DECISION_LABEL, TARGET_LABEL, type AuditEntry } from '@/lib/moderation/model';

const when = (iso: string) => new Date(iso).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });

/**
 * O registo de auditoria (#323).
 *
 * Só de leitura e sem ações: é o sítio onde se vai responder «porque é que este perfil
 * desapareceu». Por isso ninguém escreve aqui — escreve-se o que se decide, na fila.
 */
export function AuditLog() {
  const [entradas, setEntradas] = useState<AuditEntry[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void listAudit().then((r) => (r.ok ? setEntradas(r.data) : setErro(r.error)));
  }, []);

  if (erro) return <p className="text-sm text-destructive" role="alert">{erro}</p>;
  if (!entradas) return <p className="text-sm text-muted-foreground">A carregar o registo…</p>;

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Auditoria</h1>
        <p className="text-sm text-muted-foreground">
          Quem decidiu o quê, quando e porquê. Só de leitura.
        </p>
      </header>

      {entradas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ainda não há decisões registadas.</p>
      ) : (
        <ol className="grid gap-3" aria-label="Decisões registadas">
          {entradas.map((e) => (
            <li key={e.id}>
              <Card>
              <CardContent className="grid gap-1 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <ScrollText className="size-4 text-muted-foreground" aria-hidden />
                  <span className="font-medium">{DECISION_LABEL[e.action as keyof typeof DECISION_LABEL] ?? e.action}</span>
                  <span>{e.targetName}</span>
                  <Badge variant="outline">{TARGET_LABEL[e.target]}</Badge>
                </div>
                <p className="text-muted-foreground">
                  por {e.actor} · {when(e.at)} · denúncia #{e.reportId}
                </p>
                {e.note && <p>{e.note}</p>}
              </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}