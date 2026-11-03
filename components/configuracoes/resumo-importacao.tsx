import type { ResumoImportacao } from '@/lib/gestaods/importar'

const dataBR = (s: string) => s.split('-').reverse().join('/')

/** O que uma atualização ou importação fez, e o que precisa de revisão. */
export function ResumoImportacaoView({ resumo }: { resumo: ResumoImportacao }) {
  return (
    <div className="text-sm text-slate-600 space-y-2">
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
        <li><b className="text-slate-800">{resumo.pacientesNovos}</b> pacientes novos</li>
        <li><b className="text-slate-800">{resumo.pacientesCompletados}</b> pacientes completados</li>
        {resumo.periodo && <li className="col-span-2"><b className="text-slate-800">{resumo.consultas}</b> consultas de {dataBR(resumo.periodo[0])} a {dataBR(resumo.periodo[1])}{resumo.consultasSemPaciente > 0 && <> ({resumo.consultasSemPaciente} sem paciente identificado)</>}</li>}
      </ul>
      {resumo.revisar.length > 0 && (
        <details className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <summary className="cursor-pointer font-medium text-amber-800">{resumo.revisar.length} paciente(s) não foram ligados automaticamente: confira</summary>
          <ul className="mt-2 space-y-1 text-amber-900">
            {resumo.revisar.slice(0, 100).map((r, i) => <li key={i}><b>{r.nome}</b>: {r.motivo}</li>)}
          </ul>
        </details>
      )}
    </div>
  )
}
