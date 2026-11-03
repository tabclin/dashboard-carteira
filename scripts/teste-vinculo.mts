// Testes da regra de vínculo de pacientes e consultas (lib/gestaods/vinculo.ts). Não usa banco.
// Uso: node --test scripts/teste-vinculo.mts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planejarPacientes, ligarConsultas, tipoResumido, type PacienteExistente, type PacienteEntrada } from '../lib/gestaods/vinculo.ts'

const ex = (o: Partial<PacienteExistente> & { id: string; name: string }): PacienteExistente =>
  ({ birthDate: null, gestaodsId: null, cpf: null, phone: null, email: null, cidade: null, ...o })
const en = (o: Partial<PacienteEntrada> & { nome: string }): PacienteEntrada =>
  ({ gestaodsId: null, nascimento: null, cpf: null, telefone: null, email: null, cidade: null, ...o })
let n = 0
const novoId = () => `novo${++n}`

test('paciente cadastrado pela Dra. (sem acento/maiúsculas diferentes) é ligado e completado, sem duplicar', () => {
  const r = planejarPacientes([ex({ id: 'p1', name: 'Maria José da Silva' })],
    [en({ nome: 'MARIA JOSE DA  SILVA', gestaodsId: 10, nascimento: '2020-03-04', cpf: '123.456.789-09', telefone: '17 99999-0000' })], novoId)
  assert.deepEqual(r.criar, [])
  assert.deepEqual(r.atualizar, [{ id: 'p1', dados: { gestaodsId: 10, cpf: '12345678909', birthDate: '2020-03-04', phone: '17 99999-0000' } }])
})

test('não sobrescreve o que já está preenchido nem muda o nome', () => {
  const r = planejarPacientes([ex({ id: 'p1', name: 'Ana Souza', birthDate: '2019-01-01', phone: '111' })],
    [en({ nome: 'Ana Souza', gestaodsId: 5, nascimento: '2019-01-01', telefone: '222' })], novoId)
  assert.deepEqual(r.atualizar, [{ id: 'p1', dados: { gestaodsId: 5 } }])
})

test('mesmo nome com nascimento diferente vai para revisão e não cria cadastro', () => {
  const r = planejarPacientes([ex({ id: 'p1', name: 'Pedro Lima', birthDate: '2018-05-05' })],
    [en({ nome: 'Pedro Lima', gestaodsId: 7, nascimento: '2021-02-02' })], novoId)
  assert.equal(r.criar.length, 0); assert.equal(r.atualizar.length, 0)
  assert.match(r.ambiguos[0].motivo, /nascimento diferente/)
})

test('dois cadastros com o mesmo nome vão para revisão', () => {
  const r = planejarPacientes([ex({ id: 'p1', name: 'Lia Reis' }), ex({ id: 'p2', name: 'Lia Reis' })], [en({ nome: 'Lia Reis', gestaodsId: 3 })], novoId)
  assert.equal(r.ambiguos.length, 1); assert.equal(r.criar.length, 0)
})

test('paciente novo é criado', () => {
  const r = planejarPacientes([ex({ id: 'p1', name: 'Outro' })], [en({ nome: 'Bia Nunes', gestaodsId: 9, cidade: 'Rio Preto' })], novoId)
  assert.equal(r.criar.length, 1); assert.equal(r.criar[0].nome, 'Bia Nunes'); assert.ok(r.criar[0].id)
})

test('já ligado pelo id do Gestão DS: reconhece mesmo se o nome mudou', () => {
  const r = planejarPacientes([ex({ id: 'p1', name: 'Joao', gestaodsId: 4 })], [en({ nome: 'João Pedro Alves', gestaodsId: 4, cidade: 'X' })], novoId)
  assert.deepEqual(r.atualizar, [{ id: 'p1', dados: { cidade: 'X' } }]); assert.equal(r.criar.length, 0)
})

test('reconhece pelo CPF quando o nome está diferente', () => {
  const r = planejarPacientes([ex({ id: 'p1', name: 'Joana S.', cpf: '12345678909' })], [en({ nome: 'Joana Santos', gestaodsId: 8, cpf: '123.456.789-09' })], novoId)
  assert.deepEqual(r.atualizar, [{ id: 'p1', dados: { gestaodsId: 8 } }])
})

test('homônimo já ligado a outro paciente do Gestão DS: cria um novo cadastro', () => {
  const r = planejarPacientes([ex({ id: 'p1', name: 'Rafa Dias', gestaodsId: 1 })], [en({ nome: 'Rafa Dias', gestaodsId: 2 })], novoId)
  assert.equal(r.criar.length, 1); assert.equal(r.atualizar.length, 0)
})

test('entradas repetidas na planilha viram um só paciente', () => {
  const r = planejarPacientes([], [en({ nome: 'Caio Melo' }), en({ nome: 'caio  melo', telefone: '9' })], novoId)
  assert.equal(r.criar.length, 1); assert.equal(r.criar[0].telefone, '9')
})

test('consultas: liga por id do Gestão DS, CPF ou nome único; nome repetido fica sem paciente', () => {
  const pacientes = [
    { id: 'a', name: 'Ana', gestaodsId: 1, cpf: null }, { id: 'b', name: 'Bruno', gestaodsId: null, cpf: '12345678909' },
    { id: 'c1', name: 'Caio', gestaodsId: null, cpf: null }, { id: 'c2', name: 'Caio', gestaodsId: null, cpf: null },
    { id: 'd', name: 'Davi Luz', gestaodsId: null, cpf: null },
  ]
  const base = { gestaodsId: null, pacienteGestaodsId: null, pacienteCpf: null, data: '2026-01-01', tipo: 'Retorno', servico: null }
  const r = ligarConsultas(pacientes, [
    { ...base, pacienteGestaodsId: 1, pacienteNome: 'nome diferente' },
    { ...base, pacienteCpf: '123.456.789-09', pacienteNome: 'Bruno X' },
    { ...base, pacienteNome: 'Caio' },
    { ...base, pacienteNome: 'DAVI LUZ' },
  ])
  assert.deepEqual(r.map((x) => x.patientId), ['a', 'b', null, 'd'])
  assert.equal(r[0].tipoResumido, 'retorno')
})

test('tipo resumido', () => {
  assert.equal(tipoResumido('Primeira consulta'), 'consulta')
  assert.equal(tipoResumido('RETORNO'), 'retorno')
  assert.equal(tipoResumido('Vacina'), 'outro')
  assert.equal(tipoResumido(null), 'outro')
})
