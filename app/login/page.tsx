'use client';

import { Suspense, useState, useSyncExternalStore } from 'react';
import { loginAction } from '@/app/actions/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { KixiLogo } from '@/components/kixi-logo';
import { Eye, EyeOff, CircleAlert } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

function noticeFor(reason: string | null) {
  if (reason === 'session-expired') return 'A sessão expirou. Inicie sessão novamente para continuar.';
  if (reason === 'logged-out') return 'A sessão foi terminada com segurança.';
  if (reason === 'invalid-session') return 'Esta conta não tem acesso ao Kixi Manager. Inicie sessão com outra conta.';
  if (reason === 'required') return 'Inicie sessão para continuar.';
  return null;
}

/** `false` no servidor e na primeira renderização do cliente, `true` depois de a página estar hidratada. */
const noopSubscribe = () => () => {};
function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

function LoginContent() {
  const hydrated = useHydrated();
  const [isLoading, setIsLoading] = useState(false);
  const [show, setShow] = useState(false);
  const router = useRouter();
  const notice = noticeFor(useSearchParams().get('reason'));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);

    try {
      const result = await loginAction(formData);

      if (result.success) {
        toast.success('Sessão iniciada com sucesso!', {
          description: 'A abrir o painel...',
          duration: 3000,
        });

        await new Promise((resolve) => setTimeout(resolve, 400));

        router.push('/');
        router.refresh();
      } else {
        toast.error(result.error || 'Credenciais inválidas', {
          description: 'Confirme o nome de utilizador ou o e-mail e a palavra-passe.',
        });
      }
    } catch (error) {
      console.error('Erro no login:', error);
      toast.error('Erro de ligação', {
        description: 'Não foi possível estabelecer ligação ao servidor. Volte a tentar.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10">
      <div className="flex items-center gap-3">
        <KixiLogo size={28} wordmark />
        <span className="rounded-full border px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">Manager</span>
      </div>
      <div className="grid w-full max-w-[400px] gap-6 rounded-xl border bg-card p-6 shadow-xs sm:p-8">
        <div className="grid gap-1.5">
          <h1 className="text-2xl leading-tight font-bold tracking-tight">Bem-vindo de volta</h1>
          <p className="text-sm text-muted-foreground">Inicie sessão para aceder ao painel de gestão.</p>
        </div>
        {notice ? (
          <div role="status" className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{notice}</span>
          </div>
        ) : null}
        {/* Antes de o JavaScript hidratar, o envio nativo de um formulário sem `method` é um GET: a palavra-passe
            iria no endereço (histórico, logs de proxies). `method="post"` tira-a do URL e o botão fica desativado
            até a página estar pronta (com o botão por defeito desativado, o Enter também não submete). */}
        <form method="post" onSubmit={handleSubmit} className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="usernameOrEmail">Nome de utilizador ou e-mail</Label>
            <Input id="usernameOrEmail" name="usernameOrEmail" type="text" placeholder="admin@kixi.ao" required disabled={isLoading} autoComplete="username email" autoFocus />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Palavra-passe</Label>
            <div className="relative">
              <Input id="password" name="password" type={show ? 'text' : 'password'} placeholder="••••••••" required disabled={isLoading} autoComplete="current-password" className="pr-10" />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'} className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-md text-muted-foreground hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30">
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
<Button type="submit" size="lg" className="w-full" disabled={isLoading || !hydrated} data-testid="gestor-entrar-submeter">
            {isLoading ? (<><Spinner className="size-4" />A entrar...</>) : 'Entrar'}
          </Button>
        </form>
      </div>
      <p className="text-center text-xs text-muted-foreground">Problemas no acesso? Contacte o suporte técnico.</p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
