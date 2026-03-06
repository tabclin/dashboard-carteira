

import pandas as pd
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://postgres:TabClin1706@db.hlfiykpoousspkcdswer.supabase.co:5432/postgres"

engine = create_engine(DATABASE_URL)

arquivo_csv = r"C:\Users\Thiago\Desktop\Python\Dra Ana Beatriz Buzatto\relatorio-atendimentos.csv"

# ler CSV com separador correto
df = pd.read_csv(arquivo_csv, sep=";")

# renomear colunas
df = df.rename(columns={
    "Paciente": "paciente",
    "Valor": "valor",
    "Data": "data_atendimento",
    "Status do pagamento": "status"
})

# converter data
df["data_atendimento"] = pd.to_datetime(df["data_atendimento"], dayfirst=True)

# converter valor monetário
df["valor"] = (
    df["valor"]
    .astype(str)
    .str.replace("R$", "", regex=False)
    .str.replace(".", "", regex=False)
    .str.replace(",", ".", regex=False)
)

df["valor"] = pd.to_numeric(df["valor"], errors="coerce")

# criar id único
df["atendimento_id"] = (
    df["paciente"].astype(str) + "_" +
    df["data_atendimento"].astype(str)
)

with engine.begin() as conn:

    for _, row in df.iterrows():

        query = text("""
        INSERT INTO atendimentos
        (paciente, status, valor, data_atendimento, atendimento_id)

        VALUES
        (:paciente, :status, :valor, :data_atendimento, :atendimento_id)

        ON CONFLICT (atendimento_id)
        DO UPDATE SET

            paciente = EXCLUDED.paciente,
            status = EXCLUDED.status,
            valor = EXCLUDED.valor,
            data_atendimento = EXCLUDED.data_atendimento
        """)

        conn.execute(query, {
            "paciente": row["paciente"],
            "status": row["status"],
            "valor": row["valor"],
            "data_atendimento": row["data_atendimento"],
            "atendimento_id": row["atendimento_id"]
        })

print("Importação concluída com sucesso!")
