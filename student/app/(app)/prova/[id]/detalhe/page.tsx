import { notFound, redirect } from 'next/navigation';
import { ErrorState } from '@/components/states';
import { StatementDetailView } from '@/components/statement-detail';
import { getStatementDetail } from '@/lib/statement-detail';

export const metadata = { title: 'Prova · Kixi' };

/**
 * The detail behind `/prova/[id]`, which stays the exam room (#17).
 *
 * It lives under `(app)` so it inherits that layout's `Shell` and enrollment check —
 * this is a screen with navigation and a "Provas" breadcrumb, not the fullscreen room.
 * The exam room is deliberately outside the group: mid-exam there is no menu to escape
 * to. The two are different enough that sharing a layout would make one of them wrong.
 *
 * A second `requireStudent()` is therefore unnecessary: `(app)/layout.tsx` already
 * runs it before this file. What the proxy does not do is check the role, and that
 * check now happens upstream of here.
 */
export default async function StatementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const result = await getStatementDetail(id);
  if (result.kind === 'unauthorized') redirect('/entrar?reason=session-expired');
  if (result.kind === 'missing') notFound();

  if (result.kind === 'unknown') {
    return (
      <div className="mx-auto w-full max-w-[760px] p-4 md:p-7">
        <ErrorState
          title="Não conseguimos ler esta prova"
          message={result.message}
        />
      </div>
    );
  }

  return <StatementDetailView summary={result.summary} attempts={result.attempts} current={result.current} />;
}
