from dash import Dash, html, dcc
import dash_bootstrap_components as dbc
from dash.dependencies import Input, Output, State

from layouts.sidebar import sidebar
from pages import carteira, dashboard

from auth import login
from login_layout import layout_login


app = Dash(
    __name__,
    external_stylesheets=[dbc.themes.CYBORG],
    suppress_callback_exceptions=True
)

server = app.server


CONTENT_STYLE = {
    "margin-left": "260px",
    "padding": "30px",
}


app.layout = html.Div([

    dcc.Location(id="url"),

    # guarda sessão do usuário
    dcc.Store(id="user_session"),

    # sidebar
    html.Div(id="sidebar_container"),

    # conteúdo principal
    html.Div(id="page-content", style=CONTENT_STYLE)

])


# -------------------------
# controlar sidebar
# -------------------------

@app.callback(
    Output("sidebar_container", "children"),
    Input("user_session", "data")
)
def controlar_sidebar(user):

    if user:
        return sidebar

    return ""


# -------------------------
# controlar páginas
# -------------------------

@app.callback(
    Output("page-content", "children"),
    Input("url", "pathname"),
    State("user_session", "data")
)
def render_page(pathname, user):

    # se não estiver logado → mostrar login
    if not user:
        return layout_login

    if pathname == "/dashboard":
        return dashboard.layout()

    return carteira.layout()


# -------------------------
# login
# -------------------------

@app.callback(
    Output("user_session", "data"),
    Output("login_msg", "children"),

    Input("btn_login", "n_clicks"),

    State("login_email", "value"),
    State("login_senha", "value"),

    prevent_initial_call=True
)
def fazer_login(n, email, senha):

    usuario = login(email, senha)

    if usuario:

        return {
            "email": usuario.email
        }, ""

    return None, "Email ou senha inválidos"


# -------------------------
# rodar aplicação
# -------------------------

if __name__ == '__main__':
    app.run(debug=True)
