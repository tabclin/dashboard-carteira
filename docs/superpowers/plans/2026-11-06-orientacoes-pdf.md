# Orientações: PDF fiel, variáveis e aparência — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PDF das orientações com a formatação do editor, variáveis funcionando (incluindo gênero), título de seção maior, imagem alinhável e aparência configurável por profissional.

**Architecture:** Lógica pura em módulos sem imports de runtime (testáveis com `node --test`): variáveis, conversor HTML→blocos, cores. O PDF (`lib/pdf/orientacao.tsx`) só desenha os blocos. Aparência numa tabela nova `aparencia_pdf` (migração 0005, só acréscimo). UI: editor expõe inserção no cursor; aba Criar ganha a faixa Menino/Menina obrigatória.

**Tech Stack:** Next 14, React 18, `@react-pdf/renderer` 4, TipTap 3, Prisma 7 (Supabase Postgres), Tailwind.

**Spec:** `docs/superpowers/specs/2026-11-06-orientacoes-pdf-design.md`

## Global Constraints

- Módulos testados por `node --test scripts/teste-*.mts` não podem ter imports de runtime (só `import type`), porque o Node não resolve `@/` nem extensões omitidas.
- Nenhum teste ou script toca paciente real (banco = produção). PDF de exemplo usa dados fictícios.
- Migração 0005 só acrescenta; **não aplicar em produção sem OK explícito do Thiago**.
- Nada vai para GitHub/Vercel antes do teste local e aprovação do Thiago.
- Sem configuração salva, o PDF fica igual ao de hoje (azul `#4f46e5`, nome/CRM/especialidade do cadastro).
- Textos de interface em português, com acentos.

## Review Focus

1. HTML antigo/estranho (orientações já salvas, texto colado de fora com `<div>`, `<span style>` diverso): o texto nunca pode sumir do PDF — teste "tag desconhecida mantém o texto" na Task 2.
2. `#dele/dela` vs `#ele/ela` e `#nome_completo` vs `#nome`: sobreposição na substituição — teste na Task 1.
3. Escolher Menino/Menina depois de a Dra. editar: edição preservada — teste de `trocarNeutras` na Task 1.
4. Cor principal muito clara (amarelo): texto do cabeçalho tem de continuar legível — teste de contraste na Task 3.
5. Paciente de outro login: a rota de salvar sexo não pode alterar paciente alheio — checagem `professionalId` na Task 7.

---

### Task 1: Variáveis de gênero

**Files:**
- Modify: `lib/orientacoes/variables.ts`
- Test: `scripts/teste-variaveis.mts`

**Interfaces:**
- Produces:
  - `type Sexo = 'M' | 'F' | null`
  - `normalizarSexo(s: string | null | undefined): Sexo` — aceita `M/F`, `masculino/feminino`, qualquer caixa; resto → `null`.
  - `VariableContext` ganha `sexo?: Sexo`.
  - `buildContext(patient: { name: string; sex?: string | null } | null, date: Date): VariableContext`
  - `applyVariables(text, ctx)` passa a tratar `#o/a #ele/ela #do/da #dele/dela` e as versões com inicial maiúscula (`#O/A`, `#Ele/Ela`, `#Do/Da`, `#Dele/Dela`); sem sexo → forma neutra (`o/a`, `ele/ela`, `do/da`, `dele/dela`, ou `O/A`, `Ele/Ela`...).
  - `trocarNeutras(text: string, sexo: 'M' | 'F'): string` — troca as formas neutras (minúsculas e com inicial maiúscula) pela forma do sexo, como palavra inteira.
  - `VARIABLES` ganha as 4 de gênero (labels: "o/a conforme o sexo", "ele/ela conforme o sexo", "do/da conforme o sexo", "dele/dela conforme o sexo").

- [ ] **Step 1: Escrever os testes**

```ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyVariables, buildContext, trocarNeutras, normalizarSexo } from '../lib/orientacoes/variables.ts'
const d = new Date(2026, 10, 6)
test('menino', () => assert.equal(applyVariables('Fale para #o/a #nome que #ele/ela vai bem', buildContext({ name: 'Thiago Silva', sex: 'M' }, d)), 'Fale para o Thiago que ele vai bem'))
test('menina', () => assert.equal(applyVariables('o peso #do/da #nome, #dele/dela', buildContext({ name: 'Maria Souza', sex: 'F' }, d)), 'o peso da Maria, dela'))
test('maiúscula', () => assert.equal(applyVariables('#Ele/Ela come. #O/A #nome', buildContext({ name: 'Maria', sex: 'F' }, d)), 'Ela come. A Maria'))
test('sem sexo fica neutro', () => assert.equal(applyVariables('#o/a #nome, #dele/dela', buildContext({ name: 'Ana', sex: null }, d)), 'o/a Ana, dele/dela'))
test('nome_completo antes de nome', () => assert.equal(applyVariables('#nome_completo/#nome', buildContext({ name: 'Ana Lima', sex: 'F' }, d)), 'Ana Lima/Ana'))
test('trocarNeutras preserva edição', () => assert.equal(trocarNeutras('<p>Diga a o/a Ana (editado) que ele/ela e Ele/Ela</p>', 'F'), '<p>Diga a a Ana (editado) que ela e Ela</p>'))
test('trocarNeutras não mexe em palavra maior', () => assert.equal(trocarNeutras('modelo/app', 'M'), 'modelo/app'))
test('normalizarSexo', () => { assert.equal(normalizarSexo('masculino'), 'M'); assert.equal(normalizarSexo('f'), 'F'); assert.equal(normalizarSexo(''), null) })
```

- [ ] **Step 2:** `node --test scripts/teste-variaveis.mts` → FAIL (`trocarNeutras` não exportado).
- [ ] **Step 3:** Implementar em `lib/orientacoes/variables.ts`. Substituição de gênero por uma regex única com alternativas da mais longa para a mais curta (`dele/dela` antes de `ele/ela`), com `\b`-equivalente antes do `#`/da palavra para não pegar trechos de palavras maiores.
- [ ] **Step 4:** Rodar o teste → PASS. Rodar também `node --test scripts/teste-idade.mts` (não pode quebrar).
- [ ] **Step 5:** Commit `Orientações: variáveis de gênero (#o/a, #ele/ela, #do/da, #dele/dela)`.

### Task 2: Conversor HTML → blocos do PDF

**Files:**
- Create: `lib/pdf/html-blocos.ts`
- Test: `scripts/teste-html-blocos.mts`

**Interfaces:**
- Produces:
```ts
export interface Trecho { texto: string; negrito?: boolean; italico?: boolean; sublinhado?: boolean; tachado?: boolean; cor?: string; fundo?: string; link?: string }
export type Bloco =
  | { tipo: 'paragrafo' | 'h2' | 'h3'; alinhamento: 'left' | 'center' | 'right' | 'justify'; trechos: Trecho[] }
  | { tipo: 'lista'; ordenada: boolean; itens: Bloco[][] }   // cada item é uma lista de blocos (permite lista dentro de lista)
  | { tipo: 'linha' }
export function htmlParaBlocos(html: string): Bloco[]
```
- Regras: `<strong>/<b>`, `<em>/<i>`, `<u>`, `<s>/<del>`, `<span style="color:…">`, `<mark data-color="…">` ou `style="background-color:…"`, `<a href>`, `<br>` vira quebra `\n` no trecho, `style="text-align:…"` no `<p>/<h2>/<h3>`, `<ul>/<ol>/<li>` (o `<p>` dentro do `<li>` vira bloco do item), `<hr>`. `<h1>` trata como h2, `<h4+>` como h3. Tag desconhecida: ignora a tag, mantém o texto (texto solto fora de bloco vira parágrafo). Decodifica `&amp; &lt; &gt; &quot; &#39; &nbsp;` e `&#NNN;`. Parágrafo vazio vira parágrafo vazio (espaço visual), não é descartado. Texto puro sem tags (texto curto/seleção) → um parágrafo por linha.

