// Testes da aparência do PDF (lib/pdf/aparencia.ts). Uso: node --test scripts/teste-aparencia.mts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aparenciaComPadrao, coresDe, linhaRegistro, corValida, COR_PADRAO } from '../lib/pdf/aparencia.ts'

const cad = { name: 'Dra. Ana', crm: '157418', specialty: 'Pediatra' }

test('sem nada salvo usa o cadastro e o azul atual', () => {
  assert.deepEqual(aparenciaComPadrao(null, cad), { cor: '#4f46e5', nome: 'Dra. Ana', crm: 'CRM 157418', rqe: null, especialidade: 'Pediatra', logo: null })
  assert.equal(COR_PADRAO, '#4f46e5')
})
test('o que foi salvo vence; vazio cai no cadastro', () => {
  const a = aparenciaComPadrao({ nome: 'Dra. Ana Beatriz Buzatto', crm: 'CRM-SP 157418', rqe: '59046', especialidade: '', cor: '#ef7f67', logo: null }, cad)
  assert.equal(a.nome, 'Dra. Ana Beatriz Buzatto')
  assert.equal(a.crm, 'CRM-SP 157418')
  assert.equal(a.rqe, '59046')
  assert.equal(a.especialidade, 'Pediatra')
  assert.equal(a.cor, '#ef7f67')
})
test('cadastro sem CRM', () => {
  assert.equal(aparenciaComPadrao(null, { name: 'X', crm: null, specialty: null }).crm, null)
})
test('cor inválida volta ao padrão', () => {
  assert.equal(aparenciaComPadrao({ cor: 'azul' }, cad).cor, '#4f46e5')
  assert.equal(corValida('#A1b2C3'), true)
  assert.equal(corValida('#abc'), false)
})
test('texto do cabeçalho legível', () => {
  assert.equal(coresDe('#4f46e5').textoSobre, '#ffffff')
  assert.equal(coresDe('#ffe066').textoSobre, '#1e293b')
  assert.equal(coresDe('#ffffff').textoSobre, '#1e293b')
})
test('títulos sobre o branco: cor clara escurece, cor forte fica', () => {
  assert.equal(coresDe('#4f46e5').titulo, '#4f46e5')
  assert.notEqual(coresDe('#ef7f67').titulo, '#ef7f67')
  assert.equal(coresDe('#ef7f67').titulo, coresDe('#ef7f67').escura)
})
test('cores derivadas são hex válidos e a escura é mais escura', () => {
  const c = coresDe('#ef7f67')
  for (const v of Object.values(c)) assert.match(v, /^#[0-9a-f]{6}$/)
  assert.ok(parseInt(c.escura.slice(1, 3), 16) < 0xef)
})
test('linha de registro', () => {
  const a = aparenciaComPadrao({ crm: 'CRM-SP 157418', rqe: '59046' }, cad)
  assert.equal(linhaRegistro(a), 'Pediatra · CRM-SP 157418 · RQE 59046')
  assert.equal(linhaRegistro({ ...a, especialidade: null, rqe: null }), 'CRM-SP 157418')
})
