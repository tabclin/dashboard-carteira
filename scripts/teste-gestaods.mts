// Testa a integração com o Gestão DS e a importação por planilha, sem chave nem pacientes reais:
// sobe um Gestão DS falso em :3399 e dois logins temporários (para conferir que um não vê o outro).
// Uso: npm run build && GESTAODS_URL=http://localhost:3399 npx next start -p 3300   e depois   node scripts/teste-gestaods.mts
import { chromium, type Page } from 'playwright-core'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import http from 'node:http'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
config({ path: '.env.local', quiet: true })
const B = 'http://localhost:3300'
const TOKEN = 'token-de-teste-' + randomBytes(8).toString('hex')
const adm = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await db.connect()
const ok = (c: unknown, m: string) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) process.exitCode = 1 }
const hoje = new Date(), diasAtras = (n: number) => new Date(hoje.getTime() - n * 864e5).toISOString().slice(0, 10)
const diaBR = (emDias: number) => diasAtras(-emDias).split('-').reverse().join('/')

// ── Gestão DS falso ──
const ATENDIMENTOS = [
  { id: 9001, data_atendimento: diasAtras(10), paciente: { id: 501, nome: 'TESTE GDS MARIA SYNC', cpf: '111.222.333-96', cidade: 'Rio Preto', celular: '17 90000-0001' }, servico: 'Consulta pediátrica', tipo: 'Retorno' },
  { id: 9002, data_atendimento: diasAtras(40), paciente: { id: 501, nome: 'TESTE GDS MARIA SYNC', cpf: '111.222.333-96', cidade: 'Rio Preto' }, servico: 'Consulta pediátrica', tipo: 'Consulta' },
  { id: 9003, data_atendimento: diasAtras(20), paciente: { id: 502, nome: 'TESTE GDS JOAO NOVO', cpf: null, cidade: 'Mirassol' }, servico: 'Consulta', tipo: 'Primeira consulta' },
]
let chamadas = 0
const falso = http.createServer((req, res) => {
  let corpo = ''; req.on('data', (c) => (corpo += c)); req.on('end', () => {
    chamadas++
    const json = (s: number, o: unknown) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)) }
    if (req.headers.authorization !== `Bearer ${TOKEN}`) return json(401, { message: 'token inválido' })
    const p = corpo ? JSON.parse(corpo) : {}
    if (req.url?.startsWith('/api/v2/core/medicos/')) return json(200, { data: [{ id: 77, nome: 'Dra. Teste' }] })
    if (req.url?.startsWith('/api/v2/relatorios/atendimentos/'))
      return json(200, { data: ATENDIMENTOS.filter((a) => a.data_atendimento >= p.data_inicial && a.data_atendimento <= p.data_final), total_pages: 1 })
    if (req.url?.startsWith('/api/v2/paciente/ultima-atividade-pacientes/'))
      return json(200, { data: [{ id: 501, nome_paciente: 'TESTE GDS MARIA SYNC', celular: '17 90000-0001', email: 'maria@teste.local' }, { id: 502, nome_paciente: 'TESTE GDS JOAO NOVO', celular: null, email: null }], total_pages: 1 })
    if (req.url?.startsWith('/api/v2/agendamento/listagem/'))
      return json(200, { data: [
        { paciente: { nome: 'TESTE GDS MARIA SYNC' }, data_agendamento: diaBR(15) + ' 14:00', cancelado: false, faltou: false, finalizado: false },
        { paciente: { nome: 'TESTE GDS MARIA SYNC' }, data_agendamento: diaBR(40) + ' 14:00', cancelado: false, faltou: false, finalizado: false },
        { paciente: { nome: 'TESTE GDS JOAO NOVO' }, data_agendamento: diaBR(5) + ' 09:00', cancelado: true, faltou: false, finalizado: false },
      ], total_pages: 1 })
    if (req.url?.startsWith('/api/v2/paciente/aniversariantes/')) return json(200, { data: [{ paciente_id: 501, nascimento: '15/03/2021' }, { paciente_id: 502, nascimento: '2019-08-01' }], total_pages: 1 })
    json(404, { message: 'rota desconhecida' })
  })
}).listen(3399)

