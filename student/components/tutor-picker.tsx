import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Column, Page, PageHeader } from '@/components/page';
import { RefreshError } from '@/components/refresh-error';
import { EmptyState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { TutorLists } from '@/lib/tutor-papers';
import type { TutorPaper } from '@/lib/tutor-papers-rules';

function PaperList({ title, description, papers }: { title: string; description: string; papers: TutorPaper[] }) {
  return (
    <section className="grid gap-2" aria-label={title}>
      <div>
        <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
      </div>
      <Card className="gap-0 overflow-hidden py-0">
        <ul className="divide-y">
          {papers.map((paper) => (
            <li key={paper.statementId}>
              {/* A linha inteira é o alvo: escolher uma prova é um toque, e não um toque
                  na linha mais outro no botão. */}
              <Link
                href={`/tutor?statementId=${paper.statementId}`}
                className="flex min-h-14 items-center gap-3 px-5 py-3.5 transition-colors hover:bg-secondary/60"
              >
                <span className="min-w-0 flex-1">
                  <b className="block truncate leading-snug">{paper.title}</b>
                  {paper.note && <span className="text-[13px] text-muted-foreground">{paper.note}</span>}
                </span>
                <span aria-hidden className="inline-flex items-center gap-0.5 text-sm font-semibold text-primary">
                  Estudar
                  <ChevronRight className="size-4" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

/**
 * O tutor aberto sem prova (#491).
 *
 * Antes era um cartão a dizer «escolhe uma prova» e a mandar o aluno para a lista — um
 * separador principal que não levava a lado nenhum. O que o aluno já fez é a escolha
 * óbvia: as últimas provas, e as que estão mais fracas, cada uma a abrir a conversa já
 * com o enunciado como contexto.
 */
export function TutorPicker({ lists }: { lists: TutorLists }) {
  return (
    <Page>
      <Column className="gap-5">
        <PageHeader
          title="Tutor"
          description="Escolhe uma prova e estuda-a com o tutor, questão a questão."
        />

        {lists.kind === 'error' ? (
          <RefreshError
            title="Não foi possível carregar as tuas provas"
            message="O tutor precisa de saber que provas já fizeste. Verifica a ligação à internet e tenta de novo."
            status={lists.status}
            back={{ href: '/provas', label: 'Ver as provas' }}
          />
        ) : lists.recent.length === 0 ? (
          <EmptyState
            title="Escolhe uma prova para estudar"
            message="Ainda não tens provas feitas. Faz uma prova e o tutor explica-a contigo, questão a questão."
            action={<Button asChild><Link href="/provas">Ver as provas</Link></Button>}
          />
        ) : (
          <>
            {/* O tutor só responde sobre o enunciado de uma prova
                (`ChatSessionRequest.statementId` é obrigatório): sem prova não há
                conversa, e é isso que este ecrã diz ao oferecer uma. */}
            <PaperList
              title="As tuas últimas provas"
              description="As provas em que trabalhaste mais recentemente."
              papers={lists.recent}
            />
            {lists.review.length > 0 && (
              <PaperList
                title="Para rever"
                description="As provas em que acertaste menos: é por aí que se começa."
                papers={lists.review}
              />
            )}
          </>
        )}
      </Column>
    </Page>
  );
}
