import pandas as pd
from sqlalchemy import create_engine, text

DATABASE_URL = "postgresql://postgres:TabClin1706@db.hlfiykpoousspkcdswer.supabase.co:5432/postgres"

engine = create_engine(DATABASE_URL)

# ler CSV
df = pd.read_csv("relatorio-atendimentos.csv")

# criar ID único (exemplo simples)
df["atendimento_id"] = (
    df["Paciente"].astype(str) + "_" +
    df["Data"].astype(str)
)

with engine.begin() as conn:

    for _, row in df.iterrows():

        query = text("""
        INSERT INTO atendimentos (atendimento_id, paciente, data_atendimento, valor, status)
        VALUES (:id, :paciente, :data, :valor, :status)

        ON CONFLICT (atendimento_id)
        DO UPDATE SET
            paciente = EXCLUDED.paciente,
            data_atendimento = EXCLUDED.data_atendimento,
            valor = EXCLUDED.valor,
            status = EXCLUDED.status
        """)

        conn.execute(query, {
            "id": row["atendimento_id"],
            "paciente": row["Paciente"],
            "data": row["Data"],
            "valor": row["Valor"],
            "status": row["Status"]
        })

print("Banco atualizado com UPSERT!")
