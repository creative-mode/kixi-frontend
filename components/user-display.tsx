'use client'

import { useState, useEffect } from 'react'
import { User } from 'lucide-react'
import { fetchCurrentUser } from '@/lib/auth'
import type { CurrentUser } from '@/types/auth'
import { managerRoleLabels } from '@/lib/roles'

/** `showText`: mostra o nome do papel ao lado do avatar (barra lateral); sem ele, só o avatar (cabeçalho do telemóvel). */
export function UserDisplay({ showText }: { showText?: boolean } = {}) {
    const [user, setUser] = useState<CurrentUser | null>(null)

    useEffect(() => {
        fetchCurrentUser().then(setUser)
    }, [])

    if (!user) return null

    // O papel vem dos papéis da sessão (JWT), pela regra do `managerRoleLabels`; o token não traz o nome da conta.
    const role = managerRoleLabels(user.roles)
    if (!role) return null

    return (
        <div className="flex items-center gap-3 text-sm">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent">
                <User size={17} className="text-primary" aria-hidden="true" />
            </div>
            <div className={showText ? 'min-w-0' : 'hidden'}>
                <p className="truncate font-bold leading-tight text-foreground">{role.title}</p>
                {role.others.length > 0 ? <p className="truncate text-xs text-muted-foreground">Também {role.others.join(', ').toLowerCase()}</p> : null}
            </div>
        </div>
    )
}
