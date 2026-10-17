import { redirect } from 'next/navigation';
import { requireStudent } from '@/lib/guard';
import { getMe } from '@/lib/me';
import { getRoom } from '@/lib/exam';
import { Comecar } from '@/components/comecar-prova';
import { SalaProva } from '@/components/sala-prova';
import { RefreshError } from '@/components/refresh-error';

export const metadata = { title: 'Fazer prova · Kixi' };

type Params = Promise<Record<string, string | string[] | undefined>>;

function statementId(raw: string | string[] | undefined): number | null {
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export default async function ProvaPage({ params }: { params: Params }) {
  await requireStudent();

  const id = statementId((await params).id);
  if (id === null) redirect('/provas');

  const room = await getRoom(id);

  if (room.kind === 'unauthorized') redirect('/entrar?reason=session-expired');

  if (room.kind === 'error') {
    return (
      <div className="mx-auto grid min-h-dvh max-w-[760px] place-items-center p-6">
        <RefreshError
          title="Não conseguimos abrir esta prova"
          message={room.status === 404 ? 'Esta prova não existe ou já não está disponível.' : room.message}
          status={room.status}
          back={{ href: '/provas', label: 'Voltar às provas' }}
        />
      </div>
    );
  }

  // Uma tentativa terminada não abre uma segunda: o cartão do catálogo manda para o
  // resultado, e recomeçar aqui seria uma tentativa que o aluno não pediu.
  if (room.kind === 'finished') redirect(`/resultado?prova=${room.simulationId}`);

  if (room.kind === 'new') return <Comecar statementId={id} />;

  // O +25% é do servidor, não uma escolha do ecrã: o `deadline` já o inclui
  // (SimulationDeadlineService.java:94). O rótulo só aparece a quem o tem.
  const me = await getMe();
  return <SalaProva data={room.data} extraTime={me?.accessibility_extra_time === true} />;
}
