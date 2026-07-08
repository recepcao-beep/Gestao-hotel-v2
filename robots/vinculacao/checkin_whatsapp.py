import os
import re
import time
from datetime import datetime

import gspread
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager


ID_PLANILHA = os.environ.get("MAPINHA_SHEET_ID", "1oMKFu9aobTP5sBuF0jjSR4In3Z6EcWfATCe_9ijNFXA")
SERVICE_ACCOUNT_FILE = "automacao-mapinha-cb0bced39056.json"
SHEET_NAME = os.environ.get("CHECKIN_WHATSAPP_SHEET", "CHECKIN_WHATSAPP")

URL_HITS = (
    "https://susceptor.apphotel.one/account/login?returnUrl=%2Fconnect%2Fauthorize%2Flogin%3F"
    "response_type%3Did_token%2520token%26client_id%3DB37748FC-ED13-4858-AE26-28AB3512A171%26"
    "redirect_uri%3Dhttps%253A%252F%252Fnacionalinn.hitspms.net%252FCallback%26scope%3Dopenid%2520profile"
    "%2520webapi%26nonce%3DN0.97568240711851631771599540467%26state%3D17715995404670.017079953495659272"
)

XPATH_MENU = '//*[@id="menuPrimary"]/a'
XPATH_RECEPCAO = "/html/body/div[3]/div/header/nav[6]/div/ul/li[1]/a"
XPATH_MAPA_RESERVAS = "/html/body/div[3]/div/header/nav[6]/div/ul/li[1]/ul/li[1]/a"
XPATH_TOTAL_CHECKINS = "/html/body/div[3]/div/main/div[56]/div[1]/new-chart-timeline/div/div/div[1]/div[3]/div/div/div/div/div/div/svg/g/g/g[1]/g/text/tspan"
XPATH_CHECKIN_ROWS = "/html/body/div[3]/div/main/div[56]/div[1]/new-chart-timeline/div/div/div[2]/div/new-chart-checkin/div[1]/div[2]/div[1]/div/table/tbody/tr"
XPATH_NOME_CONTAINER = "/html/body/div[3]/div/main/div[8]/div[3]/reservation-edit/div[2]/div[2]/div[1]/div[1]/div/form/div[1]/div/div[1]/div[1]/div/div/div[1]"
XPATH_NOME_INPUT = f"{XPATH_NOME_CONTAINER}/div/input"
XPATH_TELEFONES = [
    "/html/body/div[3]/div/main/div[8]/div[3]/reservation-edit/div[2]/div[2]/div[1]/div[1]/div/form/div[1]/div/div[1]/div[3]/div/div/div[1]/div[2]/div/input",
    "/html/body/div[3]/div/main/div[8]/div[3]/reservation-edit/div[2]/div[2]/div[1]/div[1]/div/form/div[1]/div/div[1]/div[3]/div/div/div[2]/div[2]/div/input",
]
XPATH_FECHAR_RESERVA = "/html/body/div[3]/div/main/div[8]/div[3]/reservation-edit/div[14]/button[2]"


def js_click(driver, element):
    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", element)
    driver.execute_script("arguments[0].click();", element)


def texto_elemento(driver, element):
    return driver.execute_script("return arguments[0].textContent || arguments[0].value || '';", element).strip()


def valor_input(driver, xpath):
    element = WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.XPATH, xpath)))
    return (element.get_attribute("value") or texto_elemento(driver, element) or "").strip()


def valor_elemento_quando_preenchido(driver, xpath, timeout=20):
    wait = WebDriverWait(driver, timeout)

    def obter(_driver):
        try:
            element = _driver.find_element(By.XPATH, xpath)
            value = (
                element.get_attribute("value")
                or element.get_attribute("innerText")
                or element.get_attribute("textContent")
                or ""
            ).strip()
            return value or False
        except Exception:
            return False

    return wait.until(obter)


