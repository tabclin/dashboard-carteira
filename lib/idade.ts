/** "AAAA-MM-DD" (ou Date) -> partes da data sem fuso: o nascimento é um dia, não um instante. */
function partes(d: Date | string): [number, number, number] | null {
  const s = typeof d === 'string' ? d : d.toISOString()
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** Idade em anos e meses completos em `hoje` (padrão: agora). */
export function idadeEm(nascimento: Date | string | null, hoje = new Date()): { anos: number; meses: number } | null {
  const p = nascimento ? partes(nascimento) : null
  if (!p) return null
  let meses = (hoje.getFullYear() - p[0]) * 12 + (hoje.getMonth() + 1 - p[1])
  if (hoje.getDate() < p[2]) meses--
  if (meses < 0) return null
  return { anos: Math.floor(meses / 12), meses: meses % 12 }
}

/** "8 meses", "1 ano e 2 meses", "5 anos" */
export function idadeTexto(nascimento: Date | string | null, hoje = new Date()): string | null {
  const i = idadeEm(nascimento, hoje)
  if (!i) return null
  const a = i.anos === 1 ? '1 ano' : `${i.anos} anos`, m = i.meses === 1 ? '1 mês' : `${i.meses} meses`
  if (i.anos === 0) return m
  return i.meses ? `${a} e ${m}` : a
}

/** "AAAA-MM-DD" ou Date -> "dd/mm/aaaa", sem fuso */
export function dataBR(d: Date | string | null): string | null {
  const p = d ? partes(d) : null
  return p ? `${String(p[2]).padStart(2, '0')}/${String(p[1]).padStart(2, '0')}/${p[0]}` : null
}
