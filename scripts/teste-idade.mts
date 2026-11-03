// Testes da idade/datas (lib/idade.ts). Uso: node --test scripts/teste-idade.mts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { idadeEm, idadeTexto, dataBR } from '../lib/idade.ts'

const dia = (s: string) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d, 12) }

test('uma semana antes do aniversário ainda não completou o ano', () => {
  assert.deepEqual(idadeEm('2020-11-10', dia('2026-11-03')), { anos: 5, meses: 11 })
})
test('no dia do aniversário completa', () => {
  assert.deepEqual(idadeEm('2020-11-03', dia('2026-11-03')), { anos: 6, meses: 0 })
})
test('data do banco (meia-noite UTC) não perde um dia no fuso do Brasil', () => {
  assert.deepEqual(idadeEm(new Date('2020-11-03T00:00:00Z'), dia('2026-11-03')), { anos: 6, meses: 0 })
  assert.equal(dataBR(new Date('2020-11-03T00:00:00Z')), '03/11/2020')
})
test('textos', () => {
  assert.equal(idadeTexto('2026-03-01', dia('2026-11-03')), '8 meses')
  assert.equal(idadeTexto('2025-09-01', dia('2026-11-03')), '1 ano e 2 meses')
  assert.equal(idadeTexto('2021-11-01', dia('2026-11-03')), '5 anos')
  assert.equal(idadeTexto(null), null)
  assert.equal(idadeTexto('2027-01-01', dia('2026-11-03')), null)
})
