import type React from "react"
import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"

// Kixi design system v6 typefaces, self-hosted
const pixel = localFont({
  src: "./fonts/press-start-2p-latin-400-normal.woff2",
  weight: "400",
  variable: "--ff-pixel",
  display: "swap",
})

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
  themeColor: "#a8b389",
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
    <html lang="pt" className="scroll-smooth">
      <body
        className={`${pixel.variable} ${jakarta.variable} ${mono.variable} font-sans antialiased`}
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