def somente_digitos(value):
    return re.sub(r"\D+", "", str(value or ""))


def normalizar_telefone(value):
    digits = somente_digitos(value)
    if digits.startswith("00"):
        digits = digits[2:]
    while digits.startswith("0") and len(digits) > 11:
        digits = digits[1:]
    if digits.startswith("55") and len(digits) in (12, 13):
        local = digits[2:]
        ddd = local[:2]
        if ddd < "11" or ddd in {"20", "23", "25", "26", "29", "30", "36", "39", "40", "50", "52", "56", "57", "58", "59", "60", "70", "72", "76", "78", "80", "90"}:
            return ""
        return digits
    if len(digits) in (10, 11):
        ddd = digits[:2]
        if ddd < "11" or ddd in {"20", "23", "25", "26", "29", "30", "36", "39", "40", "50", "52", "56", "57", "58", "59", "60", "70", "72", "76", "78", "80", "90"}:
            return ""
        return f"55{digits}"
    return ""


def parece_cpf_ou_documento(value):
    text = str(value or "").strip()
    digits = somente_digitos(text)
    if len(digits) == 11 and re.search(r"\d{3}\D+\d{3}\D+\d{3}\D+\d{2}", text):
        return True
    return False


def nome_curto(nome):
    partes = re.findall(r"[A-Za-zÀ-ÿ]+", str(nome or "").strip())
    conectores = {"da", "de", "do", "das", "dos", "e"}
    saida = []
    relevantes = 0
    for parte in partes:
        saida.append(parte)
        if parte.lower() not in conectores:
            relevantes += 1
        if relevantes >= 2:
            break
    return " ".join(saida) or str(nome or "").strip()


def criar_driver():
    chrome_options = Options()
    if os.environ.get("ROBOT_HEADLESS", "1") != "0":
        chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--disable-extensions")
    chrome_options.add_argument("--disable-background-timer-throttling")
    chrome_options.add_argument("--disable-renderer-backgrounding")
    chrome_options.add_argument("--disable-features=CalculateNativeWinOcclusion")
    return webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)


def conectar_planilha():
    cliente = gspread.service_account(filename=SERVICE_ACCOUNT_FILE)
    planilha = cliente.open_by_key(ID_PLANILHA)
    try:
        return planilha.worksheet(SHEET_NAME)
    except gspread.WorksheetNotFound:
        return planilha.add_worksheet(title=SHEET_NAME, rows=500, cols=8)


def salvar_contatos(contatos):
    if os.environ.get("SKIP_SHEETS_SAVE") == "1":
        print("[WHATSAPP] SKIP_SHEETS_SAVE=1 ativo. Contatos coletados:", flush=True)
        for contato in contatos:
            print(
                f"[WHATSAPP] {contato['voucher']} | {contato['nome_curto']} | {contato['telefone_whatsapp']}",
                flush=True,
            )
        return

    aba = conectar_planilha()
    headers = [
        "Atualizado em",
        "Voucher",
        "Nome",
        "Nome curto",
        "Telefone",
        "Telefone WhatsApp",
        "Status",
        "Origem",
    ]
    agora = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    linhas = [
        [
            agora,
            contato["voucher"],
            contato["nome"],
            contato["nome_curto"],
            contato["telefone"],
            contato["telefone_whatsapp"],
            "Pendente",
            "HITS check-ins hoje",
        ]
        for contato in contatos
    ]
    aba.clear()
    aba.update("A1", [headers] + linhas, value_input_option="USER_ENTERED")
    print(f"[WHATSAPP] Contatos gravados na aba {SHEET_NAME}: {len(contatos)}", flush=True)


