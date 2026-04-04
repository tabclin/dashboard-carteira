'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, formatarData } from '@/lib/utils'
import { Plus, X, Loader2, FileText, ExternalLink, Trash2, FlaskConical, Scan } from 'lucide-react'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import type { ProntuarioExame } from '@/types'

interface ExamesListProps {
  exames: ProntuarioExame[]
  prontuarioId: string
  bloqueado?: boolean
}

type TipoExame = 'laboratorial' | 'imagem' | 'outro'

const TIPO_CONFIG: Record<TipoExame, { label: string; icon: React.ElementType; cor: string }> = {
  laboratorial: { label: 'Laboratorial', icon: FlaskConical, cor: 'text-blue-600 bg-blue-50' },
  imagem:       { label: 'Imagem',       icon: Scan,         cor: 'text-violet-600 bg-violet-50' },
  outro:        { label: 'Outro',        icon: FileText,     cor: 'text-slate-600 bg-slate-100' },
}

export default function ExamesList({ exames, prontuarioId, bloqueado = false }: ExamesListProps) {
  const supabase = createClient()
  const router   = useRouter()
  const fileRef  = useRef<HTMLInputElement>(null)

  const [formAberto, setFormAberto]   = useState(false)
  const [nome, setNome]               = useState('')
  const [tipo, setTipo]               = useState<TipoExame>('laboratorial')
  const [dataExame, setDataExame]     = useState(new Date().toISOString().slice(0, 10))
  const [resultado, setResultado]     = useState('')
  const [arquivo, setArquivo]         = useState<File | null>(null)
  const [saving, setSaving]           = useState(false)
  const [erro, setErro]               = useState('')
  const [confirmando, setConfirmando] = useState<ProntuarioExame | null>(null)

  function reset() {
    setNome(''); setTipo('laboratorial'); setDataExame(new Date().toISOString().slice(0, 10))
    setResultado(''); setArquivo(null); setErro(''); setFormAberto(false)
  }

  async function salvar() {
    if (!nome.trim()) { setErro('Informe o nome do exame.'); return }
    setSaving(true)
    setErro('')

    let arquivo_url: string | null = null
    let arquivo_nome: string | null = null

    // Upload para Supabase Storage (bucket 'exames')
    if (arquivo) {
      const ext = arquivo.name.split('.').pop()
      const path = `${prontuarioId}/${Date.now()}.${ext}`
      const { data: upData, error: upErr } = await supabase.storage
        .from('exames')
        .upload(path, arquivo, { upsert: false })

      if (upErr) {
        // Se o bucket não existe, salvar sem arquivo
        console.warn('Storage upload falhou (bucket pode não existir):', upErr.message)
      } else if (upData) {
        const { data: urlData } = supabase.storage.from('exames').getPublicUrl(upData.path)
        arquivo_url  = urlData.publicUrl
        arquivo_nome = arquivo.name
      }
    }

    const { error } = await supabase.from('prontuario_exames').insert({
      prontuario_id: prontuarioId,
      nome:          nome.trim(),
      tipo,
      data_exame:    dataExame || null,
      resultado:     resultado.trim() || null,
      arquivo_url,
      arquivo_nome,
    })

    setSaving(false)
    if (error) { setErro('Erro ao salvar: ' + error.message); return }
    reset()
    router.refresh()
  }

  async function excluir(exame: ProntuarioExame) {
    // Remover do storage se houver URL
    if (exame.arquivo_url) {
      const path = exame.arquivo_url.split('/exames/')[1]
      if (path) await supabase.storage.from('exames').remove([path])
    }
    await supabase.from('prontuario_exames').delete().eq('id', exame.id)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{exames.length} exame{exames.length !== 1 ? 's' : ''} registrado{exames.length !== 1 ? 's' : ''}</p>
        {!bloqueado && (
          <button
            onClick={() => setFormAberto(v => !v)}
            className="btn-primary text-sm"
          >
            <Plus className="w-4 h-4" /> Adicionar exame
          </button>
        )}
      </div>

      {/* Formulário de novo exame */}
      {formAberto && (
        <div className="card border-brand-200 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-700">Novo exame</h4>
            <button onClick={reset} className="p-1 rounded hover:bg-slate-100 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Nome do exame *</label>
              <input className="input" placeholder="Ex: Hemograma completo" value={nome} onChange={e => setNome(e.target.value)} />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={tipo} onChange={e => setTipo(e.target.value as TipoExame)}>
                <option value="laboratorial">Laboratorial</option>
                <option value="imagem">Imagem</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="label">Data do exame</label>
              <input type="date" className="input" value={dataExame} onChange={e => setDataExame(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Resultado / Laudo</label>
            <textarea className="input resize-none text-sm" rows={3} placeholder="Resumo do resultado ou laudo..." value={resultado} onChange={e => setResultado(e.target.value)} />
          </div>

          <div>
            <label className="label">Arquivo (PDF ou imagem)</label>
            <div
              className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-brand-300 hover:bg-brand-50/20 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <FileText className="w-6 h-6 mx-auto text-slate-400 mb-1" />
              {arquivo
                ? <p className="text-sm text-slate-600 font-medium">{arquivo.name}</p>
                : <p className="text-sm text-slate-400">Clique para selecionar arquivo</p>
              }
            </div>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
          </div>

          {erro && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>}

          <div className="flex gap-2">
            <button onClick={reset} className="btn-secondary flex-1 text-sm">Cancelar</button>
            <button onClick={salvar} disabled={saving} className="btn-primary flex-1 text-sm">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : 'Salvar exame'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de exames */}
      {exames.length === 0 && !formAberto ? (
        <div className="card text-center py-10">
          <FlaskConical className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="text-slate-500 text-sm">Nenhum exame registrado ainda.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {exames.map(e => {
            const cfg = TIPO_CONFIG[e.tipo as TipoExame] ?? TIPO_CONFIG.outro
            const Icon = cfg.icon
            return (
              <div key={e.id} className="card flex items-start gap-3 p-3">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', cfg.cor)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800 truncate">{e.nome}</p>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0', cfg.cor)}>
                      {cfg.label}
                    </span>
                  </div>
                  {e.data_exame && (
                    <p className="text-xs text-slate-400 mt-0.5">{formatarData(e.data_exame)}</p>
                  )}
                  {e.resultado && (
                    <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap line-clamp-2">{e.resultado}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {e.arquivo_url && (
                    <a
                      href={e.arquivo_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-600 transition-colors"
                      title="Abrir arquivo"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  {!bloqueado && (
                    <button
                      onClick={() => setConfirmando(e)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                      title="Excluir exame"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmando !== null}
        mensagem={`Excluir exame "${confirmando?.nome}"?`}
        detalhe="O arquivo vinculado também será removido."
        onConfirmar={() => { excluir(confirmando!); setConfirmando(null) }}
        onCancelar={() => setConfirmando(null)}
      />
    </div>
  )
}
