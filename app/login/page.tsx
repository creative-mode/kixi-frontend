'use client';

import { useState } from 'react';
import { loginAction } from '@/app/actions/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { KixiLogo } from '@/components/kixi-logo';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
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
    <div className="min-h-screen flex">
      {/* Left — brand panel: the handheld screen with the ship and a formation of study topics */}
      <div className="kx-screen hidden lg:flex lg:w-1/2 bg-muted relative items-center justify-center overflow-hidden border-r-2 border-border">
        <div className="absolute inset-x-0 top-12 flex justify-center gap-10 text-alvo" aria-hidden="true">
          {['text-alvo', 'text-pop', 'text-radar', 'text-tiro', 'text-lila'].map((c, i) => (
            <svg key={i} viewBox="0 0 11 8" width="44" height="32" shapeRendering="crispEdges" className={c}>
              <path fill="currentColor" d="M2 0h1v1h-1zM8 0h1v1h-1zM3 1h5v1h-5zM2 2h7v1h-7zM1 3h2v1h-2zM4 3h3v1h-3zM8 3h2v1h-2zM0 4h11v1h-11zM0 5h1v1h-1zM2 5h7v1h-7zM10 5h1v1h-1zM2 6h1v1h-1zM8 6h1v1h-1zM1 7h2v1h-2zM8 7h2v1h-2z" />
            </svg>
          ))}
        </div>
        <div className="absolute left-1/2 top-[88px] -translate-x-1/2 flex flex-col gap-3" aria-hidden="true">
          <span className="block h-3 w-1 bg-tiro" />
          <span className="block h-3 w-1 bg-tiro" />
        </div>

        <div className="relative z-10 text-center px-12">
          <KixiLogo size={120} wordmark stacked className="mx-auto mb-10" />
          <h1 className="font-pixel text-lg leading-relaxed text-foreground mb-4">
            Kixi Manager
          </h1>
          <p className="text-muted-foreground text-base max-w-sm mx-auto leading-relaxed">
            Painel de gestão administrativa do Banco de Enunciados.
          </p>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-card">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-10">
            <KixiLogo size={72} wordmark stacked />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              Bem-vindo de volta
            </h2>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Inicie sessão para aceder ao painel de gestão.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="usernameOrEmail" className="text-sm font-medium text-foreground">
                Username ou Email
              </Label>
              <Input
                id="usernameOrEmail"
                name="usernameOrEmail"
                type="text"
                placeholder="admin@kixi.ao"
                required
                disabled={isLoading}
                autoComplete="username email"
                autoFocus
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                Palavra-passe
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                disabled={isLoading}
                autoComplete="current-password"
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                  A entrar...
                </div>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Problemas no acesso? Contacte o suporte técnico.
          </p>
        </div>
      </div>
    </div>
  );
}