def navegar_ate_checkins(driver, wait):
    print("[WHATSAPP] Abrindo login do HITS...", flush=True)
    driver.get(URL_HITS)
    wait.until(EC.visibility_of_element_located((By.ID, "Email"))).send_keys(os.environ["HITS_EMAIL"])
    driver.find_element(By.ID, "Password").send_keys(os.environ["HITS_PASSWORD"])
    driver.find_element(By.XPATH, "//button[@type='submit']").click()
    time.sleep(8)

    print("[WHATSAPP] Entrando em Recepcao > Mapa de reservas...", flush=True)
    js_click(driver, wait.until(EC.element_to_be_clickable((By.XPATH, XPATH_MENU))))
    time.sleep(1)
    js_click(driver, wait.until(EC.element_to_be_clickable((By.XPATH, XPATH_RECEPCAO))))
    time.sleep(1)
    js_click(driver, wait.until(EC.element_to_be_clickable((By.XPATH, XPATH_MAPA_RESERVAS))))
    time.sleep(8)


def obter_total_checkins(driver):
    try:
        total_text = texto_elemento(driver, WebDriverWait(driver, 8).until(EC.presence_of_element_located((By.XPATH, XPATH_TOTAL_CHECKINS))))
        match = re.search(r"\d+", total_text)
        if match:
            return int(match.group(0))
    except Exception:
        pass
    return 0


def linha_tem_marcador_laranja(driver, linha):
    try:
        candidatos = linha.find_elements(By.XPATH, ".//td[5]/div/span[3] | .//td[5]//span[contains(@class, 'orange') or contains(@class, 'warning') or contains(@class, 'text-orange') or contains(@style, 'orange')]")
        for candidato in candidatos:
            classe = (candidato.get_attribute("class") or "").lower()
            style = (candidato.get_attribute("style") or "").lower()
            color = (candidato.value_of_css_property("color") or "").lower()
            background = (candidato.value_of_css_property("background-color") or "").lower()
            texto = texto_elemento(driver, candidato).lower()
            marcador = " ".join([classe, style, color, background, texto])
            if any(term in marcador for term in ("orange", "warning", "laranja", "rgb(255", "rgb(245", "rgb(249", "#ff", "#f5", "#f9")):
                return True
    except Exception:
        return False
    return False


def linhas_com_voucher(driver):
    linhas = driver.find_elements(By.XPATH, XPATH_CHECKIN_ROWS)
    resultado = []
    for linha in linhas:
        try:
            if linha_tem_marcador_laranja(driver, linha):
                voucher_text = texto_elemento(driver, linha)
                print(f"[WHATSAPP] Linha ignorada por marcador laranja: {voucher_text[:80]}", flush=True)
                continue
            span = linha.find_element(By.XPATH, ".//td[2]//span[1]")
            voucher = texto_elemento(driver, span)
            if re.search(r"\d{4,}", voucher):
                resultado.append((voucher, span))
        except Exception:
            continue
    return resultado


def fechar_reserva(driver):
    try:
        js_click(driver, WebDriverWait(driver, 8).until(EC.element_to_be_clickable((By.XPATH, XPATH_FECHAR_RESERVA))))
        time.sleep(2)
    except Exception:
        driver.execute_script("document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));")
        time.sleep(1)


def encontrar_telefone_reserva(driver):
    candidatos = []
    for xpath in XPATH_TELEFONES:
        try:
            candidatos.append(valor_input(driver, xpath))
        except Exception:
            pass

    for element in driver.find_elements(By.XPATH, "/html/body/div[3]/div/main/div[8]//reservation-edit//input"):
        try:
            value = (element.get_attribute("value") or "").strip()
            if value:
                candidatos.append(value)
        except Exception:
            continue

    vistos = set()
    for candidato in candidatos:
        key = somente_digitos(candidato)
        if not key or key in vistos:
            continue
        vistos.add(key)
        if parece_cpf_ou_documento(candidato):
            continue
        telefone = normalizar_telefone(candidato)
        if telefone:
            return candidato, telefone

    return "", ""


