import pandas as pd
import unicodedata
import re
from sqlalchemy import create_engine
import os

# DATABASE_URL = "postgresql://postgres:TabClin1706@db.hlfiykpoousspkcdswer.supabase.co:6543/postgres?sslmode=require"
DATABASE_URL = "postgresql://postgres.hlfiykpoousspkcdswer:TabClin1706@aws-1-sa-east-1.pooler.supabase.com:6543/postgres"

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True
)

# ---------------- FUNÇÕES AUXILIARES ---------------- #


def normalizar_nome(nome):
    if pd.isna(nome):
        return ""

    nome = unicodedata.normalize("NFKD", nome)
    nome = nome.encode("ASCII", "ignore").decode("utf-8")
    nome = re.sub(r"\W+", "", nome)
    return nome.lower()


def classificar_status(idade_dias, recencia):

    if pd.isna(idade_dias) or pd.isna(recencia):
        return "Atenção"

    if 0 <= idade_dias < 365:
        if recencia > 30:
            return "Perigo"
        elif recencia <= 20:
            return "Ok"
        else:
            return "Atenção"

    elif 365 <= idade_dias < 730:
        if recencia > 60:
            return "Perigo"
        elif recencia <= 40:
            return "Ok"
        else:
            return "Atenção"

    elif idade_dias >= 730:
        if recencia > 180:
            return "Perigo"
        elif recencia <= 120:
            return "Ok"
        else:
            return "Atenção"

    return "Atenção"


# ---------------- FUNÇÃO PRINCIPAL ---------------- #

def carregar_dados():

    print("Carregando atendimentos...")
    df_atend = pd.read_sql("SELECT * FROM atendimentos", engine)

    print("Carregando pacientes...")
    df_pac = pd.read_sql("SELECT * FROM pacientes", engine)

    print("Carregando observacoes...")
    df_obs = pd.read_sql("SELECT * FROM observacoes", engine)

    print("Carregando agenda...")
    df_agenda = pd.read_sql("SELECT * FROM agenda", engine)

    # ---------------- BANCO ---------------- #

    df_atend = pd.read_sql("SELECT * FROM atendimentos", engine)
    df_pac = pd.read_sql("SELECT * FROM pacientes", engine)
    df_obs = pd.read_sql("SELECT * FROM observacoes", engine)
    df_agenda = pd.read_sql("SELECT * FROM agenda", engine)

    df_atend.columns = df_atend.columns.str.strip()
    df_pac.columns = df_pac.columns.str.strip()
    df_obs.columns = df_obs.columns.str.strip()
    df_agenda.columns = df_agenda.columns.str.strip()

    # ---------------- DATAS ---------------- #

    df_atend["data_atendimento"] = pd.to_datetime(
        df_atend["data_atendimento"], errors="coerce"
    )

    df_pac["nascimento"] = pd.to_datetime(
        df_pac["nascimento"], errors="coerce"
    )

    df_agenda["data_hora"] = pd.to_datetime(
        df_agenda["data_hora"], errors="coerce"
    )

    # ---------------- NORMALIZAR NOMES ---------------- #

    df_atend["nome_normalizado"] = df_atend["paciente"].apply(normalizar_nome)
    df_pac["nome_normalizado"] = df_pac["paciente"].apply(normalizar_nome)
    df_agenda["nome_normalizado"] = df_agenda["paciente"].apply(
        normalizar_nome)

    # ---------------- MERGE PACIENTES ---------------- #

    df_base = df_atend.merge(
        df_pac[["nome_normalizado", "nascimento"]],
        on="nome_normalizado",
        how="left"
    )

    hoje = pd.Timestamp.today()

    # ---------------- AGRUPAMENTO ---------------- #

    df_group = df_base.groupby(["paciente", "nascimento"]).agg(
        ultimo_atendimento=("data_atendimento", "max"),
        quantidade_atendimento=("data_atendimento", "count")
    ).reset_index()

    df_group["idade_dias"] = (hoje - df_group["nascimento"]).dt.days
    df_group["recencia_dias"] = (hoje - df_group["ultimo_atendimento"]).dt.days

    df_group["Status"] = df_group.apply(
        lambda row: classificar_status(
            row["idade_dias"], row["recencia_dias"]
        ),
        axis=1
    )

    df_group["Recência"] = df_group["recencia_dias"]

    # ---------------- DATAFRAME FINAL ---------------- #

    df_final = df_group[[
        "paciente",
        "ultimo_atendimento",
        "quantidade_atendimento",
        "Recência",
        "Status"
    ]].rename(columns={
        "paciente": "Paciente",
        "ultimo_atendimento": "Último Atendimento",
        "quantidade_atendimento": "Qtd At."
    })

    df_final["Último Atendimento"] = df_final["Último Atendimento"].dt.strftime(
        "%d/%m/%Y")

    # ---------------- OBSERVAÇÕES ---------------- #

    df_final = df_final.merge(
        df_obs,
        left_on="Paciente",
        right_on="paciente",
        how="left"
    )

    df_final.drop(columns=["paciente"], inplace=True, errors="ignore")

    # ---------------- AGENDA ---------------- #

    df_agenda = df_agenda.sort_values("data_hora", ascending=False)

    df_agenda_unico = df_agenda.drop_duplicates(
        subset="nome_normalizado",
        keep="first"
    )

    df_final["nome_normalizado"] = df_final["Paciente"].apply(normalizar_nome)

    df_final = df_final.merge(
        df_agenda_unico[["nome_normalizado", "status"]],
        on="nome_normalizado",
        how="left",
        suffixes=("", "_agenda")
    )

    df_final.rename(columns={"status_agenda": "Agendado"}, inplace=True)

    df_final.drop(columns=["nome_normalizado"], inplace=True)

    return df_final
