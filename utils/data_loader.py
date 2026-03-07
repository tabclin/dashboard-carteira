import pandas as pd
from sqlalchemy import create_engine
import os

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True
)


def carregar_dados():

    df = pd.read_sql(
        "SELECT * FROM carteira",
        engine
    )

    if df.empty:
        return pd.DataFrame()

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
