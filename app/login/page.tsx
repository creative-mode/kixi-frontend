'use client';

import { useState } from 'react';
import { loginAction } from '@/app/actions/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { KixiLogo } from '@/components/kixi-logo';
import { Check, Eye, EyeOff } from 'lucide-react';

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
    <div className="grid min-h-dvh lg:grid-cols-[5fr_6fr]">
      <aside className="relative hidden flex-col justify-between gap-10 overflow-hidden bg-[#14391d] p-12 text-[#e5f0e2] lg:flex">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[.07] [background-image:radial-gradient(#fff_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative flex items-center gap-3">
          <KixiLogo size={30} wordmark className="[&_svg]:text-[#8fe86a]" />
          <span className="rounded-full border border-white/20 px-2.5 py-0.5 text-xs font-semibold text-[#b7d1b3]">Manager</span>
        </div>

        <div className="relative grid gap-4">
          <h2 className="max-w-[16ch] text-[34px] leading-[1.15] font-bold tracking-tight">Gere o banco de enunciados da escola.</h2>
          <p className="max-w-[40ch] text-[#b7d1b3]">Provas, questões, turmas e o desempenho dos alunos, num único painel.</p>
        </div>

        <ul className="relative grid gap-3 text-sm text-[#cfd8cb]">
          {['Enunciados e questões por disciplina e ano lectivo', 'Revisão e aprovação antes de chegarem aos alunos', 'Indicadores de actividade e desempenho em tempo real'].map((p) => (
            <li key={p} className="flex items-center gap-2.5"><Check className="size-4 text-[#8fe86a]" />{p}</li>
          ))}
        </ul>
      </aside>

      <main className="flex items-start justify-center px-6 py-10 sm:items-center">
        <div className="grid w-full max-w-[400px] gap-7">
          <KixiLogo size={24} wordmark className="lg:hidden" />
          <div className="grid gap-1.5">
            <h1 className="text-[26px] leading-tight font-bold tracking-tight">Bem-vindo de volta</h1>
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

          <p className="text-center text-xs text-muted-foreground">Problemas no acesso? Contacte o suporte técnico.</p>
        </div>
      </main>
    </div>
  );
}
