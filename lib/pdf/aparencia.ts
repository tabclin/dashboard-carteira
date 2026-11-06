// Aparência do PDF das orientações: o que a profissional configurou, completado pelo cadastro.

export interface Aparencia {
  cor:           string
  nome:          string
  crm:           string | null
  rqe:           string | null
  especialidade: string | null
  logo:          string | null   // data:image/...;base64
}

export const COR_PADRAO = '#4f46e5'
const TEXTO_ESCURO = '#1e293b'

export const corValida = (s: string | null | undefined): s is string => !!s && /^#[0-9a-f]{6}$/i.test(s)

const preenchido = (s: string | null | undefined) => (s?.trim() ? s.trim() : null)

/** Campo salvo vazio cai no cadastro; sem nada salvo, o PDF fica como sempre foi. */
export function aparenciaComPadrao(
  salva: Partial<Record<keyof Aparencia, string | null>> | null,
  cadastro: { name: string; crm: string | null; specialty: string | null },
): Aparencia {
  const crmCadastro = preenchido(cadastro.crm)
  return {
    cor:           corValida(salva?.cor) ? salva.cor.toLowerCase() : COR_PADRAO,
    nome:          preenchido(salva?.nome) ?? cadastro.name,
    crm:           preenchido(salva?.crm) ?? (crmCadastro && /^\d/.test(crmCadastro) ? `CRM ${crmCadastro}` : crmCadastro),
    rqe:           preenchido(salva?.rqe),
    especialidade: preenchido(salva?.especialidade) ?? preenchido(cadastro.specialty),
    logo:          preenchido(salva?.logo),
  }
}

/** "Pediatra · CRM-SP 157418 · RQE 59046" (só o que estiver preenchido) */
export function linhaRegistro(a: Aparencia): string {
  return [a.especialidade, a.crm, a.rqe && `RQE ${a.rqe}`].filter(Boolean).join(' · ')
}

const rgb   = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const hex   = (c: number[]) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')
const mistura = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)) }

// luminância relativa e contraste (WCAG)
function luminancia(h: string) {
  const [r, g, b] = rgb(h).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contraste = (a: string, b: string) => { const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }

/** Cores derivadas da principal: tom escuro para títulos, tom claro para fundos e o texto que fica legível sobre ela. */
export function coresDe(cor: string) {
  const principal  = corValida(cor) ? cor.toLowerCase() : COR_PADRAO
  const textoSobre = contraste(principal, '#ffffff') >= contraste(principal, TEXTO_ESCURO) ? '#ffffff' : TEXTO_ESCURO
  const escura     = mistura(principal, '#000000', 0.3)
  const titulo     = contraste(principal, '#ffffff') >= 3 ? principal : escura   // títulos sobre o papel branco
  return {
    principal,
    escura,
    titulo,
    faixa:           mistura(titulo, '#ffffff', 0.86),   // fundo do título da seção: a cor do título "transparente"
    clara:           mistura(principal, '#ffffff', 0.9),
    textoSobre,
    textoSobreSuave: mistura(textoSobre, principal, 0.25),
  }
}
