import { User } from 'lucide-react'

/** Os papéis vêm do layout, que já leu a sessão no servidor: sem um segundo pedido no browser (#389). */
export function UserDisplay({ roles }: { roles: string[] }) {
    if (roles.length === 0) return null

    const primaryRole = roles[0]

    return (
        <div className="flex items-center gap-2 text-sm">
            <div className="h-8 w-8 rounded-md border border-primary/40 bg-accent flex items-center justify-center">
                <User size={16} className="text-foreground" />
            </div>
            <div className="hidden lg:block">
                <p className="font-medium leading-none text-foreground">{primaryRole === 'TEACHER' ? 'Professor' : 'Admin'}</p>
                <p className="text-xs text-muted-foreground capitalize">{primaryRole.toLowerCase()}</p>
            </div>
        </div>
    )
}
