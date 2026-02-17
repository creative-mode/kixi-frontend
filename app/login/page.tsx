'use client';

import { useState } from 'react';
import { loginAction } from '@/app/actions/auth'; // ajusta o caminho se necessário
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

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

        // Pequeno delay para garantir que o cookie httpOnly seja definido
        // e que o middleware consiga ler antes de redirecionar
        await new Promise((resolve) => setTimeout(resolve, 400));

        // Redirecionamento suave (melhor que window.location.href em muitos casos)
        router.push('/manager');
        router.refresh(); // força refresh do RSC para carregar dados protegidos
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold">Kixi Manager</CardTitle>
          <CardDescription className="text-base mt-2">
            Autenticação de administrador
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="usernameOrEmail">Username ou Email</Label>
              <Input
                id="usernameOrEmail"
                name="usernameOrEmail"
                type="text"
                placeholder="admin@kixi.ao ou admin"
                required
                disabled={isLoading}
                autoComplete="username email"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Palavra-passe</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading} size="lg">
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

          {/* Opcional: link de recuperação de senha ou ajuda */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Problemas no acesso? Contacte o suporte técnico.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}