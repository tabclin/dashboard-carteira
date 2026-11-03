import { redirect } from 'next/navigation'
import { usuarioAtual } from '@/lib/supabase/server'
import DashboardShell from '@/components/dashboard-shell'
import { profissionalDoLogin } from '@/lib/profissional'
import { tarefasUrgentes } from '@/lib/tarefas'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await usuarioAtual()

  if (!user) {
    redirect('/login')
  }

  // garante o perfil antes de qualquer tela (as APIs das ferramentas dependem dele)
  const prof = await profissionalDoLogin()
  const urgentes = prof ? await tarefasUrgentes(prof.id) : 0

  return (
    <DashboardShell userEmail={user.email} tarefasUrgentes={urgentes}>
      {children}
    </DashboardShell>
  )
}
