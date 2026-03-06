import pandas as pd
import unicodedata
import re
import os
from sqlalchemy import create_engine

DATABASE_URL = "postgresql://postgres:TabClin1706@db.hlfiykpoousspkcdswer.supabase.co:5432/postgres"

engine = create_engine(DATABASE_URL)


# ---------------- FUNÇÕES AUXILIARES ---------------- #

def normalizar_nome(nome):
    if pd.isna(nome):
        return ""

    nome = unicodedata.normalize('NFKD', nome)
    nome = nome.encode('ASCII', 'ignore').decode('utf-8')
    nome = re.sub(r'\W+', '', nome)
    return nome.lower()


def classificar_status(idade_dias, recencia):

    if pd.isna(idade_dias) or pd.isna(recencia):
        return "Atenção"

    # 0 a 1 ano
    if 0 <= idade_dias < 365:
        if recencia > 30:
            return "Perigo"
        elif recencia <= 20:
            return "Ok"
        else:
            return "Atenção"

    # 1 a 2 anos
    elif 365 <= idade_dias < 730:
        if recencia > 60:
            return "Perigo"
        elif recencia <= 40:
            return "Ok"
        else:
            return "Atenção"

    # 2+ anos
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

    df_atend = pd.read_sql("SELECT * FROM atendimentos", engine)
    df_pac = pd.read_sql("SELECT * FROM pacientes", engine)

    df_atend.columns = df_atend.columns.str.strip()
    df_pac.columns = df_pac.columns.str.strip()

    df_atend['data_atendimento'] = pd.to_datetime(
        df_atend['data_atendimento'], dayfirst=True, errors='coerce'
    )

    df_pac['nascimento'] = pd.to_datetime(
        df_pac['nascimento'], dayfirst=True, errors='coerce'
    )

    # Normaliza nomes
    df_atend['nome_normalizado'] = df_atend['paciente'].apply(normalizar_nome)
    df_pac['nome_normalizado'] = df_pac['paciente'].apply(normalizar_nome)

    # Merge
    df_base = df_atend.merge(
        df_pac[['nome_normalizado', 'nascimento']],
        on='nome_normalizado',
        how='left'
    )

    hoje = pd.Timestamp.today()

    df_group = df_base.groupby(['paciente', 'nascimento']).agg(
        ultimo_atendimento=('data_atendimento', 'max'),
        quantidade_atendimento=('data_atendimento', 'count')
    ).reset_index()

    df_group['idade_dias'] = (hoje - df_group['nascimento']).dt.days
    df_group['recencia_dias'] = (hoje - df_group['ultimo_atendimento']).dt.days

    df_group['Status'] = df_group.apply(
        lambda row: classificar_status(
            row['idade_dias'], row['recencia_dias']
        ),
        axis=1
    )

    df_group['Recência'] = df_group['recencia_dias']

    df_final = df_group[[
        'Paciente',
        'ultimo_atendimento',
        'quantidade_atendimento',
        'Recência',
        'Status'
    ]].rename(columns={
        'ultimo_atendimento': 'Último Atendimento',
        'quantidade_atendimento': 'Qtd At.'
    })
    df_final["Último Atendimento"] = df_final["Último Atendimento"].dt.strftime(
        "%d/%m/%Y")

    # Observações
    df_obs = pd.read_sql("SELECT * FROM observacoes", engine)
    df_final = df_final.merge(
        df_obs,
        left_on="paciente",
        right_on="paciente",
        how="left"
    )
    # ================================
    # 🔹 CRUZAR COM AGENDA
    # ================================

    df_agenda = pd.read_sql("SELECT * FROM agenda", engine)


# Corrigir encoding (se necessário)
    df_agenda.columns = df_agenda.columns.str.strip()

# Normalizar nome do paciente
    df_agenda["nome_normalizado"] = df_agenda["paciente"].apply(
        normalizar_nome)
    df_final["nome_normalizado"] = df_final["paciente"].apply(normalizar_nome)

    df_agenda["data_hora"] = pd.to_datetime(
        df_agenda["data_hora"],
        dayfirst=True,
        errors="coerce"
    )

    df_agenda = df_agenda.sort_values("data_hora", ascending=False)

    df_agenda_unico = df_agenda.drop_duplicates(
        subset="nome_normalizado",
        keep="first"
    )

    df_final = df_final.merge(
        df_agenda_unico[["nome_normalizado", "status"]],
        on="nome_normalizado",
        how="left",
        suffixes=("", "_agenda")
    )

    df_final.rename(columns={"status_agenda": "Agendado"}, inplace=True)

    return df_final
