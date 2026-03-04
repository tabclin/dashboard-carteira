from flask import Flask
import subprocess

app = Flask(__name__)


@app.route("/executar-automacao")
def executar():

    print("Executando automação...")

    subprocess.run(["python", "automatizar_gestaods.py"])

    return {"status": "automacao executada"}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
