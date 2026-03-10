from flask import Flask
import subprocess
import os

app = Flask(__name__)


@app.route("/executar-automacao")
def executar_automacao():

    subprocess.run(["python", "automatizar_gestaods.py"])

    return {"status": "automacao executada"}


@app.route("/executar-importacao")
def executar_importacao():

    subprocess.run(["python", "importar_todos_csv.py"])

    return {"status": "importacao executada"}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
