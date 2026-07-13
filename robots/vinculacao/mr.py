import argparse
import json
import getpass
import os
import os.path
from pathlib import Path
import time
import datetime
import gspread
import requests
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains

def executar_mapeamento_total(headless=None, fator_pausa=0.5):
    # --- CONFIGURAÇÕES ---
    ID_PLANILHA = "1oMKFu9aobTP5sBuF0jjSR4In3Z6EcWfATCe_9ijNFXA"
    BASE_DIR = Path(__file__).resolve().parent

    caminho_token = Path(os.getenv("GOOGLE_TOKEN_PATH", str(BASE_DIR / "token.json")))
    if not caminho_token.exists() and Path("token.json").exists():
        caminho_token = Path("token.json")

    caminho_client_secret = Path(
        os.getenv("GOOGLE_CLIENT_SECRET_PATH", str(BASE_DIR / "client_secret.json"))
    )
    if not caminho_client_secret.exists() and Path("client_secret.json").exists():
        caminho_client_secret = Path("client_secret.json")

    ARQUIVO_CLIENT_SECRET = str(caminho_client_secret)

    if headless is None:
        headless = (
            os.getenv("GITHUB_ACTIONS", "").lower() == "true"
            or os.getenv("ROBOT_HEADLESS", "").lower() in {"1", "true", "yes", "sim"}
        )

    fator_pausa = max(0.25, float(fator_pausa))

    def pausar(segundos):
        time.sleep(max(0.15, segundos * fator_pausa))
    URL_HITS = "https://susceptor.apphotel.one/account/login?returnUrl=%2Fconnect%2Fauthorize%2Flogin%3F" \
               "response_type%3Did_token%2520token%26client_id%3DB37748FC-ED13-4858-AE26-28AB3512A171%26" \
               "redirect_uri%3Dhttps%253A%252F%252Fnacionalinn.hitspms.net%252FCallback%26scope%3Dopenid%2520profile" \
               "%2520webapi%26nonce%3DN0.97568240711851631771599540467%26state%3D17715995404670.017079953495659272"

    print("📡 Conectando ao Google Sheets via OAuth...")
    escopos = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
    creds = None

    token_json_env = os.getenv("GOOGLE_TOKEN_JSON", "").strip()

    if token_json_env:
        creds = Credentials.from_authorized_user_info(json.loads(token_json_env), escopos)
    elif caminho_token.exists():
        creds = Credentials.from_authorized_user_file(str(caminho_token), escopos)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if os.getenv("GITHUB_ACTIONS", "").lower() == "true":
                raise RuntimeError(
                    "Google OAuth indisponível no GitHub Actions. "
                    "Configure GOOGLE_TOKEN_JSON ou disponibilize token.json."
                )

            flow = InstalledAppFlow.from_client_secrets_file(ARQUIVO_CLIENT_SECRET, escopos)
            creds = flow.run_local_server(port=0)

        if not token_json_env:
            caminho_token.parent.mkdir(parents=True, exist_ok=True)
            caminho_token.write_text(creds.to_json(), encoding="utf-8")

    # Autoriza o cliente
    cliente = gspread.authorize(creds)
    planilha = cliente.open_by_key(ID_PLANILHA)
    aba_bruta = planilha.worksheet("DADOS_BRUTOS_HITS")

    chrome_options = Options()
    chrome_options.add_argument("--start-maximized")

    if headless:
        chrome_options.add_argument("--headless=new")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")

    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=chrome_options,
    )
    wait = WebDriverWait(driver, 30)

    print(
        f"🖥️ Modo: {'HEADLESS/GITHUB ACTIONS' if headless else 'VISUAL'} | "
        f"Fator de pausa: {fator_pausa}"
    )

    def js_click(elemento):
        driver.execute_script("arguments[0].click();", elemento)

    def focar_quadro_do_elemento(xpath_alvo, max_depth=3):
        driver.switch_to.default_content()
        def procurar(profundidade):
            if profundidade > max_depth: return False
            if len(driver.find_elements(By.XPATH, xpath_alvo)) > 0: return True
            iframes = driver.find_elements(By.TAG_NAME, "iframe")
            for i in range(len(iframes)):
                try:
                    driver.switch_to.frame(i)
                    if procurar(profundidade + 1): return True
                    driver.switch_to.parent_frame()
                except: continue
            return False
        return procurar(0)

    try:
        # --- LOGIN ---
        driver.get(URL_HITS)
        hits_email = os.getenv("HITS_EMAIL") or input("Digite o HITS_EMAIL: ").strip()
        hits_password = os.getenv("HITS_PASSWORD") or getpass.getpass("Digite o HITS_PASSWORD: ")
        if not hits_email or not hits_password:
            raise RuntimeError("HITS_EMAIL/HITS_PASSWORD não configurados.")
        wait.until(EC.visibility_of_element_located((By.ID, "Email"))).send_keys(hits_email)
        driver.find_element(By.ID, "Password").send_keys(hits_password)
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        pausar(10)

        dados_mestre = []
        chaves_vistas = set()

        # ==========================================
        # ETAPA 1: RESERVAS
        # ==========================================
        print("📂 [ETAPA 1] Extraindo Lista de Reservas...")
        js_click(wait.until(EC.element_to_be_clickable((By.XPATH, "/html/body/div[3]/div/header/nav[1]/ul/li[1]/a"))))
        pausar(2)
        js_click(wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="menureservation"]'))))
        pausar(2)
        js_click(wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="menureservations"]/a'))))
        pausar(10)

        for i in range(7):
            data_alvo = datetime.datetime.now() + datetime.timedelta(days=i)
            data_str = data_alvo.strftime("%d/%m/%y")
            str_range = f"{data_str} - {data_str}"
            print(f"🕒 Reservas - Dia {i+1}/7: {data_str}")

            if focar_quadro_do_elemento('//*[@id="one-search-filters-container"]/div[2]/span[2]/one-translate'):
                js_click(driver.find_element(By.XPATH, '//*[@id="one-search-filters-container"]/div[2]/span[2]/one-translate'))
                pausar(3)

                input_data = wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="one-search-modal-content"]/div/div/input')))
                input_data.click()
                input_data.send_keys(Keys.CONTROL + "a"); input_data.send_keys(Keys.DELETE); input_data.send_keys(str_range); input_data.send_keys(Keys.ENTER)
                pausar(2)

                xpath_apply = "//button[contains(@class, 'applyBtn')]"
                if len(driver.find_elements(By.XPATH, xpath_apply)) > 0:
                    js_click(driver.find_element(By.XPATH, xpath_apply))
                    pausar(3)

                try:
                    js_click(driver.find_element(By.XPATH, "/html/body/div[1]/div/div/div[4]/button"))
                    pausar(8)
                except: pass

                if focar_quadro_do_elemento('//*[contains(@id, "-body-grid-container")]'):
                    linhas = driver.find_elements(By.XPATH, "//div[contains(@class, 'ui-grid-row')]")

                    contagem_diaria = {}

                    for linha in linhas:
                        try:
                            def get_val(class_id):
                                el = linha.find_element(By.XPATH, f".//div[contains(@class, 'ui-grid-coluiGrid-{class_id}')]")
                                return driver.execute_script("return arguments[0].textContent", el).strip()

                            vouc = get_val("0007")
                            if not vouc: continue

                            hospede   = get_val("000A").split(",")[0].strip()
                            checkin   = get_val("0005").split(" ")[0]
                            checkout  = get_val("0006").split(" ")[0]
                            pax       = get_val("000C")
                            apto      = get_val("000D")
                            categoria = get_val("000E")

                            status_res = "ENTRADA" if i == 0 else "RESERVA"

                            chave_base = (vouc, apto, hospede, checkin, checkout)

                            contagem_diaria[chave_base] = contagem_diaria.get(chave_base, 0) + 1
                            ocorrencia_hoje = contagem_diaria[chave_base]

                            chave_unica = (vouc, apto, hospede, checkin, checkout, ocorrencia_hoje)

                            if chave_unica not in chaves_vistas:
                                dados_mestre.append([apto, vouc, checkin, checkout, status_res, pax, hospede, categoria])
                                chaves_vistas.add(chave_unica)
                        except: continue

        # ==========================================
        # ETAPA 2: OCUPADOS (VIA MAPA DE RESERVAS)
        # ==========================================
        print("📂 [ETAPA 2] Acessando Mapa de Reservas e Extraindo Ocupados...")

        driver.switch_to.default_content()

        js_click(wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="menuPrimary"]/a'))))
        pausar(2)
        js_click(wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="menufrontdesk"]'))))
        pausar(2)
        js_click(wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="menunewChart"]/a'))))
        pausar(10)

        if focar_quadro_do_elemento('//*[@id="smAccInHouse"]'):
            js_click(driver.find_element(By.XPATH, '//*[@id="smAccInHouse"]'))
            pausar(5)

            if focar_quadro_do_elemento('//*[@id="tableUsuario"]'):
                linhas_ocupados = driver.find_elements(By.XPATH, '//*[@id="tableUsuario"]/tbody/tr')

                for linha in linhas_ocupados:
                    try:
                        colunas = linha.find_elements(By.TAG_NAME, "td")
                        if len(colunas) < 7: continue

                        apto_c    = colunas[1].text.strip()
                        hosp_c    = colunas[2].text.strip()
                        checkin_c = colunas[5].text.strip()
                        checkout_c= colunas[6].text.strip()

                        # --- INÍCIO DA NOVA EXTRAÇÃO DE PAX ---
                        try:
                            # Busca especificamente pelo span com o atributo angular indicado
                            pax_c = linha.find_element(By.XPATH, ".//span[@ng-bind='ls.PaxChd']").text.strip()
                        except:
                            pax_c = "-" # Fallback caso a coluna venha vazia
                        # --- FIM DA NOVA EXTRAÇÃO ---

                        vouc_c = "MAPA"
                        cat_c  = "IN-HOUSE"

                        chave_c = (vouc_c, apto_c, hosp_c, checkin_c)
                        if chave_c not in chaves_vistas:
                            # A lista abaixo já respeita a ordem onde pax_c fica no índice 5 (Coluna F)
                            dados_mestre.append([apto_c, vouc_c, checkin_c, checkout_c, "OCUPADO", pax_c, hosp_c, cat_c])
                            chaves_vistas.add(chave_c)
                    except: continue

        # ==========================================
        # ETAPA 3: INTERDITADOS
        # ==========================================
        print("📂 [ETAPA 3] Extraindo Quartos Interditados...")

        if focar_quadro_do_elemento('//*[@id="smAccOutOrder"]'):
            js_click(driver.find_element(By.XPATH, '//*[@id="smAccOutOrder"]'))
            pausar(5)

            if focar_quadro_do_elemento('//*[@id="tableUsuario"]'):
                linhas_interditados = driver.find_elements(By.XPATH, '//*[@id="tableUsuario"]/tbody/tr')

                for linha in linhas_interditados:
                    try:
                        texto_linha = linha.text
                        if "Sem dados" in texto_linha or "No data" in texto_linha:
                            continue

                        colunas = linha.find_elements(By.TAG_NAME, "td")
                        if len(colunas) < 6: continue

                        apto_i = linha.find_element(By.XPATH, "./td[3]/span[1]").text.strip()
                        motivo_i = linha.find_element(By.XPATH, "./td[4]/div").text.strip()
                        from_i = linha.find_element(By.XPATH, "./td[5]/div/span").text.strip().split(" ")[0]
                        through_i = linha.find_element(By.XPATH, "./td[6]/div/span").text.strip().split(" ")[0]

                        vouc_i = "INTERDICAO"
                        cat_i = "OUT OF ORDER"
                        pax_i = "-"

                        chave_i = (vouc_i, apto_i, motivo_i, from_i)
                        if chave_i not in chaves_vistas:
                            dados_mestre.append([apto_i, vouc_i, from_i, through_i, "INTERDITADO", pax_i, motivo_i, cat_i])
                            chaves_vistas.add(chave_i)
                    except: continue

        # ==========================================
        # SALVAMENTO FINAL E WEBHOOK
        # ==========================================
        if dados_mestre:
            aba_bruta.batch_clear(["A2:H5000"])
            aba_bruta.update(values=dados_mestre, range_name='A2')
            print(f"✅ SUCESSO! {len(dados_mestre)} registros consolidados na planilha.")

            # --- GATILHO WEBHOOK ---
            print("🚀 Acionando o Google Sheets para reorganizar os andares...")
            try:
                url_webhook = "https://script.google.com/macros/s/AKfycbwcfhQySj2OoJVSzaWnjMCHZzfHPCQHc5fZHKt5sLmhJ7wTtD24SvR-kk-at7lFo_31EA/exec"
                resposta = requests.get(url_webhook, timeout=60)
                print(f"🤖 Resposta do Google Sheets: {resposta.text}")
            except Exception as e_web:
                print(f"⚠️ Erro ao acionar o Webhook: {e_web}")

    except Exception as e: print(f"❌ Erro Crítico: {e}")
    finally: driver.quit()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Robô MR - mapeamento HITS")
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Executa o Chrome sem interface visual.",
    )
    parser.add_argument(
        "--visual",
        action="store_true",
        help="Força o Chrome visível.",
    )
    parser.add_argument(
        "--fator-pausa",
        type=float,
        default=float(os.getenv("MR_FATOR_PAUSA", "0.5")),
        help="Multiplicador das pausas originais. Padrão: 0.5.",
    )
    args = parser.parse_args()

    modo_headless = None
    if args.headless:
        modo_headless = True
    elif args.visual:
        modo_headless = False

    executar_mapeamento_total(
        headless=modo_headless,
        fator_pausa=args.fator_pausa,
    )
