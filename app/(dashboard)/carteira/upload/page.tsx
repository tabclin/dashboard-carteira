'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, CheckCircle2, AlertCircle, FileText, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import Papa from 'papaparse'

type UploadTipo = 'atendimentos' | 'pacientes' | 'agenda'

interface UploadConfig {
  tipo: UploadTipo
  titulo: string
  descricao: string
  colunas: string
  cor: string
  instrucoes: string[]
}

const configs: UploadConfig[] = [
  {
    tipo: 'atendimentos',
    titulo: 'Relatório de Atendimentos',
    descricao: 'Arquivo relatorio-atendimentos.csv do GestaoDS',
    colunas: 'Data, Paciente, Cidade, CPF, Celular, Email, Serviço, Tipo, Médico, Valor, Status...',
    cor: 'brand',
    instrucoes: [
      'Exporte o relatório de atendimentos do GestaoDS',
      'O arquivo deve ser em formato CSV',
      'Dados existentes serão substituídos por completo',
    ],
  },
  {
    tipo: 'pacientes',
    titulo: 'Tabela de Pacientes',
    descricao: 'Arquivo tabela_pacientes.csv com cadastro de pacientes',
    colunas: 'Paciente, CPF, Telefone, Email, Nascimento, Cidade, Etiquetas',
    cor: 'indigo',
    instrucoes: [
      'Exporte a listagem de pacientes do GestaoDS',
      'Inclui data de nascimento e informações de contato',
      'Sincroniza sem apagar vínculos com planos de acompanhamento',
    ],
  },
  {
    tipo: 'agenda',
    titulo: 'Agenda / Agendamentos',
    descricao: 'Arquivo table_agenda_relatorio.csv com agendamentos futuros',
    colunas: 'Paciente, Telefone, Status, Data e hora, Observação',
    cor: 'emerald',
    instrucoes: [
      'Exporte os agendamentos ativos do GestaoDS',
      'Inclui data, hora e status do agendamento',
      'Dados existentes serão substituídos por completo',
    ],
  },
]

interface UploadState {
  status: 'idle' | 'loading' | 'success' | 'error'
  mensagem: string
  inseridos: number
}

function normalizarPacientes(rows: Record<string, string>[]) {
  return rows.map(row => ({
    paciente:   row['Paciente']    ?? row['paciente']    ?? null,
    cpf:        row['CPF']         ?? row['cpf']         ?? null,
    telefone:   row['Telefone']    ?? row['telefone']    ?? null,
    email:      row['E-mail']      ?? row['Email']       ?? row['email']       ?? null,
    nascimento: row['Nascimento']  ?? row['nascimento']  ?? null,
    cidade:     row['Cidade']      ?? row['cidade']      ?? null,
    etiquetas:  row['Etiquetas']   ?? row['etiquetas']   ?? null,
  })).filter(r => r.paciente)
}

function normalizarAtendimentos(rows: Record<string, string>[]) {
  return rows.map(row => ({
    data_atendimento: row['Data']             ?? row['data_atendimento']   ?? null,
    paciente:         row['Paciente']         ?? row['paciente']           ?? null,
    cidade:           row['Cidade']           ?? row['cidade']             ?? null,
    cpf:              row['CPF']              ?? row['cpf']                ?? null,
    celular:          row['Celular']          ?? row['celular']            ?? null,
    email:            row['E-mail']           ?? row['email']              ?? null,
    servico:          row['Serviço']          ?? row['servico']            ?? null,
    tipo:             row['Tipo']             ?? row['tipo']               ?? null,
    'Orçamento':      row['Orçamento']        ?? null,
    medico:           row['Médico']           ?? row['medico']             ?? null,
    'CNS':            row['CNS']              ?? null,
    'Número do cartão': row['Número do cartão'] ?? null,
    'Convênio':       row['Convênio']         ?? null,
    'Sala / Equipamento': row['Sala / Equipamento'] ?? null,
    valor:            parseValor(row['Valor']),
    'Valor líquido':  parseValor(row['Valor líquido']),
    'Valor total':    parseValor(row['Valor total']),
    status:           row['Status']           ?? row['status']             ?? null,
    'Estoque utilizado': row['Estoque utilizado'] ?? null,
    'Lucro líquido':  parseValor(row['Lucro líquido']),
    'Observações':    row['Observações']      ?? null,
  })).filter(r => r.paciente)
}