- [ ] **Step 1: Escrever os testes** — um por linha da tabela da spec, mais:
```ts
test('negrito dentro de cor', () => assert.deepEqual(htmlParaBlocos('<p><span style="color: #ff0000">a <strong>b</strong></span></p>'),
  [{ tipo: 'paragrafo', alinhamento: 'left', trechos: [{ texto: 'a ', cor: '#ff0000' }, { texto: 'b', cor: '#ff0000', negrito: true }] }]))
test('h2 centralizado', () => assert.deepEqual(htmlParaBlocos('<h2 style="text-align: center">Oi</h2>')[0], { tipo: 'h2', alinhamento: 'center', trechos: [{ texto: 'Oi' }] }))
test('lista aninhada', () => { const [l] = htmlParaBlocos('<ul><li><p>a</p><ul><li><p>b</p></li></ul></li></ul>'); assert.equal(l.tipo, 'lista'); /* item 0 tem parágrafo "a" e uma lista com "b" */ })
test('tag desconhecida mantém o texto', () => assert.equal(textoDe(htmlParaBlocos('<div><foo>Olá</foo> mundo</div>')), 'Olá mundo'))
test('entidades', () => assert.equal(textoDe(htmlParaBlocos('<p>A &amp; B&nbsp;C &#233;</p>')), 'A & B C é'))
test('texto puro com quebras', () => assert.equal(htmlParaBlocos('linha 1\nlinha 2').length, 2))
```
(`textoDe` = helper local no teste que concatena os `texto` de todos os trechos.)
- [ ] **Step 2:** Rodar → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar com um tokenizador próprio (tags/texto) e uma pilha de estilos; sem dependência nova; sem imports de runtime.
- [ ] **Step 4:** Rodar → PASS.
- [ ] **Step 5:** Commit `PDF: conversor do texto formatado (HTML do editor) em blocos`.

### Task 3: Cores derivadas e aparência padrão

**Files:**
- Create: `lib/pdf/aparencia.ts`
- Test: `scripts/teste-aparencia.mts`

**Interfaces:**
- Produces:
```ts
export interface Aparencia { cor: string; nome: string; crm: string | null; rqe: string | null; especialidade: string | null; logo: string | null }
export const COR_PADRAO = '#4f46e5'
export function aparenciaComPadrao(salva: Partial<Aparencia> | null, cadastro: { name: string; crm: string | null; specialty: string | null }): Aparencia
export function coresDe(cor: string): { principal: string; escura: string; textoSobre: string; textoSobreSuave: string; clara: string }
export function linhaRegistro(a: Aparencia): string  // "Pediatra · CRM-SP 157418 · RQE 59046", ignora vazios
export function corValida(s: string): boolean        // #rrggbb
```
- `aparenciaComPadrao`: campo salvo vazio/ausente cai no cadastro (nome, crm, especialidade); cor inválida → `COR_PADRAO`. `crm` do cadastro só com número (ex. "157418") vira "CRM 157418"; CRM salvo pela Dra. é usado como digitado.
- `coresDe`: `escura` = principal escurecida ~30%; `clara` = principal misturada ~90% com branco; `textoSobre` = branco ou `#1e293b`, o que tiver maior contraste com a principal (luminância relativa WCAG); `textoSobreSuave` idem com transparência visual (mistura 75% com a principal).

- [ ] **Step 1: Testes**
```ts
test('sem nada salvo usa cadastro e azul', () => assert.deepEqual(aparenciaComPadrao(null, { name: 'Dra. Ana', crm: '157418', specialty: 'Pediatra' }), { cor: '#4f46e5', nome: 'Dra. Ana', crm: 'CRM 157418', rqe: null, especialidade: 'Pediatra', logo: null }))
test('salvo vence', () => assert.equal(aparenciaComPadrao({ nome: 'Dra. Ana Beatriz Buzatto', crm: 'CRM-SP 157418' }, cad).crm, 'CRM-SP 157418'))
test('amarelo claro usa texto escuro', () => assert.equal(coresDe('#ffe066').textoSobre, '#1e293b'))
test('azul usa texto branco', () => assert.equal(coresDe('#4f46e5').textoSobre, '#ffffff'))
test('linha de registro', () => assert.equal(linhaRegistro({ ...a, especialidade: 'Pediatra', crm: 'CRM-SP 157418', rqe: '59046' }), 'Pediatra · CRM-SP 157418 · RQE 59046'))
test('cor inválida', () => assert.equal(aparenciaComPadrao({ cor: 'azul' }, cad).cor, '#4f46e5'))
```
- [ ] **Step 2:** Rodar → FAIL. **Step 3:** Implementar. **Step 4:** Rodar → PASS.
- [ ] **Step 5:** Commit `PDF: aparência padrão e cores derivadas da cor principal`.

