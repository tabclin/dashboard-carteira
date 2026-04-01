import type { StatusPaciente, ConfigRetornoFaixa } from '@/types'

/**
 * Calcula o intervalo ideal de retorno (em dias) para um paciente,
 * respeitando a ordem de prioridade:
 *   1. Override manual do paciente (retorno_custom_dias)
 *   2. Regra configurada pelo usuário (config)
 *   3. Fallback hardcoded (mantém compatibilidade com regras antigas)
 */
export function calcRetornoIdeal(
  idade_dias: number | null,
  config: ConfigRetornoFaixa[],
  retorno_custom_dias?: number | null
): number {
  if (retorno_custom_dias != null && retorno_custom_dias > 0) return retorno_custom_dias

  if (idade_dias != null && config.length > 0) {
    const regra = [...config]
      .sort((a, b) => b.idade_min_dias - a.idade_min_dias)
      .find(r =>
        idade_dias >= r.idade_min_dias &&
        (r.idade_max_dias === null || idade_dias < r.idade_max_dias)
      )
    if (regra) return regra.retorno_dias
  }

  // Fallback hardcoded (caso não haja config cadastrada)
  if (idade_dias == null) return 180
  if (idade_dias < 365) return 30
  if (idade_dias < 730) return 60
  return 180
}

/**
 * Calcula o status do paciente com base na recência e no intervalo ideal.
 *
 * Limiares (mantidos iguais à lógica Python legada):
 *   Ok      : recencia <= floor(retorno_ideal * 2/3)
 *   Atenção  : recencia entre o limiar Ok e retorno_ideal
 *   Perigo   : recencia > retorno_ideal
 */
export function calcStatus(
  recencia_dias: number | null,
  retorno_ideal: number
): StatusPaciente {
  if (recencia_dias == null) return 'Atenção'
  if (recencia_dias > retorno_ideal) return 'Perigo'
  if (recencia_dias <= Math.floor(retorno_ideal * 2 / 3)) return 'Ok'
  return 'Atenção'
}

/** Converte dias em texto legível: "8 meses", "2a 3m", "5 anos" */
export function diasParaMeses(dias: number | null): string {
  if (dias == null) return '—'
  const meses = Math.round(dias / 30.44)
  if (meses < 24) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`
  const anos = Math.floor(meses / 12)
  const m = meses % 12
  if (m === 0) return `${anos} ${anos === 1 ? 'ano' : 'anos'}`
  return `${anos}a ${m}m`
}
