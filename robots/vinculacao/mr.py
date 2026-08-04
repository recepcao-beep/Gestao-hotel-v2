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
from selenium.common.exceptions import (
    ElementClickInterceptedException,
    ElementNotInteractableException,
    NoSuchElementException,
    StaleElementReferenceException,
    TimeoutException,
)


URL_WEBHOOK_MR = (
    "https://script.google.com/macros/s/"
    "AKfycbwcfhQySj2OoJVSzaWnjMCHZzfHPCQHc5fZHKt5sLmhJ7wTtD24SvR-kk-at7lFo_31EA/exec"
)
MENSAGEM_SUCESSO_WEBHOOK_MR = "script executado com sucesso"


def resumir_erro_webhook_mr(erro):
    if isinstance(erro, requests.HTTPError) and erro.response is not None:
        return f"HTTP {erro.response.status_code}"

    if isinstance(erro, requests.RequestException):
        return erro.__class__.__name__

    return str(erro)


def acionar_webhook_mr(
    url=URL_WEBHOOK_MR,
    tentativas=3,
    timeout=60,
    pausa_entre_tentativas=5,
):
    ultimo_erro = None

    for tentativa in range(1, tentativas + 1):
        try:
            resposta = requests.get(url, timeout=timeout)
            resposta.raise_for_status()
            corpo = resposta.text.strip()

            if MENSAGEM_SUCESSO_WEBHOOK_MR not in corpo.casefold():
                resumo = " ".join(corpo.split())[:200] or "resposta vazia"

                raise RuntimeError(
                    f"Resposta inesperada do Google no MR: {resumo}"
                )

            return corpo

        except (requests.RequestException, RuntimeError) as erro:
            ultimo_erro = erro

            print(
                f"Webhook do MR falhou na tentativa "
                f"{tentativa}/{tentativas}: "
                f"{resumir_erro_webhook_mr(erro)}",
                flush=True,
            )

            if tentativa < tentativas:
                time.sleep(pausa_entre_tentativas)

    raise RuntimeError(
        f"Webhook do MR falhou apos {tentativas} tentativas: "
        f"{resumir_erro_webhook_mr(ultimo_erro)}"
    ) from ultimo_erro


