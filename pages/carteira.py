from dash import html, dcc, dash_table, Input, Output, State, ctx, callback, no_update
import dash_bootstrap_components as dbc
import pandas as pd
import requests
import dash
from sqlalchemy import text
import os

from utils.data_loader import carregar_dados, engine


# ---------------- LAYOUT ---------------- #

def layout():

    try:
        df = carregar_dados()
    except Exception as e:
        print("ERRO AO CARREGAR DADOS:", e)
        df = pd.DataFrame()

    if df is None or df.empty:
        df = pd.DataFrame(columns=[
            "Paciente",
            "Qtd At.",
            "Recência",
            "Status",
            "Observação",
            "Agendado"
        ])

    df["Ação"] = "📝"

    total_pacientes = len(df)
    total_perigo = len(df[df["Status"] == "Perigo"])
    total_atencao = len(df[df["Status"] == "Atenção"])
    total_ok = len(df[df["Status"] == "Ok"])

    return html.Div([

        html.H2("Carteira de Pacientes", className="mb-4"),

        dbc.Row([

            dbc.Col(
                dbc.Card(
                    dbc.CardBody([
                        html.H6("Total Pacientes"),
                        html.H3(total_pacientes)
                    ]),
                    color="secondary",
                    inverse=True
                ), width=3
            ),

            dbc.Col(
                dbc.Card(
                    dbc.CardBody([
                        html.H6("Perigo"),
                        html.H3(total_perigo)
                    ]),
                    color="danger",
                    inverse=True
                ), width=3
            ),

            dbc.Col(
                dbc.Card(
                    dbc.CardBody([
                        html.H6("Atenção"),
                        html.H3(total_atencao)
                    ]),
                    color="warning",
                    inverse=True
                ), width=3
            ),

            dbc.Col(
                dbc.Card(
                    dbc.CardBody([
                        html.H6("Ok"),
                        html.H3(total_ok)
                    ]),
                    color="success",
                    inverse=True
                ), width=3
            ),

        ], className="mb-4"),


        html.Div(
            [
                dbc.Button(
                    "Atualizar Relatório",
                    id="btn-atualizar-relatorio",
                    color="primary",
                    className="mb-3",
                ),

                dbc.Button(
                    "Atualizar Geral",
                    id="btn-atualizar-geral",
                    color="success",
                ),

                html.Span(
                    f"Atualizado em: {obter_ultima_atualizacao() or '—'}",
                    id="texto-atualizacao",
                    style={
                        "marginLeft": "15px",
                        "fontSize": "14px",
                        "color": "#6c757d"
                    }
                ),
            ],
            style={
                "display": "flex",
                "alignItems": "center"
            }
        ),

        dcc.Dropdown(
            id="filtro-status",
            options=[
                {"label": "Ok", "value": "Ok"},
                {"label": "Atenção", "value": "Atenção"},
                {"label": "Perigo", "value": "Perigo"},
            ],
            multi=True,
            placeholder="Filtrar por Status",
            className="mb-3",
        ),

        dcc.Loading(
            id="loading-atualizacao",
            type="circle",
            fullscreen=True,
            children=dash_table.DataTable(
                id="tabela",
                data=df.to_dict("records"),
                columns=[{"name": i, "id": i} for i in df.columns],
                style_cell={'textAlign': 'center'},
                style_data_conditional=[
                    {
                        'if': {'filter_query': '{Status} = "Ok"'},
                        'backgroundColor': '#198754',
                        'color': 'white'
                    },
                    {
                        'if': {'filter_query': '{Status} = "Atenção"'},
                        'backgroundColor': '#ffc107',
                        'color': 'black'
                    },
                    {
                        'if': {'filter_query': '{Status} = "Perigo"'},
                        'backgroundColor': '#dc3545',
                        'color': 'white'
                    },
                ],
                style_header={
                    'backgroundColor': '#212529',
                    'color': 'white',
                    'fontWeight': 'bold'
                }
            )
        ),

        dbc.Modal(
            [
                dbc.ModalHeader(dbc.ModalTitle("Adicionar Observação")),
                dbc.ModalBody(
                    dcc.Textarea(
                        id="input-observacao",
                        style={"width": "100%"}
                    )
                ),
                dbc.ModalFooter(
                    dbc.Button("Salvar", id="btn-salvar", color="success")
                ),
            ],
            id="modal",
            is_open=False,
        )

    ])


# ---------------- ABRIR MODAL / SALVAR OBS ---------------- #

@callback(
    Output("modal", "is_open"),
    Output("input-observacao", "value"),
    Output("tabela", "data"),
    Input("tabela", "active_cell"),
    Input("btn-salvar", "n_clicks"),
    State("input-observacao", "value"),
    State("tabela", "data"),
    State("modal", "is_open"),
    prevent_initial_call=True
)
def controle_modal(active_cell, n_clicks, texto, rows, is_open):

    trigger = ctx.triggered_id

    if rows is None:
        return is_open, texto, no_update

    # abrir modal
    if trigger == "tabela" and active_cell and active_cell["column_id"] == "Ação":

        obs = rows[active_cell["row"]].get("Observação", "")

        return True, obs, no_update

    # salvar observação
    if trigger == "btn-salvar" and active_cell:

        paciente = rows[active_cell["row"]]["Paciente"]

        with engine.begin() as conn:
            conn.execute(text("""
                INSERT INTO observacoes (paciente, observacao)
                VALUES (:paciente, :obs)
                ON CONFLICT (paciente)
                DO UPDATE SET observacao = EXCLUDED.observacao
            """), {"paciente": paciente, "obs": texto})

        try:
            carregar_dados.cache_clear()
        except:
            pass

        try:
            df = carregar_dados()
            df["Ação"] = "📝"
        except Exception as e:
            print("Erro ao carregar dados:", e)
            df = pd.DataFrame(columns=["Paciente", "Status"])

            return False, "", df.to_dict("records")

    return is_open, texto, no_update


# ---------------- ATUALIZAR RELATÓRIO ---------------- #

@callback(
    Output("tabela", "data"),
    Output("btn-atualizar-relatorio", "disabled"),
    Input("btn-atualizar-relatorio", "n_clicks"),
    Input("filtro-status", "value"),
    prevent_initial_call=True
)
def atualizar_relatorio(n_clicks, filtro_status):

    trigger = ctx.triggered_id

    if trigger == "btn-atualizar-relatorio":

        requests.get(
            "https://bess-leptoprosopic-grinningly.ngrok-free.dev/executar-automacao",
            headers={"ngrok-skip-browser-warning": "true"},
            timeout=120
        )

    df = carregar_dados()
    df["Ação"] = "📝"

    if filtro_status:
        df = df[df["Status"].isin(filtro_status)]

    return df.to_dict("records"), False


# ---------------- ATUALIZAR GERAL ---------------- #

@callback(
    Output("tabela", "data"),
    Input("btn-atualizar-geral", "n_clicks"),
    prevent_initial_call=True
)
def atualizar_geral(n):

    requests.get(
        "https://bess-leptoprosopic-grinningly.ngrok-free.dev/executar-importacao",
        headers={"ngrok-skip-browser-warning": "true"},
        timeout=300
    )

    df = carregar_dados()
    df["Ação"] = "📝"

    return df.to_dict("records")


# ---------------- ULTIMA ATUALIZAÇÃO ---------------- #

def obter_ultima_atualizacao():
    try:
        with open("ultima_atualizacao.txt", "r") as f:
            return f.read()
    except:
        return "Nunca atualizado"
