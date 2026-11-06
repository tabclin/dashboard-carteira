export type AlinhamentoImagem = 'esquerda' | 'centro' | 'direita'

const ALINHAMENTOS: AlinhamentoImagem[] = ['esquerda', 'centro', 'direita']

// Image valor is stored as JSON: { src: string, largura: number (20-100%), alinhamento }
// Backward compat: plain base64/URL string → 100% width; sem alinhamento → centro
export function parseImageValor(valor: string): { src: string; largura: number; alinhamento: AlinhamentoImagem } {
  try {
    const p = JSON.parse(valor)
    if (p && typeof p.src === 'string') {
      return { src: p.src, largura: p.largura ?? 100, alinhamento: ALINHAMENTOS.includes(p.alinhamento) ? p.alinhamento : 'centro' }
    }
  } catch {}
  return { src: valor, largura: 100, alinhamento: 'centro' }
}

export function serializeImageValor(src: string, largura: number, alinhamento: AlinhamentoImagem = 'centro'): string {
  return JSON.stringify({ src, largura, alinhamento })
}
