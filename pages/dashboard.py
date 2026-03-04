from dash import html, dcc
import dash_bootstrap_components as dbc
import plotly.express as px
import pandas as pd

from utils.data_loader import carregar_dados


# ---------------- LAYOUT ---------------- #

def layout():

    df = carregar_dados()

    # =============================
    # KPIs
    # =============================

    total = len(df)
    perigo = len(df[df["Status"] == "Perigo"])
    atencao = len(df[df["Status"] == "Atenção"])
    ok = len(df[df["Status"] == "Ok"])

    # =============================
    # GRÁFICOS
    # =============================

    # Pizza Status
    grafico_status = px.pie(
        df,
        names="Status",
        title="Distribuição da Carteira",
        color="Status",
        color_discrete_map={
            "Perigo": "#dc3545",
            "Atenção": "#ffc107",
            "Ok": "#198754"
        }
    )

    # Histograma Recência
    grafico_recencia = px.histogram(
        df,
        x="Recência",
        nbins=20,
        title="Distribuição de Recência (Dias)"
    )

    # Barra Status (forma segura)
    df_status = df["Status"].value_counts().reset_index()
    df_status.columns = ["Status", "Quantidade"]

    grafico_barra_status = px.bar(
        df_status,
        x="Status",
        y="Quantidade",
        title="Quantidade por Status",
        color="Status",
        color_discrete_map={
            "Perigo": "#dc3545",
            "Atenção": "#ffc107",
            "Ok": "#198754"
        }
    )

    # Top 10 maior recência
    top10 = df.sort_values("Recência", ascending=False).head(10)

    grafico_top10 = px.bar(
        top10,
        x="Recência",
        y="Paciente",
        orientation="h",
        title="Top 10 Pacientes com Maior Recência"
    )

    # =============================
    # LAYOUT
    # =============================

    return html.Div([

        html.H2("Dashboard Analítico", className="mb-4"),

        # 🔹 CARDS KPI
        dbc.Row([

            dbc.Col(
                dbc.Card(
                    dbc.CardBody([
                        html.H6("👥 Total Pacientes"),
                        html.H3(total)
                    ]),
                    color="secondary",
                    inverse=True
                ), width=3
            ),

            dbc.Col(
                dbc.Card(
                    dbc.CardBody([
                        html.H6("🚨 Perigo"),
                        html.H3(perigo)
                    ]),
                    color="danger",
                    inverse=True
                ), width=3
            ),

            dbc.Col(
                dbc.Card(
                    dbc.CardBody([
                        html.H6("⚠️ Atenção"),
                        html.H3(atencao)
                    ]),
                    color="warning",
                    inverse=True
                ), width=3
            ),

            dbc.Col(
                dbc.Card(
                    dbc.CardBody([
                        html.H6("✅ Ok"),
                        html.H3(ok)
                    ]),
                    color="success",
                    inverse=True
                ), width=3
            ),

        ], className="mb-4"),

        # 🔹 PRIMEIRA LINHA
        dbc.Row([
            dbc.Col(dcc.Graph(figure=grafico_status), width=6),
            dbc.Col(dcc.Graph(figure=grafico_barra_status), width=6),
        ], className="mb-4"),

        # 🔹 SEGUNDA LINHA
        dbc.Row([
            dbc.Col(dcc.Graph(figure=grafico_recencia), width=6),
            dbc.Col(dcc.Graph(figure=grafico_top10), width=6),
        ])

    ])
