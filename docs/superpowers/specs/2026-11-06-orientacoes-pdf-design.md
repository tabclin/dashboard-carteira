# Orientações: PDF fiel ao modelo, variáveis e aparência por profissional

Data: 06/11/2026 · Página: `/orientacoes` · Pedido do Thiago, decisões tomadas em conversa.

## Por quê

A Dra. monta modelos de orientação com títulos, cores e negrito, mas o PDF que a família recebe sai em texto puro. Os botões de variável não funcionam no texto longo, falta concordância de gênero ("o Thiago" / "a Maria"), o título da seção é pequeno demais, a imagem fica sempre colada à esquerda e o cabeçalho do PDF não pode ser personalizado. O objetivo é o PDF sair igual ao que a Dra. vê na tela, com a cara de cada profissional.

## Objetivos

1. **PDF respeita a formatação** do editor: H2, H3, negrito, itálico, sublinhado, tachado, cor do texto, marca-texto, alinhamento (esquerda/centro/direita), listas com marcador e numeradas, linha divisória e links.
2. **Botões "Inserir variável" funcionam**: inserem a variável na posição do cursor, tanto no texto curto quanto no texto longo (hoje no texto longo o valor muda, mas o editor não é avisado e a variável se perde).
3. **Variáveis de gênero**: `#o/a`, `#ele/ela`, `#do/da`, `#dele/dela` (aparecem nos botões junto com `#nome`, `#nome_completo`, `#data`).
4. **Título da seção maior** no PDF.
5. **"Aparência do PDF" em Configurações**, valendo **só para as Orientações** por enquanto: cor principal, nome, CRM, RQE, especialidade e logo (opcional). Idade da criança ao lado do nome no PDF.
6. **Imagem com alinhamento**: esquerda, centro ou direita, além do tamanho.

## Fora do escopo (não fazer)

- Trazer o sexo pela sincronização do Gestão DS (decidido: não vale, poucos cadastros lá têm sexo).
- Aplicar a aparência ao PDF do Plano Alimentar (fica para depois).
- Mudar o editor de texto, as abas, o histórico ou o "melhorar com IA".

## Anti-objetivos (seria fracasso mesmo funcionando)

- PDF quebrado ou com texto faltando por causa de alguma formatação que o conversor não entende: o que não for reconhecido vira texto normal, nunca some.
- Salvar uma orientação de criança sem sexo definido.
- Orientações já salvas mudarem de conteúdo (só a aparência do PDF delas muda, porque o PDF é gerado na hora).
- Testes mexendo em pacientes reais (o banco é o de produção).

## Como cada parte funciona

### 1. Formatação no PDF

O texto longo é HTML do TipTap. Hoje `lib/pdf/orientacao.tsx` (`htmlToText`) remove todas as tags. Passa a converter o HTML em elementos do `@react-pdf/renderer`:

| No editor | No PDF |
|---|---|
| parágrafo | bloco de texto, 10 pt, entrelinha 1,6 |
| H2 | 12,5 pt, negrito, cor principal |
| H3 | 11 pt, negrito, cinza escuro |
| negrito / itálico / negrito+itálico | Helvetica-Bold / -Oblique / -BoldOblique |
| sublinhado / tachado | `textDecoration` |
| cor do texto | a cor escolhida |
| marca-texto | fundo da cor escolhida (se o react-pdf não desenhar fundo em trecho de linha, cair para só a cor do texto sem perder o texto) |
| alinhamento | `textAlign` do bloco |
| lista com marcador / numerada | "•" ou "1." com recuo; listas dentro de listas recuam mais |
| linha divisória | linha fina cinza |
| link | texto sublinhado na cor principal, clicável |

Tags desconhecidas: mantém o texto, ignora a tag. Entidades HTML (`&amp;`, `&nbsp;`, etc.) decodificadas. Preferência: conversor próprio pequeno e testável, sem dependência nova (o HTML do TipTap é restrito); o construtor pode decidir diferente se tiver bom motivo.

### 2. Botões de variável

- Texto longo: o botão chama o editor TipTap (`insertContent`) na posição do cursor; se o editor ainda não teve foco, insere no fim. O editor precisa expor isso ao componente pai (ex.: ref).
- Texto curto: insere na posição do cursor do textarea.
- Botões aparecem na aba **Modelos** (onde já existem). Na aba Criar não há botões hoje e continua assim.

### 3. Variáveis de gênero

| Variável | Menino | Menina | Sem sexo (só na tela, antes da escolha) |
|---|---|---|---|
| `#o/a` | o | a | o/a |
| `#ele/ela` | ele | ela | ele/ela |
| `#do/da` | do | da | do/da |
| `#dele/dela` | dele | dela | dele/dela |

