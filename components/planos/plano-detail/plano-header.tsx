'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import PlanoStatusBadge from '@/components/planos/plano-status-badge'
import PlanoStatusSelect from '@/components/planos/planos-gestao/plano-status-select'
import type { PlanoAcompanhamento, PlanoStatus } from '@/types'

interface PlanoHeaderProps {
  plano: PlanoAcompanhamento
}

export default function PlanoHeader({ plano: initial }: PlanoHeaderProps) {
  const router = useRouter()
  const [status, setStatus] = useState<PlanoStatus>(initial.status)

  function handleUpdated(newStatus: PlanoStatus) {
    setStatus(newStatus)
    router.refresh()
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Link href="/planos" className="text-slate-400 hover:text-slate-600 transition-colors mt-0.5">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-lg font-bold text-slate-800">{initial.responsavel_nome}</h1>
              <PlanoStatusBadge status={status} />
            </div>
            {initial.responsavel_telefone && (
              <p className="text-sm text-slate-400 mt-0.5">{initial.responsavel_telefone}</p>
            )}
            {initial.data_inicio && initial.data_fim && (
              <p className="text-xs text-slate-400 mt-1">
                {initial.data_inicio.split('-').slice(0,2).reverse().join('/')}
                {' → '}
                {initial.data_fim.split('-').slice(0,2).reverse().join('/')}
              </p>
            )}
            {initial.plano_pagamento && (
              <p className="text-xs text-brand-600 mt-1 font-medium">
                {initial.plano_pagamento.nome}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <PlanoStatusSelect
            planoId={initial.id}
            currentStatus={status}
            onUpdated={handleUpdated}
          />
        </div>
      </div>

      {initial.observacao && (
        <p className="text-sm text-slate-500 mt-4 pt-4 border-t border-slate-100">
          {initial.observacao}
        </p>
      )}
    </div>
  )
}
