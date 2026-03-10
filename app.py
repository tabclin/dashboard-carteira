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

    # sessão do usuário
    dcc.Store(id="user_session", storage_type="session"),

    html.Div(id="sidebar_container"),

    html.Div(id="page-content", style=CONTENT_STYLE)

])


# -----------------------------
# Mostrar sidebar somente logado
# -----------------------------
@app.callback(
    Output("sidebar_container", "children"),
    Input("user_session", "data")
)
def mostrar_sidebar(user):

    if user:

        return html.Div([

            sidebar,

            dbc.Button(
                "Logout",
                id="btn_logout",
                color="danger",
                style={
                    "position": "fixed",
                    "bottom": "20px",
                    "left": "20px",
                    "width": "200px"
                }
            )

        ])

    return ""


# -----------------------------
# Controle de páginas
# -----------------------------
@app.callback(
    Output("page-content", "children"),
    Input("url", "pathname"),
    State("user_session", "data")
)
def render_page(pathname, user):

    # usuário não logado
    if not user:
        return layout_login

    # usuário logado
    if pathname == "/dashboard":
        return dashboard.layout()

    if pathname == "/carteira":
        return carteira.layout()

    # página padrão após login
    return carteira.layout()


# -----------------------------
# LOGIN
# -----------------------------
@app.callback(
    Output("user_session", "data"),
    Output("login_msg", "children"),
    Output("url", "pathname"),

    Input("btn_login", "n_clicks"),

    State("login_email", "value"),
    State("login_senha", "value"),

    prevent_initial_call=True
)
def fazer_login(n, email, senha):

    usuario = login(email, senha)

    if usuario:

        return (
            {"email": usuario["email"]},
            "",
            "/carteira"
        )

    return None, "Email ou senha inválidos", "/"


# -----------------------------
# LOGOUT
# -----------------------------
@app.callback(
    Output("user_session", "clear_data"),
    Output("url", "pathname"),

    Input("btn_logout", "n_clicks"),

    prevent_initial_call=True
)
def logout(n):

    return True, "/"


if __name__ == "__main__":
    app.run(debug=True)
