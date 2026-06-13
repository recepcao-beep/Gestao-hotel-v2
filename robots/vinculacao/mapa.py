import os
import time
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def executar_mapa():
    print("🚀 INICIANDO ATUALIZAÇÃO DO MAPA (OCC/IN/OUT)...")
    
    # --- CONFIGURAÇÕES GOOGLE SHEETS ---
    scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
    creds = ServiceAccountCredentials.from_json_keyfile_name('automacao-mapinha-cb0bced39056.json', scope)
    client = gspread.authorize(creds)

    spreadsheet_url = "https://docs.google.com/spreadsheets/d/1oMKFu9aobTP5sBuF0jjSR4In3Z6EcWfATCe_9ijNFXA/edit?usp=sharing"
    sheet = client.open_by_url(spreadsheet_url).worksheet("COLAR RESPECTIVOS ITENS")

    # --- CONFIGURAÇÕES SELENIUM ---
    chrome_options = Options()
    if os.environ.get("ROBOT_HEADLESS", "1") != "0":
        chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--disable-extensions")
    # chrome_options.add_argument("--headless") # Descomente se quiser rodar escondido
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
    wait = WebDriverWait(driver, 30)

    def js_click(elemento):
        driver.execute_script("arguments[0].click();", elemento)

    def capturar_tabela_em_colunas():
        """Extrai os dados célula por célula para preencher as colunas da planilha"""
        print("   -> Lendo tabela...")
        try:
            # Tenta localizar linhas da tabela (Grid do HITS)
            xpath_linhas = '//*[@id="menu-linha-do-tempo"]//div[contains(@class, "grid-row")] | //tr[@role="row"] | //table//tr[td]'
            linhas = driver.find_elements(By.XPATH, xpath_linhas)
            
            dados_finais = []
            for linha in linhas:
                # Pega as células individuais (td ou div) de cada linha
                celulas = linha.find_elements(By.XPATH, "./td | ./div")
                
                # Pula a primeira célula (ícones de ação) e pega o resto
                if len(celulas) > 1:
                    linha_texto = [c.text.strip().replace('\n', ' ') for c in celulas[1:]]
                    # Adiciona à lista se a linha tiver conteúdo
                    if any(linha_texto):
                        dados_finais.append(linha_texto)
                    
            print(f"   ✅ {len(dados_finais)} registros capturados.")
            return dados_finais
        except Exception as e:
            print(f"   ⚠️ Erro ao capturar tabela: {e}")
            return []

    try:
        print("🧹 Limpando dados antigos da planilha...")
        # Limpa as colunas específicas para não sobrar lixo
        sheet.batch_clear(["B4:L1000", "O4:Y1000", "AB4:AL1000"])

        print("🌐 Acessando HITS...")
        driver.get("https://susceptor.apphotel.one/account/login?returnUrl=%2Fconnect%2Fauthorize%2Flogin%3Fresponse_type%3Did_token%2520token%26client_id%3DB37748FC-ED13-4858-AE26-28AB3512A171%26redirect_uri%3Dhttps%253A%252F%252Fnacionalinn.hitspms.net%252FCallback%26scope%3Dopenid%2520profile%2520webapi%26nonce%3DN0.55369222377805221769641701210%26state%3D17696417012100.3264555900859101") 
        
        # Login
        wait.until(EC.visibility_of_element_located((By.ID, "Email"))).send_keys(os.environ["HITS_EMAIL"])
        driver.find_element(By.ID, "Password").send_keys(os.environ["HITS_PASSWORD"]) 
        js_click(driver.find_element(By.XPATH, "//button[@type='submit']"))
        
        print("⏳ Aguardando carregamento (20s)...")
        time.sleep(20)

        # Navegação
        print("🖱️ Navegando para Governança > Ocupação...")
        js_click(wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="menuPrimary"]/a'))))
        time.sleep(2)
        js_click(wait.until(EC.element_to_be_clickable((By.ID, "menufrontdesk")))) # As vezes fica em frontdesk ou governanca
        time.sleep(2)
        # Tenta achar o menu de relatórios ou mapa
        try:
            js_click(wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="menunewChart"]/a')))) # Ajuste se necessário para o caminho exato do relatório
        except:
             # Caso o ID mude, tenta pelo texto
             js_click(driver.find_element(By.XPATH, "//span[contains(text(), 'Mapa') or contains(text(), 'Ocupa')]"))

        print("⏳ Aguardando mapa carregar (15s)...")
        time.sleep(15) 

        # --- BUSCA DO IFRAME (QUADRO) ---
        print("🔍 Localizando quadro de dados...")
        driver.switch_to.default_content()
        iframes = driver.find_elements(By.TAG_NAME, "iframe")
        iframe_encontrado = False

        for i, frame in enumerate(iframes):
            try:
                driver.switch_to.default_content()
                driver.switch_to.frame(i)
                # Procura por abas conhecidas
                if len(driver.find_elements(By.ID, "smAccInHouse")) > 0:
                    print(f"🎯 Quadro de dados encontrado no índice {i}!")
                    iframe_encontrado = True
                    break
            except:
                continue
        
        if not iframe_encontrado:
            print("⚠️ Quadro não encontrado via ID. Tentando seguir no quadro principal...")
            driver.switch_to.default_content()

        # --- 1. OCUPADOS ---
        print("📊 [1/3] Extraindo OCUPADOS...")
        try:
            aba_occ = wait.until(EC.element_to_be_clickable((By.ID, "smAccInHouse")))
            js_click(aba_occ)
            time.sleep(5)
            dados_ocupados = capturar_tabela_em_colunas()
            if dados_ocupados:
                sheet.update("B4", dados_ocupados) # Sintaxe corrigida gspread
                print("   💾 Salvo na coluna B.")
        except Exception as e:
            print(f"   ❌ Falha em Ocupados: {e}")

        # --- 2. CHECK-INS ---
        print("📊 [2/3] Extraindo CHECK-INS...")
        try:
            aba_in = driver.find_element(By.ID, "smAccCheckIn")
            js_click(aba_in)
            time.sleep(5)
            dados_checkin = capturar_tabela_em_colunas()
            if dados_checkin:
                sheet.update("O4", dados_checkin)
                print("   💾 Salvo na coluna O.")
        except Exception as e:
             print(f"   ❌ Falha em Check-ins: {e}")

        # --- 3. CHECK-OUTS ---
        print("📊 [3/3] Extraindo CHECK-OUTS...")
        try:
            aba_out = driver.find_element(By.ID, "smAccCheckOut")
            js_click(aba_out)
            time.sleep(5)
            dados_checkout = capturar_tabela_em_colunas()
            if dados_checkout:
                sheet.update("AB4", dados_checkout)
                print("   💾 Salvo na coluna AB.")
        except Exception as e:
             print(f"   ❌ Falha em Check-outs: {e}")

        print("\n✅ MAPA ATUALIZADO COM SUCESSO!")

    except Exception as e:
        print(f"\n❌ ERRO CRÍTICO NO MAPA: {e}")
    finally:
        print("🏁 Finalizando mapa.py...")
        driver.quit()

# --- ISSO AQUI ERA O QUE FALTAVA ---
if __name__ == "__main__":
    executar_mapa()