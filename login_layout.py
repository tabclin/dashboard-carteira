from dash import html, dcc
import dash_bootstrap_components as dbc


def layout_login():

    return html.Div(

        dbc.Card(

            dbc.CardBody([

                html.H3(
                    "Login",
                    className="text-center mb-4"
                ),

                dbc.Input(
                    id="login_email",
                    type="email",
                    placeholder="Email",
                    className="mb-3",
                ),

                dbc.Input(
                    id="login_senha",
                    type="password",
                    placeholder="Senha",
                    className="mb-4",
                ),

                dbc.Button(
                    "Entrar",
                    id="btn_login",
                    color="primary",
                    className="w-100"
                ),

                html.Div(
                    id="login_msg",
                    className="mt-3 text-center"
                )

            ]),

            style={
                "width": "380px",
                "borderRadius": "12px",
                "boxShadow": "0 6px 25px rgba(0,0,0,0.15)"
            }

        ),

        style={
            "height": "100vh",
            "display": "flex",
            "justifyContent": "center",
            "alignItems": "center",
            "backgroundColor": "#f5f7fb"
        }

    )
