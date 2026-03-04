import time
import subprocess

while True:

    with open("solicitacao_atualizacao.txt", "r") as f:
        status = f.read().strip()

    if status == "1":

        print("Iniciando automação...")

        subprocess.run(["python", "automatizar_gestaods.py"])

        with open("solicitacao_atualizacao.txt", "w") as f:
            f.write("0")

        print("Automação concluída.")

    time.sleep(10)
