import pandas as pd
from sqlalchemy import create_engine
import os

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True
)


def carregar_dados():

    try:

        df = pd.read_sql(
            "SELECT * FROM carteira",
            engine
        )

    except Exception as e:

        print("Erro ao carregar carteira:", e)

        df = pd.DataFrame()

    # estrutura mínima para Dash não quebrar
    if df.empty:

        df = pd.DataFrame(columns=[
            "paciente",
            "qtd_at",
            "recencia_dias",
            "status",
            "observacao",
            "agendado",
            "ultimo_atendimento",
            "idade_dias"
        ])

        return df

    # converter data
    df["Último Atendimento"] = pd.to_datetime(
        df["ultimo_atendimento"],
        errors="coerce"
    ).dt.strftime("%d/%m/%Y")

    # criar colunas amigáveis (sem remover as originais)
    df["Paciente"] = df["paciente"]
    df["Qtd At."] = df["qtd_at"]
    df["Recência"] = df["recencia_dias"]
    df["Status"] = df["status"]
    df["Observação"] = df["observacao"]
    df["Agendado"] = df["agendado"]

    return df
