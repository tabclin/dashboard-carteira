// Regras para ligar pacientes e consultas vindos do Gestão DS (API ou planilha) ao cadastro do login.
// Puro (sem banco): recebe o cadastro atual e o que chegou, devolve o que atualizar, criar e o que precisa de revisão.
// Nunca apaga nem renomeia paciente; só preenche campos vazios.

export type PacienteEntrada = {
  gestaodsId: number | null
  nome: string
  nascimento: string | null // AAAA-MM-DD
  cpf: string | null
  telefone: string | null
  email: string | null
  cidade: string | null
}

export type PacienteExistente = {
  id: string
  name: string
  birthDate: string | null // AAAA-MM-DD
  gestaodsId: number | null
  cpf: string | null
  phone: string | null
  email: string | null
  cidade: string | null
}

export type ConsultaEntrada = {
  gestaodsId: number | null
  pacienteGestaodsId: number | null
  pacienteCpf: string | null
  pacienteNome: string
  data: string // AAAA-MM-DD
  tipo: string | null
  servico: string | null
}

export type Atualizacao = { id: string; dados: Partial<Omit<PacienteExistente, 'id' | 'name'>> }
export type NovoPaciente = PacienteEntrada & { id: string }
export type Ambiguo = { nome: string; motivo: string }

/** Nome sem acento, minúsculo e com espaços simples (mesma chave do Raio-X). */
export function chaveNome(nome: string | null | undefined): string | null {
  if (!nome) return null
  const k = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
  return k || null
}

/** "07/10/2026", "07/10/2026 14:00" ou "2026-10-07..." -> "2026-10-07" */
export function dataISO(v: unknown): string | null {
  const s = v == null ? '' : String(v).trim()
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (br) return `${br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}`
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null
}

/** CPF só com dígitos, ou null se não tiver 11 dígitos. */
export function cpfLimpo(cpf: string | null | undefined): string | null {
  const d = (cpf ?? '').replace(/\D/g, '')
  return d.length === 11 ? d : null
}

export function tipoResumido(tipo: string | null): 'consulta' | 'retorno' | 'outro' {
  const t = chaveNome(tipo) ?? ''
  if (t.includes('retorno')) return 'retorno'
  if (t.includes('consulta')) return 'consulta'
  return 'outro'
}

/** Junta entradas repetidas (mesmo id do Gestão DS, CPF ou nome), ficando com os campos preenchidos. */
function semRepetidos(entrada: PacienteEntrada[]): PacienteEntrada[] {
  const porRef = new Map<string, PacienteEntrada>()
  for (const e of entrada) {
    const cpf = cpfLimpo(e.cpf)
    const ref = e.gestaodsId != null ? `g:${e.gestaodsId}` : cpf ? `c:${cpf}` : `n:${chaveNome(e.nome)}`
    const antes = porRef.get(ref)
    porRef.set(ref, antes ? { ...antes, ...Object.fromEntries(Object.entries(e).filter(([, v]) => v != null)) } as PacienteEntrada : e)
  }
  return Array.from(porRef.values())
}

export function planejarPacientes(existentes: PacienteExistente[], entrada: PacienteEntrada[], novoId: () => string) {
  const porGid = new Map<number, PacienteExistente>()
  const porCpf = new Map<string, PacienteExistente>()
  const porNome = new Map<string, PacienteExistente[]>()
  for (const p of existentes) {
    if (p.gestaodsId != null) porGid.set(p.gestaodsId, p)
    const cpf = cpfLimpo(p.cpf); if (cpf) porCpf.set(cpf, p)
    const k = chaveNome(p.name); if (k) porNome.set(k, [...(porNome.get(k) ?? []), p])
  }

  const atualizar: Atualizacao[] = [], criar: NovoPaciente[] = [], ambiguos: Ambiguo[] = []
  const usados = new Set<string>()

  for (const e of semRepetidos(entrada)) {
    const k = chaveNome(e.nome); if (!k) continue
    const cpf = cpfLimpo(e.cpf)
    let m: PacienteExistente | undefined = e.gestaodsId != null ? porGid.get(e.gestaodsId) : undefined
    if (!m && cpf) {
      const c = porCpf.get(cpf)
      if (c && (c.gestaodsId == null || c.gestaodsId === e.gestaodsId)) m = c
    }
    if (!m) {
      // mesmo nome; descarta quem já está ligado a outro paciente do Gestão DS ou tem outro CPF
      const mesmoNome = (porNome.get(k) ?? []).filter((c) =>
        (c.gestaodsId == null || c.gestaodsId === e.gestaodsId) && !(cpf && cpfLimpo(c.cpf) && cpfLimpo(c.cpf) !== cpf))
      const compativeis = mesmoNome.filter((c) => !c.birthDate || !e.nascimento || c.birthDate === e.nascimento)
      if (compativeis.length > 1) { ambiguos.push({ nome: e.nome, motivo: `há ${compativeis.length} cadastros com esse nome` }); continue }
      if (compativeis.length === 0 && mesmoNome.length > 0) { ambiguos.push({ nome: e.nome, motivo: 'mesmo nome de um cadastro, mas com data de nascimento diferente' }); continue }
      m = compativeis[0]
    }
    if (!m) { criar.push({ ...e, cpf, id: novoId() }); continue }
    if (usados.has(m.id)) { ambiguos.push({ nome: e.nome, motivo: 'outro paciente do Gestão DS já foi ligado a este cadastro' }); continue }
    usados.add(m.id)

    const dados: Atualizacao['dados'] = {}
    if (m.gestaodsId == null && e.gestaodsId != null) dados.gestaodsId = e.gestaodsId
    if (!m.cpf && cpf) dados.cpf = cpf
    if (!m.birthDate && e.nascimento) dados.birthDate = e.nascimento
    if (!m.phone && e.telefone) dados.phone = e.telefone
    if (!m.email && e.email) dados.email = e.email
    if (!m.cidade && e.cidade) dados.cidade = e.cidade
    if (Object.keys(dados).length) atualizar.push({ id: m.id, dados })
  }
  return { atualizar, criar, ambiguos }
}

/** Liga cada consulta a um paciente: id do Gestão DS, depois CPF, depois nome (só se o nome for único). */
export function ligarConsultas(pacientes: { id: string; name: string; gestaodsId: number | null; cpf: string | null }[], consultas: ConsultaEntrada[]) {
  const porGid = new Map<number, string>(), porCpf = new Map<string, string>(), porNome = new Map<string, string | null>()
  for (const p of pacientes) {
    if (p.gestaodsId != null) porGid.set(p.gestaodsId, p.id)
    const cpf = cpfLimpo(p.cpf); if (cpf) porCpf.set(cpf, p.id)
    const k = chaveNome(p.name); if (k) porNome.set(k, porNome.has(k) ? null : p.id) // null = nome repetido
  }
  return consultas.map((c) => {
    const cpf = cpfLimpo(c.pacienteCpf)
    const patientId = (c.pacienteGestaodsId != null ? porGid.get(c.pacienteGestaodsId) : undefined)
      ?? (cpf ? porCpf.get(cpf) : undefined)
      ?? porNome.get(chaveNome(c.pacienteNome) ?? '')
      ?? null
    return { ...c, patientId, tipoResumido: tipoResumido(c.tipo) }
  })
}
