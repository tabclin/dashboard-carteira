'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FlaskConical, BookOpen, Users } from 'lucide-react'

const TABS = [
  { href: '/check-exames/pacientes', label: 'Pacientes', icon: Users },
  { href: '/check-exames/analises', label: 'Análises', icon: FlaskConical },
  { href: '/check-exames/catalogo', label: 'Catálogo', icon: BookOpen },
]

export default function CheckExamesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b bg-white px-6 pt-5 pb-0 flex-shrink-0">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <FlaskConical className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">Check Exames</h1>
            <p className="text-xs text-slate-500">Análise de laudos laboratoriais com IA</p>
          </div>
        </div>

        {/* Abas */}
        <div className="flex gap-1">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = (pathname ?? '').startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