- Escrita com maiúscula (`#O/A`, `#Ele/Ela`, `#Do/Da`, `#Dele/Dela`) sai com maiúscula ("Ele", "A"). *(decisão minha, para início de frase)*
- Ordem de substituição cuidando de sobreposição: `#dele/dela` antes de `#ele/ela`, `#nome_completo` antes de `#nome` (já é assim).
- Sexo vem de `patients.sex` (hoje `'M'`/`'F'`; aceitar também variações como "masculino"/"feminino", maiúsculas/minúsculas).

**Criança sem sexo cadastrado (aba Criar):**

- Ao escolher a paciente (ou abrir a partir da ficha dela), se não houver sexo, aparece uma faixa em destaque no topo: **"Esta criança é: [Menino] [Menina]"**, com uma linha explicando que a escolha fica salva no cadastro.
- **Obrigatório**: enquanto não escolher, o botão Salvar fica desabilitado com o aviso "Escolha menino ou menina". Vale para toda orientação com paciente sem sexo, mesmo que o modelo não use variável de gênero (decidido: também serve para completar os cadastros).
- Ao clicar: salva o sexo no cadastro da paciente na hora (rota nova, só para pacientes do próprio profissional) e troca no texto atual as formas neutras ("o/a" → "a", "ele/ela" → "ela", etc.), **preservando o que a Dra. já tiver editado** (não reaplica o modelo do zero). Se a gravação falhar, avisa e mantém o Salvar bloqueado.
- Errou o clique: dá para trocar (os dois botões continuam visíveis depois da escolha, com o escolhido marcado) até salvar a orientação.
- A busca de pacientes e a paciente inicial passam a trazer `sex` e `birthDate`.

### 4. Título da seção

Hoje 8 pt em maiúsculas. Passa a 14 pt, negrito, na cor principal, como foi digitado (sem forçar maiúsculas), com um pequeno espaço abaixo. Ajustável depois de ver o PDF de teste.

### 5. Aparência do PDF (Configurações)

Novo cartão "Aparência do PDF das orientações" em `/configuracoes`, com:

- **Cor principal**: algumas cores sugeridas em bolinhas + seletor livre. Padrão: o azul atual (`#4f46e5`).
- **Nome** (padrão: nome do cadastro), **CRM** (texto livre, ex.: "CRM-SP 157418"), **RQE** (ex.: "59046"), **Especialidade** (padrão: a do cadastro).
- **Logo** (opcional): PNG ou JPG, até 1 MB, com botão de remover.
- **Prévia** ao vivo do cabeçalho e um botão "Ver PDF de exemplo" (gera um PDF com dados fictícios, sem paciente real).

Cabeçalho do PDF: faixa na cor principal; logo à esquerda (sobre um fundo branco arredondado, para qualquer logo aparecer bem), ao lado o nome e a linha "Especialidade · CRM · RQE X"; data à direita. Sem logo, o nome ocupa o lugar. Rodapé com o nome. As cores derivadas (texto claro do cabeçalho, título do documento) são calculadas a partir da cor principal, garantindo leitura (cor muito clara → texto do cabeçalho escuro).

Quadro da paciente: "Maria Silva · 3 anos e 2 meses". Idade calculada com `lib/idade.ts` na **data da orientação** (se não houver, data de criação). Sem nascimento: só o nome.

Sem configuração salva: usa nome/CRM/especialidade do cadastro do profissional e o azul atual, ou seja, nada muda até a Dra. configurar.

**Banco (migração 0005, só acréscimo):** tabela nova `aparencia_pdf` (`professional_id` chave e ligado a `professionals`, `cor`, `nome`, `crm`, `rqe`, `especialidade`, `logo` (imagem em base64, como já se faz com as imagens das orientações), `updated_at`), com RLS ligada como as demais. Nenhuma coluna ou dado existente é alterado. **Só é aplicada em produção com OK explícito do Thiago.**

### 6. Imagem

O valor da seção imagem (JSON `{ src, largura }`) ganha `alinhamento: 'esquerda' | 'centro' | 'direita'`. Três botões ao lado do controle de tamanho, na aba Modelos e na aba Criar; a tela mostra a imagem já alinhada. **Padrão: centro**, inclusive para imagens antigas sem o campo.

### Pequeno extra

"Nao preenchido" no PDF ganha acento ("Não preenchido").

## Restrições

- Next 14, React 18, `@react-pdf/renderer` 4, TipTap 3, Prisma 7, Supabase. Seguir o estilo do código existente.
- Testes no estilo do projeto (`node --test scripts/teste-*.mts`): variáveis (gênero, maiúsculas, sobreposição, sem sexo), conversor HTML → PDF (cada formatação da tabela, tag desconhecida, entidades), troca das formas neutras preservando edições. Nenhum teste toca paciente real.
- Fluxo de entrega: tudo testado localmente → Thiago aprova → só então GitHub/Vercel. Migração anunciada antes de aplicar.

## Deixado para o construtor

Estrutura interna dos arquivos, nome da rota de salvar o sexo, como o editor expõe a inserção, formato exato das cores sugeridas, detalhes visuais do cartão de configurações (seguindo o padrão dos cartões já existentes em Configurações).
