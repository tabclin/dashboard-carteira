'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/ckex/button'
import { TIPOS_TAREFA, type DiasPadrao } from '@/lib/tarefas-regras'
import { salvarDiasPadrao } from '@/app/(dashboard)/tarefas/acoes'

export function PrazosPadrao({ dias }: { dias: DiasPadrao }) {
  const [valores, setValores] = useState(dias)
  const [salvando, iniciar] = useTransition()
  const salvar = () => iniciar(async () => {
    const r = await salvarDiasPadrao(valores)
    if (r.ok) toast.success('Prazos salvos.'); else toast.error(r.erro)
  })
  return (
    <section className="bg-white rounded-xl border p-5 space-y-4" aria-labelledby="titulo-prazos">
      <div>
        <h2 id="titulo-prazos" className="font-semibold text-slate-800">Prazo padrão das tarefas</h2>
        <p className="text-sm text-slate-500">Usado quando o paciente não tem retorno marcado no Gestão DS. Com retorno marcado, o prazo sugerido é a véspera do retorno.</p>
      </div>
      <form className="flex flex-wrap items-end gap-4" onSubmit={(e) => { e.preventDefault(); salvar() }}>
        {TIPOS_TAREFA.map(({ tipo, acao }) => (
          <label key={tipo} className="text-sm text-slate-700">
            <span className="block text-xs text-slate-500 mb-1">{acao}</span>
            <span className="flex items-center gap-1.5">
              <input type="number" min={0} max={90} value={valores[tipo]} required
                onChange={(e) => setValores((v) => ({ ...v, [tipo]: Number(e.target.value) }))}
                className="w-20 rounded-md border border-slate-200 px-2 py-1.5 text-sm" /> dias
            </span>
          </label>
        ))}
        <Button type="submit" variant="outline" disabled={salvando}>{salvando && <Loader2 className="w-4 h-4 animate-spin" />} Salvar prazos</Button>
      </form>
    </section>
  )
}
