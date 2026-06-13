import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def executar_limpeza():
    print("🚀 VARREDURA ULTRA OTIMIZADA: IGNORANDO PASSADO (MEMÓRIA ABSOLUTA)")
    
    URL_PADRAO = "https://susceptor.apphotel.one/account/login?returnUrl=%2Fconnect%2Fauthorize%2Flogin%3Fresponse_type%3Did_token%2520token%26client_id%3DB37748FC-ED13-4858-AE26-28AB3512A171%26redirect_uri%3Dhttps%253A%252F%252Fnacionalinn.hitspms.net%252FCallback%26scope%3Dopenid%2520profile%2520webapi%26nonce%3DN0.55369222377805221769641701210%26state%3D17696417012100.3264555900859101"

    chrome_options = Options()
    if os.environ.get("ROBOT_HEADLESS", "1") != "0":
        chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--disable-extensions")
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
    
    wait = WebDriverWait(driver, 45)
    wait_rapido = WebDriverWait(driver, 2) 

    ids_processados = set()
    contador_limpeza = 0

    def js_click(elemento):
        driver.execute_script("arguments[0].click();", elemento)

    def rolar_mapa_inteligente(pixels):
        try:
            scroll_div = driver.find_element(By.CLASS_NAME, "scheduler_default_scrollable")
            posicao_antes = driver.execute_script("return arguments[0].scrollTop;", scroll_div)
            driver.execute_script(f"arguments[0].scrollTop += {pixels};", scroll_div)
            driver.execute_script("arguments[0].dispatchEvent(new Event('scroll'));", scroll_div)
            time.sleep(1.5) 
            posicao_depois = driver.execute_script("return arguments[0].scrollTop;", scroll_div)
            if abs(posicao_depois - posicao_antes) < 5:
                return False 
            return True 
        except:
            driver.execute_script(f"window.scrollBy(0, {pixels});")
            return True 

    try:
        # --- PASSO 1: LOGIN E NAVEGAÇÃO ---
        driver.get(URL_PADRAO)
        print("🔑 Realizando Login...")
        wait.until(EC.visibility_of_element_located((By.ID, "Email"))).send_keys(os.environ["HITS_EMAIL"])
        driver.find_element(By.ID, "Password").send_keys(os.environ["HITS_PASSWORD"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        
        wait.until(EC.invisibility_of_element_located((By.CLASS_NAME, "block-ui-overlay")))

        print("🖱️ Navegando até o Mapa...")
        js_click(wait.until(EC.presence_of_element_located((By.XPATH, '//*[@id="menuPrimary"]/a'))))
        js_click(wait.until(EC.presence_of_element_located((By.ID, "menufrontdesk"))))
        js_click(wait.until(EC.presence_of_element_located((By.XPATH, '//*[@id="menunewChart"]/a'))))
        
        print("⏳ Aguardando Timeline...")
        xpath_btn_mapa = "/html/body/div[3]/div/main/div[57]/div[1]/new-chart-timeline/div/div/div[1]/div[1]/div/div/div/button[1]"
        driver.switch_to.default_content()
        try:
            js_click(wait.until(EC.element_to_be_clickable((By.XPATH, xpath_btn_mapa))))
            print("🎯 Mapa aberto!")
        except:
            pass

        print("⏳ Estabilizando carregamento (8s)...")
        time.sleep(8) 

        # --- PASSO 2: VARREDURA OTIMIZADA ---
        xpath_container_botoes = "/html/body/div[1]/div/div/create-reservation-component/div/div[1]/div/div[3]/div/div/div[2]/button"
        xpath_confirmar_sim = "/html/body/div[6]/div[7]/div/button"

        scrolls_vazios = 0
        limite_scrolls_vazios = 20 

        while scrolls_vazios < limite_scrolls_vazios:
            reservas_visiveis = driver.find_elements(By.CLASS_NAME, "scheduler_default_event_inner")
            achou_algo_nesta_tela = False
            
            # Lê a quantidade de scroll atual uma única vez por tela
            try:
                scroll_top = driver.execute_script("return document.querySelector('.scheduler_default_scrollable').scrollTop;")
            except:
                scroll_top = 0

            for res in reservas_visiveis:
                try:
                    loc = res.location
                    
                    # Corta caminho: Se estiver muito pra direita, nem lê o resto
                    if loc['x'] > 4500:
                        continue
                        
                    texto_res = res.text.strip()
                    if not texto_res:
                        continue
                    
                    # A MÁGICA ACONTECE AQUI: Soma a posição da tela com o quanto rolou
                    # Criando uma coordenada inquebrável para a reserva
                    y_absoluto = loc['y'] + scroll_top
                    
                    x_aprox = loc['x'] // 15
                    y_aprox = int(y_absoluto) // 15
                    
                    res_id_unico = f"{texto_res}_{x_aprox}_{y_aprox}"
                    
                    # Se já passou por essa reserva antes, pula IMEDIATAMENTE!
                    if res_id_unico in ids_processados:
                        continue 

                    # Só gasta processamento para ler a cor se for uma reserva inédita
                    cor = res.value_of_css_property("background-color")
                    if "26, 193, 26" in cor or "194, 86, 255" in cor:
                        nome_res = texto_res.replace('\n', ' ')
                        print(f"⚡ Limpando: {nome_res}")
                        
                        js_click(res)
                        driver.switch_to.default_content()
                        
                        botoes_modal = wait_rapido.until(EC.presence_of_all_elements_located((By.XPATH, xpath_container_botoes)))
                        qtd = len(botoes_modal)
                        xpath_final = "/html/body/div[1]/div/div/create-reservation-component/div/div[1]/div/div[3]/div/div/div[2]/button[3]" if qtd >= 3 else "/html/body/div[1]/div/div/create-reservation-component/div/div[1]/div/div[3]/div/div/div[2]/button[2]"
                        
                        try:
                            js_click(wait_rapido.until(EC.element_to_be_clickable((By.XPATH, xpath_final))))
                            js_click(wait_rapido.until(EC.element_to_be_clickable((By.XPATH, xpath_confirmar_sim))))
                            
                            wait_rapido.until(EC.invisibility_of_element_located((By.XPATH, xpath_confirmar_sim)))
                            
                            try:
                                WebDriverWait(driver, 15).until(EC.invisibility_of_element_located((By.CLASS_NAME, "block-ui-overlay")))
                            except:
                                pass 

                            print(f"   ✅ Sucesso!")
                            contador_limpeza += 1
                            achou_algo_nesta_tela = True
                            
                            ids_processados.add(res_id_unico)
                            time.sleep(0,5)
                            break 
                            
                        except Exception as click_err:
                            driver.execute_script("document.body.click();")
                            ids_processados.add(res_id_unico)
                    else:
                        # Se não for verde/roxo, marca como lido para nunca mais olhar
                        ids_processados.add(res_id_unico)
                except:
                    continue

            if not achou_algo_nesta_tela:
                print("🔄 Rolando mapa para buscar mais quartos...")
                rolou_com_sucesso = rolar_mapa_inteligente(350)
                
                if not rolou_com_sucesso:
                    print("🛑 Fim da página detectado.")
                    break
                
                time.sleep(2) 
                scrolls_vazios += 1
            else:
                scrolls_vazios = 0 

    except Exception as e:
        print(f"⚠️ Erro Geral: {e}")
    finally:
        print("\n" + "="*40)
        print(f"🏁 FIM DA VARREDURA! TOTAL LIMPO: {contador_limpeza}")
        print("="*40)
        driver.quit()

if __name__ == "__main__":
    executar_limpeza()