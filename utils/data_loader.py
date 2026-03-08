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

    # garante dataframe com estrutura
    if df.empty:

        return pd.DataFrame(columns=[
            "Paciente",
            "Qtd At.",
            "Recência",
            "Status",
            "Observação",
            "Agendado",
            "Último Atendimento"
        ])

    df["Último Atendimento"] = pd.to_datetime(
        df["ultimo_atendimento"],
        errors="coerce"
    ).dt.strftime("%d/%m/%Y")

    df.rename(columns={
        "paciente": "Paciente",
        "qtd_at": "Qtd At.",
        "recencia_dias": "Recência",
        "status": "Status",
        "observacao": "Observação",
        "agendado": "Agendado"
    }, inplace=True)

    return df
