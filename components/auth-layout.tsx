'use client'

import { usePathname } from 'next/navigation'

const PUBLIC_PAGES = ['/login', '/403']

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isPublicPage = PUBLIC_PAGES.includes(pathname)

  if (isPublicPage) {
    // No navbar padding, full-screen layout for login
    return (
      <main id="conteudo" tabIndex={-1} className="min-h-screen bg-background text-foreground outline-none">
        {children}
      </main>
    )
  }

  // Authenticated pages: add top padding for the fixed navbar
  // O `outline-none` no main e porque ele e alvo do skip-link: o foco chega aqui
  // por navegacao de fragmento, e um anel a volta da pagina inteira nao informa
  // ninguem. O skip-link, esse, mantem o anel - e o que precisa de o mostrar.
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only left-4 top-4 z-[60] rounded-md bg-card px-4 py-3 text-sm font-semibold shadow-md focus:not-sr-only focus:absolute"
      >
        Saltar para o conteudo
      </a>
      <main
        id="conteudo"
        tabIndex={-1}
        className="pt-16 min-h-screen bg-background text-foreground outline-none lg:pl-(--nav-width)"
      >
        {children}
      </main>
    </>
  )
}
