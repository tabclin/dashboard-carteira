import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TabClin Consultoria — Gestão de Pacientes',
  description: 'Sistema de gestão de carteira de pacientes',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
