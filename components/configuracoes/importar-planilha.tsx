'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/ckex/button'
import { importarPlanilhas } from '@/app/(dashboard)/configuracoes/acoes'
import { ResumoImportacaoView } from './resumo-importacao'
import type { ResumoImportacao } from '@/lib/gestaods/importar'

export function ImportarPlanilha() {
  const [enviando, iniciar] = useTransition()
  const [feitos, setFeitos] = useState<{ arquivo: string; tipo: string; resumo: ResumoImportacao }[]>([])

  return (
    <section className="bg-white rounded-xl border p-5 space-y-4" aria-labelledby="titulo-planilha">
      <div>
        <h2 id="titulo-planilha" className="font-semibold text-slate-800">Importar planilha</h2>
        <p className="text-sm text-slate-500">
          Alternativa à atualização automática: exporte do Gestão DS o relatório de <b>Pacientes</b> e/ou de <b>Atendimentos</b> (CSV) e envie aqui.
          Os pacientes já cadastrados são reconhecidos e completados; as consultas do período da planilha são substituídas.
        </p>
      </div>
      <form
        className="flex flex-wrap items-center gap-3"
        action={(form) => iniciar(async () => {
          const r = await importarPlanilhas(form)
          if (!r.ok) return void toast.error(r.erro)
          setFeitos(r.arquivos); toast.success('Planilha importada.')
        })}
      >
        <label className="flex-1 min-w-[260px]">
          <span className="sr-only">Planilhas do Gestão DS</span>
          <input name="arquivos" type="file" accept=".csv,text/csv" multiple required
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-slate-200" />
        </label>
        <Button type="submit" disabled={enviando}>
          {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Importar
        </Button>
      </form>
      {feitos.map((f) => (
        <div key={f.arquivo} className="border-t pt-3 space-y-1">
          <p className="text-sm font-medium text-slate-700">{f.arquivo} <span className="font-normal text-slate-500">({f.tipo === 'pacientes' ? 'relatório de pacientes' : 'relatório de atendimentos'})</span></p>
          <ResumoImportacaoView resumo={f.resumo} />
        </div>
      ))}
    </section>
  )
}
