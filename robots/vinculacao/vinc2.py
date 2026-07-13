import argparse
import json
import getpass
import os
import time
import re
from pathlib import Path
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from selenium.common.exceptions import TimeoutException, StaleElementReferenceException


def executar_vinculacao_2_0(headless=None, fator_pausa=0.8):
    ID_PLANILHA = "1oMKFu9aobTP5sBuF0jjSR4In3Z6EcWfATCe_9ijNFXA"
    NOME_ABA = "VINCULACAO_HOJE"
    ARQUIVO_JSON = Path(__file__).resolve().parent / "automacao-mapinha-cb0bced39056.json"

    if headless is None:
        headless = (
            os.getenv("GITHUB_ACTIONS", "").lower() == "true"
            or os.getenv("ROBOT_HEADLESS", "").lower() in {"1", "true", "yes", "sim"}
        )

    fator_pausa = max(0.6, float(fator_pausa))

    def pausar(segundos):
        time.sleep(max(0.10, float(segundos) * fator_pausa))

    URL_HITS = "https://susceptor.apphotel.one/account/login?returnUrl=%2Fconnect%2Fauthorize%2Flogin%3Fresponse_type%3Did_token%2520token%26client_id%3DB37748FC-ED13-4858-AE26-28AB3512A171%26redirect_uri%3Dhttps%253A%252F%252Fnacionalinn.hitspms.net%252FCallback%26scope%3Dopenid%2520profile%2520webapi%26nonce%3DN0.28324722615515141770822279499%26state%3D17708222794990.2983837305966167"

    XPATH_CATS = {
        "3CS": "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[1]",
        "1CSS": "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[2]",
        "1CC": "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[3]",
        "2CSS": "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[4]",
        "2CC": "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[5]",
        "SP": "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[6]",
    }

    CATEGORIAS_COM_SACADA = {"1CC", "1CSS"}
    CATEGORIAS_SEM_SACADA = {"2CC", "2CSS"}
    CATEGORIAS_ISOLADAS = {"SP", "3CS"}
    CATEGORIAS_VALIDAS = sorted(XPATH_CATS.keys(), key=len, reverse=True)

    chrome_options = Options()
    chrome_options.add_argument("--start-maximized")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--disable-extensions")

    if headless:
        chrome_options.add_argument("--headless=new")
        chrome_options.add_argument("--window-size=1920,1080")

    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()),
        options=chrome_options,
    )

    print(
        f"Modo: {'HEADLESS/GITHUB ACTIONS' if headless else 'VISUAL'} | "
        f"Fator de pausa: {fator_pausa}"
    )
    wait = WebDriverWait(driver, 20)
    wait_medio = WebDriverWait(driver, 10)
    wait_rapido = WebDriverWait(driver, 3)

    def js_click(elemento):
        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'center'});", elemento)
        driver.execute_script("arguments[0].click();", elemento)

    def focar_quadro_do_elemento(xpath_alvo, tempo_maximo=15):
        fim = time.time() + tempo_maximo
        ultimo_erro = None

        while time.time() < fim:
            driver.switch_to.default_content()
            if driver.find_elements(By.XPATH, xpath_alvo):
                return True

            iframes = driver.find_elements(By.TAG_NAME, "iframe")
            for i in range(len(iframes)):
                try:
                    driver.switch_to.default_content()
                    driver.switch_to.frame(i)
                    if driver.find_elements(By.XPATH, xpath_alvo):
                        return True
                except Exception as erro:
                    ultimo_erro = erro

            pausar(0.2)

        driver.switch_to.default_content()
        if ultimo_erro:
            print(f"Ultimo erro ao procurar quadro: {ultimo_erro}")
        return False

    def esperar_loading_sumir(timeout=15):
        try:
            WebDriverWait(driver, timeout).until(
                EC.invisibility_of_element_located((By.CLASS_NAME, "block-ui-overlay"))
            )
        except TimeoutException:
            pass

    def clicar_quando_pronto(xpath, timeout=10, descricao="elemento"):
        fim = time.time() + timeout
        ultimo_erro = None

        while time.time() < fim:
            if not focar_quadro_do_elemento(xpath, 2):
                ultimo_erro = f"{descricao} nao encontrado"
                pausar(0.2)
                continue

            try:
                botao = WebDriverWait(driver, 2, poll_frequency=0.2).until(
                    EC.element_to_be_clickable((By.XPATH, xpath))
                )
                try:
                    botao.click()
                except Exception:
                    js_click(botao)
                return True
            except StaleElementReferenceException as erro:
                ultimo_erro = erro
                pausar(0.2)
            except Exception as erro:
                ultimo_erro = erro
                pausar(0.2)

        print(f"Nao consegui clicar em {descricao}: {ultimo_erro}")
        return False

    def fechar_aviso_modificado():
        try:
            xpath_ok_erro = "//button[contains(text(), 'OK')] | //button[@ng-click='closeModal()']"
            avisos = driver.find_elements(By.XPATH, xpath_ok_erro)
            for aviso in avisos:
                if aviso.is_displayed():
                    print("Detectado pop-up 'Registro Modificado'. Fechando...")
                    js_click(aviso)
                    esperar_loading_sumir(timeout=5)
                    return True
        except Exception:
            pass
        return False

    def confirmar_acao(is_overbooking=False, ap_overbooking=None):
        fechar_aviso_modificado()

        if is_overbooking:
            if ap_overbooking and not apartamento_overbooking_selecionado(ap_overbooking):
                print(f"Texto lido em Apartamento selecionado: '{texto_apartamento_selecionado_overbooking()}'")
                print(
                    f"BLOQUEADO: nao vou confirmar overbooking porque o AP {ap_overbooking} "
                    "nao aparece no campo 'Apartamento selecionado'."
                )
                return False

            print(f"AP selecionado validado para overbooking: {ap_overbooking}")
            if clicar_confirmacao_overbooking(timeout=10):
                print("Confirmacao de overbooking enviada!")
                esperar_loading_sumir(timeout=15)
                fechar_aviso_modificado()
                return True
            print("Nao consegui clicar no botao de confirmar overbooking.")
            return False

        xpath_btn_confirmar = "//button[@ng-click='saveRooms(reservationRoom)' or @title='Confirmar']"
        if clicar_quando_pronto(xpath_btn_confirmar, timeout=10, descricao="confirmacao de vinculacao"):
            print("Confirmacao de vinculacao enviada!")
            esperar_loading_sumir(timeout=15)
            fechar_aviso_modificado()
            return True

        xpath_fallback = "/html/body/div[1]/div/div/modal-reservation-edit-select-update-grouped-rooms/div[3]/button[1]"
        if clicar_quando_pronto(xpath_fallback, timeout=5, descricao="confirmacao fallback"):
            print("Confirmacao enviada via fallback!")
            esperar_loading_sumir(timeout=15)
            fechar_aviso_modificado()
            return True

        return False

    def obter_dados():
        print("Lendo 'VINCULACAO_HOJE' (Voucher, Apartamento, Categoria, Data)...")
        escopos_google = [
            "https://spreadsheets.google.com/feeds",
            "https://www.googleapis.com/auth/drive",
        ]

        service_account_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()

        if service_account_json:
            creds = ServiceAccountCredentials.from_json_keyfile_dict(
                json.loads(service_account_json),
                escopos_google,
            )
        else:
            creds = ServiceAccountCredentials.from_json_keyfile_name(
                str(ARQUIVO_JSON),
                escopos_google,
            )
        cliente = gspread.authorize(creds)
        aba = cliente.open_by_key(ID_PLANILHA).worksheet(NOME_ABA)

        linhas = aba.get_all_values()[1:]
        agrupados = {}

        for linha in linhas:
            if len(linha) < 3:
                continue

            v_s = str(linha[0]).strip()
            a_s = str(linha[1]).strip()
            c_s = str(linha[2]).strip().upper()

            data_in = str(linha[4]).strip() if len(linha) >= 5 else ""
            data_ui = ""
            if data_in and "/" in data_in:
                partes = data_in.split("/")
                if len(partes) >= 3:
                    data_ui = f"{partes[0].zfill(2)}/{partes[1].zfill(2)}/{partes[2][-2:]}"

            if v_s and a_s and c_s:
                agrupados.setdefault(v_s, []).append({"ap": a_s, "cat": c_s, "data_ui": data_ui})

        return agrupados

    def mesma_familia_sacada(cat_origem, cat_destino):
        if cat_origem in CATEGORIAS_COM_SACADA:
            return cat_destino in CATEGORIAS_COM_SACADA
        if cat_origem in CATEGORIAS_SEM_SACADA:
            return cat_destino in CATEGORIAS_SEM_SACADA
        if cat_origem in CATEGORIAS_ISOLADAS:
            return cat_destino == cat_origem
        return cat_origem == cat_destino

    def normalizar_categoria(texto):
        """Extrai 1CC, 1CSS, 2CC, 2CSS, 3CS ou SP de um texto da tela."""
        texto_upper = (texto or "").upper()

        for categoria in CATEGORIAS_VALIDAS:
            if re.search(
                rf"(?<![A-Z0-9]){re.escape(categoria)}(?![A-Z0-9])",
                texto_upper,
            ):
                return categoria

        return ""

    def texto_card_da_cama(botao_cama):
        """Lê o texto do card associado ao botão da cama sem clicar nele."""
        try:
            return driver.execute_script(
                """
                var node = arguments[0];
                while (node && node.parentNode) {
                    node = node.parentNode;
                    if (node.innerText && node.innerText.includes('In ')) {
                        return node.innerText;
                    }
                }
                return '';
                """,
                botao_cama,
            ) or ""
        except Exception:
            return ""

    def obter_categoria_bloco(indice_bloco, botao_cama=None, texto_card=""):
        """
        Descobre a categoria do bloco antes de abrir a seleção de apartamentos.

        Ordem:
        1. texto do próprio card selecionado;
        2. texto dos ancestrais do botão da cama;
        3. fallback recuperado do commit antigo, pela ordem dos blocos visíveis.
        """
        categoria = normalizar_categoria(texto_card)
        if categoria:
            return categoria

        if botao_cama is not None:
            categoria = normalizar_categoria(texto_card_da_cama(botao_cama))
            if categoria:
                return categoria

        candidatos_xpath = (
            "//reservation-edit//*[self::span or self::div]["
            "contains(translate(normalize-space(.), "
            "'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), '1CSS') or "
            "contains(translate(normalize-space(.), "
            "'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), '1CC') or "
            "contains(translate(normalize-space(.), "
            "'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), '2CSS') or "
            "contains(translate(normalize-space(.), "
            "'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), '2CC') or "
            "contains(translate(normalize-space(.), "
            "'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), '3CS') or "
            "contains(translate(normalize-space(.), "
            "'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), 'SP')"
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
            except Exception:
                continue

        if 0 <= indice_bloco < len(categorias):
            return categorias[indice_bloco]

        return ""

    def categoria_selecionada_bate_com_planilha(cat_alvo):
        xpath_categoria_atual = "/html/body/div[1]/div/div/modal-update-room-type/div[2]/div[2]/div[2]/div/button[1]"
        try:
            texto = driver.find_element(By.XPATH, xpath_categoria_atual).text.lower()
        except Exception:
            texto = ""

        if not texto:
            print("Nao consegui ler o texto da categoria selecionada; seguindo com cautela.")
            return True

        if cat_alvo in CATEGORIAS_COM_SACADA:
            ok = "com sacada" in texto
        elif cat_alvo in CATEGORIAS_SEM_SACADA:
            ok = "sem sacada" in texto
        elif cat_alvo == "SP":
            ok = "suite" in texto or "suíte" in texto or "presid" in texto
        elif cat_alvo == "3CS":
            ok = "adapt" in texto or "pcd" in texto
        else:
            ok = False

        if not ok:
            print(
                f"BLOQUEADO: categoria selecionada na tela ('{texto}') nao bate "
                f"com a categoria da planilha ({cat_alvo})."
            )
        return ok

    def aguardar_painel_apartamentos(ap_alvo, timeout=12):
        xpath_possiveis_aps = (
            f"//span[normalize-space(text())='{ap_alvo}']"
            f" | //div[normalize-space(text())='{ap_alvo}']"
            f" | //button[contains(normalize-space(), '{ap_alvo}')]"
            " | //modal-reservation-edit-select-update-grouped-rooms//*[contains(@class, 'room')]"
            " | //modal-reservation-edit-select-update-grouped-rooms//button"
        )

        print("Aguardando painel/lista de apartamentos carregar...")
        try:
            WebDriverWait(driver, timeout, poll_frequency=0.2).until(
                lambda d: len(d.find_elements(By.XPATH, xpath_possiveis_aps)) > 0
            )
            esperar_loading_sumir(timeout=8)
            return True
        except TimeoutException:
            return False

    def procurar_apartamento_na_tela(ap_alvo, timeout=12):
        xpath_alvo_vinc = (
            f"//span[normalize-space(text())='{ap_alvo}']"
            f" | //div[normalize-space(text())='{ap_alvo}']"
            f" | //button[contains(normalize-space(), '{ap_alvo}')]"
        )

        if not aguardar_painel_apartamentos(ap_alvo, timeout=timeout):
            print("Painel de apartamentos nao carregou dentro do tempo esperado.")
            return None

        fim = time.time() + timeout
        while time.time() < fim:
            elementos_presentes = driver.find_elements(By.XPATH, xpath_alvo_vinc)
            for elemento in elementos_presentes:
                try:
                    texto_elemento = elemento.text.strip()
                    partes = texto_elemento.split()
                    if texto_elemento == ap_alvo or texto_elemento.startswith(ap_alvo) or ap_alvo in partes:
                        return elemento
                except StaleElementReferenceException:
                    continue
            pausar(0.2)

        return None

    def fechar_modal_quartos():
        xpaths_cancelar = [
            "//button[@ng-click='cancelRooms(reservationRoom)' or @title='Cancelar']",
            "/html/body/div[1]/div/div/modal-reservation-edit-select-update-grouped-rooms/div[3]/button[2]",
            "//*[@id='abandonUpdateRooms']",
        ]

        for xp_fechar in xpaths_cancelar:
            if clicar_quando_pronto(xp_fechar, timeout=3, descricao="cancelar modal de quartos"):
                esperar_loading_sumir(timeout=8)
                return True

        ActionChains(driver).send_keys(Keys.ESCAPE).perform()
        esperar_loading_sumir(timeout=8)
        return False

    def elemento_clicavel_do_ap(elemento):
        clicavel = driver.execute_script(
            """
            var node = arguments[0];
            while (node && node !== document.body) {
                var tag = (node.tagName || '').toLowerCase();
                var cls = node.className || '';
                var ngClick = node.getAttribute && node.getAttribute('ng-click');
                var role = node.getAttribute && node.getAttribute('role');

                if (
                    tag === 'button' ||
                    tag === 'a' ||
                    ngClick ||
                    role === 'button' ||
                    String(cls).includes('room') ||
                    String(cls).includes('item') ||
                    String(cls).includes('list-group')
                ) {
                    return node;
                }
                node = node.parentElement;
            }
            return arguments[0];
            """,
            elemento,
        )
        return clicavel or elemento

    def texto_apartamento_selecionado_overbooking():
        xpath_area_selecionado = "/html/body/div[1]/div/div/modal-update-room-type/div[2]/div[5]/div[1]"
        try:
            area = driver.find_element(By.XPATH, xpath_area_selecionado)
            texto = driver.execute_script("return arguments[0].innerText || arguments[0].textContent || '';", area)
            return texto.replace("\n", " ").strip()
        except Exception:
            return ""

    def apartamento_overbooking_selecionado(ap_alvo):
        texto = texto_apartamento_selecionado_overbooking()
        if texto and ("Sem apartamento" in texto or "sem apartamento" in texto):
            return False
        if texto and texto_tem_ap(texto, ap_alvo):
            return True

        # Em alguns layouts do HITS, quando o apartamento e selecionado o chip
        # troca o icone/texto de "link" para "clear". Esse estado tambem e
        # selecao valida, mesmo quando a area "Apartamento selecionado" nao
        # atualiza o innerText do jeito esperado pelo Selenium.
        xpath_chip_selecionado = (
            "/html/body/div[1]/div/div/modal-update-room-type"
            f"//*[contains(normalize-space(.), 'clear') and contains(normalize-space(.), '{ap_alvo}')]"
        )
        try:
            return any(el.is_displayed() for el in driver.find_elements(By.XPATH, xpath_chip_selecionado))
        except Exception:
            return False

    def clicar_confirmacao_overbooking(timeout=10):
        fim = time.time() + timeout
        ultimo_erro = None
        xpaths_confirmar = [
            "/html/body/div[1]/div/div/modal-update-room-type/div[6]/button[1]",
            "//modal-update-room-type/div[6]/button[1]",
            "//modal-update-room-type//div[contains(@class, 'modal-footer')]//button[1]",
            "//modal-update-room-type//button[not(@disabled) and (.//em[contains(normalize-space(.), 'check')] or .//i[contains(@class, 'check')] or contains(@class, 'btn-success') or contains(@class, 'btn-primary'))]",
        ]

        while time.time() < fim:
            fechar_aviso_modificado()
            driver.switch_to.default_content()

            for xpath in xpaths_confirmar:
                if not focar_quadro_do_elemento(xpath, 1):
                    continue

                try:
                    botoes = driver.find_elements(By.XPATH, xpath)
                    for botao in botoes:
                        if not botao.is_displayed():
                            continue
                        if botao.get_attribute("disabled"):
                            ultimo_erro = "botao confirmar overbooking esta disabled"
                            continue

                        try:
                            botao.click()
                        except Exception:
                            js_click(botao)
                        return True
                except (StaleElementReferenceException, Exception) as erro:
                    ultimo_erro = erro
                    continue

            try:
                botao_footer = driver.execute_script(
                    """
                    var modal = document.querySelector('modal-update-room-type');
                    if (!modal) return null;
                    var footer = modal.children && modal.children.length >= 6 ? modal.children[5] : null;
                    if (!footer) return null;
                    var buttons = Array.from(footer.querySelectorAll('button')).filter(function(btn) {
                        return !btn.disabled && btn.offsetParent !== null;
                    });
                    return buttons.length ? buttons[0] : null;
                    """
                )
                if botao_footer:
                    js_click(botao_footer)
                    return True
            except Exception as erro:
                ultimo_erro = erro

            pausar(0.2)

        print(f"Falha ao confirmar overbooking. Ultimo erro: {ultimo_erro}")
        return False

    def clicar_ap_overbooking(ap_alvo, timeout=15):
        xpath_grade_disponiveis = "/html/body/div[1]/div/div/modal-update-room-type/div[2]/div[5]/div[2]"
        xpath_ap_disponivel = (
            f"{xpath_grade_disponiveis}/div"
            f"[.//*[normalize-space(text())='{ap_alvo}'] or normalize-space(.)='{ap_alvo}' "
            f"or contains(concat(' ', normalize-space(.), ' '), ' {ap_alvo} ')]"
        )
        xpath_ap_texto_disponivel = (
            f"{xpath_grade_disponiveis}//*[normalize-space(text())='{ap_alvo}' "
            f"or contains(concat(' ', normalize-space(.), ' '), ' {ap_alvo} ')]"
        )

        if not focar_quadro_do_elemento(xpath_ap_texto_disponivel, timeout):
            return False

        fim = time.time() + timeout
        ultimo_erro = None

        while time.time() < fim:
            elementos = driver.find_elements(By.XPATH, xpath_ap_disponivel)
            if not elementos:
                elementos = driver.find_elements(By.XPATH, xpath_ap_texto_disponivel)

            for elemento in elementos:
                try:
                    if not elemento.is_displayed():
                        continue

                    clicavel = driver.execute_script(
                        """
                        var node = arguments[0];
                        while (node && node.parentElement) {
                            if (node.parentElement.matches && node.parentElement.matches('modal-update-room-type div:nth-child(2) > div:nth-child(5) > div:nth-child(2)')) {
                                return node;
                            }
                            if (node.tagName && node.tagName.toLowerCase() === 'div' && node.innerText && node.innerText.trim().includes(arguments[1])) {
                                var r = node.getBoundingClientRect();
                                if (r.width > 20 && r.height > 15) return node;
                            }
                            node = node.parentElement;
                        }
                        return arguments[0];
                        """,
                        elemento,
                        ap_alvo,
                    )
                    clicavel = clicavel or elemento_clicavel_do_ap(elemento)
                    print(f"Clicando no item clicavel do AP {ap_alvo}: texto='{clicavel.text.strip()}'")
                    try:
                        ActionChains(driver).move_to_element(clicavel).click().perform()
                    except Exception:
                        js_click(clicavel)

                    try:
                        texto_pos_clique = (clicavel.text or "").strip()
                        if texto_tem_ap(texto_pos_clique, ap_alvo) and "clear" in texto_pos_clique.lower():
                            print(f"AP {ap_alvo} selecionado pelo estado do chip: '{texto_pos_clique}'")
                            return True
                    except Exception:
                        pass

                    try:
                        # Na tela de overbooking, o clique realmente funcionou quando
                        # a area correta de "Apartamento selecionado" passa a mostrar
                        # o numero escolhido. Nao use "following::*" aqui, porque isso
                        # tambem pega a lista de apartamentos disponiveis.
                        WebDriverWait(driver, 3, poll_frequency=0.2).until(
                            lambda d: apartamento_overbooking_selecionado(ap_alvo)
                        )
                        print(f"AP {ap_alvo} confirmado no campo Apartamento selecionado.")
                        return True
                    except TimeoutException:
                        # Alguns layouts exigem clicar no icone de corrente, que fica
                        # mais a direita dentro do chip do apartamento.
                        try:
                            ActionChains(driver).move_to_element_with_offset(clicavel, 35, 0).click().perform()
                            WebDriverWait(driver, 3, poll_frequency=0.2).until(
                                lambda d: apartamento_overbooking_selecionado(ap_alvo)
                            )
                            print(f"AP {ap_alvo} confirmado no campo Apartamento selecionado.")
                            return True
                        except Exception as erro:
                            ultimo_erro = erro
                            continue
                except (StaleElementReferenceException, Exception) as erro:
                    ultimo_erro = erro
                    continue

            pausar(0.2)

        print(f"Falha ao clicar no AP {ap_alvo} no overbooking. Ultimo erro: {ultimo_erro}")
        return False

    def recuperar_tela_apos_overbooking():
        xpaths_saida = [
            "//*[@id='abandonUpdateRooms']",
            "//modal-update-room-type//button[contains(@class, 'close') or @title='Cancelar' or contains(normalize-space(.), 'Cancelar')]",
            "/html/body/div[1]/div/div/modal-update-room-type/div[6]/button[2]",
        ]

        for xpath in xpaths_saida:
            if clicar_quando_pronto(xpath, timeout=3, descricao="saida do overbooking"):
                esperar_loading_sumir(timeout=8)
                return True

        try:
            ActionChains(driver).send_keys(Keys.ESCAPE).perform()
            esperar_loading_sumir(timeout=8)
            return True
        except Exception:
            return False

    def texto_tem_ap(texto, ap):
        return bool(re.search(rf"(?<!\d){re.escape(str(ap))}(?!\d)", texto))

    def linhas_resultado_reservas():
        linhas_validas = []
        for linha in driver.find_elements(By.XPATH, "//div[contains(@class, 'ui-grid-row')]"):
            try:
                if linha.is_displayed() and linha.text.strip():
                    linhas_validas.append(linha)
            except StaleElementReferenceException:
                continue
        return linhas_validas

    def linha_do_voucher(voucher):
        for linha in linhas_resultado_reservas():
            try:
                texto_linha = linha.text.replace("\n", " ")
                if str(voucher) in texto_linha:
                    return linha
            except StaleElementReferenceException:
                continue
        return None

    def aguardar_linha_do_voucher(voucher, timeout=20):
        try:
            return WebDriverWait(driver, timeout, poll_frequency=0.3).until(
                lambda d: linha_do_voucher(voucher)
            )
        except TimeoutException:
            return None

    def pesquisar_voucher(voucher):
        xpath_busca_voucher = '//*[@id="one-search-filters-container"]/div[2]/span[5]/one-translate'
        print(f"Pesquisando voucher {voucher}...")

        if not clicar_quando_pronto(xpath_busca_voucher, timeout=10, descricao="filtro voucher"):
            return None

        xpath_input_voucher = '//*[@id="one-search-modal-content"]/div/input'
        digitou = False
        for tentativa in range(3):
            try:
                input_v = WebDriverWait(driver, 5, poll_frequency=0.2).until(
                    EC.element_to_be_clickable((By.XPATH, xpath_input_voucher))
                )
                js_click(input_v)
                input_v.send_keys(Keys.CONTROL + "a")
                input_v.send_keys(Keys.DELETE)
                input_v.send_keys(str(voucher))
                digitou = True
                break
            except StaleElementReferenceException:
                pausar(0.3)

        if not digitou:
            print(f"Nao consegui digitar o voucher {voucher} no filtro.")
            return None

        if not clicar_quando_pronto('/html/body/div[1]/div/div/div[4]/button', timeout=8, descricao="confirmar filtro"):
            return None

        esperar_loading_sumir(timeout=20)
        linha = aguardar_linha_do_voucher(voucher, timeout=20)
        if not linha:
            print(f"ATENCAO: o voucher {voucher} nao apareceu na grade apos a pesquisa. Pulando para evitar mexer na reserva errada.")
            return None

        print(f"Voucher {voucher} confirmado na grade.")
        return linha

    def apartamentos_ja_vinculados_no_voucher(voucher, aps_necessarios):
        linha = linha_do_voucher(voucher)
        if not linha:
            return False

        texto_linha = linha.text.replace("\n", " ")
        faltando = [ap for ap in aps_necessarios if not texto_tem_ap(texto_linha, ap)]

        if faltando:
            print(f"Na linha do voucher {voucher}, ainda falta(m) AP(s): {faltando}")
            return False

        print(f"Voucher {voucher} ja esta com os AP(s) esperados na propria linha: {aps_necessarios}")
        return True

    def abrir_reserva_do_voucher(voucher):
        linha = linha_do_voucher(voucher)
        if not linha:
            print(f"Nao vou abrir reserva: voucher {voucher} nao esta confirmado na grade.")
            return False

        try:
            lapis = linha.find_element(By.XPATH, ".//a")
            js_click(lapis)
            return True
        except Exception as erro:
            print(f"Nao consegui clicar no lapis da linha do voucher {voucher}: {erro}")
            return False

    try:
        dados = obter_dados()
        driver.get(URL_HITS)

        hits_email = os.getenv("HITS_EMAIL") or input("Digite o HITS_EMAIL: ").strip()
        hits_password = os.getenv("HITS_PASSWORD") or getpass.getpass("Digite o HITS_PASSWORD: ")
        if not hits_email or not hits_password:
            raise RuntimeError("HITS_EMAIL/HITS_PASSWORD não configurados.")
        wait.until(EC.visibility_of_element_located((By.ID, "Email"))).send_keys(hits_email)
        driver.find_element(By.ID, "Password").send_keys(hits_password)
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        esperar_loading_sumir(timeout=30)

        clicar_quando_pronto('//*[@id="menuPrimary"]/a', timeout=20, descricao="menu principal")
        clicar_quando_pronto('//*[@id="menureservation"]', timeout=20, descricao="menu reserva")
        clicar_quando_pronto('//*[@id="menureservations"]/a', timeout=20, descricao="tela de reservas")

        focar_quadro_do_elemento('//*[@id="one-search-filters-container"]', 20)

        print("Limpando filtro de datas inicial...")
        xpath_limpar_datas = '//*[@id="one-search-filters-container"]/div[1]/button[3]/em'
        if clicar_quando_pronto(xpath_limpar_datas, timeout=10, descricao="limpar datas"):
            esperar_loading_sumir()

        for voucher, lista_aps in dados.items():
            print(f"\nVOUCHER: {voucher} | Requisicoes na planilha: {len(lista_aps)}")
            driver.switch_to.default_content()
            esperar_loading_sumir()

            linha_atual = pesquisar_voucher(voucher)
            if not linha_atual:
                continue

            aps_necessarios = [d["ap"] for d in lista_aps]

            print("Verificando voucher + apartamento na mesma linha da grade...")
            if apartamentos_ja_vinculados_no_voucher(voucher, aps_necessarios):
                print("Pulando voucher para evitar retrabalho.")
                continue

            print("Algum apartamento faltando ou errado. Abrindo reserva para correcao...")

            if not abrir_reserva_do_voucher(voucher):
                continue

            focar_quadro_do_elemento("//button[contains(@id, 'btnRoomSelectInEdit')]", 15)

            xpath_qtd_grupo = '//*[@id="summaryRoomTypesReservation"]/div[3]/div[2]/span[2]'
            qtd_quartos_reserva = 1
            if focar_quadro_do_elemento(xpath_qtd_grupo, 5):
                try:
                    qtd_quartos_reserva = int(driver.find_element(By.XPATH, xpath_qtd_grupo).text.strip())
                except Exception:
                    pass

            print(
                f"Status da Reserva: contem {qtd_quartos_reserva} quarto(s). "
                f"Validando com os {len(lista_aps)} requeridos na planilha..."
            )

            for dados_alvo in lista_aps:
                ap_alvo = dados_alvo["ap"]
                cat_alvo = dados_alvo["cat"]
                data_ui_alvo = dados_alvo["data_ui"]

                print(f"\nProcessando destino: {ap_alvo} (Cat: {cat_alvo}) | Data Alvo: {data_ui_alvo}")

                botoes_cama = driver.find_elements(By.XPATH, "//button[contains(@id, 'btnRoomSelectInEdit')]")
                cama_selecionada = None
                indice_da_cama = -1

                print("Cruzando a data da planilha com os blocos da tela...")
                texto_card_selecionado = ""

                for idx, btn_c in enumerate(botoes_cama):
                    texto_card = texto_card_da_cama(btn_c)

                    is_disabled = (
                        btn_c.get_attribute("disabled")
                        or "disabled" in (btn_c.get_attribute("class") or "")
                    )
                    if is_disabled:
                        continue

                    if data_ui_alvo and data_ui_alvo in texto_card:
                        if "N/D" in texto_card or "Nenhum" in texto_card:
                            cama_selecionada = btn_c
                            indice_da_cama = idx
                            texto_card_selecionado = texto_card
                            print(
                                f"Achei o bloco {idx + 1}: "
                                f"data {data_ui_alvo} e status N/D."
                            )
                            break

                        if ap_alvo in texto_card:
                            cama_selecionada = btn_c
                            indice_da_cama = idx
                            texto_card_selecionado = texto_card
                            print(
                                f"O bloco {idx + 1} ja esta preenchido "
                                f"com o AP {ap_alvo}."
                            )
                            break

                if not cama_selecionada:
                    print(
                        f"Nao achei bloco exato com data {data_ui_alvo} e AP N/D. "
                        "Pegando a primeira cama livre..."
                    )

                    for idx, btn_c in enumerate(botoes_cama):
                        is_disabled = (
                            btn_c.get_attribute("disabled")
                            or "disabled" in (btn_c.get_attribute("class") or "")
                        )
                        if not is_disabled:
                            cama_selecionada = btn_c
                            indice_da_cama = idx
                            texto_card_selecionado = texto_card_da_cama(btn_c)
                            break

                if not cama_selecionada:
                    print(
                        f"Erro fatal: nao ha icones de cama livres "
                        f"para processar o AP {ap_alvo}."
                    )
                    break

                cat_bloco_atual = obter_categoria_bloco(
                    indice_da_cama,
                    botao_cama=cama_selecionada,
                    texto_card=texto_card_selecionado,
                )
                cat_alvo_normalizada = normalizar_categoria(cat_alvo) or cat_alvo

                if cat_bloco_atual:
                    print(
                        f"Categoria atual do bloco {indice_da_cama + 1}: "
                        f"{cat_bloco_atual} | Categoria da planilha: "
                        f"{cat_alvo_normalizada}"
                    )
                else:
                    print(
                        f"Nao consegui identificar a categoria atual do bloco "
                        f"{indice_da_cama + 1}. Mantendo o fluxo seguro atual."
                    )

                categoria_diferente = bool(
                    cat_bloco_atual
                    and cat_bloco_atual != cat_alvo_normalizada
                )
                categoria_igual = bool(
                    cat_bloco_atual
                    and cat_bloco_atual == cat_alvo_normalizada
                )

                if categoria_diferente:
                    print(
                        f"Categoria diferente: {cat_bloco_atual} -> "
                        f"{cat_alvo_normalizada}. Indo direto ao overbooking "
                        "para corrigir a categoria e vincular o apartamento."
                    )
                    driver.switch_to.default_content()
                    esperar_loading_sumir()
                else:
                    # Categoria correta ou não identificada:
                    # preserva integralmente o fluxo atual que já encontra os quartos.
                    js_click(cama_selecionada)
                    esperar_loading_sumir(timeout=12)

                    quarto_vinculado_btn = None
                    botoes_tela = driver.find_elements(
                        By.XPATH,
                        "//button[contains(@id, 'btnRoomSelectInEdit')]",
                    )

                    for btn in botoes_tela:
                        classes = btn.get_attribute("class") or ""
                        icones_check = btn.find_elements(
                            By.XPATH,
                            ".//*[contains(@class, 'fa-check') "
                            "or contains(@class, 'check')]",
                        )

                        if (
                            any(icone.is_displayed() for icone in icones_check)
                            or "btn-success" in classes
                        ):
                            quarto_vinculado_btn = btn
                            break

                    if quarto_vinculado_btn:
                        if ap_alvo in quarto_vinculado_btn.text:
                            print(
                                f"A cama ja esta com o AP {ap_alvo} marcado. "
                                "Confirmando e seguindo..."
                            )
                            confirmar_acao(is_overbooking=False)
                            continue

                        print(
                            "Desmarcando quarto errado/antigo "
                            f"({quarto_vinculado_btn.text.strip()})..."
                        )
                        js_click(quarto_vinculado_btn)

                        if confirmar_acao(is_overbooking=False):
                            print("Desvinculacao inicial concluida.")
                            botoes_cama_novos = driver.find_elements(
                                By.XPATH,
                                "//button[contains(@id, 'btnRoomSelectInEdit')]",
                            )

                            if indice_da_cama < len(botoes_cama_novos):
                                js_click(botoes_cama_novos[indice_da_cama])
                                esperar_loading_sumir(timeout=12)

                    elemento_clicavel = procurar_apartamento_na_tela(
                        ap_alvo,
                        timeout=15,
                    )

                    if elemento_clicavel:
                        print(f"Selecionando {ap_alvo} na tela atual...")
                        try:
                            ActionChains(driver).move_to_element(
                                elemento_clicavel
                            ).click().perform()
                        except Exception:
                            js_click(elemento_clicavel)

                        confirmar_acao(is_overbooking=False)
                        continue

                    if categoria_igual:
                        print(
                            f"Overbooking bloqueado: o bloco "
                            f"{indice_da_cama + 1} ja e da categoria "
                            f"{cat_bloco_atual}, igual a planilha. "
                            f"O AP {ap_alvo} deve ser procurado somente "
                            "na lista normal dessa categoria."
                        )
                        fechar_modal_quartos()
                        driver.switch_to.default_content()
                        esperar_loading_sumir()
                        continue

                    print(
                        f"AP {ap_alvo} nao apareceu no painel normal e a "
                        "categoria atual nao pôde ser confirmada. "
                        f"Usando o fallback seguro de overbooking para "
                        f"a categoria {cat_alvo_normalizada}."
                    )

                    fechar_modal_quartos()
                    driver.switch_to.default_content()
                    esperar_loading_sumir()

                if cat_alvo_normalizada in CATEGORIAS_COM_SACADA:
                    print(
                        "Regra de seguranca: destino com sacada. "
                        "Selecionando somente a categoria exata da planilha."
                    )
                elif cat_alvo_normalizada in CATEGORIAS_SEM_SACADA:
                    print(
                        "Regra de seguranca: destino sem sacada. "
                        "Selecionando somente a categoria exata da planilha."
                    )
                elif cat_alvo_normalizada == "SP":
                    print(
                        "Regra de seguranca: Suite Presidencial. "
                        "Selecionando somente SP."
                    )
                elif cat_alvo_normalizada == "3CS":
                    print(
                        "Regra de seguranca: Adaptado para PCD. "
                        "Selecionando somente 3CS."
                    )

                xpath_setas = (
                    "//button[@title='Atualizar/realizar upgrade' "
                    "or contains(@ng-click, 'openUpdateGroupedRooms') or .//em[text()='compare_arrows']]"
                )

                if not focar_quadro_do_elemento(xpath_setas, 10):
                    print("Erro fatal: botao de seta/overbooking nao apareceu na tela principal.")
                    continue

                setas = driver.find_elements(By.XPATH, xpath_setas)
                if indice_da_cama >= len(setas):
                    print(f"Erro: seta de overbooking nao encontrada para o bloco {indice_da_cama + 1}.")
                    continue

                print(f"Entrando na tela de Overbooking do bloco {indice_da_cama + 1}...")
                js_click(setas[indice_da_cama])
                esperar_loading_sumir(timeout=12)

                xpath_edit = '//*[@id="reservations"]/div[3]/reservation-update-grouped-rooms-component/div[2]/div[2]/div[1]/div[1]/div[2]/button'
                if not clicar_quando_pronto(xpath_edit, timeout=15, descricao="edicao da categoria"):
                    continue

                xpath_btn1 = "/html/body/div[1]/div/div/modal-update-room-type/div[2]/div[2]/div[2]/div/button[1]"
                if not clicar_quando_pronto(xpath_btn1, timeout=10, descricao="botao categoria atual"):
                    continue

                xpath_lupa = "/html/body/div[1]/div/div/modal-update-room-type/div[2]/div[2]/div[2]/div/button[2]"
                if not clicar_quando_pronto(xpath_lupa, timeout=10, descricao="lupa de categorias"):
                    continue

                if cat_alvo_normalizada not in XPATH_CATS:
                    print(
                        f"Erro critico: categoria '{cat_alvo_normalizada}' "
                        "nao configurada."
                    )
                    continue

                # Usa exatamente a categoria indicada pela planilha.
                categoria_destino = cat_alvo_normalizada
                if not mesma_familia_sacada(cat_alvo, categoria_destino):
                    print(f"Bloqueado por seguranca: troca de familia de sacada para {categoria_destino}.")
                    continue

                if not clicar_quando_pronto(XPATH_CATS[categoria_destino], timeout=10, descricao=f"categoria {categoria_destino}"):
                    print(f"Erro: categoria {categoria_destino} indisponivel ou XPath incorreto.")
                    continue

                if not categoria_selecionada_bate_com_planilha(categoria_destino):
                    continue

                print(f"AP {ap_alvo} encontrado no Overbooking. Vinculando...")
                if not clicar_ap_overbooking(ap_alvo, timeout=15):
                    print(f"Erro: AP {ap_alvo} nao foi clicado no Overbooking da categoria {categoria_destino}.")
                    recuperar_tela_apos_overbooking()
                    continue

                if not confirmar_acao(is_overbooking=True, ap_overbooking=ap_alvo):
                    print(f"Erro: confirmacao de overbooking nao foi enviada para o AP {ap_alvo}.")
                    recuperar_tela_apos_overbooking()
                    continue
                esperar_loading_sumir()

                print("Retornando da tela de Overbooking para a aba da reserva...")
                xpath_voltar_apos_overbooking = "//*[@id='abandonUpdateRooms']"
                if clicar_quando_pronto(xpath_voltar_apos_overbooking, timeout=5, descricao="voltar apos overbooking"):
                    esperar_loading_sumir()

            print("Concluidos os quartos deste Voucher. Retornando ao mapa principal...")
            if clicar_quando_pronto('//*[@id="cancelReservation"]', timeout=10, descricao="cancelar reserva"):
                esperar_loading_sumir()

    except Exception as e:
        print(f"Erro Critico: {e}")
    finally:
        driver.quit()
        print("Fim.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Robô de vinculação HITS")
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
        default=float(os.getenv("VINC2_FATOR_PAUSA", "0.8")),
        help="Multiplicador das pequenas pausas internas. Padrão: 0.8.",
    )
    args = parser.parse_args()

    modo_headless = None
    if args.headless:
        modo_headless = True
    elif args.visual:
        modo_headless = False

    executar_vinculacao_2_0(
        headless=modo_headless,
        fator_pausa=args.fator_pausa,
    )
