from dash import html, dcc, Input, Output, State, ctx, callback
import dash_bootstrap_components as dbc
import pandas as pd
import requests
from sqlalchemy import text
import dash_ag_grid as dag

from utils.data_loader import carregar_dados, engine


def obter_ultima_atualizacao():
    try:
        with open("ultima_atualizacao.txt", "r") as f:
            return f.read()
    except:
        return "Nunca atualizado"


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

    columnDefs = [

        {"headerName": "Paciente", "field": "Paciente", "flex": 2},

        {"headerName": "Qtd At.", "field": "Qtd At.", "width": 110},

        {"headerName": "Recência", "field": "Recência", "width": 110},

        {
            "headerName": "Status",
            "field": "Status",
            "width": 120,
            "cellClassRules": {
                "status-ok": "params.value == 'Ok'",
                "status-atencao": "params.value == 'Atenção'",
                "status-perigo": "params.value == 'Perigo'",
            },
        },

        {"headerName": "Agendado", "field": "Agendado", "width": 120},

        {"headerName": "Observação", "field": "Observação", "flex": 2},

        {
            "headerName": "",
            "field": "Ação",
            "width": 70,
            "cellRenderer": "botaoObs",
            "cellStyle": {"textAlign": "center"},
        },
    ]

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

        dag.AgGrid(

            id="tabela",

            columnDefs=columnDefs,

            rowData=df.to_dict("records"),

            defaultColDef={
                "sortable": True,
                "filter": True,
                "resizable": True,
            },

            dashGridOptions={
                "animateRows": True,
                "rowSelection": "single",
            },

            className="ag-theme-alpine-dark",

            style={"height": "600px", "width": "100%"},
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
    Input("tabela", "cellRendererData"),
    State("modal", "is_open"),
    prevent_initial_call=True
)
def abrir_modal(data, is_open):

    if not data:
        return is_open, ""

    obs = data.get("Observação", "")

    return True, obs


# ---------------- SALVAR OBS ---------------- #

@callback(
    Output("modal", "is_open", allow_duplicate=True),
    Output("tabela", "rowData", allow_duplicate=True),
    Input("btn-salvar", "n_clicks"),
    State("tabela", "cellClicked"),
    State("input-observacao", "value"),
    prevent_initial_call=True
)
def salvar_obs(n, cell, texto):

    paciente = cell["data"]["Paciente"]

    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO observacoes (paciente, observacao)
            VALUES (:paciente, :obs)
            ON CONFLICT (paciente)
            DO UPDATE SET observacao = EXCLUDED.observacao
        """), {"paciente": paciente, "obs": texto})

    df = carregar_dados()
    df["Ação"] = "📝"

    return False, df.to_dict("records")


# ---------------- ATUALIZAR RELATORIO ---------------- #
@callback(
    Output("modal", "is_open", allow_duplicate=True),
    Output("tabela", "rowData", allow_duplicate=True),
    Input("btn-salvar", "n_clicks"),
    State("tabela", "cellRendererData"),
    State("input-observacao", "value"),
    prevent_initial_call=True
)
def salvar_obs(n, data, texto):

    paciente = data["Paciente"]

    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO observacoes (paciente, observacao)
            VALUES (:paciente, :obs)
            ON CONFLICT (paciente)
            DO UPDATE SET observacao = EXCLUDED.observacao
        """), {"paciente": paciente, "obs": texto})

    df = carregar_dados()
    df["Ação"] = "📝"

    return False, df.to_dict("records")


# ---------------- ATUALIZAR GERAL ---------------- #

@callback(
    Output("tabela", "rowData", allow_duplicate=True),
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
