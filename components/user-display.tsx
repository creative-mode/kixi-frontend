'use client'

import { useState, useEffect } from 'react'
import { User } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import type { CurrentUser } from '@/lib/auth'

export function UserDisplay() {
    const [user, setUser] = useState<CurrentUser | null>(null)

    useEffect(() => {
        getCurrentUser().then(setUser)
    }, [])

    if (!user) return null

    return (
        <div className="flex items-center gap-2 text-sm">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User size={16} className="text-primary" />
            </div>
            <div className="hidden lg:block">
                <p className="font-medium leading-none">{user.name || 'Admin'}</p>
                <p className="text-xs text-muted-foreground">{user.role}</p>
            </div>
        </div>
    )
}
