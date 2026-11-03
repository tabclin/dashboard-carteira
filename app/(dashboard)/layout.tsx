import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardShell from '@/components/dashboard-shell'
import { obterProfissional } from '@/lib/profissional'

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
  await obterProfissional(user)

  return (
    <DashboardShell userEmail={user.email}>
      {children}
    </DashboardShell>
  )
}
