import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/components/dashboard-shell'
import { obterProfissional } from '@/lib/profissional'
import { tarefasUrgentes } from '@/lib/tarefas'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // garante o perfil antes de qualquer tela (as APIs das ferramentas dependem dele)
  const prof = await obterProfissional(user)
  const urgentes = prof ? await tarefasUrgentes(prof.id) : 0

  return (
    <DashboardShell userEmail={user.email} tarefasUrgentes={urgentes}>
      {children}
    </DashboardShell>
  )
}
