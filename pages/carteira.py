from dash import html, dcc, dash_table, Input, Output, State, ctx, callback
import dash_bootstrap_components as dbc
import pandas as pd
import subprocess
import os
import requests

from utils.data_loader import carregar_dados


# Caminho do arquivo observações
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
arquivo_obs = os.path.join(base_dir, "observacoes.csv")


# ---------------- LAYOUT ---------------- #

def layout():

    df = carregar_dados()
    df["Ação"] = "📝 Editar"

    total_pacientes = len(df)
    total_perigo = len(df[df["Status"] == "Perigo"])
    total_atencao = len(df[df["Status"] == "Atenção"])
    total_ok = len(df[df["Status"] == "Ok"])

    return html.Div([

        html.H2("Carteira de Pacientes", className="mb-4"),

        # começa
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
        # termina

        html.Div(
            [
                dbc.Button(
                    "Atualizar Relatório",
                    id="btn-atualizar-relatorio",
                    color="primary",
                    className="mb-3",
                ),

                html.Span(
                    f"Atualizado em: {obter_ultima_atualizacao()}",
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


# ---------------- ABRIR MODAL ---------------- #
@callback(
    Output("modal", "is_open"),
    Output("input-observacao", "value"),
    Input("tabela", "active_cell"),
    Input("btn-salvar", "n_clicks"),
    State("input-observacao", "value"),
    State("tabela", "data"),
    State("modal", "is_open"),
    prevent_initial_call=True
)
def controle_modal(active_cell, n_clicks, texto, rows, is_open):

    trigger = ctx.triggered_id

    if trigger == "tabela" and active_cell and active_cell["column_id"] == "Ação":
        obs = rows[active_cell["row"]].get("Observação", "")
        return True, obs

    if trigger == "btn-salvar" and active_cell:
        paciente = rows[active_cell["row"]]["Paciente"]
        df = pd.DataFrame(rows)
        df.loc[df["Paciente"] == paciente, "Observação"] = texto
        df[["Paciente", "Observação"]].to_csv(arquivo_obs, index=False)
        return False, ""

    return is_open, texto


# callbac da atualização:
@callback(
    Output("tabela", "data"),
    Output("btn-atualizar-relatorio", "disabled"),
    Input("btn-atualizar-relatorio", "n_clicks"),
    Input("filtro-status", "value"),
    prevent_initial_call=True
)
def atualizar_relatorio(n_clicks, filtro_status):

    trigger = ctx.triggered_id

    # 🔹 Se clicou no botão → roda automação
    if trigger == "btn-atualizar-relatorio":
        requests.get(
            "https://https://bess-leptoprosopic-grinningly.ngrok-free.dev/executar-automacao")

    # 🔹 Sempre recarrega dados depois
    df = carregar_dados()
    df["Ação"] = "📝 Editar"

    # 🔹 Aplica filtro se existir
    if filtro_status:
        df = df[df["Status"].isin(filtro_status)]

    return df.to_dict("records"), False


def obter_ultima_atualizacao():
    try:
        with open("ultima_atualizacao.txt", "r") as f:
            return f.read()
    except:
        return "Nunca atualizado"