def executar_mapeamento_total(headless=None, fator_pausa=0.5):
    # --- CONFIGURAÇÕES ---
    ID_PLANILHA = "1oMKFu9aobTP5sBuF0jjSR4In3Z6EcWfATCe_9ijNFXA"
    BASE_DIR = Path(__file__).resolve().parent
    DIAS_PROJECAO = 7

    caminho_token = Path(
        os.getenv(
            "GOOGLE_TOKEN_PATH",
            str(BASE_DIR / "token.json"),
        )
    )

    if not caminho_token.exists() and Path("token.json").exists():
        caminho_token = Path("token.json")

    caminho_client_secret = Path(
        os.getenv(
            "GOOGLE_CLIENT_SECRET_PATH",
            str(BASE_DIR / "client_secret.json"),
        )
    )

    if (
        not caminho_client_secret.exists()
        and Path("client_secret.json").exists()
    ):
        caminho_client_secret = Path("client_secret.json")

    ARQUIVO_CLIENT_SECRET = str(caminho_client_secret)

    if headless is None:
        headless = (
            os.getenv("GITHUB_ACTIONS", "").lower() == "true"
            or os.getenv("ROBOT_HEADLESS", "").lower()
            in {"1", "true", "yes", "sim"}
        )

    fator_pausa = max(0.25, float(fator_pausa))

    def pausar(segundos):
        time.sleep(max(0.15, segundos * fator_pausa))

    URL_HITS = (
        "https://susceptor.apphotel.one/account/login?"
        "returnUrl=%2Fconnect%2Fauthorize%2Flogin%3F"
        "response_type%3Did_token%2520token%26"
        "client_id%3DB37748FC-ED13-4858-AE26-28AB3512A171%26"
        "redirect_uri%3Dhttps%253A%252F%252Fnacionalinn.hitspms.net"
        "%252FCallback%26scope%3Dopenid%2520profile%2520webapi%26"
        "nonce%3DN0.97568240711851631771599540467%26"
        "state%3D17715995404670.017079953495659272"
    )

    print("📡 Conectando ao Google Sheets via OAuth...")

    escopos = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]

    creds = None

    token_json_env = os.getenv("GOOGLE_TOKEN_JSON", "").strip()

    if token_json_env:
        creds = Credentials.from_authorized_user_info(
            json.loads(token_json_env),
            escopos,
        )

    elif caminho_token.exists():
        creds = Credentials.from_authorized_user_file(
            str(caminho_token),
            escopos,
        )

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())

        else:
            if os.getenv("GITHUB_ACTIONS", "").lower() == "true":
                raise RuntimeError(
                    "Google OAuth indisponível no GitHub Actions. "
                    "Configure GOOGLE_TOKEN_JSON ou disponibilize token.json."
                )

            flow = InstalledAppFlow.from_client_secrets_file(
                ARQUIVO_CLIENT_SECRET,
                escopos,
            )

            creds = flow.run_local_server(port=0)

        if not token_json_env:
            caminho_token.parent.mkdir(
                parents=True,
                exist_ok=True,
            )

            caminho_token.write_text(
                creds.to_json(),
                encoding="utf-8",
            )

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
        f"🖥️ Modo: "
        f"{'HEADLESS/GITHUB ACTIONS' if headless else 'VISUAL'} | "
        f"Fator de pausa: {fator_pausa}"
    )

    def js_click(elemento):
        driver.execute_script(
            "arguments[0].click();",
            elemento,
        )

    def remover_overlay_hitsa():
        """
        Remove ou desativa a camada de apresentação/tutorial do HITS
        que pode bloquear os cliques durante a execução.
        """

        try:
            ActionChains(driver).send_keys(Keys.ESCAPE).perform()
        except Exception:
            pass

        try:
            quantidade = driver.execute_script(
                """
                const seletores = [
                    "div.themes-preview-reflect-backdrop",
                    "div[class*='themes-preview-reflect-backdrop']"
                ];

                const elementos = new Set();

                seletores.forEach(function(seletor) {
                    document.querySelectorAll(seletor).forEach(
                        function(elemento) {
                            elementos.add(elemento);
                        }
                    );
                });

                elementos.forEach(function(elemento) {
                    elemento.style.setProperty(
                        "pointer-events",
                        "none",
                        "important"
                    );

                    elemento.style.setProperty(
                        "display",
                        "none",
                        "important"
                    );

                    elemento.setAttribute(
                        "aria-hidden",
                        "true"
                    );
                });

                return elementos.size;
                """
            )

            if quantidade:
                print(
                    f"🧹 Sobreposição do HITS removida: "
                    f"{quantidade} elemento(s).",
                    flush=True,
                )

                pausar(1)

        except Exception as erro_overlay:
            print(
                f"⚠️ Não foi possível remover a sobreposição do HITS: "
                f"{erro_overlay}",
                flush=True,
            )

    def focar_quadro_do_elemento(xpath_alvo, max_depth=3):
        driver.switch_to.default_content()

        def procurar(profundidade):
            if profundidade > max_depth:
                return False

            if len(driver.find_elements(By.XPATH, xpath_alvo)) > 0:
                return True

            iframes = driver.find_elements(By.TAG_NAME, "iframe")

            for i in range(len(iframes)):
                try:
                    driver.switch_to.frame(i)

                    if procurar(profundidade + 1):
                        return True

                    driver.switch_to.parent_frame()

                except Exception:
                    continue

            return False

        return procurar(0)

    try:
        # ==========================================
        # LOGIN
        # ==========================================
        driver.get(URL_HITS)

        hits_email = (
            os.getenv("HITS_EMAIL")
            or input("Digite o HITS_EMAIL: ").strip()
        )

        hits_password = (
            os.getenv("HITS_PASSWORD")
            or getpass.getpass("Digite o HITS_PASSWORD: ")
        )

        if not hits_email or not hits_password:
            raise RuntimeError(
                "HITS_EMAIL/HITS_PASSWORD não configurados."
            )

        wait.until(
            EC.visibility_of_element_located(
                (By.ID, "Email")
            )
        ).send_keys(hits_email)

        driver.find_element(
            By.ID,
            "Password",
        ).send_keys(hits_password)

        driver.find_element(
            By.XPATH,
            "//button[@type='submit']",
        ).click()

        pausar(10)

        dados_mestre = []
        chaves_vistas = set()

        # ==========================================
        # ETAPA 1: RESERVAS
        # ==========================================
        print("📂 [ETAPA 1] Extraindo Lista de Reservas...")

        js_click(
            wait.until(
                EC.element_to_be_clickable(
                    (
                        By.XPATH,
                        "/html/body/div[3]/div/header/nav[1]/ul/li[1]/a",
                    )
                )
            )
        )

        pausar(2)

        js_click(
            wait.until(
                EC.element_to_be_clickable(
                    (
                        By.XPATH,
                        '//*[@id="menureservation"]',
                    )
                )
            )
        )

        pausar(2)

        js_click(
            wait.until(
                EC.element_to_be_clickable(
                    (
                        By.XPATH,
                        '//*[@id="menureservations"]/a',
                    )
                )
            )
        )

        pausar(10)

        for i in range(DIAS_PROJECAO):
            data_alvo = (
                datetime.datetime.now()
                + datetime.timedelta(days=i)
            )

            data_str = data_alvo.strftime("%d/%m/%y")
            str_range = f"{data_str} - {data_str}"

            print(
                f"🕒 Reservas - Dia "
                f"{i + 1}/{DIAS_PROJECAO}: {data_str}"
            )

            xpath_filtro = (
                '//*[@id="one-search-filters-container"]'
                '/div[2]/span[2]/one-translate'
            )

            if focar_quadro_do_elemento(xpath_filtro):
                js_click(
                    driver.find_element(
                        By.XPATH,
                        xpath_filtro,
                    )
                )

                pausar(3)

                localizador_input_data = (
                    By.XPATH,
                    '//*[@id="one-search-modal-content"]/div/div/input',
                )

                def campo_data_visivel():
                    xpath_input_data = localizador_input_data[1]

                    if not focar_quadro_do_elemento(xpath_input_data):
                        return False

                    for campo in driver.find_elements(
                        *localizador_input_data
                    ):
                        try:
                            if campo.is_displayed():
                                return True
                        except StaleElementReferenceException:
                            continue

                    return False

                def garantir_modal_data_aberto():
                    if campo_data_visivel():
                        return

                    if not focar_quadro_do_elemento(xpath_filtro):
                        raise TimeoutException(
                            "Filtro de data das reservas não encontrado."
                        )

                    filtro_data = WebDriverWait(
                        driver,
                        8,
                        poll_frequency=0.2,
                        ignored_exceptions=(
                            StaleElementReferenceException,
                            NoSuchElementException,
                        ),
                    ).until(
                        EC.element_to_be_clickable(
                            (By.XPATH, xpath_filtro)
                        )
                    )

                    js_click(filtro_data)
                    pausar(2)

                    if not campo_data_visivel():
                        raise TimeoutException(
                            "Campo do intervalo de datas não abriu."
                        )

                def preencher_intervalo_data(
                    valor,
                    tentativas=5,
                ):
                    ultimo_erro = None
                    xpath_input_data = localizador_input_data[1]

                    for tentativa in range(1, tentativas + 1):
                        try:
                            garantir_modal_data_aberto()
                            remover_overlay_hitsa()
                            garantir_modal_data_aberto()

                            input_data = WebDriverWait(
                                driver,
                                10,
                                poll_frequency=0.2,
                                ignored_exceptions=(
                                    StaleElementReferenceException,
                                    NoSuchElementException,
                                ),
                            ).until(
                                EC.element_to_be_clickable(
                                    localizador_input_data
                                )
                            )

                            driver.execute_script(
                                """
                                arguments[0].scrollIntoView({
                                    block: "center",
                                    inline: "center"
                                });
                                """,
                                input_data,
                            )

                            try:
                                input_data.click()
                            except ElementClickInterceptedException:
                                remover_overlay_hitsa()
                                garantir_modal_data_aberto()
                                input_data = WebDriverWait(
                                    driver,
                                    5,
                                    poll_frequency=0.2,
                                    ignored_exceptions=(
                                        StaleElementReferenceException,
                                        NoSuchElementException,
                                    ),
                                ).until(
                                    EC.presence_of_element_located(
                                        localizador_input_data
                                    )
                                )
                                js_click(input_data)

                            # Uma única chamada reduz a janela em que o Angular
                            # pode recriar o input entre limpar e digitar.
                            input_data.send_keys(
                                Keys.CONTROL,
                                "a",
                                Keys.DELETE,
                                valor,
                            )

                            pausar(0.8)

                            # O HITS normalmente recria o campo após receber a
                            # data. Nunca reutilize a referência anterior para
                            # confirmar: localize o input novamente.
                            if not campo_data_visivel():
                                raise StaleElementReferenceException(
                                    "O HITS recriou o campo de data."
                                )

                            input_confirmacao = WebDriverWait(
                                driver,
                                8,
                                poll_frequency=0.2,
                                ignored_exceptions=(
                                    StaleElementReferenceException,
                                    NoSuchElementException,
                                ),
                            ).until(
                                EC.element_to_be_clickable(
                                    localizador_input_data
                                )
                            )

                            input_confirmacao.send_keys(Keys.ENTER)
                            return

                        except (
                            StaleElementReferenceException,
                            ElementClickInterceptedException,
                            ElementNotInteractableException,
                            NoSuchElementException,
                            TimeoutException,
                        ) as erro_data:
                            ultimo_erro = erro_data

                            print(
                                "⚠️ Campo de data foi atualizado pelo HITS. "
                                f"Repetindo {tentativa}/{tentativas} para "
                                f"{valor}: {erro_data.__class__.__name__}",
                                flush=True,
                            )

                            if tentativa < tentativas:
                                pausar(1.5)

                    raise RuntimeError(
                        f"Não foi possível aplicar o intervalo {valor} "
                        f"após {tentativas} tentativas."
                    ) from ultimo_erro

                preencher_intervalo_data(str_range)

                pausar(2)

                xpath_apply = (
                    "//button[contains(@class, 'applyBtn')]"
                )

                if len(
                    driver.find_elements(
                        By.XPATH,
                        xpath_apply,
                    )
                ) > 0:
                    js_click(
                        driver.find_element(
                            By.XPATH,
                            xpath_apply,
                        )
                    )

                    pausar(3)

                try:
                    js_click(
                        driver.find_element(
                            By.XPATH,
                            "/html/body/div[1]/div/div/div[4]/button",
                        )
                    )

                    pausar(8)

                except Exception:
                    pass

                if focar_quadro_do_elemento(
                    '//*[contains(@id, "-body-grid-container")]'
                ):
                    linhas = driver.find_elements(
                        By.XPATH,
                        "//div[contains(@class, 'ui-grid-row')]",
                    )

                    contagem_diaria = {}

                    for linha in linhas:
                        try:
                            def get_val(class_id):
                                el = linha.find_element(
                                    By.XPATH,
                                    (
                                        ".//div[contains("
                                        "@class, "
                                        f"'ui-grid-coluiGrid-{class_id}'"
                                        ")]"
                                    ),
                                )

                                return driver.execute_script(
                                    "return arguments[0].textContent",
                                    el,
                                ).strip()

                            vouc = get_val("0007")

                            if not vouc:
                                continue

                            hospede = (
                                get_val("000A")
                                .split(",")[0]
                                .strip()
                            )

                            checkin = (
                                get_val("0005")
                                .split(" ")[0]
                            )

                            checkout = (
                                get_val("0006")
                                .split(" ")[0]
                            )

                            pax = get_val("000C")
                            apto = get_val("000D")
                            categoria = get_val("000E")

                            status_res = (
                                "ENTRADA"
                                if i == 0
                                else "RESERVA"
                            )

                            chave_base = (
                                vouc,
                                apto,
                                hospede,
                                checkin,
                                checkout,
                            )

                            contagem_diaria[chave_base] = (
                                contagem_diaria.get(
                                    chave_base,
                                    0,
                                )
                                + 1
                            )

                            ocorrencia_hoje = (
                                contagem_diaria[chave_base]
                            )

                            chave_unica = (
                                vouc,
                                apto,
                                hospede,
                                checkin,
                                checkout,
                                ocorrencia_hoje,
                            )

                            if chave_unica not in chaves_vistas:
                                dados_mestre.append(
                                    [
                                        apto,
                                        vouc,
                                        checkin,
                                        checkout,
                                        status_res,
                                        pax,
                                        hospede,
                                        categoria,
                                    ]
                                )

                                chaves_vistas.add(
                                    chave_unica
                                )

                        except Exception:
                            continue

        # ==========================================
        # ETAPA 2: OCUPADOS
        # VIA MAPA DE RESERVAS
        # ==========================================
        print(
            "📂 [ETAPA 2] Acessando Mapa de Reservas "
            "e Extraindo Ocupados..."
        )

        driver.switch_to.default_content()

        js_click(
            wait.until(
                EC.element_to_be_clickable(
                    (
                        By.XPATH,
                        '//*[@id="menuPrimary"]/a',
                    )
                )
            )
        )

        pausar(2)

        js_click(
            wait.until(
                EC.element_to_be_clickable(
                    (
                        By.XPATH,
                        '//*[@id="menufrontdesk"]',
                    )
                )
            )
        )

        pausar(2)

        js_click(
            wait.until(
                EC.element_to_be_clickable(
                    (
                        By.XPATH,
                        '//*[@id="menunewChart"]/a',
                    )
                )
            )
        )

        pausar(10)

        if focar_quadro_do_elemento(
            '//*[@id="smAccInHouse"]'
        ):
            js_click(
                driver.find_element(
                    By.XPATH,
                    '//*[@id="smAccInHouse"]',
                )
            )

            pausar(5)

            if focar_quadro_do_elemento(
                '//*[@id="tableUsuario"]'
            ):
                linhas_ocupados = driver.find_elements(
                    By.XPATH,
                    '//*[@id="tableUsuario"]/tbody/tr',
                )

                for linha in linhas_ocupados:
                    try:
                        colunas = linha.find_elements(
                            By.TAG_NAME,
                            "td",
                        )

                        if len(colunas) < 7:
                            continue

                        apto_c = colunas[1].text.strip()
                        hosp_c = colunas[2].text.strip()
                        checkin_c = colunas[5].text.strip()
                        checkout_c = colunas[6].text.strip()

                        # --- INÍCIO DA NOVA EXTRAÇÃO DE PAX ---
                        try:
                            pax_c = linha.find_element(
                                By.XPATH,
                                ".//span[@ng-bind='ls.PaxChd']",
                            ).text.strip()

                        except Exception:
                            pax_c = "-"

                        # --- FIM DA NOVA EXTRAÇÃO ---

                        vouc_c = "MAPA"
                        cat_c = "IN-HOUSE"

                        chave_c = (
                            vouc_c,
                            apto_c,
                            hosp_c,
                            checkin_c,
                        )

                        if chave_c not in chaves_vistas:
                            dados_mestre.append(
                                [
                                    apto_c,
                                    vouc_c,
                                    checkin_c,
                                    checkout_c,
                                    "OCUPADO",
                                    pax_c,
                                    hosp_c,
                                    cat_c,
                                ]
                            )

                            chaves_vistas.add(
                                chave_c
                            )

                    except Exception:
                        continue

        # ==========================================
        # ETAPA 3: INTERDITADOS
        # ==========================================
        print(
            "📂 [ETAPA 3] Extraindo Quartos Interditados..."
        )

        if focar_quadro_do_elemento(
            '//*[@id="smAccOutOrder"]'
        ):
            js_click(
                driver.find_element(
                    By.XPATH,
                    '//*[@id="smAccOutOrder"]',
                )
            )

            pausar(5)

            if focar_quadro_do_elemento(
                '//*[@id="tableUsuario"]'
            ):
                linhas_interditados = driver.find_elements(
                    By.XPATH,
                    '//*[@id="tableUsuario"]/tbody/tr',
                )

                for linha in linhas_interditados:
                    try:
                        texto_linha = linha.text

                        if (
                            "Sem dados" in texto_linha
                            or "No data" in texto_linha
                        ):
                            continue

                        colunas = linha.find_elements(
                            By.TAG_NAME,
                            "td",
                        )

                        if len(colunas) < 6:
                            continue

                        apto_i = linha.find_element(
                            By.XPATH,
                            "./td[3]/span[1]",
                        ).text.strip()

                        motivo_i = linha.find_element(
                            By.XPATH,
                            "./td[4]/div",
                        ).text.strip()

                        from_i = (
                            linha.find_element(
                                By.XPATH,
                                "./td[5]/div/span",
                            )
                            .text.strip()
                            .split(" ")[0]
                        )

                        through_i = (
                            linha.find_element(
                                By.XPATH,
                                "./td[6]/div/span",
                            )
                            .text.strip()
                            .split(" ")[0]
                        )

                        vouc_i = "INTERDICAO"
                        cat_i = "OUT OF ORDER"
                        pax_i = "-"

                        chave_i = (
                            vouc_i,
                            apto_i,
                            motivo_i,
                            from_i,
                        )

                        if chave_i not in chaves_vistas:
                            dados_mestre.append(
                                [
                                    apto_i,
                                    vouc_i,
                                    from_i,
                                    through_i,
                                    "INTERDITADO",
                                    pax_i,
                                    motivo_i,
                                    cat_i,
                                ]
                            )

                            chaves_vistas.add(
                                chave_i
                            )

                    except Exception:
                        continue

        # ==========================================
        # SALVAMENTO FINAL E WEBHOOK
        # ==========================================
        if not dados_mestre:
            raise RuntimeError(
                "Nenhum registro foi extraído do HITS."
            )

        aba_bruta.batch_clear(
            ["A2:H5000"]
        )

        aba_bruta.update(
            values=dados_mestre,
            range_name="A2",
        )

        print(
            f"✅ SUCESSO! {len(dados_mestre)} registros "
            f"consolidados na planilha."
        )

        # --- GATILHO WEBHOOK ---
        print(
            "🚀 Acionando o Google Sheets para "
            "reorganizar os andares..."
        )

        resposta_webhook = acionar_webhook_mr()

        print(
            f"🤖 Resposta do Google Sheets: "
            f"{resposta_webhook}"
        )

    except Exception as e:
        print(
            f"❌ Erro Crítico: {e}",
            flush=True,
        )

        raise

    finally:
        driver.quit()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Robô MR - mapeamento HITS"
    )

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
        default=float(
            os.getenv(
                "MR_FATOR_PAUSA",
                "0.5",
            )
        ),
        help=(
            "Multiplicador das pausas originais. "
            "Padrão: 0.5."
        ),
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
