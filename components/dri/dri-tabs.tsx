'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Calculator, History } from 'lucide-react'

const TABS = [
  { href: '/dri/calculadora', label: 'Calculadora', icon: Calculator },
  { href: '/dri/historico',   label: 'Histórico',   icon: History   },
]

export default function DRITabs() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-1">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname?.startsWith(href) ?? false
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              active
                ? 'bg-orange-50 text-orange-700 border border-orange-200'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
