# Ferramentas clínicas da Dra. Ana Beatriz Buzatto

App Next.js com três ferramentas: **Check Exames** (análise de laudos com IA), **DRI** (necessidade energética e plano alimentar) e **Orientações**, mais o cadastro de **Pacientes**.

- Publicado na Vercel (projeto `dashboard-carteira`), banco e login no Supabase.
- Variáveis em `.env.local` (modelo em `.env.example`).
- `npm run dev` para rodar localmente; `npm run build` gera o Prisma e compila.

## Gestão DS e planilhas

Cada login guarda a própria chave do Gestão DS em **Configurações** (criptografada com `GESTAODS_CHAVE_MESTRA`, que precisa ser a mesma no `.env.local` e na Vercel). "Atualizar agora" traz pacientes e consultas realizadas; a importação de planilha (relatórios de Pacientes e de Atendimentos do Gestão DS) é a alternativa. Regras de vínculo em `lib/gestaods/vinculo.ts`: nunca apaga nem renomeia paciente, só completa campos vazios; casos duvidosos vão para revisão.

## Banco

Mudanças em `supabase/migrations`, aplicadas com `node scripts/aplicar-migracoes.mjs` (use `--ensaio` para rodar e desfazer). Só acréscimos; avisar antes de aplicar.

## Testes

- `node --test scripts/teste-vinculo.mts`: regras de vínculo (sem banco)
- `node scripts/teste-limpeza.mts`: telas e cadastro, com login temporário (app em :3300)
- `node --test scripts/teste-idade.mts`: idade e datas sem erro de fuso
- `node scripts/teste-pacientes.mts`: lista e ficha de pacientes, atalhos para as ferramentas, isolamento entre logins (app em :3300)
- `node --test scripts/teste-tarefas-regras.mts`: prazo sugerido e grupos das tarefas
- `node scripts/teste-tarefas.mts`: tarefas (criar, prazos, concluir sozinha pelas ferramentas, isolamento entre logins)
- `node scripts/teste-gestaods.mts`: Gestão DS (falso, em :3399) e planilhas, com dois logins temporários; suba o app com `GESTAODS_URL=http://localhost:3399`
