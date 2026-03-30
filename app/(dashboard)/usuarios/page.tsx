'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  UserPlus, Mail, Eye, EyeOff, Loader2, CheckCircle2,
  AlertCircle, Users, Shield, UserCog,
} from 'lucide-react'

interface MembroEquipe {
  id: string
  nome: string
  role: 'admin' | 'membro'
}

type ModoCreate = 'membro' | 'admin'

export default function UsuariosPage() {
  const supabase = createClient()

  const [modo, setModo] = useState<ModoCreate>('membro')
  const [form, setForm] = useState({ email: '', senha: '', nome: '' })
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [resultado, setResultado] = useState<{ ok: boolean; msg: string } | null>(null)

  const [membros, setMembros] = useState<MembroEquipe[]>([])
  const [carregandoMembros, setCarregandoMembros] = useState(true)
  const [myTeamId, setMyTeamId] = useState<string | null>(null)
  const [myRole, setMyRole] = useState<'admin' | 'membro' | null>(null)

  useEffect(() => {
    carregarEquipe()
  }, [])

  async function carregarEquipe() {
    setCarregandoMembros(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: perfil } = await supabase
      .from('profiles')
      .select('team_id, role')
      .eq('id', user.id)
      .single()

    if (!perfil) { setCarregandoMembros(false); return }

    setMyTeamId(perfil.team_id)
    setMyRole(perfil.role as 'admin' | 'membro')

    // Só admins veem membros da equipe
    if (perfil.role === 'admin') {
      const { data } = await supabase
        .from('profiles')
        .select('id, nome, role')
        .eq('team_id', user.id)
        .order('role')

      setMembros((data ?? []) as MembroEquipe[])
    }

    setCarregandoMembros(false)
  }

  function setField(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setResultado(null)
  }

  async function handleCriar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.email.trim() || !form.senha || !form.nome.trim()) return
    if (form.senha.length < 6) {
      setResultado({ ok: false, msg: 'A senha deve ter no mínimo 6 caracteres.' })
      return
    }

    setSalvando(true)
    setResultado(null)

    const metadata: Record<string, string> = { nome: form.nome.trim() }

    // Se for membro da equipe, passa o team_id do admin atual
    if (modo === 'membro' && myTeamId) {
      metadata.team_id = myTeamId
    }

    const { error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.senha,
      options: { data: metadata },
    })

    setSalvando(false)

    if (error) {
      setResultado({ ok: false, msg: error.message })
      return
    }

    const tipoMsg = modo === 'membro'
      ? `Membro ${form.email} adicionado à sua equipe. Ele verá os mesmos dados que você.`
      : `Nova conta independente criada para ${form.email}. Terá seus próprios dados separados.`

    setResultado({ ok: true, msg: tipoMsg })
    setForm({ email: '', senha: '', nome: '' })
    setTimeout(carregarEquipe, 1500) // atualiza lista
  }

  const isAdmin = myRole === 'admin'

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Users className="w-6 h-6 text-brand-500" />
          Usuários & Equipe
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Gerencie quem acessa o sistema e com quais permissões.
        </p>
      </div>

      {/* Badge do papel do usuário atual */}
      <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm ${
        myRole === 'admin'
          ? 'bg-brand-50 border-brand-200 text-brand-700'
          : 'bg-slate-50 border-slate-200 text-slate-600'
      }`}>
        {myRole === 'admin'
          ? <Shield className="w-4 h-4 text-brand-500" />
          : <UserCog className="w-4 h-4 text-slate-400" />
        }
        {myRole === 'admin'
          ? 'Você é administrador desta equipe. Pode criar membros e contas independentes.'
          : 'Você é membro de uma equipe. Somente o administrador pode criar novos usuários.'}
      </div>

      {/* Equipe atual — só para admins */}
      {isAdmin && (
        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-slate-400" />
            Membros da sua equipe
          </h2>

          {carregandoMembros ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : membros.length === 0 ? (
            <p className="text-slate-400 text-sm py-2">Nenhum membro adicionado ainda.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {membros.map(m => (
                <div key={m.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{m.nome}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      m.role === 'admin'
                        ? 'bg-brand-100 text-brand-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {m.role === 'admin' ? 'Admin' : 'Membro'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Formulário — só para admins */}
      {isAdmin && (
        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-brand-500" />
            Adicionar usuário
          </h2>

          {/* Toggle de modo */}
          <div className="flex gap-2 mb-5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setModo('membro')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                modo === 'membro'
                  ? 'bg-white shadow text-brand-700'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Membro da equipe
            </button>
            <button
              type="button"
              onClick={() => setModo('admin')}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                modo === 'admin'
                  ? 'bg-white shadow text-slate-800'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Nova conta independente
            </button>
          </div>

          {/* Explicação do modo */}
          <div className={`flex gap-2.5 text-xs rounded-lg px-3 py-2.5 mb-4 ${
            modo === 'membro'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-amber-50 border border-amber-200 text-amber-700'
          }`}>
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            {modo === 'membro'
              ? 'O usuário verá e editará os mesmos dados que você. Ideal para secretária ou auxiliar.'
              : 'Conta completamente separada, com dados próprios e isolados. Ideal para outro médico ou outra clínica.'}
          </div>

          <form onSubmit={handleCriar} className="space-y-4">
            <div>
              <label className="label">Nome *</label>
              <input
                className="input"
                placeholder={modo === 'membro' ? 'Ex: Secretária Ana' : 'Ex: Dr. Carlos Silva'}
                value={form.nome}
                onChange={e => setField('nome', e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label">E-mail *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  className="input pl-9"
                  placeholder="usuario@email.com"
                  value={form.email}
                  onChange={e => setField('email', e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Senha inicial *</label>
              <div className="relative">
                <input
                  type={mostrarSenha ? 'text' : 'password'}
                  className="input pr-10"
                  placeholder="Mínimo 6 caracteres"
                  value={form.senha}
                  onChange={e => setField('senha', e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {mostrarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">O usuário pode alterar após o primeiro acesso.</p>
            </div>

            {resultado && (
              <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm ${
                resultado.ok
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  : 'bg-red-50 border border-red-200 text-red-600'
              }`}>
                {resultado.ok
                  ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                }
                {resultado.msg}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setForm({ email: '', senha: '', nome: '' }); setResultado(null) }}
                className="btn-secondary"
              >
                Limpar
              </button>
              <button
                type="submit"
                disabled={salvando || !form.email || !form.senha || !form.nome}
                className="btn-primary flex items-center gap-2"
              >
                {salvando ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</>
                ) : (
                  <><UserPlus className="w-4 h-4" />
                    {modo === 'membro' ? 'Adicionar à equipe' : 'Criar conta'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Nota sobre gerenciamento avançado */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-500">
        <p className="font-medium text-slate-600 mb-1">Gerenciamento avançado</p>
        <p>Para desativar usuários, redefinir senhas ou remover membros, use o painel do Supabase em <strong>Authentication → Users</strong>.</p>
      </div>
    </div>
  )
}
