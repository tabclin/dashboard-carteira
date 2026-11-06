// Converte o HTML do editor (TipTap) em blocos simples para o PDF desenhar.
// Regra de ouro: o texto nunca some; formatação que não for reconhecida vira texto normal.

export interface Trecho {
  texto:       string
  negrito?:    boolean
  italico?:    boolean
  sublinhado?: boolean
  tachado?:    boolean
  cor?:        string
  fundo?:      string
  link?:       string
}

export type Alinhamento = 'left' | 'center' | 'right' | 'justify'

export type Bloco =
  | { tipo: 'paragrafo' | 'h2' | 'h3'; alinhamento: Alinhamento; trechos: Trecho[] }
  | { tipo: 'lista'; ordenada: boolean; itens: Bloco[][] }   // cada item pode ter vários blocos (e listas dentro)
  | { tipo: 'linha' }

type Estilo  = Omit<Trecho, 'texto'>
type Texto   = Extract<Bloco, { trechos: Trecho[] }>
type No      = string | Elemento
interface Elemento { tag: string; attrs: Record<string, string>; filhos: No[] }

const VAZIAS   = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'wbr'])
const MARCA_PADRAO = '#fef08a'

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
function decodificar(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (inteira, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(n) ? String.fromCodePoint(n) : inteira
    }
    return ENTIDADES[e.toLowerCase()] ?? inteira
  })
}

function lerAtributos(s: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const m of s.matchAll(/([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attrs[m[1].toLowerCase()] = decodificar(m[2] ?? m[3] ?? m[4] ?? '')
  }
  return attrs
}

/** Árvore tolerante: fechamento sem abertura é ignorado; o que ficou aberto fecha no fim. */
function arvore(html: string): No[] {
  const raiz: Elemento = { tag: '#raiz', attrs: {}, filhos: [] }
  const pilha: Elemento[] = [raiz]
  for (const m of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<(\/?)([a-zA-Z][\w-]*)([^>]*)>|([^<]+)|</g)) {
    const topo = pilha[pilha.length - 1]
    if (m[4] !== undefined || m[2] === undefined) { topo.filhos.push(m[4] ?? '<'); continue }
    const tag = m[2].toLowerCase()
    if (m[1]) {
      const i = pilha.map((e) => e.tag).lastIndexOf(tag)
      if (i > 0) pilha.length = i
      continue
    }
    const el: Elemento = { tag, attrs: lerAtributos(m[3]), filhos: [] }
    topo.filhos.push(el)
    if (!VAZIAS.has(tag) && !m[3].trim().endsWith('/')) pilha.push(el)
  }
  return raiz.filhos
}

function estiloCss(style: string | undefined, prop: string): string | undefined {
  const m = style?.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i'))
  return m?.[1].trim()
}

/** "#abc", "#aabbcc", "rgb(1, 2, 3)" -> "#rrggbb"; o resto (inherit, nomes) -> undefined */
function cor(v: string | undefined): string | undefined {
  if (!v) return undefined
  const s = v.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(s)) return s
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + s.slice(1).split('').map((c) => c + c).join('')
  const rgb = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (rgb) return '#' + rgb.slice(1, 4).map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('')
  return undefined
}

function alinhamentoDe(el: Elemento): Alinhamento {
  const a = estiloCss(el.attrs.style, 'text-align')
  return a === 'center' || a === 'right' || a === 'justify' ? a : 'left'
}

function estiloDe(el: Elemento, base: Estilo): Estilo {
  const e: Estilo = { ...base }
  switch (el.tag) {
    case 'strong': case 'b':                  e.negrito = true; break
    case 'em': case 'i':                      e.italico = true; break
    case 'u':                                 e.sublinhado = true; break
    case 's': case 'del': case 'strike':      e.tachado = true; break
    case 'mark': e.fundo = cor(el.attrs['data-color']) ?? cor(estiloCss(el.attrs.style, 'background-color')) ?? MARCA_PADRAO; break
    case 'a':    if (el.attrs.href) e.link = el.attrs.href; break
  }
  const c = cor(estiloCss(el.attrs.style, 'color'))
  if (c) e.cor = c
  if (el.tag !== 'mark') {
    const f = cor(estiloCss(el.attrs.style, 'background-color'))
    if (f) e.fundo = f
  }
  return e
}

const mesmoEstilo = (a: Estilo, b: Estilo) =>
  (['negrito', 'italico', 'sublinhado', 'tachado', 'cor', 'fundo', 'link'] as const).every((k) => a[k] === b[k])

interface Contexto { blocos: Bloco[]; atual: Texto | null }

function escrever(ctx: Contexto, texto: string, estilo: Estilo) {
  if (!ctx.atual) {
    if (!texto.trim()) return // espaço entre blocos
    ctx.atual = { tipo: 'paragrafo', alinhamento: 'left', trechos: [] }
    ctx.blocos.push(ctx.atual)
  }
  const ultimo = ctx.atual.trechos[ctx.atual.trechos.length - 1]
  if (ultimo && mesmoEstilo(ultimo, estilo)) ultimo.texto += texto
  else ctx.atual.trechos.push({ texto, ...estilo })
}

function percorrer(nos: No[], estilo: Estilo, ctx: Contexto) {
  for (const no of nos) {
    if (typeof no === 'string') {
      escrever(ctx, decodificar(no.replace(/\s+/g, ' ')), estilo)
      continue
    }
    switch (no.tag) {
      case 'p': case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
        const tipo = no.tag === 'p' ? 'paragrafo' : no.tag === 'h1' || no.tag === 'h2' ? 'h2' : 'h3'
        const bloco: Texto = { tipo, alinhamento: alinhamentoDe(no), trechos: [] }
        ctx.blocos.push(bloco)
        ctx.atual = bloco
        percorrer(no.filhos, estilo, ctx)
        ctx.atual = null
        break
      }
      case 'ul': case 'ol': {
        ctx.atual = null
        const itens: Bloco[][] = []
        for (const f of no.filhos) {
          if (typeof f === 'string' && !f.trim()) continue
          const sub: Contexto = { blocos: [], atual: null }
          percorrer(typeof f === 'string' ? [f] : f.tag === 'li' ? f.filhos : [f], estilo, sub)
          itens.push(sub.blocos)
        }
        ctx.blocos.push({ tipo: 'lista', ordenada: no.tag === 'ol', itens })
        break
      }
      case 'hr':
        ctx.atual = null
        ctx.blocos.push({ tipo: 'linha' })
        break
      case 'br':
        if (!ctx.atual) escrever(ctx, ' ', estilo) // garante o parágrafo
        escrever(ctx, '\n', estilo)
        break
      case 'img': case 'script': case 'style':
        break
      default: // formatação reconhecida ou tag desconhecida: segue o texto de dentro
        percorrer(no.filhos, estiloDe(no, estilo), ctx)
    }
  }
}

export function htmlParaBlocos(html: string): Bloco[] {
  if (!html.trim()) return []
  // texto curto ou seleção: texto puro, um parágrafo por linha
  if (!/<[a-zA-Z/!]/.test(html)) {
    return html.split(/\r?\n/).map((linha) => ({ tipo: 'paragrafo' as const, alinhamento: 'left' as const, trechos: linha ? [{ texto: decodificar(linha) }] : [] }))
  }
  const ctx: Contexto = { blocos: [], atual: null }
  percorrer(arvore(html), {}, ctx)
  return ctx.blocos
}
