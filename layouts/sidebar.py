from dash import html
import dash_bootstrap_components as dbc

SIDEBAR_STYLE = {
    "position": "fixed",
    "top": 0,
    "left": 0,
    "bottom": 0,
    "width": "240px",
    "padding": "20px",
    "background-color": "#111111",
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
