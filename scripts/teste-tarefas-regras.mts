// Testes das regras de tarefas (lib/tarefas-regras.ts). Uso: node --test scripts/teste-tarefas-regras.mts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sugerirPrazo, grupoDoPrazo, textoDoPrazo, DIAS_PADRAO } from '../lib/tarefas-regras.ts'

const hoje = '2026-11-03'

test('com retorno marcado, o prazo é a véspera do retorno', () => {
  assert.deepEqual(sugerirPrazo({ hoje, proximoAgendamento: '2026-11-20', tipo: 'exames', dias: DIAS_PADRAO }), { prazo: '2026-11-19', motivo: 'antes do retorno em 20/11' })
})
test('retorno amanhã: prazo hoje; retorno hoje: prazo hoje', () => {
  assert.equal(sugerirPrazo({ hoje, proximoAgendamento: '2026-11-04', tipo: 'dri', dias: DIAS_PADRAO }).prazo, '2026-11-03')
  assert.deepEqual(sugerirPrazo({ hoje, proximoAgendamento: hoje, tipo: 'dri', dias: DIAS_PADRAO }), { prazo: hoje, motivo: 'o retorno é hoje' })
})
test('sem retorno (ou retorno no passado): prazo padrão do tipo', () => {
  assert.deepEqual(sugerirPrazo({ hoje, proximoAgendamento: null, tipo: 'exames', dias: DIAS_PADRAO }), { prazo: '2026-11-08', motivo: 'prazo padrão de 5 dias' })
  assert.equal(sugerirPrazo({ hoje, proximoAgendamento: '2026-10-01', tipo: 'orientacao', dias: { ...DIAS_PADRAO, orientacao: 1 } }).prazo, '2026-11-04')
})
test('virada de mês e de ano', () => {
  assert.equal(sugerirPrazo({ hoje: '2026-12-29', proximoAgendamento: null, tipo: 'dri', dias: DIAS_PADRAO }).prazo, '2027-01-05')
})
test('grupos', () => {
  assert.equal(grupoDoPrazo('2026-11-02', hoje), 'atrasadas')
  assert.equal(grupoDoPrazo(hoje, hoje), 'hoje')
  assert.equal(grupoDoPrazo('2026-11-10', hoje), 'semana')
  assert.equal(grupoDoPrazo('2026-11-11', hoje), 'depois')
})
test('texto do prazo', () => {
  assert.equal(textoDoPrazo(hoje, hoje), 'hoje')
  assert.equal(textoDoPrazo('2026-11-04', hoje), 'amanhã')
  assert.equal(textoDoPrazo('2026-11-02', hoje), 'venceu ontem')
  assert.equal(textoDoPrazo('2026-10-31', hoje), 'venceu há 3 dias')
  assert.equal(textoDoPrazo('2026-11-08', hoje), 'em 5 dias')
})
