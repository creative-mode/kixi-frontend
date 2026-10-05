'use client';

import { useState } from 'react';
import { loginAction } from '@/app/actions/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { KixiLogo } from '@/components/kixi-logo';
import { Eye, EyeOff } from 'lucide-react';

const SHIP =
  'M12 0h1v1h-1zM10 1h3v1h-3zM8 2h5v1h-5zM8 3h5v1h-5zM8 4h5v1h-5zM8 5h5v1h-5zM8 6h5v1h-5zM8 7h5v1h-5zM8 8h5v1h-5zM8 9h6v1h-6zM7 10h7v1h-7zM7 11h8v1h-8zM6 12h10v1h-10zM6 13h11v1h-11zM5 14h14v1h-14zM4 15h18v1h-18zM3 16h21v1h-21zM3 17h4v1h-4zM14 17h9v1h-9zM1 18h2v1h-2zM17 18h5v1h-5zM19 19h1v1h-1z';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [show, setShow] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);

    try {
      const result = await loginAction(formData);

      if (result.success) {
        toast.success('Login realizado com sucesso!', {
          description: 'A redirecionar para o painel...',
          duration: 3000,
        });

        await new Promise((resolve) => setTimeout(resolve, 400));

        router.push('/');
        router.refresh();
      } else {
        toast.error(result.error || 'Credenciais inválidas', {
          description: 'Verifique o username/email e a senha.',
        });
      }
    } catch (error) {
      console.error('Erro no login:', error);
      toast.error('Erro de conexão', {
        description: 'Não foi possível conectar ao servidor. Tente novamente.',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-7 px-6 py-10">
      <div aria-hidden className="relative -mb-3 flex flex-col items-center">
        <svg viewBox="0 0 24 20" width="72" height="60" shapeRendering="crispEdges" className="text-primary drop-shadow-[0_3px_0_rgba(27,36,19,.25)]">
          <path d={SHIP} fill="currentColor" />
        </svg>
        <span className="mt-1.5 grid gap-1.5">
          <i className="block h-3 w-1.5 bg-highlight shadow-[0_0_0_1.5px_var(--primary)]" />
          <i className="block h-3 w-1.5 bg-highlight shadow-[0_0_0_1.5px_var(--primary)]" />
        </span>
      </div>
      <div className="w-full max-w-[400px] overflow-hidden rounded-xl border-[1.6px] border-primary bg-card shadow-[5px_5px_0_0_var(--primary)]">
        <div aria-hidden className="h-3.5 border-b-[1.6px] border-primary [background:repeating-linear-gradient(60deg,var(--primary)_0_1px,transparent_1px_5px)]" />
        <div className="grid gap-6 p-6 sm:p-8">
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl leading-tight font-bold tracking-tight">Bem-vindo de volta</h1>
              <span className="rounded-full bg-highlight px-2.5 py-0.5 text-xs font-bold text-highlight-foreground">Manager</span>
            </div>
            <p className="text-sm text-muted-foreground">Inicie sessão para aceder ao painel de gestão.</p>
          </div>
          <form onSubmit={handleSubmit} className="grid gap-5">
    <div className="grid gap-2">
      <Label htmlFor="usernameOrEmail">Username ou email</Label>
      <Input id="usernameOrEmail" name="usernameOrEmail" type="text" placeholder="admin@kixi.ao" required disabled={isLoading} autoComplete="username email" autoFocus />
    </div>
    <div className="grid gap-2">
      <Label htmlFor="password">Palavra-passe</Label>
      <div className="relative">
        <Input id="password" name="password" type={show ? 'text' : 'password'} placeholder="••••••••" required disabled={isLoading} autoComplete="current-password" className="pr-10" />
        <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
    <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
      {isLoading ? (<><span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />A entrar...</>) : 'Entrar'}
    </Button>
  </form>

        </div>
      </div>
      <KixiLogo size={18} wordmark />
      <p className="text-center text-xs text-muted-foreground">Problemas no acesso? Contacte o suporte técnico.</p>
    </main>
  );
}
