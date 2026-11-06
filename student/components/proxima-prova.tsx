import Link from 'next/link';
import { phaseOf, sortInvitations, type Invitation } from '@/lib/exam-room-rules';
import { SalasDeProva } from '@/components/salas-de-prova';
import type { SocialData } from '@/lib/social';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** `LocalDateTime` do servidor lido pelo texto, para o ecrã não mudar com o fuso do computador. */
function parts(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return { y, mo, d, hh: m[4], mm: m[5], weekday: new Date(Date.UTC(y, mo - 1, d)).getUTCDay() };
}

function badge(daysLeft: number, live: boolean): string {
  if (live) return 'A decorrer';
  if (daysLeft <= 0) return 'Hoje';
  if (daysLeft === 1) return 'Amanhã';
  return `Daqui a ${daysLeft} dias`;
}

const Step = ({ state, last, children }: { state: 'done' | 'now' | 'todo'; last?: boolean; children: React.ReactNode }) => (
  <li className="grid grid-cols-[28px_minmax(0,1fr)] gap-4">
    <div className="flex flex-col items-center">
      {state === 'done' ? (
        <span className="flex size-7 items-center justify-center rounded-full bg-[#1f5a2c]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></span>
      ) : state === 'now' ? (
        <span className="flex size-7 items-center justify-center rounded-full border-[3px] border-[#1f5a2c] bg-white"><span className="size-2.5 rounded-full bg-[#1f5a2c]" /></span>
      ) : (
        <span className="size-7 rounded-full border-2 border-[#cdd6c9] bg-white" />
      )}
      {!last && <span className="min-h-[18px] w-0.5 flex-1 bg-[#dfe6db]" />}
    </div>
    <div className={`flex flex-col ${last ? 'pb-3' : 'pb-[18px]'}`}>{children}</div>
  </li>
);

/**
 * O cartão do topo do início: a próxima prova (sala a que o professor convidou o aluno) e, ao abrir,
 * o plano até lá. O plano usa o que o aluno já fez: o último resultado, o tema mais fraco e as provas por fazer.
 */
