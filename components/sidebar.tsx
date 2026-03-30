'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  Users,
  LogOut,
  Stethoscope,
  ChevronRight,
  ClipboardList,
  DollarSign,
  UserCog,
} from 'lucide-react'

const navItems = [
  { href: '/carteira',   label: 'Carteira',   icon: Users        },
  { href: '/planos',     label: 'Planos',     icon: ClipboardList },
  { href: '/financeiro', label: 'Financeiro', icon: DollarSign   },
  { href: '/usuarios',   label: 'Usuários',   icon: UserCog      },
]

interface SidebarProps {
  userEmail?: string
}

export default function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-sidebar-bg border-r border-sidebar-border flex flex-col z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Stethoscope className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">ClinKPI</p>
            <p className="text-slate-500 text-xs leading-tight">Gestão de Pacientes</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-slate-600 text-xs font-semibold uppercase tracking-widest px-3 mb-3">
          Menu Principal
        </p>

        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            href === '/' ? pathname === '/' : pathname?.startsWith(href) ?? false

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'sidebar-link group',
                active && 'sidebar-link-active'
              )}
            >
              <Icon className={cn(
                'w-4 h-4 flex-shrink-0 transition-colors',
                active ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'
              )} />
              <span className="flex-1">{label}</span>
              {active && (
                <ChevronRight className="w-3 h-3 text-brand-400 opacity-70" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* User + Logout */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
        {userEmail && (
          <div className="px-3 py-2 mb-1">
            <p className="text-slate-600 text-xs">Logado como</p>
            <p className="text-slate-300 text-xs font-medium truncate">{userEmail}</p>
          </div>
        )}

        <button
          onClick={handleLogout}
          className="sidebar-link w-full hover:bg-red-500/10 hover:text-red-400 group"
        >
          <LogOut className="w-4 h-4 flex-shrink-0 text-slate-500 group-hover:text-red-400 transition-colors" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  )
}
