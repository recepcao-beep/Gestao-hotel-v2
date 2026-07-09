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

    def fechar_popup_hits():
        """Fecha o pop-up pós-login do HITS e remove o backdrop que bloqueia cliques."""
        driver.switch_to.default_content()
        def remover_comunicado_visivel():
            try:
                return bool(driver.execute_script("""
                    let removeu = false;
                    const termos = ['COMUNICADO', 'Olá Hoteleiros', 'Ola Hoteleiros'];
                    const contemComunicado = (el) => {
                      const texto = String(el.innerText || el.textContent || '');
                      return termos.some((termo) => texto.includes(termo));
                    };
                    const area = (el) => {
                      const r = el.getBoundingClientRect();
                      return r.width * r.height;
                    };
                    const candidatos = Array.from(document.querySelectorAll('body *'))
                      .filter((el) => {
                        if (!contemComunicado(el)) return false;
                        const r = el.getBoundingClientRect();
                        const visivel = !!(r.width || r.height || el.getClientRects().length);
                        return visivel && r.width >= 250 && r.height >= 120;
                      })
                      .sort((a, b) => area(a) - area(b));
                    candidatos.forEach((el) => {
                      let alvo = el;
                      let atual = el;
                      while (atual.parentElement && atual.parentElement !== document.body) {
                        const pai = atual.parentElement;
                        const r = pai.getBoundingClientRect();
                        if (!contemComunicado(pai)) break;
                        if (r.width >= window.innerWidth * 0.98 || r.height >= window.innerHeight * 0.98) break;
                        alvo = pai;
                        atual = pai;
                      }
                      if (alvo && alvo.parentElement && alvo.tagName !== 'BODY' && alvo.tagName !== 'HTML') {
                        alvo.remove();
                        removeu = true;
                      }
                    });
                    return removeu;
                """))
            except:
                return False

        remover_comunicado_visivel()
        def popup_bloqueando_presente():
            try:
                return bool(driver.execute_script("""
                    const textoPagina = String(document.body ? document.body.innerText || '' : '');
                    const temComunicado = textoPagina.includes('COMUNICADO') || textoPagina.includes('Olá Hoteleiros');
                    const temBackdrop = Array.from(document.querySelectorAll('div, [class]')).some((el) => {
                      const cls = String(el.className || '');
                      const bg = String(el.getAttribute('backgroundcolor') || '');
                      const style = String(el.getAttribute('style') || '');
                      return cls.includes('themes-preview-reflect-backdrop')
                        || cls.includes('ug-sdk__sc-1rnuyal')
                        || bg.includes('rgba(0, 0, 0')
                        || (style.includes('pointer-events: all') && style.includes('rgba(0, 0, 0'));
                    });
                    return temComunicado || temBackdrop;
                """))
            except:
                return True

        xpaths_fechar = [
            "/html/body/div/div/div/div/div/div/div[3]/div/button",
            "/html/body/div/div/div/div/div/div/div[1]//*[name()='svg']",
            "/html/body/div/div/div/div/div/div/div[1]//*[name()='svg']/*[name()='path']",
            "/html/body/div/div/div/div/div/div/div[1]//*[normalize-space(.)='×' or normalize-space(.)='x' or normalize-space(.)='X']",
            "//*[contains(normalize-space(.), 'COMUNICADO')]/ancestor::*[self::div][1]//*[normalize-space(.)='OK']",
            "//button[contains(normalize-space(.), 'Fechar')]",
            "//button[normalize-space(.)='OK' or .//*[normalize-space(.)='OK']]",
            "//*[@role='button' and (normalize-space(.)='OK' or .//*[normalize-space(.)='OK'])]",
            "//button[contains(normalize-space(.), 'Entendi')]",
        ]
        for _ in range(6):
            if remover_comunicado_visivel():
                time.sleep(0.5)
            if not popup_bloqueando_presente():
                break
            fechou = False
            for xpath in xpaths_fechar:
                try:
                    botoes = driver.find_elements(By.XPATH, xpath)
                    for botao in botoes:
                        if botao.is_displayed() or "svg" in xpath:
                            driver.execute_script("""
                                const el = arguments[0];
                                const disparar = (alvo) => {
                                  if (!alvo) return;
                                  ['mouseover', 'mousedown', 'mouseup', 'click'].forEach((nome) => {
                                    try { alvo.dispatchEvent(new MouseEvent(nome, { bubbles: true, cancelable: true, view: window })); } catch (e) {}
                                  });
                                  try { alvo.click(); } catch (e) {}
                                };
                                disparar(el);
                                disparar(el.closest && (el.closest('button') || el.closest('[role="button"]') || el.closest('svg')));
                                let pai = el.parentElement;
                                for (let i = 0; pai && i < 6; i += 1, pai = pai.parentElement) disparar(pai);
                            """, botao)
                            time.sleep(0.8)
                            fechou = True
                            break
                    if fechou:
                        break
                except:
                    continue
            if not fechou:
                try:
                    ActionChains(driver).send_keys(Keys.ESCAPE).perform()
                    time.sleep(0.3)
                except:
                    pass
            try:
                fechou_js = driver.execute_script("""
                    let clicou = false;
                    const disparar = (alvo) => {
                      if (!alvo) return;
                      ['mouseover', 'mousedown', 'mouseup', 'click'].forEach((nome) => {
                        try { alvo.dispatchEvent(new MouseEvent(nome, { bubbles: true, cancelable: true, view: window })); } catch (e) {}
                      });
                      try { alvo.click(); clicou = true; } catch (e) {}
                    };
                    const fecharPath = document.evaluate(
                      "/html/body/div/div/div/div/div/div/div[1]//*[name()='svg']/*[name()='path']",
                      document,
                      null,
                      XPathResult.FIRST_ORDERED_NODE_TYPE,
                      null
                    ).singleNodeValue;
                    const fecharSvg = document.evaluate(
                      "/html/body/div/div/div/div/div/div/div[1]//*[name()='svg']",
                      document,
                      null,
                      XPathResult.FIRST_ORDERED_NODE_TYPE,
                      null
                    ).singleNodeValue;
                    disparar(fecharPath);
                    disparar(fecharSvg);
                    let paiFechar = (fecharPath || fecharSvg || {}).parentElement;
                    for (let i = 0; paiFechar && i < 8; i += 1, paiFechar = paiFechar.parentElement) disparar(paiFechar);
                    Array.from(document.querySelectorAll('button, [role="button"], a, div, span')).forEach((el) => {
                      const texto = String(el.innerText || el.textContent || '').trim();
                      const visivel = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
                      if (visivel && (texto === 'OK' || texto === 'Fechar' || texto === 'Entendi')) {
                        try { el.click(); clicou = true; } catch (e) {}
                      }
                    });
                    const comunicados = Array.from(document.querySelectorAll('body *'))
                      .filter((el) => {
                        const texto = String(el.innerText || '');
                        if (!texto.includes('COMUNICADO') && !texto.includes('Olá Hoteleiros')) return false;
                        const rect = el.getBoundingClientRect();
                        return rect.width >= 250 && rect.height >= 120 && rect.width < window.innerWidth * 0.95 && rect.height < window.innerHeight * 0.98;
                      })
                      .sort((a, b) => (b.getBoundingClientRect().width * b.getBoundingClientRect().height) - (a.getBoundingClientRect().width * a.getBoundingClientRect().height));
                    if (comunicados.length) {
                      const alvo = comunicados[0];
                      if (alvo && alvo.tagName !== 'BODY' && alvo.tagName !== 'HTML') {
                        alvo.remove();
                        clicou = true;
                      }
                    }
                    Array.from(document.querySelectorAll('div, [class]')).forEach((el) => {
                      const cls = String(el.className || '');
                      const bg = String(el.getAttribute('backgroundcolor') || '');
                      const style = String(el.getAttribute('style') || '');
                      const bloqueiaTela = cls.includes('themes-preview-reflect-backdrop')
                        || cls.includes('ug-sdk__sc-1rnuyal')
                        || bg.includes('rgba(0, 0, 0')
                        || (style.includes('pointer-events: all') && style.includes('rgba(0, 0, 0'));
                      if (bloqueiaTela) { el.remove(); clicou = true; }
                    });
                    return clicou;
                """)
                fechou = fechou or bool(fechou_js)
            except:
                pass
            if not fechou:
                break
        driver.switch_to.default_content()

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

    def obter_elemento_seguro(xpath_alvo, timeout=20):
        fim = time.time() + timeout
        ultimo_erro = None
        while time.time() < fim:
            try:
                fechar_popup_hits()
                if focar_quadro_do_elemento(xpath_alvo):
                    elementos = driver.find_elements(By.XPATH, xpath_alvo)
                    if elementos:
                        return elementos[0]
            except Exception as erro:
                ultimo_erro = erro
            time.sleep(0.5)
        raise RuntimeError(f"Elemento nao encontrado: {xpath_alvo}. Ultimo erro: {ultimo_erro}")

    def obter_primeiro_elemento_seguro(xpaths_alvo, timeout=20):
        if isinstance(xpaths_alvo, str):
            xpaths_alvo = [xpaths_alvo]
        fim = time.time() + timeout
        ultimo_erro = None
        while time.time() < fim:
            for xpath_alvo in xpaths_alvo:
                try:
                    fechar_popup_hits()
                    if focar_quadro_do_elemento(xpath_alvo):
                        elementos = driver.find_elements(By.XPATH, xpath_alvo)
                        if elementos:
                            return elementos[0]
                except Exception as erro:
                    ultimo_erro = erro
            time.sleep(0.5)
        raise RuntimeError(f"Elemento nao encontrado: {xpaths_alvo}. Ultimo erro: {ultimo_erro}")

    def clicar_xpath_seguro(xpath_alvo, timeout=20, tentativas=4):
        ultimo_erro = None
        for _ in range(tentativas):
            try:
                elemento = obter_elemento_seguro(xpath_alvo, timeout=timeout)
                js_click(elemento)
                return True
            except Exception as erro:
                ultimo_erro = erro
                fechar_popup_hits()
                time.sleep(0.8)
        raise RuntimeError(f"Nao foi possivel clicar em: {xpath_alvo}. Ultimo erro: {ultimo_erro}")

    def preencher_input_seguro(xpath_alvo, texto, tentativas=4):
        ultimo_erro = None
        for _ in range(tentativas):
            try:
                campo = obter_primeiro_elemento_seguro(xpath_alvo, timeout=20)
                try:
                    campo.click()
                except:
                    js_click(campo)
                campo.send_keys(Keys.CONTROL + "a")
                campo.send_keys(Keys.DELETE)
                campo.send_keys(texto)
                campo.send_keys(Keys.ENTER)
                return True
            except Exception as erro:
                ultimo_erro = erro
                fechar_popup_hits()
                time.sleep(0.8)
        raise RuntimeError(f"Nao foi possivel preencher: {xpath_alvo}. Ultimo erro: {ultimo_erro}")

    try:
        # --- LOGIN ---
        driver.get(URL_HITS)
        wait.until(EC.visibility_of_element_located((By.ID, "Email"))).send_keys(os.environ["HITS_EMAIL"])
        driver.find_element(By.ID, "Password").send_keys(os.environ["HITS_PASSWORD"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        time.sleep(10)
        fechar_popup_hits()

        dados_mestre = []
        chaves_vistas = set()

        # ==========================================
        # ETAPA 1: RESERVAS
        # ==========================================
        print("📂 [ETAPA 1] Extraindo Lista de Reservas...")
        clicar_xpath_seguro("/html/body/div[3]/div/header/nav[1]/ul/li[1]/a")
        time.sleep(2)
        clicar_xpath_seguro('//*[@id="menureservation"]')
        time.sleep(2)
        clicar_xpath_seguro('//*[@id="menureservations"]/a')
        time.sleep(10)

        for i in range(7):
            data_alvo = datetime.datetime.now() + datetime.timedelta(days=i)
            data_str = data_alvo.strftime("%d/%m/%y")
            str_range = f"{data_str} - {data_str}"
            print(f"🕒 Reservas - Dia {i+1}/7: {data_str}")
            fechar_popup_hits()

            if focar_quadro_do_elemento('//*[@id="one-search-filters-container"]/div[2]/span[2]/one-translate'):
                clicar_xpath_seguro('//*[@id="one-search-filters-container"]/div[2]/span[2]/one-translate')
                time.sleep(3)
                fechar_popup_hits()
                
                xpaths_input_data = [
                    '//*[@id="one-search-modal-content"]/div/div/input',
                    '//*[@id="one-search-modal-content"]//input',
                    "//input[@date-range-picker]",
                    "//input[contains(@ng-model, 'datePicker.date')]",
                    "//input[contains(@class, 'date-picker')]",
                ]
                try:
                    preencher_input_seguro(xpaths_input_data, str_range)
                except:
                    clicar_xpath_seguro('//*[@id="one-search-filters-container"]/div[2]/span[2]/one-translate')
                    time.sleep(2)
                    preencher_input_seguro(xpaths_input_data, str_range)
                time.sleep(2)

                xpath_apply = "//button[contains(@class, 'applyBtn')]"
                if len(driver.find_elements(By.XPATH, xpath_apply)) > 0:
                    clicar_xpath_seguro(xpath_apply)
                    time.sleep(3)

                try:
                    clicar_xpath_seguro("/html/body/div[1]/div/div/div[4]/button", timeout=5, tentativas=2)
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
