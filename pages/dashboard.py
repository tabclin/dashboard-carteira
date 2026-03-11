from dash import html, dcc
import dash_bootstrap_components as dbc
import plotly.express as px
import pandas as pd

from utils.data_loader import carregar_dados


# ---------------- LAYOUT ---------------- #

def layout():

    df = carregar_dados()
    print(df.columns)

    # =============================
    # KPIs
    # =============================

    total = len(df)
    perigo = len(df[df["Status"] == "Perigo"])
    atencao = len(df[df["Status"] == "Atenção"])
    ok = len(df[df["Status"] == "Ok"])

    # =============================
    # GRÁFICO 1 - Pizza Status
    # =============================

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

    # =============================
    # GRÁFICO 2 - Barra Status
    # =============================

    df_status = df["Status"].value_counts().reset_index()
    df_status.columns = ["Status", "Quantidade"]

    grafico_barra_status = px.bar(
        df_status,
        x="Status",
        y="Quantidade",
        title="Quantidade por Status",
        color="Status",
        text="Quantidade",
        color_discrete_map={
            "Perigo": "#dc3545",
            "Atenção": "#ffc107",
            "Ok": "#198754"
        }
    )

    grafico_barra_status.update_traces(textposition="outside")

    # =============================
    # GRÁFICO 3 - Distribuição de Idades
    # =============================

    df["idade_anos"] = df["idade_dias"] / 365

    def faixa_idade(x):
        if x < 1:
            return "0-1"
        elif x < 2:
            return "1-2"
        elif x < 5:
            return "2-5"
        elif x < 12:
            return "5-12"
        else:
            return ">12"

    df["faixa_idade"] = df["idade_anos"].apply(faixa_idade)

    idade_dist = df["faixa_idade"].value_counts().reset_index()
    idade_dist.columns = ["Faixa", "Quantidade"]

    ordem = ["0-1", "1-2", "2-5", "5-12", ">12"]

    grafico_idade = px.bar(
        idade_dist,
        x="Faixa",
        y="Quantidade",
        title="Distribuição de Idades",
        category_orders={"Faixa": ordem},
        text="Quantidade"
    )

    grafico_idade.update_traces(textposition="outside")

    grafico_idade.update_layout(
        yaxis_title="Quantidade de Pacientes",
        xaxis_title="Faixa Etária"
    )

    # =============================
    # GRÁFICO 4 - Atendimentos por mês
    # =============================

    df["ultimo_atendimento"] = pd.to_datetime(df["ultimo_atendimento"])

    df["mes"] = df["ultimo_atendimento"].dt.to_period("M")

    atendimentos_mes = (
        df
        .groupby("mes")
        .size()
        .reset_index(name="Quantidade")
    )

    atendimentos_mes["mes"] = atendimentos_mes["mes"].astype(str)

    grafico_atendimentos = px.bar(
        atendimentos_mes,
        x="mes",
        y="Quantidade",
        title="Atendimentos por Mês",
        text="Quantidade"
    )

    grafico_atendimentos.update_traces(textposition="outside")

    grafico_atendimentos.update_layout(
        xaxis_title="Mês",
        yaxis_title="Quantidade de Atendimentos"
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
                        html.Div("Total Pacientes", className="card-title"),
                        html.H3(total, className="fw-bold")
                    ]),
                    style={
                        "backgroundColor": "#6c757d",
                        "color": "white",
                        "borderRadius": "10px"
                    }
                ),
                width=3
            ),

            dbc.Col(
                dbc.Card(
                    dbc.CardBody([
                        html.Div("Perigo", className="card-title"),
                        html.H3(perigo, className="fw-bold")
                    ]),
                    style={
                        "backgroundColor": "#dc3545",
                        "color": "white",
                        "borderRadius": "10px"
                    }
                ),
                width=3
            ),

            dbc.Col(
                dbc.Card(
                    dbc.CardBody([
                        html.Div("Atenção", className="card-title"),
                        html.H3(atencao, className="fw-bold")
                    ]),
                    style={
                        "backgroundColor": "#ffc107",
                        "color": "#000",
                        "borderRadius": "10px"
                    }
                ),
                width=3
            ),

            dbc.Col(
                dbc.Card(
                    dbc.CardBody([
                        html.Div("Ok", className="card-title"),
                        html.H3(ok, className="fw-bold")
                    ]),
                    style={
                        "backgroundColor": "#198754",
                        "color": "white",
                        "borderRadius": "10px"
                    }
                ),
                width=3
            ),

        ], className="mb-4 g-3"),

        # 🔹 PRIMEIRA LINHA
        dbc.Row([
            dbc.Col(dcc.Graph(figure=grafico_status), width=6),
            dbc.Col(dcc.Graph(figure=grafico_barra_status), width=6),
        ], className="mb-4"),

        # 🔹 SEGUNDA LINHA
        dbc.Row([
            dbc.Col(dcc.Graph(figure=grafico_idade), width=6),
            dbc.Col(dcc.Graph(figure=grafico_atendimentos), width=6),
        ])

    ])