// ── planilhas fictícias ──
const pasta = mkdtempSync(join(tmpdir(), 'planilhas-'))
const csvPac = join(pasta, 'pacientes.csv'), csvAt = join(pasta, 'atendimentos.csv')
writeFileSync(csvPac, '\uFEFFPaciente,CPF,Telefone,Email,Nascimento,Cidade\nTESTE PLAN ANA,,17 98888-0000,,02/02/2020,Bady Bassitt\nTESTE PLAN BETO,222.333.444-05,,,10/10/2018,Rio Preto\n')
writeFileSync(csvAt, 'Data atendimento,Paciente,CPF,Cidade,Serviço,Tipo\n05/01/2025 09:00,TESTE PLAN ANA,,,Consulta,Consulta\n12/02/2025,Teste Plan Ana,,,Consulta,Retorno\n20/02/2025,TESTE PLAN BETO,222.333.444-05,,Consulta,Retorno\n')

async function criarLogin(email: string) {
  const senha = randomBytes(12).toString('base64url')
  const { data, error } = await adm.auth.admin.createUser({ email, password: senha, email_confirm: true }); if (error) throw error
  return { id: data.user.id, email, senha }
}
async function entrar(p: Page, l: { email: string; senha: string }) {
  await p.goto(B + '/login'); await p.fill('input[type=email]', l.email); await p.fill('input[placeholder="••••••••"]', l.senha); await p.click('button[type=submit]')
  await p.waitForURL((x) => x.pathname === '/tarefas'); await p.waitForLoadState('networkidle')
}
const prof = async (authId: string) => (await db.query('select id from professionals where auth_user_id = $1', [authId])).rows[0]?.id as string
const linhas = async (sql: string, args: unknown[]) => (await db.query(sql, args)).rows