### Task 4: Banco — tabela `aparencia_pdf` (migração 0005)

**Files:**
- Create: `supabase/migrations/0005_aparencia_pdf.sql`
- Modify: `prisma/schema.prisma` (model `AparenciaPdf` + relação `aparenciaPdf AparenciaPdf?` em `Professional`)

**Interfaces:**
- Produces: `prisma.aparenciaPdf` com `professionalId (id) cor nome crm rqe especialidade logo updatedAt` (todos texto opcional, exceto id/updatedAt), `@@map("aparencia_pdf")`, colunas snake_case.

- [ ] **Step 1:** Escrever a migração no estilo da 0003 (comentário no topo dizendo "só acréscimo", `create table if not exists`, FK `on delete cascade`, `enable row level security`).
- [ ] **Step 2:** Model no Prisma, `npx prisma generate`. Expected: sem erro; `npx tsc --noEmit` sem erros novos.
- [ ] **Step 3:** **PARAR e pedir OK do Thiago** para aplicar a 0005 em produção (`node scripts/aplicar-migracoes.mjs` — conferir antes como o script escolhe a migração). Até o OK, seguir as tasks; o que depende da tabela é testado depois do OK.
- [ ] **Step 4:** Commit `Migração 0005: aparência do PDF por profissional (só acréscimo)`.

### Task 5: PDF da orientação

**Files:**
- Modify: `lib/pdf/orientacao.tsx`, `app/api/orientacoes/[id]/pdf/route.ts`, `components/orientacoes/secao-input.tsx` (`parseImageValor`/`serializeImageValor` ganham `alinhamento`)
- Create: `lib/orientacoes/imagem.ts` (parse/serialize puros, movidos de `secao-input.tsx`, reexportados lá para não quebrar imports) + teste `scripts/teste-imagem.mts`

**Interfaces:**
- Consumes: `htmlParaBlocos` (Task 2), `Aparencia`, `coresDe`, `linhaRegistro`, `aparenciaComPadrao` (Task 3), `idadeTexto` (`lib/idade.ts`).
- Produces:
  - `parseImageValor(valor): { src: string; largura: number; alinhamento: 'esquerda' | 'centro' | 'direita' }` (ausente → `'centro'`)
  - `serializeImageValor(src, largura, alinhamento = 'centro'): string`
  - `OrientacaoDocument` props: `{ aparencia: Aparencia; paciente: { nome: string; idade: string | null } | null; title; secoes; data: Date }`

- [ ] **Step 1: Teste da imagem** — antigo sem campo → centro; string base64 pura → `{ largura: 100, alinhamento: 'centro' }`; ida e volta preserva `'direita'`. Rodar → FAIL; implementar `lib/orientacoes/imagem.ts`; → PASS.
- [ ] **Step 2: Documento.** Cabeçalho: faixa `principal`, logo (se houver) num quadro branco arredondado ~44pt de altura à esquerda, nome em `textoSobre` 13pt negrito, `linhaRegistro` em `textoSobreSuave` 9pt, data à direita. Quadro da paciente: "Nome · idade" (sem idade só o nome). Título do documento com barra `principal` e texto `escura`. Título da seção: 14pt Helvetica-Bold cor `principal`, sem `textTransform`, `marginBottom: 6`. Corpo: render dos `Bloco` com a tabela da spec (H2 12,5pt negrito `principal`; H3 11pt negrito `#334155`; parágrafo 10pt lh 1.6; lista com "•"/"n." e recuo 12pt por nível; linha = borda 1pt `#e2e8f0`; link = `Link` do react-pdf sublinhado na `principal`; fonte por combinação negrito/itálico: Helvetica, -Bold, -Oblique, -BoldOblique). Marca-texto via `backgroundColor` no `Text` aninhado. Imagem: `View` com `alignItems` flex-start/center/flex-end. "Não preenchido" com acento. Rodapé com `aparencia.nome`.
- [ ] **Step 3: Rota.** Buscar `aparenciaPdf` e o paciente com `birthDate`; idade com `idadeTexto(birthDate, orientacaoDate ?? createdAt)`; data do PDF = `orientacaoDate ?? createdAt`.
- [ ] **Step 4: Verificar.** `npx tsc --noEmit` limpo. Com `pnpm dev` (porta livre, ex. 3300) e login de teste, abrir o PDF de uma orientação **de teste** (criar paciente/orientação fictícios e apagar no fim, como em `scripts/teste-limpeza.mts`) contendo todas as formatações; converter a página 1 em PNG (pdfjs-dist ou Playwright) e olhar: formatação visível, título de seção grande, imagem centralizada, idade ao lado do nome.
- [ ] **Step 5:** Commit `PDF das orientações: formatação do editor, título maior, imagem alinhada, idade e cabeçalho configurável`.

