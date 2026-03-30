'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Users, LayoutDashboard, TrendingUp, Upload } from 'lucide-react'

const tabs = [
  { href: '/carteira',             label: 'Carteira de Pacientes', icon: Users           },
  { href: '/carteira/dashboard',   label: 'Dashboard',             icon: LayoutDashboard },
  { href: '/carteira/indicadores', label: 'Indicadores',           icon: TrendingUp      },
  { href: '/carteira/upload',      label: 'Upload de Dados',       icon: Upload          },
]

export default function CarteiraTabNav() {
  const pathname = usePathname()

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit min-w-full sm:min-w-0">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = href === '/carteira'
            ? pathname === '/carteira'
            : (pathname ?? '').startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap',
                active
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