const l1 = await criarLogin('teste-gds-1@tabclin.local'), l2 = await criarLogin('teste-gds-2@tabclin.local')
try {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const p = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage()
  const erros: string[] = []; p.on('pageerror', (e) => erros.push(e.message))
  await entrar(p, l1)
  const p1 = await prof(l1.id)

  // paciente cadastrado à mão antes (como os 43 da Dra.), sem nascimento: deve ser ligado, não duplicado
  await p.evaluate(async () => fetch('/api/ckex/patients', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Teste GDS Maria Sync' }) }))

  await p.getByRole('link', { name: 'Configurações' }).click(); await p.waitForURL(/configuracoes/)
  ok(await p.getByRole('heading', { name: 'Gestão DS' }).isVisible(), 'menu leva às Configurações, com o bloco do Gestão DS')
  ok((await p.getByRole('button', { name: 'Atualizar agora' }).count()) === 0, 'sem chave, não há botão de atualizar')

  await p.fill('#chave-gestaods', 'chave-errada-1234567'); await p.getByRole('button', { name: 'Conferir e salvar' }).click()
  await p.getByText(/recusou a chave/).waitFor(); ok(true, 'chave errada é recusada com aviso')
  ok((await linhas('select 1 from integracoes_gestaods where professional_id = $1', [p1])).length === 0, 'chave errada não é gravada')

  await p.fill('#chave-gestaods', TOKEN); await p.getByRole('button', { name: 'Conferir e salvar' }).click()
  await p.getByText('Chave ••••' + TOKEN.slice(-4)).waitFor(); ok(true, 'chave certa é conferida e guardada; tela mostra só o final')
  const [integ] = await linhas('select token_cifrado, token_final, medico_id from integracoes_gestaods where professional_id = $1', [p1])
  ok(integ && !integ.token_cifrado.includes(TOKEN) && integ.token_cifrado.startsWith('v1:'), 'no banco a chave está criptografada')
  ok(integ?.medico_id === 77, 'guarda o médico da conta')
  ok(!(await p.content()).includes(TOKEN), 'a chave não aparece em nenhum lugar da página')

  await p.getByRole('button', { name: 'Atualizar agora' }).click()
  await p.getByText('Dados atualizados pelo Gestão DS.').waitFor({ timeout: 120_000 }); ok(true, 'atualização pelo Gestão DS termina com sucesso')
  const pacs = await linhas(`select name, gestaods_id, cpf, cidade, phone, email, birth_date::text nasc from patients where professional_id = $1 and name ilike 'teste gds%' order by name`, [p1])
  ok(pacs.length === 2, `2 pacientes (o já cadastrado foi ligado, não duplicado): ${pacs.map((x) => x.name).join(', ')}`)
  const maria = pacs.find((x) => x.gestaods_id === 501)
  ok(maria?.name === 'Teste GDS Maria Sync', 'o paciente já cadastrado mantém o nome digitado')
  ok(maria?.nasc === '2021-03-15' && maria?.cpf === '11122233396' && maria?.cidade === 'Rio Preto' && maria?.email === 'maria@teste.local', 'e foi completado com nascimento, CPF, cidade e e-mail')
  const cons = await linhas(`select c.gestaods_id, c.tipo_resumido, c.origem, p.name from consultas c left join patients p on p.id = c.patient_id where c.professional_id = $1 order by c.gestaods_id`, [p1])
  ok(cons.length === 3 && cons.every((c) => c.name && c.origem === 'gestaods'), '3 consultas, todas ligadas ao paciente')
  const ags = await linhas(`select name, proximo_agendamento::text ag from patients where professional_id = $1 and name ilike 'teste gds%' order by name`, [p1])
  ok(ags.find((x) => x.name === 'Teste GDS Maria Sync')?.ag === diasAtras(-15), 'próximo agendamento vem da agenda do Gestão DS (o mais próximo)')
  ok(ags.find((x) => x.name === 'TESTE GDS JOAO NOVO')?.ag == null, 'agendamento cancelado não conta como retorno')
  ok(cons.map((c) => c.tipo_resumido).join() === 'retorno,consulta,consulta', 'tipo resumido (retorno / consulta)')
  await p.getByText(/2 pacientes completados|1 pacientes completados/).first().waitFor().catch(() => {})
  ok((await p.content()).includes('Última atualização'), 'a tela mostra quando foi a última atualização')

  await p.getByRole('button', { name: 'Atualizar agora' }).click(); await p.getByText('Dados atualizados pelo Gestão DS.').nth(0).waitFor({ timeout: 120_000 })
  await p.waitForTimeout(500)
  ok((await linhas('select count(*)::int n from patients where professional_id = $1', [p1]))[0].n === 2 && (await linhas('select count(*)::int n from consultas where professional_id = $1', [p1]))[0].n === 3, 'atualizar de novo não duplica pacientes nem consultas')

  // planilha
  await p.setInputFiles('input[name=arquivos]', [csvAt, csvPac]); await p.getByRole('button', { name: 'Importar' }).click()
  await p.getByText('Planilha importada.').waitFor({ timeout: 60_000 }); ok(true, 'importação de planilhas (pacientes + atendimentos) funciona')
  const plan = await linhas(`select name, cpf, birth_date::text nasc, (select count(*)::int from consultas c where c.patient_id = p.id) consultas from patients p where professional_id = $1 and name ilike 'teste plan%' order by name`, [p1])
  ok(plan.length === 2 && plan[0].nasc === '2020-02-02' && plan[1].cpf === '22233344405', 'planilha cria os pacientes com nascimento e CPF')
  ok(plan[0].consultas === 2 && plan[1].consultas === 1, 'consultas da planilha ligadas aos pacientes (nome com maiúsculas diferentes inclusive)')
  await p.setInputFiles('input[name=arquivos]', [csvAt, csvPac]); await p.getByRole('button', { name: 'Importar' }).click(); await p.waitForTimeout(4000)
  ok((await linhas(`select count(*)::int n from consultas where professional_id = $1 and origem = 'planilha'`, [p1]))[0].n === 3, 'importar a mesma planilha de novo não duplica')
  ok(erros.length === 0, 'sem erros na página' + (erros[0] ? ': ' + erros[0] : ''))

  // outro login não enxerga nada do primeiro
  const p2page = await (await b.newContext()).newPage()
  await entrar(p2page, l2)
  await p2page.goto(B + '/configuracoes')
  ok((await p2page.getByRole('button', { name: 'Atualizar agora' }).count()) === 0 && (await p2page.locator('#chave-gestaods').count()) === 1, 'o segundo login não tem chave configurada')
  ok((await p2page.getByText('· 0 pacientes · 0 consultas').count()) === 1, 'e não vê os pacientes nem as consultas do primeiro')
  await p2page.goto(B + '/pacientes'); await p2page.waitForLoadState('networkidle')
  ok(!(await p2page.content()).includes('Teste GDS Maria Sync'), 'lista de pacientes do segundo login não mostra pacientes do primeiro')
  ok(chamadas > 0, `Gestão DS falso foi usado (${chamadas} chamadas)`)
  await b.close()
} finally {
  for (const l of [l1, l2]) {
    const id = await prof(l.id)
    if (id) {
      await db.query('delete from tarefas where professional_id = $1', [id])
      await db.query('delete from consultas where professional_id = $1', [id])
      await db.query('delete from integracoes_gestaods where professional_id = $1', [id])
      await db.query('delete from patients where professional_id = $1', [id])
      const [{ org_id }] = (await db.query('delete from professionals where id = $1 returning org_id', [id])).rows
      await db.query('delete from organizations where id = $1', [org_id])
    }
    await adm.auth.admin.deleteUser(l.id)
  }
  falso.close(); await db.end(); console.log('logins de teste removidos')
}
