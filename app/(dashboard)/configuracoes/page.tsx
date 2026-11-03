import { Settings } from 'lucide-react'
import { prisma } from '@/lib/prisma/client'
import { profissionalDoLogin } from '@/lib/profissional'
import { GestaoDSConfig } from '@/components/configuracoes/gestaods-config'
import { ImportarPlanilha } from '@/components/configuracoes/importar-planilha'
import type { ResumoImportacao } from '@/lib/gestaods/importar'
import { PrazosPadrao } from '@/components/configuracoes/prazos-padrao'
import { diasPadrao } from '@/lib/tarefas'

// a primeira atualização traz o histórico e pode passar de 1 minuto
export const maxDuration = 300

export default async function ConfiguracoesPage() {
  const prof = await profissionalDoLogin()
  if (!prof) return null

  // nunca lê a chave: só o final e o estado da última atualização
  const integ = await prisma.integracaoGestaoDS.findUnique({
    where: { professionalId: prof.id },
    select: { tokenFinal: true, ultimaSincronizacao: true, ultimoStatus: true, ultimoErro: true, ultimoResumo: true },
  })
  const [pacientes, consultas, dias] = await Promise.all([
    prisma.patient.count({ where: { professionalId: prof.id } }),
    prisma.consulta.count({ where: { professionalId: prof.id } }),
    diasPadrao(prof.id),
  ])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b bg-white px-6 py-5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
            <Settings className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 leading-tight">Configurações</h1>
            <p className="text-xs text-slate-500">Integração com o Gestão DS e importação de planilhas · {pacientes} pacientes · {consultas} consultas</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto bg-slate-50 p-6 space-y-6 max-w-3xl">
        <GestaoDSConfig
          integracao={integ && {
            final: integ.tokenFinal,
            ultima: integ.ultimaSincronizacao?.toISOString() ?? null,
            status: integ.ultimoStatus,
            erro: integ.ultimoErro,
            resumo: integ.ultimoResumo as (ResumoImportacao & { segundos: number }) | null,
          }}
        />
        <ImportarPlanilha />
        <PrazosPadrao dias={dias} />
      </div>
    </div>
  )
}
