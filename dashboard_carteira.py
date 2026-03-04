from dash import no_update
import pandas as pd
from dash import Dash, html, dcc, dash_table, Input, Output, State, ctx
import dash_bootstrap_components as dbc
import plotly.express as px
import unicodedata
import re
import os
import subprocess
import threading


def executar_automacao():

    try:
        subprocess.run(
            ["python", "automatizar_gestaods.py"],
            check=True
        )
        print("Automação concluída.")
    except Exception as e:
        print("Erro na automação:", e)


# ---------------- CONFIG ---------------- #
base_dir = os.path.dirname(os.path.abspath(__file__))
arquivo_atend = os.path.join(base_dir, "relatorio-atendimentos.csv")
arquivo_pac = os.path.join(base_dir, "tabela_pacientes.csv")
arquivo_obs = os.path.join(base_dir, "observacoes.csv")

# ---------------- FUNÇÕES ---------------- #


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

    if 0 <= idade_dias < 365:
        if recencia > 30:
            return "Perigo"
        elif recencia <= 20:
            return "Ok"
        else:
            return "Atenção"

    elif 365 <= idade_dias < 730:
        if recencia > 60:
            return "Perigo"
        elif recencia <= 40:
            return "Ok"
        else:
            return "Atenção"

    elif idade_dias >= 730:
        if recencia > 180:
            return "Perigo"
        elif recencia <= 120:
            return "Ok"
        else:
            return "Atenção"

    return "Atenção"


def carregar_dados():

    df_atend = pd.read_csv(arquivo_atend, sep=";")
    df_pac = pd.read_csv(arquivo_pac, sep=";")

    df_atend.columns = df_atend.columns.str.strip()
    df_pac.columns = df_pac.columns.str.strip()

    df_atend['Data'] = pd.to_datetime(
        df_atend['Data'], dayfirst=True, errors='coerce')
    df_pac['Nascimento'] = pd.to_datetime(
        df_pac['Nascimento'], dayfirst=True, errors='coerce')

    df_atend['nome_normalizado'] = df_atend['Paciente'].apply(normalizar_nome)
    df_pac['nome_normalizado'] = df_pac['Paciente'].apply(normalizar_nome)

    df_base = df_atend.merge(
        df_pac[['nome_normalizado', 'Nascimento']],
        on='nome_normalizado',
        how='left'
    )

    hoje = pd.Timestamp.today()

    df_group = df_base.groupby(['Paciente', 'Nascimento']).agg(
        ultimo_atendimento=('Data', 'max'),
        quantidade_atendimento=('Data', 'count')
    ).reset_index()

    df_group['idade_dias'] = (hoje - df_group['Nascimento']).dt.days
    df_group['recencia_dias'] = (hoje - df_group['ultimo_atendimento']).dt.days

    df_group['Status'] = df_group.apply(
        lambda row: classificar_status(
            row['idade_dias'], row['recencia_dias']),
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
        'quantidade_atendimento': 'Quantidade Atendimento'
    })

    if os.path.exists(arquivo_obs):
        df_obs = pd.read_csv(arquivo_obs)
        df_final = df_final.merge(df_obs, on="Paciente", how="left")
    else:
        df_final["Observação"] = ""

    return df_final


# ---------------- APP ---------------- #

app = Dash(
    __name__,
    external_stylesheets=[dbc.themes.CYBORG],
    suppress_callback_exceptions=True
)
server = app.server  # importante para deploy futuro

SIDEBAR_STYLE = {
    "position": "fixed",
    "top": 0,
    "left": 0,
    "bottom": 0,
    "width": "240px",
    "padding": "20px",
    "background-color": "#111111",
}

CONTENT_STYLE = {
    "margin-left": "260px",
    "padding": "30px",
}

sidebar = html.Div(
    [
        html.H4("ClinKPI", className="text-light"),
        html.P("Sistema de Análise de Carteira", className="text-muted"),
        html.Hr(),

        dbc.Nav(
            [
                dbc.NavLink("Carteira", href="/", active="exact"),
                dbc.NavLink("Dashboard Analítico",
                            href="/dashboard", active="exact"),
            ],
            vertical=True,
            pills=True,
        ),
    ],
    style=SIDEBAR_STYLE,
)

app.layout = html.Div([
    dcc.Location(id="url"),
    sidebar,
    html.Div(id="page-content", style=CONTENT_STYLE)
])

# ---------------- PÁGINAS ---------------- #


@app.callback(
    Output("page-content", "children"),
    Input("url", "pathname")
)
def render_page(path):

    if path == "/dashboard":

        df = carregar_dados()

        grafico_status = px.pie(
            df, names="Status", title="Distribuição da Carteira"
        )

        grafico_recencia = px.histogram(
            df,
            x="Recência",
            nbins=20,
            title="Distribuição de Recência (Dias)"
        )

        return html.Div([
            html.H2("Dashboard Analítico", className="mb-4"),

            dbc.Row([
                dbc.Col(dcc.Graph(figure=grafico_status), width=6),
                dbc.Col(dcc.Graph(figure=grafico_recencia), width=6),
            ])
        ])

    # -------- Página Carteira -------- #

    df = carregar_dados()
    df["Ação"] = "📝 Editar"

    return html.Div([

        html.H2("Carteira de Pacientes", className="mb-4"),

        dbc.Button(
            "Atualizar Relatório",
            id="btn-atualizar-relatorio",
            color="primary",
            className="mb-3",
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
        dcc.Interval(
            id="interval-verificar",
            interval=2000,
            n_intervals=0,
            disabled=True
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

# ---------------- MODAL ---------------- #


@app.callback(
    Output("modal", "is_open"),
    Output("input-observacao", "value"),
    Input("tabela", "active_cell"),
    State("tabela", "data"),
    prevent_initial_call=True
)
def abrir_modal(active_cell, rows):

    if active_cell and active_cell["column_id"] == "Ação":
        paciente = rows[active_cell["row"]]["Paciente"]
        obs = rows[active_cell["row"]].get("Observação", "")
        return True, obs

    return False, ""


@app.callback(
    Output("modal", "is_open", allow_duplicate=True),
    Input("btn-salvar", "n_clicks"),
    State("input-observacao", "value"),
    State("tabela", "active_cell"),
    State("tabela", "data"),
    prevent_initial_call=True
)
def salvar_obs(n_clicks, texto, active_cell, rows):

    if active_cell:
        paciente = rows[active_cell["row"]]["Paciente"]
        df = pd.DataFrame(rows)
        df.loc[df["Paciente"] == paciente, "Observação"] = texto
        df[["Paciente", "Observação"]].to_csv(arquivo_obs, index=False)

    return False


@app.callback(
    Output("tabela", "data"),
    Output("interval-verificar", "disabled"),
    Output("btn-atualizar-relatorio", "disabled"),
    Input("btn-atualizar-relatorio", "n_clicks"),
    Input("filtro-status", "value"),
    prevent_initial_call=True
)
def controle_atualizacao(n_clicks, filtro_status):

    trigger = ctx.triggered_id

    # Clique no botão → roda automação DIRETAMENTE
    if trigger == "btn-atualizar-relatorio":

        subprocess.run(
            ["python", "automatizar_gestaods.py"],
            check=True
        )

    # Sempre recarrega dados após ação
    df = carregar_dados()
    df["Ação"] = "📝 Editar"

    if filtro_status:
        df = df[df["Status"].isin(filtro_status)]

    return df.to_dict("records"), True, False


if __name__ == '__main__':
    app.run(debug=True)
