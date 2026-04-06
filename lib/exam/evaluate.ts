import type { $Enums } from '@prisma/client'
type ResultStatus = $Enums.ResultStatus

/**
 * Avalia automaticamente o status de um exame com base no valor e referência.
 * Regra conservadora: fora do intervalo → ATTENTION (o profissional decide se é DANGER).
 */
export function autoEvaluate(
  valueNumeric: number | null,
  refMin: number | null,
  refMax: number | null,
): ResultStatus {
  if (valueNumeric === null) return 'NOT_EVALUATED'
  if (refMin === null && refMax === null) return 'NOT_EVALUATED'

  const belowMin = refMin !== null && valueNumeric < refMin
  const aboveMax = refMax !== null && valueNumeric > refMax

  if (belowMin || aboveMax) return 'ATTENTION'
  return 'NORMAL'
}
