'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, ArrowLeftRight, TrendingUp,
  Package, Tag, CalendarDays, FileUp, BarChart3,
} from 'lucide-react'

const tabs = [
  { href: '/financeiro',               label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/financeiro/movimentacoes', label: 'Movimentações', icon: ArrowLeftRight  },
  { href: '/financeiro/fluxo',         label: 'Fluxo de Caixa', icon: TrendingUp    },
  { href: '/financeiro/planejamento',  label: 'Planejamento',  icon: CalendarDays    },
  { href: '/financeiro/dre',           label: 'DRE',           icon: BarChart3       },
  { href: '/financeiro/produtos',      label: 'Produtos',      icon: Package         },
  { href: '/financeiro/categorias',    label: 'Categorias',    icon: Tag             },
  { href: '/financeiro/importar',      label: 'Importar',      icon: FileUp          },
]

export default function FinTabNav() {
  const pathname = usePathname()

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit min-w-full sm:min-w-0">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = href === '/financeiro'
            ? pathname === '/financeiro'
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
