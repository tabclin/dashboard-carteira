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

    df["ultimo_atendimento"] = pd.to_datetime(
        df["ultimo_atendimento"]
    )

    df["Último Atendimento"] = df["ultimo_atendimento"].dt.strftime("%d/%m/%Y")

    df.rename(columns={
        "paciente": "Paciente",
        "qtd_at": "Qtd At.",
        "observacao": "Observação"
    }, inplace=True)

    return df
