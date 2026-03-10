from dash import html, dcc

layout_login = html.Div(

    style={"width": "300px", "margin": "auto", "marginTop": "150px"},

    children=[

        html.H2("Login"),

        dcc.Input(
            id="login_email",
            type="email",
            placeholder="Email",
            style={"width": "100%", "marginBottom": "10px"}
        ),

        dcc.Input(
            id="login_senha",
            type="password",
            placeholder="Senha",
            style={"width": "100%", "marginBottom": "10px"}
        ),

        html.Button(
            "Entrar",
            id="btn_login",
            style={"width": "100%"}
        ),

        html.Div(id="login_msg")

    ]
)
