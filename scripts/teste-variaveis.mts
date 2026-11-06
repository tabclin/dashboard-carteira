// Testes das variáveis das orientações (lib/orientacoes/variables.ts). Uso: node --test scripts/teste-variaveis.mts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyVariables, buildContext, trocarNeutras, normalizarSexo } from '../lib/orientacoes/variables.ts'

const d = new Date(2026, 10, 6)

test('menino', () => {
  assert.equal(applyVariables('Fale para #o/a #nome que #ele/ela vai bem', buildContext({ name: 'Thiago Silva', sex: 'M' }, d)), 'Fale para o Thiago que ele vai bem')
})
test('menina', () => {
  assert.equal(applyVariables('o peso #do/da #nome, #dele/dela', buildContext({ name: 'Maria Souza', sex: 'F' }, d)), 'o peso da Maria, dela')
})
test('inicial maiúscula', () => {
  assert.equal(applyVariables('#Ele/Ela come. #O/A #nome. #Do/Da #Dele/Dela', buildContext({ name: 'Maria', sex: 'F' }, d)), 'Ela come. A Maria. Da Dela')
})
test('sem sexo fica neutro', () => {
  assert.equal(applyVariables('#o/a #nome, #dele/dela, #Ele/Ela', buildContext({ name: 'Ana', sex: null }, d)), 'o/a Ana, dele/dela, Ele/Ela')
  assert.equal(applyVariables('#o/a', buildContext({ name: 'Ana' }, d)), 'o/a')
})
test('nome_completo antes de nome e data', () => {
  assert.equal(applyVariables('#nome_completo/#nome em #data', buildContext({ name: 'Ana Lima', sex: 'F' }, d)), 'Ana Lima/Ana em 06/11/2026')
})
test('trocarNeutras preserva edição', () => {
  assert.equal(trocarNeutras('<p>Diga a o/a Ana (editado) que ele/ela e Ele/Ela, do/da e dele/dela</p>', 'F'), '<p>Diga a a Ana (editado) que ela e Ela, da e dela</p>')
  assert.equal(trocarNeutras('O/A Ana e o/a', 'M'), 'O Ana e o')
})
test('trocarNeutras não mexe em palavra maior', () => {
  assert.equal(trocarNeutras('modelo/app aquele/ela', 'M'), 'modelo/app aquele/ela')
})
test('normalizarSexo', () => {
  assert.equal(normalizarSexo('M'), 'M')
  assert.equal(normalizarSexo('masculino'), 'M')
  assert.equal(normalizarSexo('f'), 'F')
  assert.equal(normalizarSexo('Feminino'), 'F')
  assert.equal(normalizarSexo(''), null)
  assert.equal(normalizarSexo(null), null)
  assert.equal(normalizarSexo('outro'), null)
})
