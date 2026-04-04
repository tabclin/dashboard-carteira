import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatarMoeda(valor: number | null | undefined): string {
  if (valor == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor / 100) // valores vêm em centavos do banco
}

export function formatarData(data: string | null | undefined): string {
  if (!data) return '—'
  try {
    // data pode vir como "YYYY-MM-DD" do Supabase
    const [year, month, day] = data.split('-')
    if (year && month && day) return `${day}/${month}/${year}`
    return data
  } catch {
    return data
  }
}

export function formatarRecencia(dias: number | null | undefined): string {
  if (dias == null) return '—'
  if (dias === 0) return 'Hoje'
  if (dias === 1) return '1 dia'
  if (dias < 30) return `${dias} dias`
  if (dias < 365) {
    const meses = Math.floor(dias / 30)
    return meses === 1 ? '1 mês' : `${meses} meses`
  }
  const anos = Math.floor(dias / 365)
  return anos === 1 ? '1 ano' : `${anos} anos`
}

export function formatarIdade(dias: number | null | undefined): string {
  if (dias == null) return '—'
  if (dias < 365) {
    const meses = Math.floor(dias / 30)
    return meses < 1 ? 'Recém-nascido' : `${meses} ${meses === 1 ? 'mês' : 'meses'}`
  }
  const anos = Math.floor(dias / 365)
  return `${anos} ${anos === 1 ? 'ano' : 'anos'}`
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export function getMesLabel(mes: string): string {
  const meses: Record<string, string> = {
    '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
    '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
    '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
  }
  const [, month] = mes.split('-')
  return meses[month] ?? mes
}