def encontrar_nome_reserva(driver):
    candidatos = []

    for xpath in (XPATH_NOME_INPUT, XPATH_NOME_CONTAINER):
        try:
            candidatos.append(valor_elemento_quando_preenchido(driver, xpath, timeout=12))
        except Exception:
            pass

    try:
        container = driver.find_element(By.XPATH, XPATH_NOME_CONTAINER)
        for element in container.find_elements(By.XPATH, ".//input|.//textarea|.//span|.//div"):
            value = (
                element.get_attribute("value")
                or element.get_attribute("innerText")
                or element.get_attribute("textContent")
                or ""
            ).strip()
            if value:
                candidatos.append(value)
    except Exception:
        pass

    for element in driver.find_elements(By.XPATH, "/html/body/div[3]/div/main/div[8]//reservation-edit//input"):
        try:
            value = (element.get_attribute("value") or "").strip()
            if value and re.search(r"[A-Za-zÀ-ÿ]{2,}", value) and not normalizar_telefone(value):
                candidatos.append(value)
        except Exception:
            continue

    for candidato in candidatos:
        text = re.sub(r"\s+", " ", str(candidato or "")).strip()
        if re.search(r"[A-Za-zÀ-ÿ]{2,}", text) and not parece_cpf_ou_documento(text) and not normalizar_telefone(text):
            return text

    return ""


def coletar_contatos():
    driver = criar_driver()
    wait = WebDriverWait(driver, 30)
    contatos = []
    processados = set()

    try:
        navegar_ate_checkins(driver, wait)
        total = obter_total_checkins(driver)
        print(f"[WHATSAPP] Total informado de check-ins hoje: {total or 'nao localizado'}", flush=True)

        tentativas_sem_novo = 0
        limite_tentativas = max(total + 10, 20)

        while tentativas_sem_novo < limite_tentativas:
            opcoes = [(voucher, element) for voucher, element in linhas_com_voucher(driver) if voucher not in processados]
            if not opcoes:
                tentativas_sem_novo += 1
                if total and len(processados) >= total:
                    break
                time.sleep(1)
                continue

            voucher, element = opcoes[0]
            processados.add(voucher)
            print(f"[WHATSAPP] Abrindo voucher {voucher}...", flush=True)

            try:
                js_click(driver, element)
                time.sleep(3)
                nome = encontrar_nome_reserva(driver)
                telefone_original, telefone_whatsapp = encontrar_telefone_reserva(driver)

                if not nome:
                    print(f"[WHATSAPP] Voucher {voucher} ignorado: nome nao localizado.", flush=True)
                elif not telefone_whatsapp:
                    print(f"[WHATSAPP] Voucher {voucher} ignorado: telefone ausente/invalido.", flush=True)
                else:
                    contato = {
                        "voucher": voucher,
                        "nome": nome,
                        "nome_curto": nome_curto(nome),
                        "telefone": telefone_original,
                        "telefone_whatsapp": telefone_whatsapp,
                    }
                    contatos.append(contato)
                    print(f"[WHATSAPP] Coletado: {contato['nome_curto']} - {telefone_whatsapp}", flush=True)
            except Exception as error:
                print(f"[WHATSAPP] Falha ao coletar voucher {voucher}: {error}", flush=True)
            finally:
                fechar_reserva(driver)

            if total and len(processados) >= total:
                break

        return contatos
    finally:
        driver.quit()


def main():
    faltando = [nome for nome in ("HITS_EMAIL", "HITS_PASSWORD") if not os.environ.get(nome)]
    if faltando:
        raise RuntimeError(f"Variaveis ausentes: {', '.join(faltando)}")
    if os.environ.get("SKIP_SHEETS_SAVE") != "1" and not os.path.exists(SERVICE_ACCOUNT_FILE):
        raise RuntimeError(f"Credencial ausente: {SERVICE_ACCOUNT_FILE}")

    contatos = coletar_contatos()
    salvar_contatos(contatos)
    print("[WHATSAPP] Rotina finalizada.", flush=True)


if __name__ == "__main__":
    main()
