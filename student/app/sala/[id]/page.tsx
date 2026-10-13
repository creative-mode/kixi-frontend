import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireStudent } from '@/lib/guard';
import { getMe } from '@/lib/me';
import { getControlledRoom } from '@/lib/exam-room';
import { formatWhen } from '@/lib/exam-room-rules';
import { SalaProva } from '@/components/sala-prova';
import { RefreshError } from '@/components/refresh-error';
import { Button } from '@/components/ui/button';

type Params = Promise<Record<string, string | string[] | undefined>>;

const WAITING: Record<string, string> = {
  scheduled: 'O professor ainda não abriu esta sala.',
  lobby: 'A prova ainda não começou. Espera que o professor a inicie.',
  over: 'Esta sala já terminou.',
};

/** A sala de prova controlada (FE-14): a mesma sala do treino, com o tempo fixo da
 *  sala e sem refazer. */
export default async function SalaControladaPage({ params }: { params: Params }) {
  await requireStudent();
  const raw = (await params).id;
  const roomId = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isInteger(roomId) || roomId <= 0) redirect('/provas');

  const room = await getControlledRoom(roomId);
  if (room.kind === 'unauthorized') redirect('/entrar?reason=session-expired');
  if (room.kind === 'submitted') redirect(`/resultado?prova=${room.simulationId}`);
  if (room.kind === 'open') {
    const me = await getMe();
    return <SalaProva data={room.data} extraTime={me?.accessibility_extra_time === true} />;
  }

  const message =
    room.kind === 'missing'
      ? 'Não foste convidado para esta sala.'
      : room.kind === 'waiting'
        ? `${WAITING[room.phase] ?? 'A sala não está a decorrer.'} ${room.phase === 'over' ? '' : `Abre ${formatWhen(room.invitation.startsAt)}.`}`
        : room.message;

  return (
    <div className="mx-auto grid min-h-dvh max-w-[760px] place-items-center p-6">
      {room.kind === 'error' ? (
        <RefreshError title="Não conseguimos abrir a sala" message={message} />
      ) : (
        <div className="grid gap-4 text-center">
          <p className="text-lg font-semibold">{message.trim()}</p>
          <Button asChild variant="outline" className="justify-self-center"><Link href="/provas#salas">Voltar às salas</Link></Button>
        </div>
      )}
    </div>
  );
}
