// Testes do valor da seção de imagem (lib/orientacoes/imagem.ts). Uso: node --test scripts/teste-imagem.mts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseImageValor, serializeImageValor } from '../lib/orientacoes/imagem.ts'

test('valor antigo sem alinhamento fica centralizado', () => {
  assert.deepEqual(parseImageValor(JSON.stringify({ src: 'data:x', largura: 60 })), { src: 'data:x', largura: 60, alinhamento: 'centro' })
})
test('base64 puro (bem antigo) ocupa 100% e fica centralizado', () => {
  assert.deepEqual(parseImageValor('data:image/png;base64,AAA'), { src: 'data:image/png;base64,AAA', largura: 100, alinhamento: 'centro' })
})
test('ida e volta preserva o alinhamento', () => {
  assert.deepEqual(parseImageValor(serializeImageValor('s', 40, 'direita')), { src: 's', largura: 40, alinhamento: 'direita' })
  assert.equal(parseImageValor(serializeImageValor('s', 40)).alinhamento, 'centro')
})
test('alinhamento inválido vira centro', () => {
  assert.equal(parseImageValor(JSON.stringify({ src: 's', alinhamento: 'meio' })).alinhamento, 'centro')
})
