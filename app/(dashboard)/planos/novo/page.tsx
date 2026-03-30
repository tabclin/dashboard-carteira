import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import PlanoWizard from '@/components/planos/wizard/plano-wizard'
import type { Servico, PlanoPagamento } from '@/types'

export const revalidate = 0

export default async function NovoPlanoPage() {
  const supabase = createClient()

  const [{ data: servicos }, { data: planosPagamento }] = await Promise.all([
    supabase.from('servicos').select('*').eq('ativo', true).order('nome'),
    supabase.from('planos_pagamento').select('*').eq('ativo', true).order('nome'),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/planos" className="text-slate-400 hover:text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Novo Plano de Acompanhamento</h1>
          <p className="text-sm text-slate-500 mt-0.5">Siga os passos para criar e simular o plano</p>
        </div>
      </div>

      <PlanoWizard
        servicos={(servicos ?? []) as Servico[]}
        planosPagamento={(planosPagamento ?? []) as PlanoPagamento[]}
      />
    </div>
  )
}
