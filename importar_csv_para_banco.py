import pandas as pd
from sqlalchemy import create_engine

# conexão
DATABASE_URL = "postgresql://postgres:Tab17062014@bd@db.hlfiykpoousspkcdswer.supabase.co:5432/postgres"

engine = create_engine(DATABASE_URL)

# ler CSV
df = pd.read_csv("relatorio-atendimentos.csv")

# enviar para banco
df.to_sql(
    "atendimentos",
    engine,
    if_exists="replace",
    index=False
)

print("Dados enviados para banco!")
