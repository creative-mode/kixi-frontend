'use client'

import { useState, useEffect } from 'react'
import { User } from 'lucide-react'
import { fetchCurrentUser } from '@/lib/auth'
import type { CurrentUser } from '@/types/auth'

export function UserDisplay() {
    const [user, setUser] = useState<CurrentUser | null>(null)

    useEffect(() => {
        fetchCurrentUser().then(setUser)
    }, [])

    if (!user) return null

    const primaryRole = user.roles?.[0] ?? 'User'

    return (
        <div className="flex items-center gap-2 text-sm">
            <div className="h-8 w-8 rounded-md border border-primary/40 bg-accent flex items-center justify-center">
                <User size={16} className="text-foreground" />
            </div>
            <div className="hidden lg:block">
                <p className="font-medium leading-none text-foreground">Admin</p>
                <p className="text-xs text-muted-foreground capitalize">{primaryRole.toLowerCase()}</p>
            </div>
        </div>
    )
}
