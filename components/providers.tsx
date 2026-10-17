'use client'

import { TechifyUIProvider } from '@techify/ui'
import type React from 'react'
import { useServiceWorker } from '@/hooks/use-service-worker'

const UI_CONFIG = {
    loading: { mode: 'blur', showText: false },
    defaults: { size: 'md', variant: 'primary' },
    feedback: {
        showIcon: true,
        showMessage: true,
        autoReset: true,
        autoResetDelay: 2000,
    },
    input: {
        borderRadius: '0.5rem',
        borderWidth: '1px',
    },
} as const

export function Providers({ children }: { children: React.ReactNode }) {
    // Register service worker for PWA
    useServiceWorker()

    return (
        <TechifyUIProvider
            config={UI_CONFIG}
        >
            {children}
        </TechifyUIProvider>
    )
}

