// Leitura das planilhas (CSV) exportadas do Gestão DS: relatório de pacientes e de atendimentos.
// Mesmos relatórios aceitos pelo Raio-X; o tipo é reconhecido pelas colunas.
import Papa from 'papaparse'
import { dataISO, type PacienteEntrada, type ConsultaEntrada } from './vinculo'

export type PlanilhaLida =
  | { tipo: 'pacientes'; arquivo: string; pacientes: PacienteEntrada[] }
  | { tipo: 'atendimentos'; arquivo: string; pacientes: PacienteEntrada[]; consultas: ConsultaEntrada[]; periodo: [string, string] }

const limpar = (v: unknown) => {
  const s = v == null ? '' : String(v).trim()
  return s === '' || s === '-' ? null : s
}

export function lerPlanilha(texto: string, arquivo: string): PlanilhaLida {
  const r = Papa.parse<Record<string, string>>(texto.replace(/^﻿/, ''), {
    header: true, skipEmptyLines: true, transformHeader: (h) => h.replace(/^﻿/, '').trim(),
  })
  const campos = r.meta.fields ?? []
  const tem = (c: string) => campos.includes(c)

  if (tem('Data atendimento') && tem('Paciente')) {
    const consultas: ConsultaEntrada[] = [], pacientes: PacienteEntrada[] = []
    for (const l of r.data) {
      const nome = limpar(l['Paciente']), data = dataISO(l['Data atendimento'])
      if (!nome || !data) continue
      const cpf = limpar(l['CPF'])
      consultas.push({ gestaodsId: null, pacienteGestaodsId: null, pacienteCpf: cpf, pacienteNome: nome, data, tipo: limpar(l['Tipo']), servico: limpar(l['Serviço']) })
      pacientes.push({ gestaodsId: null, nome, nascimento: null, cpf, telefone: null, email: null, cidade: limpar(l['Cidade']) })
    }
    if (!consultas.length) throw new Error(`"${arquivo}": nenhum atendimento com data encontrado.`)
    const datas = consultas.map((c) => c.data).sort()
    return { tipo: 'atendimentos', arquivo, pacientes, consultas, periodo: [datas[0], datas[datas.length - 1]] }
  }

  if (tem('Nascimento') && tem('Paciente')) {
    const pacientes: PacienteEntrada[] = []
    for (const l of r.data) {
      const nome = limpar(l['Paciente']); if (!nome) continue
      pacientes.push({
        gestaodsId: null, nome, nascimento: dataISO(l['Nascimento']), cpf: limpar(l['CPF']),
        telefone: limpar(l['Telefone']), email: limpar(l['Email']), cidade: limpar(l['Cidade']),
      })
    }
    return { tipo: 'pacientes', arquivo, pacientes }
  }

  throw new Error(`"${arquivo}": não reconheci esta planilha. Use o relatório de Pacientes ou de Atendimentos do Gestão DS. Colunas encontradas: ${campos.slice(0, 6).join(', ')}…`)
}
