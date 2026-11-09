'use client'

import { useState, useEffect } from 'react'
import { User } from 'lucide-react'
import { fetchCurrentUser } from '@/lib/auth'
import type { CurrentUser } from '@/types/auth'

/** `showText`: mostra o nome do papel ao lado do avatar (barra lateral); sem ele, só o avatar (cabeçalho do telemóvel). */
export function UserDisplay({ showText }: { showText?: boolean } = {}) {
    const [user, setUser] = useState<CurrentUser | null>(null)

    useEffect(() => {
        fetchCurrentUser().then(setUser)
    }, [])

    if (!user) return null

    const primaryRole = user.roles?.[0] ?? 'User'

    const label = primaryRole === 'TEACHER' ? 'Professor' : primaryRole === 'COORDINATOR' ? 'Coordenador' : 'Admin'

    return (
        <div className="flex items-center gap-3 text-sm">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent">
                <User size={17} className="text-primary" aria-hidden="true" />
            </div>
            <div className={showText ? 'min-w-0' : 'hidden'}>
                <p className="truncate font-bold leading-tight text-foreground">{label}</p>
                <p className="text-xs capitalize text-muted-foreground">{primaryRole.toLowerCase()}</p>
            </div>
        </div>
    )
}
