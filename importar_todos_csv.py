import pandas as pd
from sqlalchemy import create_engine

DATABASE_URL = "postgresql://postgres.hlfiykpoousspkcdswer:TabClin1706@aws-1-sa-east-1.pooler.supabase.com:6543/postgres"

engine = create_engine(DATABASE_URL)

base = r"C:\Users\Thiago\Desktop\Python\Dra Ana Beatriz Buzatto passo02"
# -------------------------------
# observacoes.csv
# -------------------------------
df_obs = pd.read_csv(f"{base}/observacoes.csv")

df_obs.to_sql(
    "observacoes",
    engine,
    if_exists="replace",
    index=False
)

print("observacoes atualizado")


# -------------------------------
# relatorio-atendimentos.csv
# -------------------------------
df_atend = pd.read_csv(
    f"{base}/relatorio-atendimentos.csv",
    sep=";"
)

df_atend = df_atend.rename(columns={
    "Paciente": "paciente",
    "Data": "data_atendimento",
    "Cidade": "cidade",
    "CPF": "cpf",
    "Celular": "celular",
    "E-mail": "email",
    "Serviço": "servico",
    "Tipo": "tipo",
    "Médico": "medico",
    "Valor": "valor",
    "Status do pagamento": "status"
})

df_atend.to_sql(
    "atendimentos",
    engine,
    if_exists="replace",
    index=False
)

print("atendimentos atualizado")


# -------------------------------
# tabela_pacientes.csv
# -------------------------------
df_pac = pd.read_csv(
    f"{base}/tabela_pacientes.csv",
    sep=";"
)

df_pac = df_pac.rename(columns={
    "Paciente": "paciente",
    "CPF": "cpf",
    "Telefone": "telefone",
    "Email": "email",
    "Nascimento": "nascimento",
    "Cidade": "cidade",
    "Etiquetas": "etiquetas"
})

df_pac.to_sql(
    "pacientes",
    engine,
    if_exists="replace",
    index=False
)

print("pacientes atualizado")


# -------------------------------
# agenda
# -------------------------------
df_agenda = pd.read_csv(
    f"{base}/table_agenda_relatorio.csv"
)

df_agenda = df_agenda.rename(columns={
    "Medico": "medico",
    "Paciente": "paciente",
    "Data e hora": "data_hora",
    "Agendado em": "agendado_em",
    "Tipo": "tipo",
    "Convênio": "convenio",
    "Status": "status",
    "Primeiro Atendimento": "primeiro_atendimento",
    "Obs": "observacao"
})

df_agenda.to_sql(
    "agenda",
    engine,
    if_exists="replace",
    index=False
)

print("agenda atualizado")
