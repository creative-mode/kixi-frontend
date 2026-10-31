import Link from 'next/link';
import { ArrowLeft, CircleAlert } from 'lucide-react';
import { KixiLogo } from '@/components/kixi-logo';

export default function RecuperarPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10">
      <div className="flex items-center gap-3">
        <KixiLogo size={28} wordmark />
        <span className="rounded-full border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">Manager</span>
      </div>
      <div className="grid w-full max-w-[400px] gap-6 rounded-xl border bg-card p-6 shadow-xs sm:p-8">
        <div className="grid gap-1.5">
          <h1 className="text-2xl leading-tight font-bold tracking-tight">Recuperar palavra-passe</h1>
          <p className="text-sm text-muted-foreground">A recuperação automática ainda não está disponível.</p>
        </div>
        <div role="note" className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Contacta o professor ou a secretaria da escola para redefinir a palavra-passe. Não há um serviço automático disponível neste momento.</span>
        </div>

        <Link
          href="/login"
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Voltar a iniciar sessão
        </Link>
      </div>
      <p className="text-center text-xs text-muted-foreground">Problemas no acesso? Contacte o suporte técnico.</p>
    </main>
  );
}
