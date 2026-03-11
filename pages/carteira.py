from dash import html, dcc, Input, Output, State, callback
import dash
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

    df = carregar_dados()

    if df is None or df.empty:
        df = pd.DataFrame(columns=[
            "Paciente",
            "Último Atendimento",
            "Qtd At.",
            "Recência",
            "Status",
            "Observação",
            "Agendado"
        ])

   # df["Ação"] = "📝"

    total_pacientes = len(df)
    total_perigo = len(df[df["Status"] == "Perigo"])
    total_atencao = len(df[df["Status"] == "Atenção"])
    total_ok = len(df[df["Status"] == "Ok"])

    columnDefs = [

        {"headerName": "Paciente", "field": "Paciente", "flex": 2},

        {"headerName": "Último Atendimento",
            "field": "Último Atendimento", "width": 150},

        {"headerName": "Qtd At.", "field": "Qtd At.", "width": 100},

        {"headerName": "Recência", "field": "Recência", "width": 100},

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

        {"headerName": "Agendado", "field": "Agendado", "width": 110},

        {"headerName": "Observação", "field": "Observação", "flex": 2},

        # {
        #    "headerName": "",
        #   "field": "Ação",
        #   "width": 60,
        #  "cellStyle": {
        #     "cursor": "pointer",
        #     "textAlign": "center",
        #    "fontSize": "18px"
        # },
        # },
    ]

    return html.Div([

        html.H2(
            "Carteira de Pacientes",
            className="mb-4",
            style={"fontWeight": "600"}
        ),

        dbc.Row([

            dbc.Col(
                dbc.Card(
                    dbc.CardBody([
                        html.Div("Total Pacientes", className="card-title"),
                        html.H3(total_pacientes, className="fw-bold")
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
                        html.H3(total_perigo, className="fw-bold")
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
                        html.H3(total_atencao, className="fw-bold")
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
                        html.H3(total_ok, className="fw-bold")
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


        # CONTROLES
        html.Div([

            html.Div([

                dbc.Button(
                    "Atualizar Relatório",
                    id="btn-atualizar-relatorio",
                    color="primary",
                    className="me-2"
                ),

                dbc.Button(
                    "Atualizar Geral",
                    id="btn-atualizar-geral",
                    color="secondary",
                    className="me-2"
                ),

                dbc.Button(
                    "Adicionar Observação",
                    id="btn-abrir-modal",
                    color="success",
                    className="me-3"
                ),

                dcc.Dropdown(
                    id="filtro-status",
                    options=[
                        {"label": "Ok", "value": "Ok"},
                        {"label": "Atenção", "value": "Atenção"},
                        {"label": "Perigo", "value": "Perigo"},
                    ],
                    multi=True,
                    placeholder="Filtrar status...",
                    style={
                        "width": "250px",
                        "marginRight": "20px"
                    }
                ),

            ], style={
                "display": "flex",
                "alignItems": "center"
            }),


            html.Div(
                f"Atualizado em: {obter_ultima_atualizacao()}",
                style={
                    "fontSize": "13px",
                    "color": "#6c757d",
                }
            )

        ],
            style={
            "display": "flex",
            "justifyContent": "space-between",
            "alignItems": "center",
            "marginBottom": "20px"
        }
        ),


        dcc.Store(id="paciente-selecionado"),


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
                "rowSelection": "single"
            },

            className="ag-theme-alpine-dark",

            style={"height": "600px", "width": "100%"},
        ),


        dbc.Modal(
            [

                dbc.ModalHeader(
                    dbc.ModalTitle("Observação do Paciente")
                ),

                dbc.ModalBody(
                    dcc.Textarea(
                        id="input-observacao",
                        style={
                            "width": "100%",
                            "height": "120px",
                            "borderRadius": "6px"
                        },
                    )
                ),

                dbc.ModalFooter(
                    dbc.Button(
                        "Salvar",
                        id="btn-salvar",
                        color="success"
                    )
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
    Output("paciente-selecionado", "data"),
    Input("btn-abrir-modal", "n_clicks"),
    State("tabela", "selectedRows"),
    prevent_initial_call=True
)
def abrir_modal(n, rows):

    if not rows:
        raise dash.exceptions.PreventUpdate

    row = rows[0]

    paciente = row.get("Paciente")
    obs = row.get("Observação", "")

    return True, obs, paciente


# ---------------- SALVAR OBS ---------------- #

@callback(
    Output("modal", "is_open", allow_duplicate=True),
    Output("tabela", "rowData", allow_duplicate=True),
    Input("btn-salvar", "n_clicks"),
    State("paciente-selecionado", "data"),
    State("input-observacao", "value"),
    prevent_initial_call=True
)
def salvar_obs(n, paciente, texto):

    if not paciente:
        raise dash.exceptions.PreventUpdate

    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO observacoes (paciente, observacao)
            VALUES (:paciente, :obs)
            ON CONFLICT (paciente)
            DO UPDATE SET observacao = EXCLUDED.observacao
        """), {"paciente": paciente, "obs": texto})

    df = carregar_dados()
   # df["Ação"] = "📝"

    return False, df.to_dict("records")


# ---------------- ATUALIZAR RELATORIO ---------------- #

@callback(
    Output("tabela", "rowData", allow_duplicate=True),
    Output("btn-atualizar-relatorio", "disabled"),
    Input("btn-atualizar-relatorio", "n_clicks"),
    Input("filtro-status", "value"),
    prevent_initial_call=True
)
def atualizar_relatorio(n_clicks, filtro):

    if n_clicks:
        requests.get(
            "https://bess-leptoprosopic-grinningly.ngrok-free.dev/executar-automacao",
            headers={"ngrok-skip-browser-warning": "true"},
            timeout=120
        )

    df = carregar_dados()
   # df["Ação"] = "📝"

    if filtro:
        df = df[df["Status"].isin(filtro)]

    return df.to_dict("records"), False


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
    # df["Ação"] = "📝"

    return df.to_dict("records")
