export type TipoSecao = 'texto_curto' | 'texto_longo' | 'selecao_unica' | 'imagem'

export interface SecaoTemplate {
  id:     string
  titulo: string
  tipo:   TipoSecao
  valor:  string        // default content / base64 for imagem
  opcoes?: string[]     // only for selecao_unica
}

export interface SecaoValor {
  id:     string
  titulo: string
  tipo:   TipoSecao
  valor:  string        // resolved content (variables replaced)
  opcoes?: string[]     // carried from template for selecao_unica
}

export const TIPO_LABELS: Record<TipoSecao, string> = {
  texto_curto:   'Texto curto',
  texto_longo:   'Texto longo',
  selecao_unica: 'Seleção (dropdown)',
  imagem:        'Imagem',
}
