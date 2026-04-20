'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  Users,
  UserRound,
  LogOut,
  Stethoscope,
  ChevronRight,
  ChevronLeft,
  ClipboardList,
  DollarSign,
  UserCog,
  CalendarDays,
  FileText,
  FlaskConical,
  Flame,
  ScrollText,
} from 'lucide-react'

const navItems = [
  { href: '/pacientes',  label: 'Pacientes',  icon: UserRound    },
  { href: '/carteira',   label: 'Carteira',   icon: Users        },
  { href: '/agenda',     label: 'Agenda',     icon: CalendarDays },
  { href: '/prontuario', label: 'Prontuário', icon: FileText     },
  { href: '/planos',     label: 'Planos',     icon: ClipboardList },
  { href: '/financeiro', label: 'Financeiro', icon: DollarSign   },
  { href: '/usuarios',   label: 'Usuários',   icon: UserCog      },
]


interface SidebarProps {
  userEmail?: string
  collapsed?: boolean
  onToggle?: () => void
}

export default function Sidebar({ userEmail, collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className={cn(
      'fixed inset-y-0 left-0 bg-sidebar-bg border-r border-sidebar-border flex flex-col z-40',
      'transition-all duration-300 overflow-hidden',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Logo + toggle */}
      <div className="border-b border-sidebar-border flex-shrink-0">
        {collapsed ? (
          <div className="flex flex-col items-center py-4 gap-3">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <button
              onClick={onToggle}
              title="Expandir menu"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="px-4 py-5 flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-tight truncate">TabClin Consultoria</p>
              <p className="text-slate-500 text-xs leading-tight">Gestão de Pacientes</p>
            </div>
            <button
              onClick={onToggle}
              title="Recolher menu"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-colors flex-shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn('flex-1 py-4 space-y-0.5', collapsed ? 'px-2' : 'px-3')}>
        {!collapsed && (
          <p className="text-slate-600 text-xs font-semibold uppercase tracking-widest px-3 mb-3">
            Menu Principal
          </p>
        )}

        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            href === '/' ? pathname === '/' : pathname?.startsWith(href) ?? false

          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'sidebar-link group',
                active && 'sidebar-link-active',
                collapsed && 'justify-center px-0 py-2.5'
              )}
            >
              <Icon className={cn(
                'w-4 h-4 flex-shrink-0 transition-colors',
                active ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'
              )} />
              {!collapsed && (
                <>
                  <span className="flex-1">{label}</span>
                  {active && <ChevronRight className="w-3 h-3 text-brand-400 opacity-70" />}
                </>
              )}
            </Link>
          )
        })}

        {/* ─ Divisor + Check Exames ─ */}
        {!collapsed && (
          <p className="text-slate-600 text-xs font-semibold uppercase tracking-widest px-3 mt-4 mb-2">
            Ferramentas
          </p>
        )}
        <Link
          href="/check-exames"
          title={collapsed ? 'Check Exames' : undefined}
          className={cn(
            'sidebar-link group',
            pathname?.startsWith('/check-exames') && 'sidebar-link-active',
            collapsed && 'justify-center px-0 py-2.5'
          )}
        >
          <FlaskConical className={cn(
            'w-4 h-4 flex-shrink-0 transition-colors',
            pathname?.startsWith('/check-exames') ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'
          )} />
          {!collapsed && (
            <>
              <span className="flex-1">Check Exames</span>
              {pathname?.startsWith('/check-exames') && <ChevronRight className="w-3 h-3 text-brand-400 opacity-70" />}
            </>
          )}
        </Link>

        <Link
          href="/dri"
          title={collapsed ? 'DRI' : undefined}
          className={cn(
            'sidebar-link group',
            pathname?.startsWith('/dri') && 'sidebar-link-active',
            collapsed && 'justify-center px-0 py-2.5'
          )}
        >
          <Flame className={cn(
            'w-4 h-4 flex-shrink-0 transition-colors',
            pathname?.startsWith('/dri') ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'
          )} />
          {!collapsed && (
            <>
              <span className="flex-1">DRI</span>
              {pathname?.startsWith('/dri') && <ChevronRight className="w-3 h-3 text-brand-400 opacity-70" />}
            </>
          )}
        </Link>

        <Link
          href="/orientacoes"
          title={collapsed ? 'Orientações' : undefined}
          className={cn(
            'sidebar-link group',
            pathname?.startsWith('/orientacoes') && 'sidebar-link-active',
            collapsed && 'justify-center px-0 py-2.5'
          )}
        >
          <ScrollText className={cn(
            'w-4 h-4 flex-shrink-0 transition-colors',
            pathname?.startsWith('/orientacoes') ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'
          )} />
          {!collapsed && (
            <>
              <span className="flex-1">Orientações</span>
              {pathname?.startsWith('/orientacoes') && <ChevronRight className="w-3 h-3 text-brand-400 opacity-70" />}
            </>
          )}
        </Link>
      </nav>

      {/* User + Logout */}
      <div className={cn('py-4 border-t border-sidebar-border space-y-1', collapsed ? 'px-2' : 'px-3')}>
        {userEmail && !collapsed && (
          <div className="px-3 py-2 mb-1">
            <p className="text-slate-600 text-xs">Logado como</p>
            <p className="text-slate-300 text-xs font-medium truncate">{userEmail}</p>
          </div>
        )}

        <button
          onClick={handleLogout}
          title={collapsed ? 'Sair' : undefined}
          className={cn(
            'sidebar-link w-full hover:bg-red-500/10 hover:text-red-400 group',
            collapsed && 'justify-center px-0 py-2.5'
          )}
        >
          <LogOut className="w-4 h-4 flex-shrink-0 text-slate-500 group-hover:text-red-400 transition-colors" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  )
}
