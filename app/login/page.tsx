'use client'

import { useState } from 'react'
import { loginAction } from '@/app/actions/auth'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'

export default function LoginPage() {
    const [isLoading, setIsLoading] = useState(false)
    const [isChecking, setIsChecking] = useState(false)
    const router = useRouter()

    // Don't check auth on client side - let middleware handle it
    // The middleware will redirect authenticated users automatically

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setIsLoading(true)

        const formData = new FormData(e.currentTarget)

        try {
            const result = await loginAction(formData)

            if (result.success) {
                toast.success('Login realizado com sucesso!')
                // Small delay to ensure cookie is set before navigation
                await new Promise(resolve => setTimeout(resolve, 500))
                // Force a hard reload to ensure cookies are sent and bypass RSC issues
                window.location.href = '/manager'
            } else {
                toast.error(result.error || 'Erro ao fazer login')
            }
        } catch (error) {
            toast.error('Erro inesperado ao fazer login')
            console.error('Login error:', error)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold text-center">Kixi Manager</CardTitle>
                    <CardDescription className="text-center">
                        Entre com suas credenciais de administrador
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="admin@kixi.ao"
                                required
                                disabled={isLoading}
                                autoComplete="email"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Senha</Label>
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
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Entrando...' : 'Entrar'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
