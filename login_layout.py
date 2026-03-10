from dash import html, dcc


def layout_login():

    return html.Div([
        html.H2("Login"),

        dcc.Input(
            id="login_email",
            type="email",
            placeholder="Email"
        ),

        dcc.Input(
            id="login_senha",
            type="password",
            placeholder="Senha"
        ),

        html.Button("Entrar", id="btn_login"),

        html.Div(id="login_msg")
    ])
