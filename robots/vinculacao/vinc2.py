import os
import re
import time
import gspread
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
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys

def executar_vinculacao_2_0():
    # --- CONFIGURAÇÕES ---
    ID_PLANILHA = "1oMKFu9aobTP5sBuF0jjSR4In3Z6EcWfATCe_9ijNFXA"
    NOME_ABA = "VINCULACAO_HOJE"
    
    URL_HITS = "https://susceptor.apphotel.one/account/login?returnUrl=%2Fconnect%2Fauthorize%2Flogin%3F" \
               "response_type%3Did_token%2520token%26client_id%3DB37748FC-ED13-4858-AE26-28AB3512A171%26" \
               "redirect_uri%3Dhttps%253A%252F%252Fnacionalinn.hitspms.net%252FCallback%26scope%3Dopenid%2520profile" \
               "%2520webapi%26nonce%3DN0.28324722615515141770822279499%26state%3D17708222794990.2983837305966167"

    # DICIONÁRIO DE CATEGORIAS ATUALIZADO
    XPATH_CATS = {
        "3CS":  "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[1]",
        "1CSS": "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[2]",
        "1CC":  "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[3]",
        "2CSS": "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[4]",
        "2CC":  "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[5]",
        "SP":   "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[6]"
    }
    CATEGORIAS_VALIDAS = sorted(XPATH_CATS.keys(), key=len, reverse=True)

    chrome_options = Options()
    if os.environ.get("ROBOT_HEADLESS", "1") != "0":
        chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--disable-extensions")
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
    wait = WebDriverWait(driver, 15)

    def js_click(elemento):
        driver.execute_script("arguments[0].click();", elemento)

    def focar_quadro_do_elemento(xpath_alvo, tempo_maximo=15):
        tempo_inicial = time.time()
        while time.time() - tempo_inicial < tempo_maximo:
            driver.switch_to.default_content()
            if len(driver.find_elements(By.XPATH, xpath_alvo)) > 0: return True
            iframes = driver.find_elements(By.TAG_NAME, "iframe")
            for i in range(len(iframes)):
                try:
                    driver.switch_to.frame(i)
                    if len(driver.find_elements(By.XPATH, xpath_alvo)) > 0: return True
                    driver.switch_to.parent_frame()
                except: continue
            time.sleep(0.5)
        return False

    def esperar_loading_sumir():
        try:
            WebDriverWait(driver, 10).until(
                EC.invisibility_of_element_located((By.CLASS_NAME, "block-ui-overlay"))
            )
        except: pass

    def xpath_literal(texto):
        if "'" not in texto:
            return f"'{texto}'"
        if '"' not in texto:
            return f'"{texto}"'
        partes = texto.split("'")
        return "concat(" + ', "\'", '.join(f"'{parte}'" for parte in partes) + ")"

    def normalizar_categoria(texto):
        texto_upper = (texto or "").upper()
        for categoria in CATEGORIAS_VALIDAS:
            if re.search(rf"(?<![A-Z0-9]){re.escape(categoria)}(?![A-Z0-9])", texto_upper):
                return categoria
        return ""

    def obter_categoria_bloco(indice_bloco):
        candidatos_xpath = (
            "//reservation-edit//*[self::span or self::div]["
            "contains(translate(normalize-space(.), 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), '1CSS') or "
            "contains(translate(normalize-space(.), 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), '1CC') or "
            "contains(translate(normalize-space(.), 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), '2CSS') or "
            "contains(translate(normalize-space(.), 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), '2CC') or "
            "contains(translate(normalize-space(.), 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), '3CS') or "
            "contains(translate(normalize-space(.), 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), 'SP')"
            "]"
        )

        categorias = []
        driver.switch_to.default_content()
        for elemento in driver.find_elements(By.XPATH, candidatos_xpath):
            try:
                if not elemento.is_displayed():
                    continue
                texto = elemento.text.strip()
                if not texto or len(texto) > 80:
                    continue
                categoria = normalizar_categoria(texto)
                if categoria and (not categorias or categorias[-1] != categoria):
                    categorias.append(categoria)
            except:
                continue

        if indice_bloco < len(categorias):
            return categorias[indice_bloco]
        return ""

    def clicar_apartamento_no_popup(ap_alvo):
        ap_literal = xpath_literal(str(ap_alvo).strip())
        container_xpath = "/html/body/div[1]/div/div/modal-reservation-edit-select-update-grouped-rooms/div[2]/div/div[5]"
        xpaths_busca = [
            f"{container_xpath}//button[contains(concat(' ', normalize-space(.), ' '), concat(' ', {ap_literal}, ' '))]",
            f"{container_xpath}//*[self::span or self::label][normalize-space(.)={ap_literal}]",
            f"//modal-reservation-edit-select-update-grouped-rooms//button[contains(concat(' ', normalize-space(.), ' '), concat(' ', {ap_literal}, ' '))]",
            f"//modal-reservation-edit-select-update-grouped-rooms//*[self::span or self::label][normalize-space(.)={ap_literal}]",
            f"//button[.//span[normalize-space(.)={ap_literal}] or normalize-space(.)={ap_literal}]",
            f"//span[normalize-space(.)={ap_literal}]",
        ]

        for xpath_busca in xpaths_busca:
            try:
                if not focar_quadro_do_elemento(xpath_busca, 3):
                    continue
                for elemento in driver.find_elements(By.XPATH, xpath_busca):
                    try:
                        if not elemento.is_displayed():
                            continue

                        clicavel = elemento
                        for ancestral_xpath in [
                            "./ancestor-or-self::button[1]",
                            "./ancestor::label[1]",
                            "./ancestor::*[contains(@class, 'btn')][1]",
                        ]:
                            try:
                                ancestral = elemento.find_element(By.XPATH, ancestral_xpath)
                                if ancestral and ancestral.is_displayed():
                                    clicavel = ancestral
                                    break
                            except:
                                pass

                        classe = clicavel.get_attribute("class") or ""
                        if clicavel.get_attribute("disabled") or "disabled" in classe:
                            continue

                        try:
                            ActionChains(driver).move_to_element(clicavel).click().perform()
                        except:
                            js_click(clicavel)
                        return True
                    except:
                        continue
            except:
                continue
        return False

    def fechar_modal_selecao_apartamento():
        xpaths_cancelar = [
            "//button[@ng-click='cancelRooms(reservationRoom)' or @title='Cancelar']",
            "/html/body/div[1]/div/div/modal-reservation-edit-select-update-grouped-rooms/div[3]/button[2]",
            "//*[@id='abandonUpdateRooms']"
        ]

        for xp_fechar in xpaths_cancelar:
            if focar_quadro_do_elemento(xp_fechar, 3):
                print("❌ Clicando no botão Cancelar/X...")
                js_click(driver.find_element(By.XPATH, xp_fechar))
                time.sleep(1.5)
                return True

        print("⚠️ Botão X bloqueado! Forçando fechamento com tecla ESC...")
        ActionChains(driver).send_keys(Keys.ESCAPE).perform()
        time.sleep(1.5)
        return False

    def fechar_aviso_modificado():
        try:
            xpath_ok_erro = "//button[contains(text(), 'OK')] | //button[@ng-click='closeModal()']"
            aviso = driver.find_elements(By.XPATH, xpath_ok_erro)
            if aviso and len(aviso) > 0:
                if aviso[0].is_displayed():
                    print("⚠️ Detectado pop-up 'Registro Modificado'. Fechando...")
                    js_click(aviso[0])
                    time.sleep(1.5)
                    return True
        except: pass
        return False

    def confirmar_acao(is_overbooking=False):
        time.sleep(1) 
        fechar_aviso_modificado() 
        if is_overbooking:
            xpath_conf_over = "/html/body/div[1]/div/div/modal-update-room-type/div[6]/button[1]"
            if focar_quadro_do_elemento(xpath_conf_over, 10):
                js_click(driver.find_element(By.XPATH, xpath_conf_over))
                print("✅ Confirmação de overbooking enviada!")
                time.sleep(2)
                fechar_aviso_modificado()
                return True
        else:
            xpath_btn_confirmar = "//button[@ng-click='saveRooms(reservationRoom)' or @title='Confirmar']"
            if focar_quadro_do_elemento(xpath_btn_confirmar, 10):
                botao = driver.find_element(By.XPATH, xpath_btn_confirmar)
                try: botao.click()
                except: js_click(botao)
                print("✅ Confirmação de vinculação enviada!")
                time.sleep(2)
                fechar_aviso_modificado()
                return True
            else:
                xpath_fallback = "/html/body/div[1]/div/div/modal-reservation-edit-select-update-grouped-rooms/div[3]/button[1]"
                if focar_quadro_do_elemento(xpath_fallback, 5):
                    js_click(driver.find_element(By.XPATH, xpath_fallback))
                    print("✅ Confirmação enviada (via fallback)!")
                    time.sleep(2)
                    fechar_aviso_modificado()
                    return True
        return False

    def obter_dados():
        print("📡 Lendo 'VINCULACAO_HOJE' (Voucher, Apartamento, Categoria) via OAuth...")
        escopos = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
        creds = None
        
        diretorio_atual = os.path.dirname(os.path.abspath(__file__))
        caminho_token = os.path.join(diretorio_atual, 'token.json')
        caminho_secret = os.path.join(diretorio_atual, 'client_secret.json')
        
        if os.path.exists(caminho_token):
            creds = Credentials.from_authorized_user_file(caminho_token, escopos)
            
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(caminho_secret, escopos)
                creds = flow.run_local_server(port=0)
                
            with open(caminho_token, 'w') as token:
                token.write(creds.to_json())

        cliente = gspread.authorize(creds)
        aba = cliente.open_by_key(ID_PLANILHA).worksheet(NOME_ABA)
        
        linhas = aba.get_all_values()[1:]
        agrupados = {}
        
        for linha in linhas:
            if len(linha) >= 3:
                v_s = str(linha[0]).strip() 
                a_s = str(linha[1]).strip() 
                c_s = str(linha[2]).strip().upper() 
                
                if v_s and a_s and c_s:
                    if v_s not in agrupados: agrupados[v_s] = []
                    agrupados[v_s].append({"ap": a_s, "cat": c_s})
        return agrupados

    try:
        dados = obter_dados()
        driver.get(URL_HITS)
        wait.until(EC.visibility_of_element_located((By.ID, "Email"))).send_keys(os.environ["HITS_EMAIL"])
        driver.find_element(By.ID, "Password").send_keys(os.environ["HITS_PASSWORD"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        
        js_click(wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="menuPrimary"]/a'))))
        time.sleep(1); js_click(wait.until(EC.presence_of_element_located((By.XPATH, '//*[@id="menureservation"]'))))
        time.sleep(1); js_click(wait.until(EC.presence_of_element_located((By.XPATH, '//*[@id="menureservations"]/a'))))
        
        focar_quadro_do_elemento('//*[@id="one-search-filters-container"]', 20)
        
        print("🧹 Limpando filtro de datas inicial...")
        xpath_limpar_datas = '//*[@id="one-search-filters-container"]/div[1]/button[3]/em'
        if focar_quadro_do_elemento(xpath_limpar_datas, 10):
            js_click(driver.find_element(By.XPATH, xpath_limpar_datas))
            time.sleep(1)
            esperar_loading_sumir()

        for voucher, lista_aps in dados.items():
            print(f"\n🚀 VOUCHER: {voucher} | Requisições na planilha: {len(lista_aps)}")
            driver.switch_to.default_content()
            esperar_loading_sumir()
            
            if focar_quadro_do_elemento('//*[@id="one-search-filters-container"]/div[2]/span[5]/one-translate', 10):
                js_click(driver.find_element(By.XPATH, '//*[@id="one-search-filters-container"]/div[2]/span[5]/one-translate')); time.sleep(1)
                
                input_v = driver.find_element(By.XPATH, '//*[@id="one-search-modal-content"]/div/input')
                js_click(input_v)
                input_v.send_keys(Keys.CONTROL + "a"); input_v.send_keys(Keys.DELETE); input_v.send_keys(voucher); time.sleep(0.5)
                js_click(driver.find_element(By.XPATH, '/html/body/div[1]/div/div/div[4]/button'))
                time.sleep(2); esperar_loading_sumir(); time.sleep(1) 
            
            aps_necessarios = [d["ap"] for d in lista_aps]
            todos_vinculados_corretamente = True
            
            print("🔎 Verificando se os apartamentos já estão vinculados na tela...")
            for ap in aps_necessarios:
                xpath_check_tela = f"//div[contains(@class, 'ui-grid-cell-contents') and contains(text(), '{ap}')]"
                if not driver.find_elements(By.XPATH, xpath_check_tela):
                    todos_vinculados_corretamente = False
                    break

            if todos_vinculados_corretamente:
                print(f"✨ Todos os apartamentos ({aps_necessarios}) já estão perfeitamente vinculados! Pulando voucher...")
                continue

            print("⚠️ Algum apartamento faltando ou errado. Abrindo reserva para correção...")
            
            xpath_lapis = "(//div[contains(@class, 'ui-grid-row')]//div[contains(@class, 'ui-grid-cell')]//a)[1]"
            if focar_quadro_do_elemento(xpath_lapis, 20):
                js_click(driver.find_element(By.XPATH, xpath_lapis))
                
                focar_quadro_do_elemento("//button[contains(@id, 'btnRoomSelectInEdit')]", 15)

                xpath_qtd_grupo = '//*[@id="summaryRoomTypesReservation"]/div[3]/div[2]/span[2]'
                qtd_quartos_reserva = 1
                if focar_quadro_do_elemento(xpath_qtd_grupo, 5):
                    try: qtd_quartos_reserva = int(driver.find_element(By.XPATH, xpath_qtd_grupo).text.strip())
                    except: pass
                
                print(f"🏨 Status da Reserva: Contém {qtd_quartos_reserva} quarto(s). Validando com os {len(lista_aps)} requeridos na planilha...")

                for i, dados_alvo in enumerate(lista_aps):
                    ap_alvo = dados_alvo["ap"]
                    cat_alvo = dados_alvo["cat"]
                    
                    print(f"\n🔄 Processando Quarto {i+1} -> Destino: {ap_alvo} (Cat: {cat_alvo})")
                    
                    botoes_cama = driver.find_elements(By.XPATH, "//button[contains(@id, 'btnRoomSelectInEdit')]")
                    if i >= len(botoes_cama):
                        print(f"⚠️ Erro: Não há ícones de cama suficientes para processar o {i+1}º quarto. Parando este voucher.")
                        break
                        
                    btn_c = botoes_cama[i]
                    
                    if btn_c.get_attribute("disabled") or "disabled" in (btn_c.get_attribute("class") or ""):
                        print(f"🔒 Cama {i+1} bloqueada (Provável Check-in realizado). Pulando...")
                        continue

                    cat_bloco_atual = obter_categoria_bloco(i)
                    if cat_bloco_atual:
                        print(f"🏷️ Categoria atual do bloco {i+1}: {cat_bloco_atual}")
                    else:
                        print(f"⚠️ Não consegui identificar a categoria atual do bloco {i+1}.")
                    
                    js_click(btn_c)
                    focar_quadro_do_elemento("//button[contains(@id, 'btnRoomSelectInEdit')]", 10)
                    time.sleep(1.5) 

                    quarto_vinculado_btn = None
                    botoes_tela = driver.find_elements(By.XPATH, "//button[contains(@id, 'btnRoomSelectInEdit')]")
                    for btn in botoes_tela:
                        classes = btn.get_attribute("class") or ""
                        icones_check = btn.find_elements(By.XPATH, ".//*[contains(@class, 'fa-check') or contains(@class, 'check')]")
                        if any(icone.is_displayed() for icone in icones_check) or "btn-success" in classes:
                            quarto_vinculado_btn = btn
                            break

                    if quarto_vinculado_btn:
                        if ap_alvo in quarto_vinculado_btn.text:
                            print(f"✨ A cama já está com o AP {ap_alvo} marcado. Confirmando e seguindo...")
                            confirmar_acao(is_overbooking=False)
                            time.sleep(1.5)
                            continue 

                        print(f"🧹 Desmarcando quarto errado/antigo ({quarto_vinculado_btn.text.strip()})...")
                        js_click(quarto_vinculado_btn); time.sleep(1)
                        if confirmar_acao(is_overbooking=False):
                            print("✅ Desvinculação inicial concluída."); time.sleep(1)
                            botoes_cama_novos = driver.find_elements(By.XPATH, "//button[contains(@id, 'btnRoomSelectInEdit')]")
                            js_click(botoes_cama_novos[i]); time.sleep(1.5)

                    ap_literal = xpath_literal(str(ap_alvo).strip())
                    xpath_alvo_vinc = f"//button[.//span[normalize-space(.)={ap_literal}] or normalize-space(.)={ap_literal}] | //span[normalize-space(.)={ap_literal}]"
                    elementos_presentes = driver.find_elements(By.XPATH, xpath_alvo_vinc)

                    if elementos_presentes:
                        print(f"🎯 Selecionando {ap_alvo} na tela atual...")
                        try: ActionChains(driver).move_to_element(elementos_presentes[0]).click().perform()
                        except: js_click(elementos_presentes[0])
                        time.sleep(1.5)
                        confirmar_acao(is_overbooking=False)
                        time.sleep(1.5)
                        continue 

                    if clicar_apartamento_no_popup(ap_alvo):
                        print(f"🎯 Selecionando {ap_alvo} no pop-up de apartamentos agrupados...")
                        time.sleep(1.5)
                        confirmar_acao(is_overbooking=False)
                        time.sleep(1.5)
                        continue

                    if cat_bloco_atual and cat_bloco_atual == cat_alvo:
                        print(
                            f"🛑 Overbooking bloqueado: bloco {i+1} já é da categoria {cat_bloco_atual}, "
                            f"igual à planilha ({cat_alvo}). O AP {ap_alvo} deveria estar no pop-up normal."
                        )
                        fechar_modal_selecao_apartamento()
                        driver.switch_to.default_content()
                        esperar_loading_sumir()
                        continue

                    print(f"⚠️ AP {ap_alvo} não encontrado. Fechando modal e iniciando OVERBOOKING na Cama {i+1}...")
                    
                    fechar_modal_selecao_apartamento()
                        
                    driver.switch_to.default_content()
                    esperar_loading_sumir()
                    
                    xpath_setas = "//button[@title='Atualizar/realizar upgrade' or contains(@ng-click, 'openUpdateGroupedRooms') or .//em[text()='compare_arrows']]"
                    
                    if focar_quadro_do_elemento(xpath_setas, 10):
                        setas = driver.find_elements(By.XPATH, xpath_setas)
                        if i < len(setas):
                            print(f"🔄 Entrando na tela de Overbooking do bloco {i+1}...")
                            js_click(setas[i]); time.sleep(1.5)
                            
                            xpath_edit = '//*[@id="reservations"]/div[3]/reservation-update-grouped-rooms-component/div[2]/div[2]/div[1]/div[1]/div[2]/button'
                            if focar_quadro_do_elemento(xpath_edit, 15):
                                print("✏️ Abrindo edição da categoria...")
                                js_click(driver.find_element(By.XPATH, xpath_edit)); time.sleep(1)
                                
                                xpath_btn1 = '/html/body/div[1]/div/div/modal-update-room-type/div[2]/div[2]/div[2]/div/button[1]'
                                if focar_quadro_do_elemento(xpath_btn1, 10):
                                    js_click(driver.find_element(By.XPATH, xpath_btn1)); time.sleep(1)
                                    
                                    xpath_lupa = '/html/body/div[1]/div/div/modal-update-room-type/div[2]/div[2]/div[2]/div/button[2]'
                                    if focar_quadro_do_elemento(xpath_lupa, 10):
                                        print("🔍 Clicando na lupa de categorias...")
                                        js_click(driver.find_element(By.XPATH, xpath_lupa)); time.sleep(1)
                                        
                                        if cat_alvo in XPATH_CATS:
                                            if focar_quadro_do_elemento(XPATH_CATS[cat_alvo], 10):
                                                js_click(driver.find_element(By.XPATH, XPATH_CATS[cat_alvo])); time.sleep(1.5)
                                                
                                                xpath_final_ap = f"//button[.//span[text()='{ap_alvo}'] | text()='{ap_alvo}'] | //div[contains(@class, 'room')]//span[text()='{ap_alvo}']"
                                                if focar_quadro_do_elemento(xpath_final_ap, 15):
                                                    print(f"🎯 AP {ap_alvo} encontrado! Vinculando...")
                                                    el_ap_over = driver.find_element(By.XPATH, xpath_final_ap)
                                                    try: ActionChains(driver).move_to_element(el_ap_over).click().perform()
                                                    except: js_click(el_ap_over)
                                                    
                                                    time.sleep(2) 
                                                    confirmar_acao(is_overbooking=True)
                                                    
                                                    esperar_loading_sumir()
                                                    print("🔙 Retornando da tela de Overbooking para a aba da reserva...")
                                                    xpath_voltar_apos_overbooking = "//*[@id='abandonUpdateRooms']"
                                                    if focar_quadro_do_elemento(xpath_voltar_apos_overbooking, 5):
                                                        js_click(driver.find_element(By.XPATH, xpath_voltar_apos_overbooking))
                                                        time.sleep(1.5)
                                                        esperar_loading_sumir()

                                                else: print(f"⚠️ Erro: AP {ap_alvo} não encontrado no Overbooking.")
                                            else: print(f"⚠️ Erro: Categoria {cat_alvo} indisponível ou XPath incorreto.")
                                        else: print(f"⚠️ Erro Crítico: Categoria '{cat_alvo}' não configurada!")
                                    else: print("⚠️ Erro: Lupa não encontrada.")
                                else: print("⚠️ Erro: Botão 1 não encontrado.")
                            else: print("⚠️ Erro: Botão Lápis (Edição de Categoria) não encontrado.")
                        else: print(f"⚠️ Erro: Seta de overbooking não encontrada para o bloco {i+1}.")
                    else:
                        print("⚠️ Erro FATAL: O botão de Seta (Overbooking) não apareceu na tela principal!")

                print("⬅️ Concluídos os quartos deste Voucher. Retornando ao mapa principal...")
                if focar_quadro_do_elemento('//*[@id="cancelReservation"]', 10):
                    js_click(driver.find_element(By.ID, "cancelReservation")); time.sleep(2)
                    esperar_loading_sumir()

    except Exception as e: print(f"❌ Erro Crítico: {e}")
    finally: driver.quit(); print("🏁 Fim.")

if __name__ == "__main__":
    executar_vinculacao_2_0()
