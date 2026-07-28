import argparse
import getpass
import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, StaleElementReferenceException


def executar_ciclos_limpeza(
    preparar_e_abrir_mapa,
    varrer_mapa_reservas,
    fechar_mapa_reservas,
    registrar_limpos=None,
):
    ciclo = 1
    total_limpo = 0

    while True:
        preparar_e_abrir_mapa()
        limpos_no_ciclo = varrer_mapa_reservas(ciclo)
        total_limpo += limpos_no_ciclo
        if registrar_limpos:
            registrar_limpos(limpos_no_ciclo)

        if not fechar_mapa_reservas():
            raise RuntimeError("Mapa de Reservas nao foi fechado apos a varredura.")

        if limpos_no_ciclo == 0:
            print("Ciclo de conferencia sem apartamentos para desvincular. Encerrando limpeza.")
            return total_limpo

        print("Foram feitas desvinculacoes. Reiniciando o mapa para conferir novamente por seguranca.")
        ciclo += 1


def executar_limpeza(headless=None, pausa_rolagem=1.0, pausa_acao=1.0):
    print("VARREDURA OTIMIZADA: LIMPEZA DO MAPA DE RESERVAS")

    URL_PADRAO = "https://susceptor.apphotel.one/account/login?returnUrl=%2Fconnect%2Fauthorize%2Flogin%3Fresponse_type%3Did_token%2520token%26client_id%3DB37748FC-ED13-4858-AE26-28AB3512A171%26redirect_uri%3Dhttps%253A%252F%252Fnacionalinn.hitspms.net%252FCallback%26scope%3Dopenid%2520profile%2520webapi%26nonce%3DN0.55369222377805221769641701210%26state%3D17696417012100.3264555900859101"

    chrome_options = Options()
    chrome_options.add_argument("--start-maximized")
    usar_headless = os.getenv("ROBOT_HEADLESS", "1") != "0" if headless is None else bool(headless)
    if usar_headless:
        chrome_options.add_argument("--headless=new")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)

    wait = WebDriverWait(driver, 45)
    wait_medio = WebDriverWait(driver, 8)
    wait_rapido = WebDriverWait(driver, 2)

    contador_limpeza = 0

    def js_click(elemento):
        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'center'});", elemento)
        driver.execute_script("arguments[0].click();", elemento)

    def aguardar_overlay_sumir(timeout=15):
        try:
            WebDriverWait(driver, timeout).until(
                EC.invisibility_of_element_located((By.CLASS_NAME, "block-ui-overlay"))
            )
        except TimeoutException:
            pass

    def clicar_primeiro_disponivel(localizadores, timeout=10, descricao="elemento"):
        ultimo_erro = None
        for by, valor in localizadores:
            try:
                elemento = WebDriverWait(driver, timeout).until(EC.element_to_be_clickable((by, valor)))
                js_click(elemento)
                return True
            except Exception as erro:
                ultimo_erro = erro
        print(f"Nao consegui clicar em {descricao}. Ultimo erro: {ultimo_erro}")
        return False

    def localizar_clicavel(by, valor, timeout=2):
        try:
            return WebDriverWait(driver, timeout).until(EC.element_to_be_clickable((by, valor)))
        except Exception:
            return None

    def navegar_ate_mapa(tentativas=3):
        ultimo_erro = None

        for tentativa in range(1, tentativas + 1):
            try:
                print(f"Navegando ate o Mapa de Reservas (tentativa {tentativa}/{tentativas})...")
                driver.switch_to.default_content()
                aguardar_overlay_sumir(timeout=20)

                localizador_new_chart = (By.XPATH, '//*[@id="menunewChart"]/a')
                new_chart = localizar_clicavel(*localizador_new_chart, timeout=2)

                if new_chart is None:
                    front_desk = localizar_clicavel(By.ID, "menufrontdesk", timeout=2)
                    if front_desk is None:
                        if not clicar_primeiro_disponivel(
                            [(By.XPATH, '//*[@id="menuPrimary"]/a')],
                            timeout=10,
                            descricao="menu principal",
                        ):
                            raise TimeoutException("Menu principal nao localizado/clicavel.")
                        aguardar_overlay_sumir(timeout=10)
                        front_desk = localizar_clicavel(By.ID, "menufrontdesk", timeout=5)

                    new_chart = localizar_clicavel(*localizador_new_chart, timeout=2)
                    if new_chart is None:
                        if front_desk is None:
                            raise TimeoutException("Front Desk nao localizado/clicavel.")
                        js_click(front_desk)
                        new_chart = WebDriverWait(driver, 10).until(
                            EC.element_to_be_clickable(localizador_new_chart)
                        )

                js_click(new_chart)
                wait.until(EC.presence_of_element_located((By.TAG_NAME, "new-chart-timeline")))
                aguardar_overlay_sumir(timeout=20)
                print("Modulo do Mapa de Reservas carregado.")
                return
            except Exception as erro:
                ultimo_erro = erro
                print(f"Falha ao navegar para o mapa na tentativa {tentativa}: {erro}")
                if tentativa < tentativas:
                    time.sleep(max(1.0, pausa_acao))

        raise TimeoutException(
            f"Nao foi possivel navegar ate o Mapa de Reservas. Ultimo erro: {ultimo_erro}"
        )

    def abrir_mapa_reservas():
        print("Aguardando botao do Mapa de Reservas...")
        driver.switch_to.default_content()

        localizadores_mapa = [
            (By.XPATH, "/html/body/div[3]/div/main/div[56]/div[1]/new-chart-timeline/div/div/div[1]/div[1]/div/div/div/button[1]"),
            (By.XPATH, "/html/body/div[3]/div/main/div[57]/div[1]/new-chart-timeline/div/div/div[1]/div[1]/div/div/div/button[1]"),
            (By.XPATH, "//new-chart-timeline//button[1]"),
            (By.CSS_SELECTOR, "new-chart-timeline button"),
        ]

        if not clicar_primeiro_disponivel(localizadores_mapa, timeout=15, descricao="Mapa de Reservas"):
            raise TimeoutException("Botao do Mapa de Reservas nao localizado/clicavel.")

        wait.until(EC.presence_of_element_located((By.CLASS_NAME, "scheduler_default_scrollable")))
        aguardar_overlay_sumir(timeout=15)
        print("Mapa aberto.")

    def fechar_mapa_reservas():
        print("Fechando Mapa de Reservas...")
        driver.switch_to.default_content()
        try:
            botao_fechar = WebDriverWait(driver, 8).until(
                EC.element_to_be_clickable((By.XPATH, '//*[@id="closeTabnewChart"]'))
            )
            js_click(botao_fechar)
            aguardar_overlay_sumir(timeout=15)
            time.sleep(1)
            print("Mapa fechado.")
            return True
        except TimeoutException:
            print("Botao de fechar mapa nao apareceu; seguindo com a finalizacao.")
            return False
        except Exception as erro:
            print(f"Nao consegui fechar o mapa: {erro}")
            return False

    def preparar_e_abrir_mapa(tentativas=2):
        ultimo_erro = None

        for tentativa in range(1, tentativas + 1):
            try:
                navegar_ate_mapa()
                abrir_mapa_reservas()
                return
            except Exception as erro:
                ultimo_erro = erro
                print(f"Falha ao preparar e abrir o mapa na tentativa {tentativa}: {erro}")
                if tentativa < tentativas:
                    time.sleep(max(1.0, pausa_acao))

        raise TimeoutException(
            f"Mapa de Reservas nao abriu apos {tentativas} tentativas. Ultimo erro: {ultimo_erro}"
        )

    def rolar_mapa_inteligente(pixels):
        try:
            scroll_div = wait_medio.until(
                EC.presence_of_element_located((By.CLASS_NAME, "scheduler_default_scrollable"))
            )
            posicao_antes = driver.execute_script("return arguments[0].scrollTop;", scroll_div)
            driver.execute_script("arguments[0].scrollTop += arguments[1];", scroll_div, pixels)
            driver.execute_script("arguments[0].dispatchEvent(new Event('scroll'));", scroll_div)

            WebDriverWait(driver, 4, poll_frequency=0.1).until(
                lambda d: abs(d.execute_script("return arguments[0].scrollTop;", scroll_div) - posicao_antes) >= 5
            )

            posicao_depois = driver.execute_script("return arguments[0].scrollTop;", scroll_div)
            return abs(posicao_depois - posicao_antes) >= 5
        except TimeoutException:
            return False
        except Exception:
            driver.execute_script("window.scrollBy(0, arguments[0]);", pixels)
            return True

    def varrer_mapa_reservas(numero_ciclo):
        ids_processados = set()
        limpos_no_ciclo = 0
        xpath_container_botoes = "/html/body/div[1]/div/div/create-reservation-component/div/div[1]/div/div[3]/div/div/div[2]/button"
        xpath_confirmar_sim = "/html/body/div[6]/div[7]/div/button"

        scrolls_vazios = 0
        limite_scrolls_vazios = 20

        print(f"Iniciando ciclo de limpeza {numero_ciclo}...")

        while scrolls_vazios < limite_scrolls_vazios:
            try:
                wait_medio.until(EC.presence_of_element_located((By.CLASS_NAME, "scheduler_default_event_inner")))
            except TimeoutException:
                print("Nenhuma reserva visivel no mapa neste ciclo.")
                break

            reservas_visiveis = driver.find_elements(By.CLASS_NAME, "scheduler_default_event_inner")
            achou_algo_nesta_tela = False

            try:
                scroll_top = driver.execute_script(
                    "return document.querySelector('.scheduler_default_scrollable').scrollTop;"
                )
            except Exception:
                scroll_top = 0

            for res in reservas_visiveis:
                res_id_unico = None
                try:
                    loc = res.location

                    if loc["x"] > 4500:
                        continue

                    texto_res = res.text.strip()
                    if not texto_res:
                        continue

                    y_absoluto = loc["y"] + scroll_top
                    x_aprox = loc["x"] // 15
                    y_aprox = int(y_absoluto) // 15
                    res_id_unico = f"{texto_res}_{x_aprox}_{y_aprox}"

                    if res_id_unico in ids_processados:
                        continue

                    cor = res.value_of_css_property("background-color")
                    if "26, 193, 26" not in cor and "194, 86, 255" not in cor:
                        ids_processados.add(res_id_unico)
                        continue

                    nome_res = texto_res.replace("\n", " ")
                    print(f"Limpando: {nome_res}")

                    js_click(res)
                    driver.switch_to.default_content()

                    botoes_modal = wait_medio.until(
                        EC.presence_of_all_elements_located((By.XPATH, xpath_container_botoes))
                    )
                    qtd = len(botoes_modal)
                    indice_botao = 3 if qtd >= 3 else 2
                    xpath_final = (
                        "/html/body/div[1]/div/div/create-reservation-component/div/div[1]/div/div[3]/div/div/div[2]"
                        f"/button[{indice_botao}]"
                    )

                    js_click(wait_medio.until(EC.element_to_be_clickable((By.XPATH, xpath_final))))
                    js_click(wait_medio.until(EC.element_to_be_clickable((By.XPATH, xpath_confirmar_sim))))

                    wait_medio.until(EC.invisibility_of_element_located((By.XPATH, xpath_confirmar_sim)))
                    aguardar_overlay_sumir(timeout=15)

                    print("   Sucesso!")
                    limpos_no_ciclo += 1
                    achou_algo_nesta_tela = True
                    ids_processados.add(res_id_unico)
                    time.sleep(0.2)
                    break

                except (TimeoutException, StaleElementReferenceException) as click_err:
                    print(f"   Falha ao limpar reserva visivel: {click_err}")
                    try:
                        driver.execute_script("document.body.click();")
                    except Exception:
                        pass
                    if res_id_unico:
                        ids_processados.add(res_id_unico)
                except Exception:
                    continue

            if not achou_algo_nesta_tela:
                print("Rolando mapa para buscar mais quartos...")
                rolou_com_sucesso = rolar_mapa_inteligente(350)

                if not rolou_com_sucesso:
                    print("Fim da pagina detectado.")
                    break

                scrolls_vazios += 1
            else:
                scrolls_vazios = 0

        print(f"Ciclo {numero_ciclo} finalizado. Limpos no ciclo: {limpos_no_ciclo}")
        return limpos_no_ciclo

    try:
        driver.get(URL_PADRAO)
        print("Realizando login...")

        hits_email = os.getenv("HITS_EMAIL") or input("Digite o HITS_EMAIL: ").strip()
        hits_password = os.getenv("HITS_PASSWORD") or getpass.getpass("Digite o HITS_PASSWORD: ")
        if not hits_email or not hits_password:
            raise RuntimeError("HITS_EMAIL/HITS_PASSWORD não configurados.")
        wait.until(EC.visibility_of_element_located((By.ID, "Email"))).send_keys(hits_email)
        driver.find_element(By.ID, "Password").send_keys(hits_password)
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        aguardar_overlay_sumir(timeout=25)

        def registrar_limpos(limpos_no_ciclo):
            nonlocal contador_limpeza
            contador_limpeza += limpos_no_ciclo

        executar_ciclos_limpeza(
            preparar_e_abrir_mapa,
            varrer_mapa_reservas,
            fechar_mapa_reservas,
            registrar_limpos,
        )

    except Exception as e:
        print(f"Erro Geral: {e}")
        raise
    finally:
        print("\n" + "=" * 40)
        print(f"FIM DA VARREDURA! TOTAL LIMPO: {contador_limpeza}")
        print("=" * 40)
        driver.quit()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Robô de limpeza HITS")
    parser.add_argument("--headless", action="store_true", help="Executa o Chrome sem interface visual.")
    parser.add_argument("--visual", action="store_true", help="Força o Chrome visível.")
    parser.add_argument("--pausa-rolagem", type=float, default=1.0, help="Pausa de rolagem mantida por compatibilidade.")
    parser.add_argument("--pausa-acao", type=float, default=1.0, help="Pausa de ação mantida por compatibilidade.")
    args = parser.parse_args()

    modo_headless = None
    if args.headless:
        modo_headless = True
    elif args.visual:
        modo_headless = False

    executar_limpeza(
        headless=modo_headless,
        pausa_rolagem=args.pausa_rolagem,
        pausa_acao=args.pausa_acao,
    )
