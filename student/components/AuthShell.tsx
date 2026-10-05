import { Check, ThumbsUp } from 'lucide-react';
import { Logo } from './brand';
import { UserAvatar } from './user-avatar';
import { Card, CardContent } from '@/components/ui/card';

const POINTS = ['Simulações com as provas da tua escola', 'Um tutor que explica cada erro e cita a prova', 'A tua turma por perto, para perguntar e partilhar'];

/** Ecrã dividido das páginas de entrada: painel de apresentação (só em ecrãs largos) e formulário. */
export function AuthShell({ title, lead, children }: { title: string; lead: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[5fr_6fr]">
      <aside className="relative hidden flex-col justify-between gap-10 overflow-hidden bg-[#14391d] p-12 text-[#e5f0e2] lg:flex">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[.07] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" />
        <Logo size={30} wordmark shipClassName="text-[#8fe86a]" wordClassName="text-[#e5f0e2]" className="relative" />

        <div className="relative grid gap-8">
          <div>
            <h2 className="max-w-[16ch] text-[34px] leading-[1.15] font-bold tracking-tight">Estuda com as provas da tua escola.</h2>
            <p className="mt-4 max-w-[38ch] text-[#b7d1b3]">Faz simulações, tira dúvidas e vê como a tua turma está a evoluir.</p>
          </div>

          {/* Pré-visualização de uma publicação, para mostrar como é por dentro */}
          <Card className="max-w-sm gap-3 border-white/10 bg-white/[.06] py-4 text-[#e5f0e2] shadow-none backdrop-blur-sm" aria-hidden>
            <CardContent className="grid gap-3">
              <div className="flex items-center gap-3">
                <UserAvatar name="Mariana Costa" size={36} />
                <div className="leading-tight"><div className="text-sm font-bold">Mariana Costa</div><div className="text-xs text-[#b7d1b3]">12B · ITEL · há 2 h</div></div>
              </div>
              <p className="text-sm text-[#cfe3cb]">O subnetting finalmente entrou depois de refazer as questões 3 e 8 com o tutor.</p>
              <div className="flex items-center justify-between rounded-md border border-white/10 bg-black/10 px-3 py-2.5">
                <div className="text-sm"><div className="font-semibold">P1 · Redes de Computadores</div><div className="text-xs text-[#b7d1b3]">ITEL 2024</div></div>
                <div className="text-right"><div className="text-2xl leading-none font-bold tabular-nums">18,2</div><div className="text-xs font-semibold text-[#8fe86a]">+3,0 face à anterior</div></div>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#b7d1b3]"><ThumbsUp className="size-4" />24 acharam útil</div>
            </CardContent>
          </Card>
        </div>

        <ul className="relative grid gap-3 text-sm text-[#cfe3cb]">
          {POINTS.map((p) => <li key={p} className="flex items-center gap-2.5"><Check className="size-4 text-[#8fe86a]" />{p}</li>)}
        </ul>
      </aside>

      <main className="flex items-start justify-center px-6 py-10 sm:items-center">
        <div className="grid w-full max-w-[400px] gap-7">
          <Logo size={24} wordmark className="lg:hidden" />
          <div className="grid gap-1.5">
            <h1 className="text-[26px] leading-tight font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{lead}</p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
