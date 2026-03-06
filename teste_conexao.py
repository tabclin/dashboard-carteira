

# DATABASE_URL = "postgresql://postgres:TabClin1706@db.hlfiykpoousspkcdswer.supabase.co:6543/postgres?sslmode=require"


from sqlalchemy import create_engine
import pandas as pd

DATABASE_URL = "postgresql://postgres.hlfiykpoousspkcdswer:TabClin1706@aws-1-sa-east-1.pooler.supabase.com:6543/postgres"

engine = create_engine(DATABASE_URL)

df = pd.read_sql("SELECT 1", engine)

print(df)
