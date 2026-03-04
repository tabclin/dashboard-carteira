import glob
import os
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from datetime import datetime

# -------- CONFIG -------- #

download_path = r"C:\Users\Thiago\Desktop\Python\Dra Ana Beatriz Buzatto"

email = "suporte@tabclin.com"
senha = "Thi17062014$"

# -------- CONFIGURAR CHROME -------- #

options = webdriver.ChromeOptions()

prefs = {
    "download.default_directory": download_path,
    "download.prompt_for_download": False,
    "download.directory_upgrade": True,
    "safebrowsing.enabled": True
}

options.add_experimental_option("prefs", prefs)

driver = webdriver.Chrome(service=Service(
    ChromeDriverManager().install()), options=options)

driver.maximize_window()

# -------- 1️⃣ LOGIN -------- #

driver.get("https://app.gestaods.com.br/login")
time.sleep(3)

driver.find_element(By.NAME, "username").send_keys(email)
driver.find_element(By.NAME, "password").send_keys(senha)
driver.find_element(By.NAME, "password").send_keys(Keys.RETURN)

time.sleep(5)

# -------- 2️⃣ IR PARA RELATÓRIO -------- #

driver.get("https://app.gestaods.com.br/relatorios/servicos")
time.sleep(5)

# -------- 3️⃣ CLICAR CALENDÁRIO -------- #

driver.find_element(By.ID, "calendario-relatorio_atendimentos_v2").click()
time.sleep(2)

# -------- 4️⃣ PREENCHER DATA INICIAL -------- #

campo_data = driver.find_element(By.ID, "dt_incial-relatorio-atendimentos")
campo_data.clear()
campo_data.send_keys("01/01/2025")

time.sleep(1)

# -------- 5️⃣ CLICAR APLICAR -------- #

driver.find_element(By.XPATH, "//button[contains(., 'Aplicar')]").click()
time.sleep(5)

# -------- 6️⃣ ABRIR MENU EXPORTAÇÃO -------- #

wait = WebDriverWait(driver, 20)

botao_menu = wait.until(
    EC.element_to_be_clickable(
        (By.ID, "arrowdown-relatorio_atendimentos_v2")
    )
)

botao_menu.click()

# -------- 7️⃣ CLICAR EXPORTAR CSV -------- #

botao_exportar = wait.until(
    EC.element_to_be_clickable(
        (By.XPATH, "//div[contains(text(),'Exportar .CSV')]")
    )
)

botao_exportar.click()

# ================= AGUARDAR DOWNLOAD ================= #

print("Aguardando download finalizar...")

while True:
    arquivos = os.listdir(download_path)

    # Se ainda existir .crdownload, está baixando
    if any(arq.endswith(".crdownload") for arq in arquivos):
        time.sleep(1)
    else:
        break

print("Download finalizado. Verificando arquivos...")

# ================= IDENTIFICAR ARQUIVO NOVO ================= #

arquivo_oficial = os.path.join(download_path, "relatorio-atendimentos.csv")

# Procurar possíveis novos arquivos (ex: relatorio-atendimentos (1).csv)
lista_relatorios = glob.glob(
    os.path.join(download_path, "relatorio-atendimentos*.csv")
)

# Se só existir o oficial antigo, não houve download novo
if len(lista_relatorios) <= 1 and os.path.exists(arquivo_oficial):
    print("Nenhum novo arquivo detectado. Mantendo arquivo antigo.")
else:
    # Pegar o mais recente
    arquivo_novo = max(lista_relatorios, key=os.path.getctime)

    # Se o novo já for o oficial, significa que baixou direto com mesmo nome
    if arquivo_novo == arquivo_oficial:
        print("Arquivo foi substituído automaticamente pelo navegador.")
    else:
        print(f"Novo arquivo detectado: {os.path.basename(arquivo_novo)}")

        # Garantir que o novo realmente existe
        if os.path.exists(arquivo_novo):

            # Remover antigo somente agora
            if os.path.exists(arquivo_oficial):
                os.remove(arquivo_oficial)
                print("Arquivo antigo removido com segurança.")

            # Renomear novo para oficial
            os.rename(arquivo_novo, arquivo_oficial)
            print("Novo arquivo renomeado com sucesso.")

        else:
            print("ERRO: Arquivo novo não encontrado. Arquivo antigo mantido.")

            # salvar data da última atualização
agora = datetime.now().strftime("%d/%m/%Y %H:%M")

with open("ultima_atualizacao.txt", "w") as f:
    f.write(agora)
