'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { CalendarDays, List } from 'lucide-react'

const tabs = [
  { href: '/agenda',      label: 'Semana',        icon: CalendarDays, exact: true  },
  { href: '/agenda/hoje', label: 'Hoje',           icon: List,         exact: false },
]

export default function AgendaTabNav() {
  const pathname = usePathname() ?? ''

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit min-w-full sm:min-w-0">
        {tabs.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                active
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