export function ProximaProva({ invitations, data, serverNow }: { invitations: Invitation[]; data: SocialData; serverNow: number }) {
  const pending = sortInvitations([...invitations]).filter((i) => ['live', 'lobby', 'scheduled'].includes(phaseOf(i)));
  const next = pending[0];
  if (!next) return null;
  const when = parts(next.startsAt);
  if (!when) return null;
  const today = new Date(serverNow);
  const daysLeft = Math.round((Date.UTC(when.y, when.mo - 1, when.d) - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / 86_400_000);
  const live = phaseOf(next) === 'live';
  const title = next.statementTitle ?? 'Sala de prova';
  const dateLong = `${DIAS[when.weekday][0].toUpperCase()}${DIAS[when.weekday].slice(1)}, ${when.d} de ${MESES_LONGOS[when.mo - 1]}, às ${when.hh}h${when.mm}`;
  const weak = data.performance.mastery[0];
  const last = data.history[0];
  const steps = 4;
  const doneCount = last ? 1 : 0;

  return (
    <details className="group overflow-hidden rounded-[20px] border border-[#e9ebe7] bg-white">
      <summary
        aria-label={`Próxima prova, ${badge(daysLeft, live).toLowerCase()}. ${title}. ${dateLong}. Clica para ver o plano`}
        className="flex cursor-pointer list-none items-center gap-3.5 px-[18px] py-4 md:flex-wrap md:gap-6 md:px-6 md:py-[22px] [&::-webkit-details-marker]:hidden"
      >
        <div aria-hidden="true" className="w-16 shrink-0 overflow-hidden rounded-[14px] border md:w-24 md:rounded-2xl border-[#dde3da] bg-white text-center">
          <div className="bg-[#c2383e] py-[3px] text-xs font-bold text-white md:py-[5px] md:text-sm">{MESES[when.mo - 1]}</div>
          <div className="pt-1.5 pb-px text-[30px] leading-none md:pt-2.5 md:pb-0.5 md:text-[46px] font-extrabold tracking-[-0.03em]">{when.d}</div>
          <div className="pb-1.5 text-[11px] text-[#5f6b63] md:pb-[9px] md:text-[13px]">{DIAS[when.weekday]}</div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 md:min-w-[240px] md:gap-1.5">
          <span className="inline-flex h-5 self-start items-center rounded-full bg-[#fdf0d9] px-[9px] text-[11px] md:h-[22px] md:px-2.5 md:text-xs font-bold text-[#9a6400]">{badge(daysLeft, live)}</span>
          <h1 className="m-0 text-[21px] leading-[1.15] font-extrabold tracking-[-0.02em] md:text-[32px] md:leading-[1.1] md:tracking-[-0.025em]">{title}</h1>
          <span className="text-[13px] text-[#5f6b63] md:text-[15px]">{dateLong}. {next.durationMinutes} min.</span>
        </div>
        <span className="flex shrink-0 flex-col items-center gap-1">
          <svg className="transition-transform group-open:rotate-180" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          <span className="text-xs font-bold text-[#617066]">Ver plano</span>
        </span>
      </summary>

      <div className="px-[18px] pb-[18px] md:px-6 md:pb-4">
        <div className="mb-[18px] flex items-baseline justify-between border-t border-[#dfe9da] pt-[18px]">
          <h2 className="m-0 text-xl font-extrabold tracking-[-0.01em]">O teu plano até à prova</h2>
          <span className="lbl">{doneCount} de {steps} passos</span>
        </div>
        <div className="mb-4 empty:hidden"><SalasDeProva invitations={pending} /></div>
        <Link href={`/provas/preparar?materia=${encodeURIComponent(title)}`} className="mb-4 flex h-11 items-center justify-between rounded-xl bg-[#f1f6ee] px-4 text-[15px] font-bold text-[#1f5a2c] no-underline">O que sai na prova<span aria-hidden="true">&rsaquo;</span></Link>
        <ol className="m-0 flex list-none flex-col p-0">
          <Step state={last ? 'done' : 'now'}>
            <div className="flex justify-between gap-3">
              <span className="flex flex-col"><strong className="text-[15px]">Diagnóstico</strong><span className="text-sm text-[#617066]">{last ? `${last.title}${last.score ? `. Ficaste com ${last.score}.` : '.'}` : 'Ainda não fizeste nenhuma prova.'}</span></span>
              <Link href={last ? '/provas' : '/provas'} className="text-sm font-bold text-[#1f5a2c] no-underline">{last ? 'Ver resultado' : 'Escolher prova'}</Link>
            </div>
          </Step>
          <Step state={last ? 'now' : 'todo'}>
            <span className="flex flex-col">
              <strong className="text-[15px]">{weak ? `Treinar ${weak.label}` : 'Treinar'}</strong>
              <span className="text-sm text-[#617066]">{weak ? 'É o tema onde tens mais a rever. Questões com explicação do tutor.' : 'Faz uma prova para o tutor saber o que treinar.'}</span>
            </span>
            {weak && <Link href={`/provas/montar?statementId=${weak.id}`} className="mt-3 flex h-11 items-center self-start rounded-xl bg-[#1f5a2c] px-5 text-[15px] font-bold text-white no-underline">Começar o treino</Link>}
          </Step>
          <Step state="todo">
            <strong className="text-[15px] text-[#3d4a41]">Simulação completa</strong>
            <span className="text-sm text-[#617066]">Faz uma prova inteira, com tempo, como no dia. <Link href="/provas" className="font-bold text-[#1f5a2c] no-underline">Ver provas</Link></span>
          </Step>
          <Step state="todo" last>
            <strong className="text-[15px] text-[#3d4a41]">Prova</strong>
            <span className="text-sm text-[#617066]">{dateLong}.</span>
          </Step>
        </ol>
      </div>
    </details>
  );
}