function normalizarAgenda(rows: Record<string, string>[]) {
  return rows.map(row => {
    const dataHora = row['Data e hora'] ?? ''
    const partes = dataHora.trim().split(' ')
    let data_atendimento: string | null = null
    let hora_atendimento: string | null = null
    if (partes.length >= 2) {
      const [d, m, y] = (partes[0] ?? '').split('/')
      if (d && m && y) data_atendimento = `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
      hora_atendimento = partes[1] ?? null
    }
    return {
      paciente:          row['Paciente']   ?? row['paciente']   ?? null,
      telefone:          row['Telefone']   ?? row['telefone']   ?? null,
      status:            row['Status']     ?? row['status']     ?? null,
      data_atendimento,
      hora_atendimento,
      observacao:        row['Observação'] ?? row['observacao'] ?? null,
    }
  }).filter(r => r.paciente)
}

function parseValor(v: string | undefined): number | null {
  if (!v) return null
  const limpo = v.replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.').trim()
  const num = parseFloat(limpo)
  return isNaN(num) ? null : Math.round(num * 100)
}

export default function UploadPage() {
  const [estados, setEstados] = useState<Record<UploadTipo, UploadState>>({
    atendimentos: { status: 'idle', mensagem: '', inseridos: 0 },
    pacientes:    { status: 'idle', mensagem: '', inseridos: 0 },
    agenda:       { status: 'idle', mensagem: '', inseridos: 0 },
  })
  const [dragOver, setDragOver] = useState<UploadTipo | null>(null)
  const refs = {
    atendimentos: useRef<HTMLInputElement>(null),
    pacientes:    useRef<HTMLInputElement>(null),
    agenda:       useRef<HTMLInputElement>(null),
  }

  function setEstado(tipo: UploadTipo, partial: Partial<UploadState>) {
    setEstados(prev => ({ ...prev, [tipo]: { ...prev[tipo], ...partial } }))
  }

  async function processarArquivo(tipo: UploadTipo, file: File) {
    setEstado(tipo, { status: 'loading', mensagem: 'Processando arquivo...', inseridos: 0 })

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: '',
      complete: async (results) => {
        const rows = results.data as Record<string, string>[]
        if (rows.length === 0) {
          setEstado(tipo, { status: 'error', mensagem: 'Arquivo vazio ou sem dados válidos.' })
          return
        }

        let normalizado: object[]
        try {
          if (tipo === 'atendimentos') normalizado = normalizarAtendimentos(rows)
          else if (tipo === 'pacientes') normalizado = normalizarPacientes(rows)
          else normalizado = normalizarAgenda(rows)
        } catch {
          setEstado(tipo, { status: 'error', mensagem: 'Erro ao processar colunas do arquivo.' })
          return
        }

        if (normalizado.length === 0) {
          setEstado(tipo, { status: 'error', mensagem: 'Nenhum dado válido encontrado. Verifique as colunas do arquivo.' })
          return
        }

        const supabase = createClient()

        if (tipo === 'pacientes') {
          type LinhaPaciente = {
            paciente: string | null; cpf: string | null; telefone: string | null
            email: string | null; nascimento: string | null; cidade: string | null; etiquetas: string | null
          }
          const linhas = normalizado as LinhaPaciente[]

          setEstado(tipo, { status: 'loading', mensagem: 'Buscando pacientes existentes...' })

          const { data: existentes, error: errExist } = await supabase
            .from('pacientes').select('id, paciente, nascimento')

          if (errExist) {
            setEstado(tipo, { status: 'error', mensagem: `Erro ao buscar pacientes: ${errExist.message}` })
            return
          }

          const mapa = new Map<string, string>()
          for (const e of existentes ?? []) {
            mapa.set(`${e.paciente}|${e.nascimento ?? ''}`, e.id)
          }

          const novosMap = new Map<string, LinhaPaciente>()
          const aAtualizar: { id: string; linha: LinhaPaciente }[] = []

          for (const linha of linhas) {
            const chave = `${linha.paciente}|${linha.nascimento ?? ''}`
            const id = mapa.get(chave)
            if (id) aAtualizar.push({ id, linha })
            else novosMap.set(chave, linha)
          }

          const novos = Array.from(novosMap.values())
          let processados = 0

          for (const { id, linha } of aAtualizar) {
            const { error } = await supabase.from('pacientes').update({
              cpf: linha.cpf, telefone: linha.telefone, email: linha.email,
              cidade: linha.cidade, etiquetas: linha.etiquetas,
            }).eq('id', id)
            if (error) {
              setEstado(tipo, { status: 'error', mensagem: `Erro ao atualizar: ${error.message}` })
              return
            }
            processados++
            if (processados % 50 === 0) {
              setEstado(tipo, { status: 'loading', mensagem: `Sincronizando... ${processados}/${linhas.length}`, inseridos: processados })
            }
          }

          const LOTE_PAC = 500
          for (let i = 0; i < novos.length; i += LOTE_PAC) {
            const lote = novos.slice(i, i + LOTE_PAC).map(l => ({ ...l, fonte: 'csv' }))
            const { error } = await supabase.from('pacientes').insert(lote)
            if (error) {
              setEstado(tipo, { status: 'error', mensagem: `Erro ao inserir novos: ${error.message}` })
              return
            }
            processados += lote.length
            setEstado(tipo, { status: 'loading', mensagem: `Inserindo novos... ${processados}/${linhas.length}`, inseridos: processados })
          }

          setEstado(tipo, {
            status: 'success',
            mensagem: `Sincronizado: ${novos.length} novo${novos.length !== 1 ? 's' : ''}, ${aAtualizar.length} atualizado${aAtualizar.length !== 1 ? 's' : ''}.`,
            inseridos: linhas.length,
          })
          return
        }

        const { error: delError } = await supabase.from(tipo).delete().neq('id', '00000000-0000-0000-0000-000000000000')
        if (delError) {
          setEstado(tipo, { status: 'error', mensagem: `Erro ao limpar tabela: ${delError.message}` })
          return
        }

        const LOTE = 500
        let inseridos = 0
        for (let i = 0; i < normalizado.length; i += LOTE) {
          const lote = normalizado.slice(i, i + LOTE)
          const { error } = await supabase.from(tipo).insert(lote)
          if (error) {
            setEstado(tipo, { status: 'error', mensagem: `Erro ao inserir: ${error.message}` })
            return
          }
          inseridos += lote.length
          setEstado(tipo, { status: 'loading', mensagem: `Inserindo... ${inseridos}/${normalizado.length}`, inseridos })
        }

        setEstado(tipo, {
          status: 'success',
          mensagem: `${inseridos} registros importados com sucesso!`,
          inseridos,
        })
      },
      error: () => {
        setEstado(tipo, { status: 'error', mensagem: 'Erro ao ler o arquivo CSV.' })
      },
    })
  }

  function handleFile(tipo: UploadTipo, files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    if (!file.name.endsWith('.csv')) {
      setEstado(tipo, { status: 'error', mensagem: 'Por favor, selecione um arquivo .csv' })
      return
    }
    processarArquivo(tipo, file)
  }

  const corMap: Record<string, string> = {
    brand:   'border-brand-300 bg-brand-50   hover:border-brand-400',
    indigo:  'border-indigo-300 bg-indigo-50 hover:border-indigo-400',
    emerald: 'border-emerald-300 bg-emerald-50 hover:border-emerald-400',
  }

  return (
    <div className="space-y-5">
      {/* Aviso */}
      <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-700">Atenção ao importar</p>
          <p className="text-xs text-amber-600 mt-0.5">
            Atendimentos e Agenda substituem os dados existentes. Pacientes são sincronizados — registros existentes são atualizados sem perder vínculos com planos.
          </p>
        </div>
      </div>

      {/* Cards de upload */}
      <div className="grid gap-4">
        {configs.map(cfg => {
          const estado = estados[cfg.tipo]
          const corClasses = corMap[cfg.cor]

          return (
            <div key={cfg.tipo} className="card">
              <div className="flex items-start gap-4">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                  cfg.cor === 'brand'   ? 'bg-brand-100 text-brand-600'   :
                  cfg.cor === 'indigo'  ? 'bg-indigo-100 text-indigo-600' :
                                          'bg-emerald-100 text-emerald-600'
                )}>
                  <FileText className="w-5 h-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-800 text-sm">{cfg.titulo}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{cfg.descricao}</p>
                  <p className="text-xs text-slate-400 mt-1 font-mono">{cfg.colunas}</p>
                  <ul className="mt-2 space-y-0.5">
                    {cfg.instrucoes.map((inst, i) => (
                      <li key={i} className="text-xs text-slate-500 flex items-start gap-1.5">
                        <span className="text-slate-300 mt-0.5">•</span>
                        {inst}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div
                className={cn(
                  'mt-4 border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer',
                  corClasses,
                  dragOver === cfg.tipo && 'scale-[0.99]'
                )}
                onDragOver={e => { e.preventDefault(); setDragOver(cfg.tipo) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={e => {
                  e.preventDefault()
                  setDragOver(null)
                  handleFile(cfg.tipo, e.dataTransfer.files)
                }}
                onClick={() => refs[cfg.tipo].current?.click()}
              >
                <Upload className={cn(
                  'w-8 h-8 mx-auto mb-2',
                  cfg.cor === 'brand'   ? 'text-brand-400'   :
                  cfg.cor === 'indigo'  ? 'text-indigo-400'  :
                                          'text-emerald-400'
                )} />
                <p className="text-sm font-medium text-slate-600">
                  Arraste o arquivo aqui ou <span className={cn(
                    'underline',
                    cfg.cor === 'brand'   ? 'text-brand-600'   :
                    cfg.cor === 'indigo'  ? 'text-indigo-600'  :
                                            'text-emerald-600'
                  )}>clique para selecionar</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">Apenas arquivos .csv</p>

                <input
                  ref={refs[cfg.tipo]}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => handleFile(cfg.tipo, e.target.files)}
                />
              </div>

              {estado.status !== 'idle' && (
                <div className={cn(
                  'mt-3 flex items-center gap-2.5 rounded-xl px-4 py-3',
                  estado.status === 'loading' && 'bg-slate-50 border border-slate-200',
                  estado.status === 'success' && 'bg-emerald-50 border border-emerald-200',
                  estado.status === 'error'   && 'bg-red-50 border border-red-200',
                )}>
                  {estado.status === 'loading' && <Loader2 className="w-4 h-4 text-slate-500 animate-spin flex-shrink-0" />}
                  {estado.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                  {estado.status === 'error'   && <AlertCircle  className="w-4 h-4 text-red-500 flex-shrink-0" />}

                  <p className={cn(
                    'text-sm flex-1',
                    estado.status === 'loading' && 'text-slate-600',
                    estado.status === 'success' && 'text-emerald-700',
                    estado.status === 'error'   && 'text-red-600',
                  )}>
                    {estado.mensagem}
                  </p>

                  {estado.status !== 'loading' && (
                    <button
                      onClick={() => setEstado(cfg.tipo, { status: 'idle', mensagem: '', inseridos: 0 })}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
