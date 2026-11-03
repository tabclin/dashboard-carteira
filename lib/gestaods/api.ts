// Cliente de leitura da API do Gestão DS (mesmo do Raio-X), com a chave de cada login.
// Documentação: https://devapi.gestaods.com.br/docs/scalar
import 'server-only'

const BASE = process.env.GESTAODS_URL ?? 'https://devapi.gestaods.com.br'
const MAX_DIAS_POR_CONSULTA = 365 // limite da API

export class ErroGestaoDS extends Error {}

type Pagina<T> = { data?: T[]; total_pages?: number; message?: string }

async function pedir<T>(token: string, metodo: 'GET' | 'POST', rota: string, params: Record<string, string | number>, tentativa = 1): Promise<{ status: number; corpo: Pagina<T> }> {
  const url = BASE + rota + (metodo === 'GET' ? '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])) : '')
  const r = await fetch(url, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: metodo === 'POST' ? JSON.stringify(params) : undefined,
    signal: AbortSignal.timeout(30_000),
    cache: 'no-store',
  })
  // limite de uso (429) ou instabilidade (503): espera e tenta de novo
  if ((r.status === 429 || r.status === 503) && tentativa < 4) {
    await new Promise((ok) => setTimeout(ok, 2000 * tentativa))
    return pedir(token, metodo, rota, params, tentativa + 1)
  }
  const corpo = (await r.json().catch(() => ({}))) as Pagina<T>
  if (r.status === 401 || r.status === 403) throw new ErroGestaoDS('O Gestão DS recusou a chave. Confira a chave em Configurações.')
  return { status: r.status, corpo }
}

async function todasAsPaginas<T>(token: string, metodo: 'GET' | 'POST', rota: string, params: Record<string, string | number>): Promise<T[]> {
  const itens: T[] = []
  for (let page = 1; ; page++) {
    const { status, corpo } = await pedir<T>(token, metodo, rota, { ...params, page })
    if (status === 400 && /sem (agendamentos|atendimentos)/i.test(corpo.message ?? '')) break // período vazio
    if (status < 200 || status >= 300) throw new ErroGestaoDS(`Gestão DS respondeu ${status} em ${rota}: ${corpo.message ?? 'erro desconhecido'}`)
    itens.push(...(corpo.data ?? []))
    if (page >= (corpo.total_pages ?? 1)) break
  }
  return itens
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Divide [ini, fim] em blocos de até 365 dias (limite da API). */
function blocos(ini: Date, fim: Date): [Date, Date][] {
  const r: [Date, Date][] = []
  for (let a = new Date(ini); a <= fim; ) {
    const b = new Date(a); b.setUTCDate(b.getUTCDate() + MAX_DIAS_POR_CONSULTA - 1)
    r.push([a, b < fim ? b : fim])
    a = new Date(b); a.setUTCDate(a.getUTCDate() + 1)
  }
  return r
}

export type AtendimentoAPI = {
  id: number
  data_atendimento: string
  paciente: { id: number; nome: string; cpf?: string; cidade?: string; celular?: string } | null
  servico: string | null
  tipo: string | null
}
export type PacienteAtividadeAPI = { id: number; nome_paciente: string; celular: string | null; email: string | null }
export type AniversarianteAPI = { paciente_id: number; nascimento: string | null }

/** Confere a chave e devolve o(s) médico(s) da conta. */
export async function testarChave(token: string): Promise<{ id: number; nome?: string }[]> {
  const r = await pedir<{ id: number; nome?: string }>(token, 'GET', '/api/v2/core/medicos/', {})
  if (r.status < 200 || r.status >= 300) throw new ErroGestaoDS(`O Gestão DS respondeu ${r.status} ao conferir a chave.`)
  return r.corpo.data ?? []
}

export async function buscarAtendimentos(token: string, ini: Date, fim: Date): Promise<AtendimentoAPI[]> {
  const todos: AtendimentoAPI[] = []
  for (const [a, b] of blocos(ini, fim)) {
    todos.push(...(await todasAsPaginas<AtendimentoAPI>(token, 'POST', '/api/v2/relatorios/atendimentos/', { data_inicial: iso(a), data_final: iso(b) })))
  }
  return todos
}

/** Pacientes com atividade e as datas de nascimento (aniversariantes do ano inteiro). */
export async function buscarPacientes(token: string, ano: number) {
  const [atividade, aniversariantes] = await Promise.all([
    todasAsPaginas<PacienteAtividadeAPI>(token, 'POST', '/api/v2/paciente/ultima-atividade-pacientes/', { dias: 0 }),
    todasAsPaginas<AniversarianteAPI>(token, 'POST', '/api/v2/paciente/aniversariantes/', { data_inicial: `${ano}-01-01`, data_final: `${ano}-12-31` }),
  ])
  return { atividade, aniversariantes }
}
