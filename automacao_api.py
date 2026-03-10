from flask import Flask, jsonify
import subprocess
import threading
import os
import datetime

app = Flask(__name__)

executando = False
ultimo_log = ""


def rodar_script(script):

    global executando
    global ultimo_log

    executando = True
    inicio = datetime.datetime.now()

    try:

        resultado = subprocess.run(
            ["python", script],
            capture_output=True,
            text=True
        )

        fim = datetime.datetime.now()

        ultimo_log = {
            "script": script,
            "inicio": str(inicio),
            "fim": str(fim),
            "saida": resultado.stdout,
            "erro": resultado.stderr
        }

    except Exception as e:

        ultimo_log = {"erro": str(e)}

    executando = False


@app.route("/executar-automacao")
def executar_automacao():

    global executando

    if executando:
        return jsonify({"status": "automacao já está rodando"})

    thread = threading.Thread(
        target=rodar_script,
        args=("automatizar_gestaods.py",)
    )

    thread.start()

    return jsonify({"status": "automacao iniciada"})


@app.route("/executar-importacao")
def executar_importacao():

    global executando

    if executando:
        return jsonify({"status": "importacao já está rodando"})

    thread = threading.Thread(
        target=rodar_script,
        args=("importar_todos_csv.py",)
    )

    thread.start()

    return jsonify({"status": "importacao iniciada"})


@app.route("/status")
def status():

    return jsonify({
        "executando": executando,
        "ultimo_log": ultimo_log
    })


if __name__ == "__main__":

    port = int(os.environ.get("PORT", 5000))

    app.run(
        host="0.0.0.0",
        port=port,
        debug=False
    )
