import pandas as pd
from sqlalchemy import create_engine

DATABASE_URL = "postgresql://postgres:TabClin1706@db.hlfiykpoousspkcdswer.supabase.co:6543/postgres?sslmode=require"

engine = create_engine(DATABASE_URL)

df = pd.read_sql("SELECT 1", engine)

print(df)
