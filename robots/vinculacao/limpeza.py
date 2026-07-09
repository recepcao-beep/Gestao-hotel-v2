import os
import time
import re
from datetime import datetime, timedelta, timezone
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, StaleElementReferenceException
from speed import configure_fast_sleep
from hits_popup_guard import fechar_popups_hits, click_hits_seguro

configure_fast_sleep()


def executar_limpeza():
    print("VARREDURA OTIMIZADA: LIMPEZA DO MAPA DE RESERVAS")

    URL_PADRAO = "https://susceptor.apphotel.one/account/login?returnUrl=%2Fconnect%2Fauthorize%2Flogin%3Fresponse_type%3Did_token%2520token%26client_id%3DB37748FC-ED13-4858-AE26-28AB3512A171%26redirect_uri%3Dhttps%253A%252F%252Fnacionalinn.hitspms.net%252FCallback%26scope%3Dopenid%2520profile%2520webapi%26nonce%3DN0.55369222377805221769641701210%26state%3D17696417012100.3264555900859101"

    chrome_options = Options()
    if os.environ.get("ROBOT_HEADLESS", "1") != "0":
        chrome_options.add_argument("--headless=new")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
    else:
        chrome_options.add_argument("--start-maximized")
    chrome_options.add_argument("--disable-background-timer-throttling")
    chrome_options.add_argument("--disable-backgrounding-occluded-windows")
    chrome_options.add_argument("--disable-renderer-backgrounding")
    chrome_options.add_argument("--disable-features=CalculateNativeWinOcclusion")
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)

    wait = WebDriverWait(driver, 45)
    wait_medio = WebDriverWait(driver, 8)
    wait_rapido = WebDriverWait(driver, 2)

    ids_processados = set()
    contador_limpeza = 0
    data_protecao_aptos = os.environ.get("LIMPEZA_APTOS_PROTEGIDOS_DATA", "2026-06-17")
    hoje_sp = datetime.now(timezone(timedelta(hours=-3))).strftime("%Y-%m-%d")
    lista_aptos_protegidos = os.environ.get(
        "LIMPEZA_APTOS_PROTEGIDOS",
        "419,420,421,422,425,426,427,724,725,726,727,728,729,730,731,732",
    )
    if data_protecao_aptos and hoje_sp != data_protecao_aptos:
        lista_aptos_protegidos = ""
    aptos_protegidos = {apto.strip() for apto in lista_aptos_protegidos.split(",") if apto.strip()}
    if aptos_protegidos:
        print(f"Apartamentos protegidos da limpeza em {data_protecao_aptos}: {', '.join(sorted(aptos_protegidos))}")
    else:
        print("Sem apartamentos protegidos por data hoje.")

    def js_click(elemento):
        fechar_popups_hits(driver)
        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'center'});", elemento)
        try:
            driver.execute_script("arguments[0].click();", elemento)
        except Exception:
            fechar_popups_hits(driver)
            click_hits_seguro(driver, elemento)

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
                fechar_popups_hits(driver)
                elemento = WebDriverWait(driver, timeout).until(EC.element_to_be_clickable((by, valor)))
                js_click(elemento)
                return True
            except Exception as erro:
                ultimo_erro = erro
        print(f"Nao consegui clicar em {descricao}. Ultimo erro: {ultimo_erro}")
        return False

    def obter_apto_card():
        fim = time.time() + 3
        while time.time() < fim:
            try:
                texto = driver.execute_script("""
                    const cards = [...document.querySelectorAll('create-reservation-component')]
                      .filter(el => el.offsetParent !== null);
                    const card = cards[cards.length - 1];
                    return card ? (card.innerText || card.textContent || '') : '';
                """) or ""
                match = re.search(r"Apartamento\s+(\d{3})\b", texto)
                if match:
                    return match.group(1)
            except Exception:
                pass
            time.sleep(0.2)
        return ""

    def fechar_card_ativo():
        try:
            driver.execute_script("document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));")
            driver.execute_script("document.body.click();")
        except Exception:
            pass
        time.sleep(0.3)

    def abrir_mapa_reservas():
        print("Aguardando botao do Mapa de Reservas...")
        driver.switch_to.default_content()

        xpath_botao_mapa_reservas = (
            "/html/body/div[3]/div/main/div[56]/div[1]/new-chart-timeline"
            "/div/div/div[1]/div[1]/div/div/div/button[1]"
        )

        if not clicar_primeiro_disponivel(
            [(By.XPATH, xpath_botao_mapa_reservas)],
            timeout=25,
            descricao="botao exato do Mapa de Reservas",
        ):
            raise TimeoutException("Botao do Mapa de Reservas nao localizado/clicavel.")

        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "new-chart-timeline .scheduler_default_scrollable")))
        aguardar_overlay_sumir(timeout=15)
        print("Mapa aberto. Aguardando blocos carregarem...")

        fim = time.time() + 35
        while time.time() < fim:
            try:
                contagens = driver.execute_script("""
                    const scroll = document.querySelector('.scheduler_default_scrollable');
                    if (scroll) {
                      scroll.dispatchEvent(new Event('scroll', {bubbles: true}));
                      scroll.dispatchEvent(new WheelEvent('wheel', {deltaY: 1, bubbles: true}));
                    }
                    return {
                      inner: document.querySelectorAll('.scheduler_default_event_inner').length,
                      event: document.querySelectorAll('.scheduler_default_event').length,
                      bar: document.querySelectorAll('.scheduler_default_event_bar').length
                    };
                """)
                total_eventos = sum(int(v or 0) for v in contagens.values())
                if total_eventos > 0:
                    print(f"Blocos carregados: {contagens}")
                    return
            except Exception:
                pass
            time.sleep(1)

        print("Mapa abriu, mas nenhum bloco de reserva foi renderizado dentro do tempo.")

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

    try:
        driver.get(URL_PADRAO)
        print("Realizando login...")

        wait.until(EC.visibility_of_element_located((By.ID, "Email"))).send_keys(os.environ.get("HITS_EMAIL", "edivan.junior.app@vilageinn.com.br"))
        driver.find_element(By.ID, "Password").send_keys(os.environ.get("HITS_PASSWORD", "Edivan@123"))
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        aguardar_overlay_sumir(timeout=45)
        fechar_popups_hits(driver)

        print("Navegando ate o Mapa...")
        clicar_primeiro_disponivel([(By.XPATH, '//*[@id="menuPrimary"]/a')], timeout=20, descricao="menu principal")
        clicar_primeiro_disponivel([(By.ID, "menufrontdesk")], timeout=20, descricao="front desk")
        clicar_primeiro_disponivel([(By.XPATH, '//*[@id="menunewChart"]/a')], timeout=20, descricao="new chart")

        abrir_mapa_reservas()

        xpath_container_botoes = "/html/body/div[1]/div/div/create-reservation-component/div/div[1]/div/div[3]/div/div/div[2]/button"
        xpath_confirmar_sim = "/html/body/div[6]/div[7]/div/button"

        scrolls_vazios = 0
        limite_scrolls_vazios = 20

        while scrolls_vazios < limite_scrolls_vazios:
            try:
                wait_medio.until(EC.presence_of_element_located((By.CLASS_NAME, "scheduler_default_event_inner")))
                reservas_visiveis = driver.find_elements(By.CLASS_NAME, "scheduler_default_event_inner")
            except TimeoutException:
                wait_medio.until(EC.presence_of_element_located((By.CLASS_NAME, "scheduler_default_event")))
                reservas_visiveis = driver.find_elements(By.CLASS_NAME, "scheduler_default_event")
            achou_algo_nesta_tela = False

            try:
                scroll_top = driver.execute_script(
                    "return document.querySelector('.scheduler_default_scrollable').scrollTop;"
                )
            except Exception:
                scroll_top = 0

            for res in reservas_visiveis:
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

                    apto_card = obter_apto_card()
                    if apto_card in aptos_protegidos:
                        print(f"   Protegido por chegada hoje: apto {apto_card}. Pulando.")
                        fechar_card_ativo()
                        ids_processados.add(res_id_unico)
                        continue

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
                    fechar_card_ativo()

                    print("   Sucesso!")
                    contador_limpeza += 1
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

    except Exception as e:
        print(f"Erro Geral: {e}")
    finally:
        print("\n" + "=" * 40)
        print(f"FIM DA VARREDURA! TOTAL LIMPO: {contador_limpeza}")
        print("=" * 40)
        driver.quit()


if __name__ == "__main__":
    executar_limpeza()
