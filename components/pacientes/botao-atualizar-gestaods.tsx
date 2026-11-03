'use client'

import { useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/ckex/button'
import { atualizarPeloGestaoDS } from '@/app/(dashboard)/configuracoes/acoes'

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

export function BotaoAtualizarGestaoDS({ ultima }: { ultima: string | null }) {
  const [atualizando, iniciar] = useTransition()
  const atualizar = () => iniciar(async () => {
    const r = await atualizarPeloGestaoDS()
    if (!r.ok) return void toast.error(r.erro)
    const s = r.resumo
    toast.success(`Atualizado: ${s.pacientesNovos} pacientes novos, ${s.consultas} consultas.` + (s.revisar.length ? ` ${s.revisar.length} para conferir em Configurações.` : ''))
  })
  return (
    <div className="flex items-center gap-3">
      {ultima && !atualizando && <span className="text-xs text-slate-500">Gestão DS: {quando(ultima)}</span>}
      {atualizando && <span className="text-xs text-slate-500">{ultima ? 'Atualizando…' : 'Primeira atualização: pode levar alguns minutos…'}</span>}
      <Button variant="outline" size="sm" onClick={atualizar} disabled={atualizando}>
        {atualizando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Atualizar do Gestão DS
      </Button>
    </div>
  )
}