### Task 6: Configurações — "Aparência do PDF das orientações"

**Files:**
- Create: `components/configuracoes/aparencia-pdf.tsx`, `app/api/orientacoes/exemplo-pdf/route.ts`
- Modify: `app/(dashboard)/configuracoes/acoes.ts` (ação `salvarAparenciaPdf`), `app/(dashboard)/configuracoes/page.tsx` (carregar e mostrar o cartão), cabeçalho da página ("· aparência do PDF" no subtítulo é opcional)

**Interfaces:**
- Consumes: `Aparencia`, `aparenciaComPadrao`, `coresDe`, `corValida`, `linhaRegistro` (Task 3); `OrientacaoDocument` (Task 5).
- Produces: `salvarAparenciaPdf(dados: { cor: string; nome: string; crm: string; rqe: string; especialidade: string; logo: string | null }): Promise<Resultado>` — valida cor (`corValida`), nome não vazio, logo `data:image/(png|jpeg);base64,` com até ~1,4 MB de texto (≈1 MB de arquivo); `upsert` por `professionalId` do login (padrão `profissionalAtual()`); campos vazios gravam `null`.

- [ ] **Step 1:** Cartão no estilo de `prazos-padrao.tsx`: bolinhas de cor sugeridas (azul atual `#4f46e5`, azul-petróleo `#3e6e8e`, verde `#0f766e`, rosa `#db2777`, coral `#ef7f67`, roxo `#7c3aed`) + `input type=color`; campos Nome, CRM (placeholder "CRM-SP 157418"), RQE (placeholder "59046"), Especialidade; logo com botão de escolher (PNG/JPG, recusa >1 MB com mensagem) e remover; prévia ao vivo do cabeçalho (mesmas cores de `coresDe`); botões "Salvar aparência" e "Ver PDF de exemplo".
- [ ] **Step 2:** Rota `GET /api/orientacoes/exemplo-pdf`: login obrigatório; gera `OrientacaoDocument` com a aparência salva e dados fictícios fixos (paciente "Maria Exemplo · 3 anos e 2 meses", uma seção com H2/H3/negrito/cor/lista e uma imagem? — sem imagem é aceitável). Nunca lê paciente real.
- [ ] **Step 3: Verificar** (após OK da migração): salvar cor coral, CRM e logo de teste no login de teste → "Ver PDF de exemplo" mostra o cabeçalho coral com logo; recarregar a página mantém os valores; cor `#ffe066` deixa o texto do cabeçalho escuro. Apagar a configuração do login de teste no fim.
- [ ] **Step 4:** Commit `Configurações: aparência do PDF das orientações (cor, nome, CRM, RQE, especialidade, logo)`.

### Task 7: Editor, variáveis no cursor, imagem alinhável e Menino/Menina

**Files:**
- Modify: `components/orientacoes/editor.tsx`, `components/orientacoes/template-builder.tsx`, `components/orientacoes/secao-input.tsx`, `components/orientacoes/orientacoes-page.tsx`, `app/(dashboard)/orientacoes/page.tsx`, `app/api/pacientes/route.ts`
- Create: `app/api/pacientes/[id]/sexo/route.ts`, `components/orientacoes/alinhamento-imagem.tsx`

**Interfaces:**
- Consumes: `normalizarSexo`, `trocarNeutras`, `buildContext` com `sex` (Task 1); `parseImageValor/serializeImageValor` com alinhamento (Task 5).
- Produces:
  - `RichTextEditor` aceita `ref` (forwardRef) com `{ inserir(texto: string): void }` — usa `editor.chain().focus().insertContent(texto).run()`; se o editor nunca teve foco, insere no fim (`focus('end')`).
  - `PATCH /api/pacientes/[id]/sexo` body `{ sexo: 'M' | 'F' }` → 200 `{ ok: true }`; 400 se valor inválido; 404 se paciente não for do `professionalId` do login (usar `updateMany` com `where: { id, professionalId }` e checar `count`).
  - `GET /api/pacientes` passa a devolver `sex` e `birthDate`; `Patient` na página ganha `sex?: string | null`.
  - `<AlinhamentoImagem valor onChange />` — três botões (ícones `AlignLeft/AlignCenter/AlignRight`), usado no builder e no `SecaoInput`.

