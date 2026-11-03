// Testa a tela Pacientes (lista, busca, filtros, indicadores) e a ficha (dados, consultas, atalhos para as ferramentas)
// com dois logins temporários e pacientes fictícios; apaga tudo no fim.
// Uso: npm run build && npx next start -p 3300   e depois   node scripts/teste-pacientes.mts
import { chromium, type Page } from 'playwright-core'
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import { randomBytes, randomUUID } from 'node:crypto'
config({ path: '.env.local', quiet: true })
const B = 'http://localhost:3300'
const adm = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await db.connect()
const ok = (c: unknown, m: string) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) process.exitCode = 1 }
const q = async (sql: string, a: unknown[] = []) => (await db.query(sql, a)).rows

async function criarLogin(email: string) {
  const senha = randomBytes(12).toString('base64url')
  const { data, error } = await adm.auth.admin.createUser({ email, password: senha, email_confirm: true }); if (error) throw error
  return { id: data.user.id, email, senha }
}
async function entrar(p: Page, l: { email: string; senha: string }) {
  await p.goto(B + '/login'); await p.fill('input[type=email]', l.email); await p.fill('input[placeholder="••••••••"]', l.senha); await p.click('button[type=submit]')
  await p.waitForURL((x) => x.pathname === '/pacientes'); await p.waitForLoadState('networkidle')
}
const l1 = await criarLogin('teste-pac-1@tabclin.local'), l2 = await criarLogin('teste-pac-2@tabclin.local')
try {
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
  const p = await (await b.newContext({ viewport: { width: 1360, height: 900 } })).newPage()
  const erros: string[] = []; p.on('pageerror', (e) => erros.push(e.message)); p.on('console', (m) => m.type() === 'error' && erros.push(m.text()))
  await entrar(p, l1)
  const [{ id: prof }] = await q('select id from professionals where auth_user_id = $1', [l1.id])

  // pacientes fictícios: um com tudo (exame, orientação, consultas), outros só no cadastro
  const joao = randomUUID(), bia = randomUUID()
  await q(`insert into patients (id, professional_id, name, birth_date, cpf, phone, cidade, gestaods_id, updated_at) values
    ($1, $3, 'TESTE João Ficha', '2021-03-15', '12345678909', '17 99999-0000', 'Rio Preto', 4242, now()),
    ($2, $3, 'TESTE Bia Lista', null, null, null, null, null, now())`, [joao, bia, prof])
  for (let i = 0; i < 4; i++) await q(`insert into patients (id, professional_id, name, updated_at) values ($1, $2, $3, now())`, [randomUUID(), prof, `TESTE Extra ${i}`])
  await q(`insert into analyses (id, patient_id, professional_id, collected_at, lab_name, status, updated_at) values ($1, $2, $3, '2026-09-10', 'Lab Teste', 'FINALIZED', now())`, [randomUUID(), joao, prof])
  await q(`insert into orientacoes (id, professional_id, patient_id, patient_name, title, orientacao_date, updated_at) values ($1, $2, $3, 'TESTE João Ficha', 'Orientação de teste', '2026-10-01', now())`, [randomUUID(), prof, joao])
  for (let i = 0; i < 12; i++) await q(`insert into consultas (professional_id, patient_id, paciente_nome, data, tipo, tipo_resumido, servico, origem) values ($1, $2, 'TESTE João Ficha', $3, $4, $5, 'Consulta pediátrica', 'planilha')`,
    [prof, joao, `2026-${String(10 - (i % 9)).padStart(2, '0')}-${String(10 + i).padStart(2, '0')}`, i === 0 ? 'Retorno' : 'Consulta', i === 0 ? 'retorno' : 'consulta'])

  // ── lista ──
  await p.goto(B + '/pacientes'); await p.waitForLoadState('networkidle')
  ok((await p.getByText('6 pacientes').count()) === 1, 'lista mostra o total de pacientes do login')
  ok((await p.getByRole('link', { name: 'Ligar ao Gestão DS para trazer pacientes e consultas' }).count()) === 1, 'sem chave do Gestão DS, oferece o atalho para configurar')
  const linhaJoao = p.locator('tr', { hasText: 'TESTE João Ficha' })
  const [{ idade }] = await q("select extract(year from age(current_date, date '2021-03-15'))::int || ' anos e ' || extract(month from age(current_date, date '2021-03-15'))::int || ' meses' idade")
  ok((await linhaJoao.textContent())?.includes(idade), `mostra a idade (${idade})`)
  const [{ ultima }] = await q("select to_char(max(data), 'DD/MM/YYYY') ultima from consultas where patient_id = $1", [joao])
  ok((await linhaJoao.textContent())?.includes(ultima), `mostra a última consulta (${ultima})`)
  ok((await linhaJoao.getByLabel('1 análise de exames').count()) === 1 && (await linhaJoao.getByLabel('1 orientação').count()) === 1 && (await linhaJoao.getByLabel('Sem DRI').count()) === 1, 'indicadores: Check Exames e Orientações feitos, DRI não')
  await p.getByLabel('Buscar paciente').fill('joao ficha'); ok((await p.locator('tbody tr').count()) === 1, 'busca sem acento e sem maiúsculas acha "João"')
  await p.getByLabel('Buscar paciente').fill('')
  await p.getByRole('button', { name: /Com Check Exames \(1\)/ }).click(); ok((await p.locator('tbody tr').count()) === 1, 'filtro "Com Check Exames" mostra só quem tem análise')
  await p.getByRole('button', { name: /Todos/ }).click()
  if (process.env.FOTOS) await p.screenshot({ path: process.env.FOTOS + '/lista.png' })

  // ── ficha ──
  await linhaJoao.getByRole('link', { name: 'Detalhes' }).click(); await p.waitForURL(new RegExp(`/pacientes/${joao}`))
  ok(await p.getByRole('heading', { name: 'TESTE João Ficha' }).isVisible(), '"Detalhes" abre a ficha do paciente')
  if (process.env.FOTOS) await p.screenshot({ path: process.env.FOTOS + '/ficha.png', fullPage: true })
  ok((await p.getByText('123.456.789-09').count()) === 1 && (await p.getByText('15/03/2021').count()) === 1, 'ficha mostra CPF formatado e nascimento sem erro de fuso')
  ok((await p.getByText('Ligado ao Gestão DS').count()) === 1, 'mostra que está ligado ao Gestão DS')
  ok((await p.getByRole('region', { name: 'Consultas realizadas' }).locator('ul').first().locator('li').count()) === 10 && (await p.getByText('Ver as outras 2').count()) === 1, 'consultas: 10 visíveis e o resto recolhido')
  ok((await p.getByRole('link', { name: /Coleta em 10\/09\/2026/ }).count()) === 1, 'análise de exames aparece e leva à análise')
  ok((await p.getByRole('link', { name: /Orientação de teste/ }).getAttribute('href'))?.endsWith('/pdf'), 'orientação abre o PDF')

  await p.getByRole('link', { name: 'Nova análise de exames' }).click(); await p.waitForURL(/check-exames\/analises\/nova/)
  ok((await p.getByRole('link', { name: 'Voltar à ficha do paciente' }).count()) === 1, 'Nova análise abre o Check Exames e o voltar leva à ficha')
  ok((await p.content()).includes('TESTE João Ficha'), 'paciente já escolhido na nova análise')
  await p.getByRole('link', { name: 'Voltar à ficha do paciente' }).click(); await p.waitForURL(new RegExp(`/pacientes/${joao}$`))

  await p.getByRole('link', { name: 'Novo DRI' }).click(); await p.waitForURL(/dri\/calculadora/); await p.waitForLoadState('networkidle')
  ok(await p.locator(`input[value="TESTE João Ficha"]`).count() === 1, 'Novo DRI abre com o paciente preenchido')
  ok(await p.locator('input[placeholder="0"]').first().inputValue() === '5', 'e com a idade calculada pelo nascimento (5 anos)')
  await p.locator('input[placeholder="0,0"]').nth(0).fill('19'); await p.locator('input[placeholder="0,0"]').nth(1).fill('110')
  await p.getByRole('button', { name: /Calcular Necessidade Energética/ }).click()
  await p.getByRole('button', { name: 'Salvar' }).click(); await p.getByText('Avaliação salva no histórico').waitFor()
  const [dri] = await q('select patient_id, patient_name from dri_avaliacoes where professional_id = $1', [prof])
  ok(dri?.patient_id === joao, 'DRI salvo fica ligado ao paciente (não só ao nome)')

  await p.goto(B + `/pacientes/${joao}`)
  ok((await p.getByRole('region', { name: 'DRI' }).getByRole('link').count()) === 1, 'a avaliação DRI aparece na ficha')
  await p.getByRole('link', { name: 'Nova orientação' }).click(); await p.waitForURL(/orientacoes/); await p.waitForLoadState('networkidle')
  ok((await p.locator('span', { hasText: 'TESTE João Ficha' }).count()) >= 1, 'Nova orientação abre com o paciente escolhido')

  await p.goto(B + '/pacientes')
  ok((await p.locator('tr', { hasText: 'TESTE João Ficha' }).getByLabel('1 avaliação DRI').count()) === 1, 'indicador do DRI passa a aparecer na lista')
  const realErros = erros.filter((e) => !/status of 4\d\d/.test(e))
  ok(realErros.length === 0, 'sem erros na página' + (realErros[0] ? ': ' + realErros[0].slice(0, 160) : ''))

  // outro login não abre a ficha
  const p2 = await (await b.newContext()).newPage(); await entrar(p2, l2)
  ok((await p2.getByText('0 pacientes').count()) === 1, 'segundo login não vê os pacientes do primeiro')
  const r = await p2.goto(B + `/pacientes/${joao}`); ok(r?.status() === 404, 'nem consegue abrir a ficha pelo endereço (404)')
  const r2 = await p2.goto(B + `/dri/calculadora?patientId=${joao}`); await p2.waitForLoadState('networkidle')
  ok(r2?.status() === 200 && (await p2.locator('input[value="TESTE João Ficha"]').count()) === 0, 'nem abrir o DRI com o paciente de outro login')
  await b.close()
} finally {
  for (const l of [l1, l2]) {
    const [pr] = await q('select id, org_id from professionals where auth_user_id = $1', [l.id])
    if (pr) {
      for (const t of ['consultas', 'planos_alimentares', 'dri_avaliacoes', 'orientacoes', 'analyses', 'patients']) await q(`delete from ${t} where professional_id = $1`, [pr.id])
      await q('delete from professionals where id = $1', [pr.id]); await q('delete from organizations where id = $1', [pr.org_id])
    }
    await adm.auth.admin.deleteUser(l.id)
  }
  await db.end(); console.log('logins de teste removidos')
}
