from dash import Dash, html, dcc
import dash_bootstrap_components as dbc
from layouts.sidebar import sidebar
from pages import carteira, dashboard
from dash import Output, Input

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
    sidebar,
    html.Div(id="page-content", style=CONTENT_STYLE)
])


@app.callback(
    Output("page-content", "children"),
    Input("url", "pathname")
)
def render_page(pathname):

    if pathname == "/dashboard":
        return dashboard.layout()

    return carteira.layout()


if __name__ == '__main__':
    app.run(debug=True)
