'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { myTutorStyles, saveTutorStyle, type TutorStyleRow } from '@/app/actions/tutor-style';
import { previewStyle, remaining, TUTOR_STYLE_EXAMPLES, TUTOR_STYLE_MAX } from '@/lib/tutor-style';

/**
 * FE-18 (#29): o professor descreve como explica, por turma e disciplina. O tutor
 * de IA usa esse texto quando o aluno estuda um enunciado dessa turma e disciplina
 * (creative-mode/kixi#116); quem grava é o `PUT /teaching-assignments/{id}/tutor-style`.
 */
export default function TutorStylePage() {
  const [rows, setRows] = useState<TutorStyleRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await myTutorStyles();
    if (res.ok) {
      setRows(res.data);
      setError(null);
    } else {
      setRows([]);
      setError(res.error);
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-8 lg:p-10">
      <div className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/professor">
            <ArrowLeft size={14} aria-hidden /> Início
          </Link>
        </Button>
        <h1 className="text-2xl leading-tight tracking-tight text-foreground">Estilo do tutor</h1>
        <p className="text-muted-foreground">
          Diga ao tutor de IA como costuma explicar: o tom, os passos, os exemplos. Ele usa este texto quando os
          seus alunos estudam um enunciado da turma e disciplina correspondentes. As regras do tutor não mudam:
          continua a não dar a resposta certa e a ficar pelo enunciado.
        </p>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Não foi possível carregar as suas atribuições: {error}
        </p>
      ) : null}

      {rows === null ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : rows.length === 0 && !error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Ainda não tem turmas atribuídas. Quando o administrador o associar a uma turma e disciplina, pode
            definir aqui o estilo do tutor para ela.
          </CardContent>
        </Card>
      ) : (
        rows.map((row) => <StyleCard key={row.id} row={row} />)
      )}
    </div>
  );
}

function StyleCard({ row }: { row: TutorStyleRow }) {
  const [saved, setSaved] = useState(row.tutorStyle ?? '');
  const [text, setText] = useState(row.tutorStyle ?? '');
  const [busy, setBusy] = useState(false);
  const fieldId = `tutor-style-${row.id}`;
  const left = remaining(text);
  const preview = previewStyle(text);
  const changed = text.trim() !== saved.trim();

  async function save(value: string) {
    setBusy(true);
    const res = await saveTutorStyle(row.id, value);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const stored = res.data ?? '';
    setSaved(stored);
    setText(stored);
    toast.success(stored ? 'Estilo guardado.' : 'Estilo removido: o tutor volta ao modo padrão.');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-foreground">
          {row.classLabel} · {row.subjectLabel}
        </CardTitle>
        <CardDescription>
          {saved ? 'O tutor já usa um estilo seu nesta turma.' : 'Sem estilo: o tutor explica no modo padrão.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <Label htmlFor={fieldId}>Como explica</Label>
            <span
              className={`text-xs tabular-nums ${left < 0 ? 'text-destructive' : 'text-muted-foreground'}`}
              aria-live="polite"
            >
              {text.trim().length}/{TUTOR_STYLE_MAX}
            </span>
          </div>
          <Textarea
            id={fieldId}
            value={text}
            maxLength={TUTOR_STYLE_MAX}
            rows={2}
            placeholder="Por exemplo: explica com exemplos do dia a dia antes da fórmula."
            onChange={(event) => setText(event.target.value)}
            disabled={busy}
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Exemplos</p>
          <div className="flex flex-wrap gap-2">
            {TUTOR_STYLE_EXAMPLES.map((example) => (
              <Button
                key={example}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto max-w-full whitespace-normal py-1 text-left text-xs"
                onClick={() => setText(example)}
                disabled={busy}
              >
                {example}
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Sparkles size={12} aria-hidden /> O que o tutor vai ler
          </p>
          <p className="mt-1 text-foreground">{preview || 'Nada: o tutor explica no modo padrão.'}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void save(text)} disabled={busy || !changed || left < 0}>
            {busy ? 'A guardar…' : 'Guardar'}
          </Button>
          {saved ? (
            <Button type="button" variant="ghost" onClick={() => void save('')} disabled={busy}>
              Remover estilo
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
