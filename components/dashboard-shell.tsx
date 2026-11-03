'use client'

import { useState } from 'react'
import Sidebar from './sidebar'
import { cn } from '@/lib/utils'

interface DashboardShellProps {
  userEmail?: string
  tarefasUrgentes?: number
  children: React.ReactNode
}

export default function DashboardShell({ userEmail, tarefasUrgentes = 0, children }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        userEmail={userEmail}
        tarefasUrgentes={tarefasUrgentes}
        collapsed={collapsed}
        onToggle={() => setCollapsed(p => !p)}
      />
      <main className={cn(
        'flex-1 min-w-0 transition-all duration-300',
        collapsed ? 'ml-16' : 'ml-60'
      )}>
        <div className="max-w-7xl mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