- [ ] **Step 1: Variáveis no cursor (Modelos).** `template-builder.tsx`: guardar refs dos editores por seção e refs dos textareas; `insertVar` chama `ref.inserir(variavel)` no texto longo e, no texto curto, insere em `selectionStart/selectionEnd` e reposiciona o cursor. Os botões passam a listar as 7 variáveis de `VARIABLES`.
- [ ] **Step 2: Imagem.** Builder e `SecaoInput`: preview usa um contêiner flex com `justify-start/center/end` conforme o alinhamento; `AlinhamentoImagem` ao lado do controle de tamanho; trocar imagem/tamanho preserva o alinhamento.
- [ ] **Step 3: Rota do sexo + API de pacientes** (conforme Interfaces). `orientacoes/page.tsx` passa `sex` em `pacienteInicial`. Histórico: ao "Editar"/"Duplicar", o `o.patient` vem sem `sex` → buscar o paciente (`/api/pacientes?q=` não serve por id; incluir `sex` no `include` de `app/api/orientacoes/route.ts`).
- [ ] **Step 4: Faixa Menino/Menina (aba Criar).** `const sexo = normalizarSexo(selectedPatient?.sex)`. Com paciente escolhido e `sexo === null` → mostrar a faixa logo abaixo do passo "1. Paciente": fundo âmbar, "Esta criança é:" + botões [Menino] [Menina] + "A escolha fica salva no cadastro da criança." Estado novo: `escolhaSexo: { sexo: 'M' | 'F'; neutras: SecaoValor[]; resultado: SecaoValor[] } | null` (zerado ao trocar de paciente e no `resetForm`). A faixa aparece quando `sexo === null` **ou** `escolhaSexo !== null`. Clicar: `PATCH` → em sucesso: `neutras` = `escolhaSexo?.neutras ?? secoes` atuais; `resultado` = `neutras` com `trocarNeutras` em `valor` e `titulo` (imagens intactas); `setSecoes(resultado)`; `setSelectedPatient({ ...p, sex })`; botão escolhido marcado. Trocar a escolha só é permitido enquanto `secoes === escolhaSexo.resultado` (nenhuma edição depois da escolha); senão o outro botão fica desabilitado com a dica "Para trocar, edite o texto à mão". Em erro do `PATCH`: toast e nada muda. **Atenção:** o `useEffect` que reaplica o modelo depende de `selectedPatient` (objeto) e apagaria as edições ao gravar o sexo — passar a depender de `selectedPatient?.id` e `orientacaoDate`. `buildContext` recebe o paciente com `sex`, então ao aplicar o modelo o texto já sai certo quando houver sexo.
- [ ] **Step 5: Salvar bloqueado.** `handleSave` e o botão Salvar: com paciente sem sexo (estado atual), `disabled` + texto auxiliar "Escolha menino ou menina" ao lado do botão; `handleSave` também recusa com `toast.error`.
- [ ] **Step 6: Verificar** com `pnpm dev` + Playwright no login de teste, paciente **fictícia** sem sexo: (a) em Modelos, clicar `#o/a` no meio de um texto longo insere no cursor; (b) Criar com essa paciente → faixa aparece, Salvar desabilitado, texto com "o/a"; editar uma palavra, clicar Menina → "a" no texto, edição mantida, Salvar habilitado; (c) banco: paciente fictícia agora `sex = 'F'`; (d) imagem centralizada no preview e no PDF; (e) `PATCH` com id de paciente de outro login → 404. Apagar os dados fictícios no fim. `npx tsc --noEmit` e `pnpm lint` limpos; todos os `node --test scripts/teste-*.mts` verdes.
- [ ] **Step 7:** Commit `Orientações: variáveis no cursor, imagem alinhável e escolha obrigatória de menino/menina`.
