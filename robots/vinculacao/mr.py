import os
import os.path
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
from speed import configure_fast_sleep

configure_fast_sleep()

def executar_mapeamento_total():
    # --- CONFIGURAÇÕES ---
    ID_PLANILHA = "1oMKFu9aobTP5sBuF0jjSR4In3Z6EcWfATCe_9ijNFXA"
    ARQUIVO_CLIENT_SECRET = "client_secret.json"
    URL_HITS = "https://susceptor.apphotel.one/account/login?returnUrl=%2Fconnect%2Fauthorize%2Flogin%3F" \
               "response_type%3Did_token%2520token%26client_id%3DB37748FC-ED13-4858-AE26-28AB3512A171%26" \
               "redirect_uri%3Dhttps%253A%252F%252Fnacionalinn.hitspms.net%252FCallback%26scope%3Dopenid%2520profile" \
               "%2520webapi%26nonce%3DN0.97568240711851631771599540467%26state%3D17715995404670.017079953495659272"

    print("📡 Conectando ao Google Sheets via OAuth...")
    escopos = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
    creds = None
    
    # Verifica se já existe um token salvo de um login anterior
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', escopos)
        
    # Se não tem credencial válida, faz o usuário logar
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(ARQUIVO_CLIENT_SECRET, escopos)
            creds = flow.run_local_server(port=0)
            
        # Salva a credencial para a próxima vez
        with open('token.json', 'w') as token:
            token.write(creds.to_json())

    # Autoriza o cliente
    cliente = gspread.authorize(creds)
    planilha = cliente.open_by_key(ID_PLANILHA)
    aba_bruta = planilha.worksheet("DADOS_BRUTOS_HITS")

    chrome_options = Options()
    if os.environ.get("ROBOT_HEADLESS", "1") != "0":
        chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--disable-extensions")
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
    wait = WebDriverWait(driver, 30)

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
        wait.until(EC.visibility_of_element_located((By.ID, "Email"))).send_keys(os.environ["HITS_EMAIL"])
        driver.find_element(By.ID, "Password").send_keys(os.environ["HITS_PASSWORD"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        time.sleep(10)

        dados_mestre = []
        chaves_vistas = set()

        # ==========================================
        # ETAPA 1: RESERVAS
        # ==========================================
        print("📂 [ETAPA 1] Extraindo Lista de Reservas...")
        js_click(wait.until(EC.element_to_be_clickable((By.XPATH, "/html/body/div[3]/div/header/nav[1]/ul/li[1]/a"))))
        time.sleep(2)
        js_click(wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="menureservation"]'))))
        time.sleep(2)
        js_click(wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="menureservations"]/a'))))
        time.sleep(10)

        for i in range(7):
            data_alvo = datetime.datetime.now() + datetime.timedelta(days=i)
            data_str = data_alvo.strftime("%d/%m/%y")
            str_range = f"{data_str} - {data_str}"
            print(f"🕒 Reservas - Dia {i+1}/7: {data_str}")

            if focar_quadro_do_elemento('//*[@id="one-search-filters-container"]/div[2]/span[2]/one-translate'):
                js_click(driver.find_element(By.XPATH, '//*[@id="one-search-filters-container"]/div[2]/span[2]/one-translate'))
                time.sleep(3)
                
                input_data = wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="one-search-modal-content"]/div/div/input')))
                input_data.click()
                input_data.send_keys(Keys.CONTROL + "a"); input_data.send_keys(Keys.DELETE); input_data.send_keys(str_range); input_data.send_keys(Keys.ENTER)
                time.sleep(2)

                xpath_apply = "//button[contains(@class, 'applyBtn')]"
                if len(driver.find_elements(By.XPATH, xpath_apply)) > 0:
                    js_click(driver.find_element(By.XPATH, xpath_apply))
                    time.sleep(3)

                try:
                    js_click(driver.find_element(By.XPATH, "/html/body/div[1]/div/div/div[4]/button"))
                    time.sleep(8) 
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
        time.sleep(2)
        js_click(wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="menufrontdesk"]'))))
        time.sleep(2)
        js_click(wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="menunewChart"]/a'))))
        time.sleep(10) 

        if focar_quadro_do_elemento('//*[@id="smAccInHouse"]'):
            js_click(driver.find_element(By.XPATH, '//*[@id="smAccInHouse"]'))
            time.sleep(5) 

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
            time.sleep(5) 

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
                resposta = requests.get(url_webhook)
                print(f"🤖 Resposta do Google Sheets: {resposta.text}")
            except Exception as e_web:
                print(f"⚠️ Erro ao acionar o Webhook: {e_web}")
        
    except Exception as e: print(f"❌ Erro Crítico: {e}")
    finally: driver.quit()

if __name__ == "__main__":
    executar_mapeamento_total()
