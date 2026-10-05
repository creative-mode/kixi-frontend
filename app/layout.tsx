import type React from "react"
import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"

// Tipos do design system Kixi, self-hosted
const jakarta = localFont({
  src: [
    { path: "./fonts/plus-jakarta-sans-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/plus-jakarta-sans-latin-600-normal.woff2", weight: "600" },
    { path: "./fonts/plus-jakarta-sans-latin-700-normal.woff2", weight: "700" },
  ],
  variable: "--ff-sans",
  display: "swap",
})

const mono = localFont({
  src: "./fonts/jetbrains-mono-latin-500-normal.woff2",
  weight: "500",
  variable: "--ff-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Kixi Manager",
  description: "Painel de gestão do Kixi",
  manifest: "/manager/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kixi Manager",
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: "#b7c198",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

import { ManagerNavbar } from "@/components/manager-navbar"
import { Providers } from "@/components/providers"
import { AuthLayout } from "@/components/auth-layout"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt" data-theme="light" className="scroll-smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('kixi-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}" }} />
      </head>
      <body
        className={`${jakarta.variable} ${mono.variable} font-sans antialiased`}
      >
        <Providers>
          <ManagerNavbar />
          <AuthLayout>
            {children}
          </AuthLayout>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
