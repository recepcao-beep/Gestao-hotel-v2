from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import time
import traceback
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Callable, DefaultDict, Iterable

import gspread
from gspread.exceptions import APIError, SpreadsheetNotFound, WorksheetNotFound
from google.oauth2.service_account import Credentials
from selenium import webdriver
from selenium.common.exceptions import (
    ElementClickInterceptedException,
    ElementNotInteractableException,
    NoSuchElementException,
    StaleElementReferenceException,
    TimeoutException,
    WebDriverException,
)
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.remote.webdriver import WebDriver, WebElement
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


BASE_DIR = Path(__file__).resolve().parent
LOG_DIR = BASE_DIR / "logs"
ERROR_DIR = BASE_DIR / "erros"
RESULT_DIR = BASE_DIR / "resultados"
OPER_LOGGER_NAME = "vinc3.operacional"

CONFIG_PLANILHA = {
    "nome_aba": "VINCULACAO_HOJE",
    "id_padrao_vinc2": "1oMKFu9aobTP5sBuF0jjSR4In3Z6EcWfATCe_9ijNFXA",
    "arquivo_json_padrao_vinc2": "automacao-mapinha-cb0bced39056.json",
    "linha_cabecalho": 1,
    "linha_inicial": 2,
    "coluna_voucher": "A",
    "coluna_apartamento": "B",
    "coluna_categoria": "C",
    "coluna_hospede": "D",
    "coluna_data_checkin": "E",
    "coluna_status_extra": "F",
}

CONFIG_HITS = {
    "url_env": "HITS_URL",
    "url_padrao": "https://susceptor.apphotel.one/account/login?returnUrl=%2Fconnect%2Fauthorize%2Flogin%3Fresponse_type%3Did_token%2520token%26client_id%3DB37748FC-ED13-4858-AE26-28AB3512A171%26redirect_uri%3Dhttps%253A%252F%252Fnacionalinn.hitspms.net%252FCallback%26scope%3Dopenid%2520profile%2520webapi%26nonce%3DN0.28324722615515141770822279499%26state%3D17708222794990.2983837305966167",
    "email_env": "HITS_EMAIL",
    "password_env": "HITS_PASSWORD",
    "spreadsheet_id_env": "SPREADSHEET_ID",
    "spreadsheet_url_env": "SPREADSHEET_URL",
    "google_credentials_env": "GOOGLE_CREDENTIALS_JSON",
    "google_credentials_file_env": "GOOGLE_CREDENTIALS_FILE",
}

HITS_SELECTORS = {
    "login_email": '//*[@id="Email"]',
    "login_password": '//*[@id="Password"]',
    "login_confirm": '//*[@id="navbar-login"]/section/form/div[1]/div[3]/div/button',
    "menu_lateral": '//*[@id="menuPrimary"]/a/i',
    "nav_options": '//*[@id="navOptions"]',
    "overlay_nav": '//*[contains(@class,"overlay-nav")]',
    "block_ui_overlay": '//*[contains(@class,"block-ui-overlay")]',
    "block_ui_message": '//*[contains(@class,"block-ui-message")]',
    "menu_reservas": '//*[@id="menureservation"]',
    "menu_sub_reservas": '//*[@id="menureservations"]/a',
    "remover_filtro_data": '//*[@id="btn_removeFilter_searchFilters_lblcheckin"]',
    "botao_voucher": '//*[@id="btn_quickFilter_searchFilters_lblvoucher"]/one-translate',
    "campo_voucher": '//*[@id="input_value_numberFilter"]',
    "confirmar_pesquisa": '//*[@id="btn_apply_searchFiltersModal"]/em',
    "grid_container": '//*[contains(@id,"-body-grid-container")]/div[2]',
    "grid_apartamentos": '//*[contains(@id,"-uiGrid-000D-cell")]',
    "botao_editar": '//*[starts-with(@id,"btn_edit_")]',
    "cards": '//*[starts-with(@id,"cardRoomType")]',
    "modal_quartos": "/html/body/div[1]/div/div/modal-reservation-edit-select-update-grouped-rooms/div[2]/div/div[5]",
    "titulo_modal_quartos": "/html/body/div[1]/div/div/modal-reservation-edit-select-update-grouped-rooms/div[1]/h2",
    "confirmar_quarto": '//*[@id="btn_save_selectUpdateRoom"]/em',
    "lapis_troca_categoria": '//*[@id="btn_openUpdateRoomType_updateGroupedRooms"]',
    "permitir_overbooking_troca_categoria": '//*[@id="btn_toggleAllowOverbooking_updateRoomType"]',
    "lupa_troca_categoria": '//*[@id="btn_selectDetail_updateRoomType"]',
    "container_apartamentos_troca": "/html/body/div[1]/div/div/modal-update-room-type/div[2]/div[5]/div[2]",
    "confirmar_troca_categoria": '//*[@id="btn_confirm_updateRoomType"]',
    "voltar_troca_categoria": '//*[@id="abandonUpdateRooms"]',
    "voltar_reserva": '//*[@id="cancelReservation"]',
}

HITS_RELATIVE_SELECTORS = {
    "data_card": "./div[1]/div[2]/div/div[2]/span[1]",
    "apartamento_card": "./div[1]/div[1]/div[1]/span[3]",
    "botao_vincular": './/*[starts-with(@id,"btnRoomSelectInEdit_")]',
    "botao_categoria": './/*[starts-with(@id,"btn_upgrade_card_")]',
}

CATEGORY_MAP = {
    "3CS": {"xpath": "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[1]"},
    "1CSS": {"xpath": "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[2]"},
    "1CC": {"xpath": "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[3]"},
    "2CSS": {"xpath": "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[4]"},
    "2CC": {"xpath": "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[5]"},
    "SP": {"xpath": "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[6]"},
}

CATEGORIAS_CONHECIDAS = {"1CC", "2CC", "1CSS", "2CSS", "3CS", "SP"}

TIMEOUTS = {
    "padrao": 15,
    "clique_menu": 3,
    "loading_hits": 20,
    "apos_login": 1,
    "apos_pesquisa": 1,
    "apos_abrir_reserva": 1,
    "apos_abrir_troca_categoria": 1,
    "apos_selecionar_categoria": 1,
    "apos_voltar_troca_categoria": 1,
    "apos_fechar_modal_quartos": 2,
    "apos_sair_reserva": 1,
}

RETRY_CONFIG = {
    "tentativas_menu": 2,
    "tentativas_pesquisa": 3,
    "tentativas_vinculacao": 3,
    "tentativas_troca_categoria": 3,
    "tentativas_click": 3,
    "intervalo_click": 0.5,
}

GRID_APARTAMENTO_ID_RE = re.compile(r"^(.+)-(\d+)-uiGrid-000D-cell$")
CARD_ID_RE = re.compile(r"^cardRoomType(1CSS|2CSS|1CC|2CC|3CS|SP)(\d+)$")
TRAILING_NUMERIC_ZERO_RE = re.compile(r"^(.+)\.0$")


@dataclass
class RuntimeConfig:
    hits_url: str
    hits_email: str
    hits_password: str
    spreadsheet_id: str
    spreadsheet_url: str
    google_credentials_json: str
    google_service_account_json: str
    google_credentials_file: str


@dataclass
class Tarefa:
    linha_planilha: int
    voucher: str
    apartamento_destino: str
    categoria_destino: str
    hospede: str
    data_checkin: date
    status_extra: str
    status: str = "PENDENTE"
    card_id: str | None = None
    resultado: str | None = None


@dataclass
class GridRow:
    indice_linha: int
    apartamento_atual: str
    categoria_atual: str
    prefixo_grid: str


@dataclass
class CardInfo:
    card_id: str
    categoria: str
    indice_card: int
    data_checkin: date
    apartamento_atual: str
    id_botao_vincular: str | None
    id_botao_categoria: str | None


@dataclass
class ResumoExecucao:
    total_linhas_planilha: int = 0
    total_vouchers: int = 0
    vinculados_com_sucesso: int = 0
    ja_estavam_corretos: int = 0
    grupos_concluidos: int = 0
    grupos_parciais: int = 0
    vouchers_nao_encontrados: int = 0
    categorias_desconhecidas: int = 0
    falhas: int = 0
    detalhes: list[dict[str, Any]] = field(default_factory=list)


def preparar_diretorios() -> None:
    for directory in (LOG_DIR, ERROR_DIR, RESULT_DIR):
        directory.mkdir(parents=True, exist_ok=True)


def configurar_logging() -> None:
    preparar_diretorios()
    log_file = LOG_DIR / "vinc3.log"
    operational_log_file = LOG_DIR / "vinc3_operacional.log"

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.setLevel(logging.INFO)

    technical_handler = logging.FileHandler(log_file, encoding="utf-8")
    technical_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s"))
    root_logger.addHandler(technical_handler)

    operational_logger = logging.getLogger(OPER_LOGGER_NAME)
    operational_logger.handlers.clear()
    operational_logger.setLevel(logging.INFO)
    operational_logger.propagate = False

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(logging.Formatter("%(message)s"))
    operational_logger.addHandler(console_handler)

    operational_file_handler = logging.FileHandler(operational_log_file, encoding="utf-8")
    operational_file_handler.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
    operational_logger.addHandler(operational_file_handler)


def op_log(message: str) -> None:
    logging.getLogger(OPER_LOGGER_NAME).info(message)


def descrever_tarefas(tarefas: Iterable[Tarefa]) -> str:
    partes = [f"{tarefa.apartamento_destino}/{tarefa.categoria_destino}" for tarefa in tarefas]
    return ", ".join(partes)


def carregar_env_local() -> None:
    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
            continue
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        elif value[:1] in {"'", '"'}:
            value = value[1:]
        os.environ.setdefault(key, value)


def carregar_configuracoes() -> RuntimeConfig:
    carregar_env_local()
    return RuntimeConfig(
        hits_url=os.getenv("HITS_URL", str(CONFIG_HITS["url_padrao"])).strip(),
        hits_email=os.getenv("HITS_EMAIL", "").strip(),
        hits_password=os.getenv("HITS_PASSWORD", "").strip(),
        spreadsheet_id=os.getenv("SPREADSHEET_ID", "").strip(),
        spreadsheet_url=os.getenv("SPREADSHEET_URL", "").strip(),
        google_credentials_json=os.getenv("GOOGLE_CREDENTIALS_JSON", "").strip(),
        google_service_account_json=os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip(),
        google_credentials_file=os.getenv("GOOGLE_CREDENTIALS_FILE", "").strip(),
    )


def validar_variaveis_ambiente(config: RuntimeConfig) -> None:
    ausentes = [
        name
        for name, value in {
            "HITS_URL": config.hits_url,
            "HITS_EMAIL": config.hits_email,
            "HITS_PASSWORD": config.hits_password,
        }.items()
        if not value
    ]
    if not config.spreadsheet_id and not config.spreadsheet_url:
        logging.info("SPREADSHEET_ID/SPREADSHEET_URL ausente; usando ID padrao herdado do Vinc2")
    if ausentes:
        raise RuntimeError(f"Variaveis obrigatorias ausentes: {', '.join(ausentes)}")
    carregar_google_credentials_info(config)


def resolver_caminho_credenciais(caminho: str) -> Path:
    expandido = Path(os.path.expandvars(os.path.expanduser(caminho.strip().strip('"').strip("'"))))
    if expandido.is_absolute():
        return expandido
    return BASE_DIR / expandido


def descobrir_arquivo_credenciais_local() -> Path | None:
    pastas_candidatas = [
        BASE_DIR,
        BASE_DIR / "vinculacao hoje",
        BASE_DIR / "vinculação hoje",
        BASE_DIR / "VINCULACAO_HOJE",
        BASE_DIR / "vinculacao",
        BASE_DIR / "vinculação",
    ]
    arquivos: list[Path] = []
    arquivo_padrao = BASE_DIR / CONFIG_PLANILHA["arquivo_json_padrao_vinc2"]
    if arquivo_padrao.exists() and arquivo_padrao.is_file():
        return arquivo_padrao

    for pasta in pastas_candidatas:
        if not pasta.exists() or not pasta.is_dir():
            continue
        for arquivo in pasta.glob("*.json"):
            if arquivo.name.lower() in {"package.json", "package-lock.json", "resumo.json"}:
                continue
            try:
                info = json.loads(arquivo.read_text(encoding="utf-8-sig"))
            except (OSError, json.JSONDecodeError):
                continue
            if info.get("type") == "service_account" and info.get("client_email") and info.get("private_key"):
                arquivos.append(arquivo)

    if len(arquivos) == 1:
        return arquivos[0]
    if len(arquivos) > 1:
        nomes = ", ".join(str(path.relative_to(BASE_DIR)) for path in arquivos)
        raise RuntimeError(
            "Mais de um JSON de conta de servico encontrado automaticamente. "
            f"Defina GOOGLE_CREDENTIALS_FILE no .env. Candidatos: {nomes}"
        )
    return None


def carregar_google_credentials_info(config: RuntimeConfig) -> dict[str, Any]:
    erro_json_env: json.JSONDecodeError | None = None
    erro_credencial_env: RuntimeError | None = None
    info: dict[str, Any] | None = None
    json_env = config.google_credentials_json or config.google_service_account_json
    if json_env:
        valor = json_env.strip()
        possivel_arquivo = resolver_caminho_credenciais(valor)
        if possivel_arquivo.exists() and possivel_arquivo.is_file():
            info = json.loads(possivel_arquivo.read_text(encoding="utf-8-sig"))
        else:
            try:
                info = json.loads(valor)
            except json.JSONDecodeError as exc:
                erro_json_env = exc

    if info is not None:
        try:
            validar_google_credentials_info(info)
            return info
        except RuntimeError as exc:
            erro_credencial_env = exc

    if config.google_credentials_file:
        caminho = resolver_caminho_credenciais(config.google_credentials_file)
        if not caminho.exists():
            raise RuntimeError(f"GOOGLE_CREDENTIALS_FILE nao encontrado: {caminho}")
        info = json.loads(caminho.read_text(encoding="utf-8-sig"))
        validar_google_credentials_info(info)
        return info

    caminho_auto = descobrir_arquivo_credenciais_local()
    if caminho_auto is not None:
        logging.info("Usando arquivo local de credenciais Google: %s", caminho_auto)
        info = json.loads(caminho_auto.read_text(encoding="utf-8-sig"))
        validar_google_credentials_info(info)
        return info

    if erro_json_env is not None:
        raise RuntimeError(
            "GOOGLE_CREDENTIALS_JSON nao contem JSON valido e nenhum arquivo local foi encontrado. "
            "Para rodar localmente, prefira GOOGLE_CREDENTIALS_FILE=caminho/do/token.json"
        ) from erro_json_env
    if erro_credencial_env is not None:
        raise RuntimeError(
            "GOOGLE_CREDENTIALS_JSON foi lido, mas nao parece ser o JSON completo da conta de servico. "
            "Para rodar localmente, prefira GOOGLE_CREDENTIALS_FILE=caminho/do/token.json"
        ) from erro_credencial_env

    raise RuntimeError(
        "Credenciais Google ausentes. Configure GOOGLE_CREDENTIALS_JSON ou GOOGLE_CREDENTIALS_FILE no .env."
    )


def validar_google_credentials_info(info: dict[str, Any]) -> None:
    obrigatorios = ["type", "client_email", "private_key", "token_uri"]
    ausentes = [key for key in obrigatorios if not info.get(key)]
    if ausentes:
        raise RuntimeError(
            "Credencial Google invalida. O JSON precisa ser o arquivo completo da conta de servico. "
            f"Campos ausentes: {', '.join(ausentes)}"
        )
    if info.get("type") != "service_account":
        raise RuntimeError("Credencial Google invalida: o campo type precisa ser service_account")


def conectar_planilha(config: RuntimeConfig) -> gspread.Worksheet:
    info = carregar_google_credentials_info(config)
    scopes = [
        "https://www.googleapis.com/auth/spreadsheets.readonly",
        "https://www.googleapis.com/auth/drive.readonly",
    ]
    credentials = Credentials.from_service_account_info(info, scopes=scopes)
    client = gspread.authorize(credentials)
    spreadsheet_id_configurado = extrair_spreadsheet_id(config.spreadsheet_id) if config.spreadsheet_id else ""
    spreadsheet_id_padrao = str(CONFIG_PLANILHA["id_padrao_vinc2"])
    try:
        if spreadsheet_id_configurado:
            spreadsheet = client.open_by_key(spreadsheet_id_configurado)
        elif config.spreadsheet_url:
            spreadsheet = client.open_by_url(config.spreadsheet_url)
        else:
            logging.info("Abrindo planilha pelo ID padrao usado no Vinc2")
            spreadsheet = client.open_by_key(spreadsheet_id_padrao)
    except SpreadsheetNotFound as exc:
        if spreadsheet_id_configurado and spreadsheet_id_configurado != spreadsheet_id_padrao:
            logging.warning(
                "SPREADSHEET_ID configurado nao abriu. Tentando fallback com o ID padrao usado no Vinc2."
            )
            try:
                spreadsheet = client.open_by_key(spreadsheet_id_padrao)
            except SpreadsheetNotFound as fallback_exc:
                raise RuntimeError(
                    "Nem o SPREADSHEET_ID do .env nem o ID padrao herdado do Vinc2 abriram no Google Sheets. "
                    "Confira se a planilha foi compartilhada com o e-mail da conta de servico do JSON."
                ) from fallback_exc
        else:
            raise RuntimeError(
                "Planilha nao encontrada pelo Google Sheets. Isso acontece quando SPREADSHEET_ID/SPREADSHEET_URL "
                "nao aponta para a planilha correta ou quando a planilha nao foi compartilhada com o e-mail da "
                "conta de servico do arquivo JSON. Este erro acontece antes de ler a aba VINCULACAO_HOJE."
            ) from exc
    except APIError as exc:
        raise RuntimeError(f"Falha da API Google Sheets ao abrir a planilha: {exc}") from exc

    try:
        return spreadsheet.worksheet(CONFIG_PLANILHA["nome_aba"])
    except WorksheetNotFound as exc:
        raise RuntimeError(
            f"A planilha abriu, mas a aba {CONFIG_PLANILHA['nome_aba']} nao foi encontrada. "
            "Confira se o nome da aba esta exatamente igual, inclusive acentos, espacos e maiusculas."
        ) from exc


def extrair_spreadsheet_id(valor: str) -> str:
    texto = valor.strip()
    match = re.search(r"/spreadsheets/d/([^/?#]+)", texto)
    if match:
        return match.group(1)
    return texto


def remover_ponto_zero_final(valor: str) -> str:
    texto = valor.strip()
    match = TRAILING_NUMERIC_ZERO_RE.match(texto)
    if match:
        return match.group(1)
    return texto


def normalizar_texto_planilha(valor: Any) -> str:
    if valor is None:
        return ""
    return remover_ponto_zero_final(str(valor).strip())


def normalizar_categoria(valor: Any) -> str:
    return normalizar_texto_planilha(valor).upper()


def parse_data(valor: Any) -> date:
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor

    texto = normalizar_texto_planilha(valor)
    if not texto:
        raise ValueError("data vazia")

    if re.fullmatch(r"\d+(\.\d+)?", texto):
        serial = float(texto)
        return (date(1899, 12, 30) + timedelta(days=int(serial)))

    formatos = (
        "%d/%m/%Y",
        "%d/%m/%y",
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d.%m.%Y",
        "%d/%m/%Y %H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
    )
    for fmt in formatos:
        try:
            return datetime.strptime(texto, fmt).date()
        except ValueError:
            pass

    raise ValueError(f"data invalida: {texto}")


def coluna_para_indice(coluna: str) -> int:
    total = 0
    for char in coluna.upper():
        total = total * 26 + (ord(char) - ord("A") + 1)
    return total - 1


def obter_celula(linha: list[str], coluna: str) -> str:
    indice = coluna_para_indice(coluna)
    if indice >= len(linha):
        return ""
    return linha[indice]


def ler_tarefas_planilha(worksheet: gspread.Worksheet) -> list[Tarefa]:
    valores = worksheet.get_all_values()
    tarefas: list[Tarefa] = []
    linha_inicial = int(CONFIG_PLANILHA["linha_inicial"])

    for offset, linha in enumerate(valores[linha_inicial - 1 :], start=linha_inicial):
        voucher = normalizar_texto_planilha(obter_celula(linha, CONFIG_PLANILHA["coluna_voucher"]))
        apartamento = normalizar_texto_planilha(obter_celula(linha, CONFIG_PLANILHA["coluna_apartamento"]))
        categoria = normalizar_categoria(obter_celula(linha, CONFIG_PLANILHA["coluna_categoria"]))
        hospede = normalizar_texto_planilha(obter_celula(linha, CONFIG_PLANILHA["coluna_hospede"]))
        data_raw = obter_celula(linha, CONFIG_PLANILHA["coluna_data_checkin"])
        status_extra = normalizar_texto_planilha(obter_celula(linha, CONFIG_PLANILHA["coluna_status_extra"]))

        if not any([voucher, apartamento, categoria, data_raw, hospede, status_extra]):
            continue

        faltando = []
        if not voucher:
            faltando.append("Voucher")
        if not apartamento:
            faltando.append("Apto Sugerido")
        if not categoria:
            faltando.append("Categoria")
        if not data_raw:
            faltando.append("Data Check-in")
        if faltando:
            raise RuntimeError(f"Linha {offset} possui campos obrigatorios vazios: {', '.join(faltando)}")

        tarefas.append(
            Tarefa(
                linha_planilha=offset,
                voucher=voucher,
                apartamento_destino=apartamento,
                categoria_destino=categoria,
                hospede=hospede,
                data_checkin=parse_data(data_raw),
                status_extra=status_extra,
            )
        )

    logging.info("Tarefas lidas da planilha: %s", len(tarefas))
    return tarefas


def agrupar_tarefas_por_voucher(tarefas: Iterable[Tarefa]) -> dict[str, dict[date, list[Tarefa]]]:
    agrupado: DefaultDict[str, DefaultDict[date, list[Tarefa]]] = defaultdict(lambda: defaultdict(list))
    for tarefa in tarefas:
        agrupado[tarefa.voucher][tarefa.data_checkin].append(tarefa)
    return {voucher: dict(datas) for voucher, datas in agrupado.items()}


def iniciar_navegador(headless: bool) -> WebDriver:
    chrome_options = Options()
    chrome_options.add_argument("--lang=pt-BR")
    if headless:
        chrome_options.add_argument("--headless=new")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
    else:
        chrome_options.add_argument("--start-maximized")
        chrome_options.add_argument("--window-size=1920,1080")
    return webdriver.Chrome(options=chrome_options)


def wait(driver: WebDriver, timeout: int | float | None = None) -> WebDriverWait:
    return WebDriverWait(driver, timeout or TIMEOUTS["padrao"])


def esperar_estabilizacao(nome_timeout: str) -> None:
    time.sleep(float(TIMEOUTS[nome_timeout]))


def esta_visivel_habilitado(elemento: WebElement) -> bool:
    try:
        return elemento.is_displayed() and elemento.is_enabled()
    except StaleElementReferenceException:
        return False


def elementos_visiveis_habilitados(contexto: WebDriver | WebElement, xpath: str) -> list[WebElement]:
    return [el for el in contexto.find_elements(By.XPATH, xpath) if esta_visivel_habilitado(el)]


def elemento_esta_visivel(driver: WebDriver, xpath: str) -> bool:
    try:
        return any(elemento.is_displayed() for elemento in driver.find_elements(By.XPATH, xpath))
    except StaleElementReferenceException:
        return False


def aguardar_block_ui_sumir(driver: WebDriver, timeout: int | float | None = None) -> None:
    limite = timeout or TIMEOUTS["loading_hits"]
    wait(driver, limite).until(
        lambda d: not elemento_esta_visivel(d, HITS_SELECTORS["block_ui_overlay"])
        and not elemento_esta_visivel(d, HITS_SELECTORS["block_ui_message"])
    )


def menu_lateral_esta_aberto(driver: WebDriver) -> bool:
    try:
        navs = driver.find_elements(By.XPATH, HITS_SELECTORS["nav_options"])
        return any(nav.is_displayed() for nav in navs)
    except StaleElementReferenceException:
        return False


def modal_quartos_esta_aberto(driver: WebDriver) -> bool:
    return elemento_esta_visivel(driver, HITS_SELECTORS["titulo_modal_quartos"])


def clicar(driver: WebDriver, elemento: WebElement) -> None:
    ultimo_erro: Exception | None = None
    for tentativa in range(1, RETRY_CONFIG["tentativas_click"] + 1):
        try:
            aguardar_block_ui_sumir(driver, timeout=5)
        except TimeoutException:
            pass
        try:
            driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'center'});", elemento)
            elemento.click()
            return
        except (ElementClickInterceptedException, ElementNotInteractableException, StaleElementReferenceException) as exc:
            ultimo_erro = exc
            if tentativa == RETRY_CONFIG["tentativas_click"]:
                break
            logging.warning(
                "Clique nao aceito na tentativa %s/%s; aguardando %.1fs e tentando novamente.",
                tentativa,
                RETRY_CONFIG["tentativas_click"],
                RETRY_CONFIG["intervalo_click"],
            )
            time.sleep(float(RETRY_CONFIG["intervalo_click"]))
    if ultimo_erro is not None:
        raise ultimo_erro


def aguardar_elemento(driver: WebDriver, xpath: str, timeout: int | float | None = None) -> WebElement:
    return wait(driver, timeout).until(EC.visibility_of_element_located((By.XPATH, xpath)))


def aguardar_clicavel(driver: WebDriver, xpath: str, timeout: int | float | None = None) -> WebElement:
    return wait(driver, timeout).until(EC.element_to_be_clickable((By.XPATH, xpath)))


def sanitizar_nome_arquivo(valor: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "_", valor or "sem_voucher").strip("_") or "sem_voucher"


def salvar_screenshot(driver: WebDriver | None, voucher: str, codigo_erro: str) -> Path | None:
    if driver is None:
        return None
    nome = f"{datetime.now():%Y%m%d_%H%M%S}_{sanitizar_nome_arquivo(voucher)}_{codigo_erro}.png"
    destino = ERROR_DIR / nome
    driver.save_screenshot(str(destino))
    return destino


def salvar_html(driver: WebDriver | None, voucher: str, codigo_erro: str) -> Path | None:
    if driver is None:
        return None
    nome = f"{datetime.now():%Y%m%d_%H%M%S}_{sanitizar_nome_arquivo(voucher)}_{codigo_erro}.html"
    destino = ERROR_DIR / nome
    destino.write_text(driver.page_source, encoding="utf-8")
    return destino


def salvar_artefatos_erro(driver: WebDriver | None, voucher: str, codigo_erro: str) -> None:
    try:
        screenshot = salvar_screenshot(driver, voucher, codigo_erro)
        html = salvar_html(driver, voucher, codigo_erro)
        logging.error("Artefatos de erro salvos: screenshot=%s html=%s", screenshot, html)
    except WebDriverException:
        logging.exception("Falha ao salvar artefatos de erro para %s/%s", voucher, codigo_erro)


def fazer_login(driver: WebDriver, config: RuntimeConfig) -> None:
    op_log("[...] Conectando ao HITS")
    logging.info("Abrindo HITS")
    driver.get(config.hits_url)
    try:
        email = aguardar_elemento(driver, HITS_SELECTORS["login_email"])
        senha = aguardar_elemento(driver, HITS_SELECTORS["login_password"])
        email.clear()
        email.send_keys(config.hits_email)
        senha.clear()
        senha.send_keys(config.hits_password)
        clicar(driver, aguardar_clicavel(driver, HITS_SELECTORS["login_confirm"]))
        aguardar_elemento(driver, HITS_SELECTORS["menu_lateral"])
        aguardar_block_ui_sumir(driver)
        esperar_estabilizacao("apos_login")
        logging.info("Login realizado")
        op_log("[OK] HITS conectado")
    except Exception:
        salvar_artefatos_erro(driver, "LOGIN", "FALHA_LOGIN")
        raise


def acessar_reservas(driver: WebDriver) -> None:
    ultimo_erro: Exception | None = None
    for tentativa in range(1, RETRY_CONFIG["tentativas_menu"] + 1):
        try:
            logging.info("Acessando Reservas > Sub-reservas (tentativa %s)", tentativa)
            aguardar_block_ui_sumir(driver)
            if not menu_lateral_esta_aberto(driver):
                wait(driver, TIMEOUTS["clique_menu"]).until(
                    EC.invisibility_of_element_located((By.XPATH, HITS_SELECTORS["overlay_nav"]))
                )
                clicar(driver, aguardar_clicavel(driver, HITS_SELECTORS["menu_lateral"], TIMEOUTS["clique_menu"]))
                aguardar_elemento(driver, HITS_SELECTORS["nav_options"], TIMEOUTS["clique_menu"])
            aguardar_block_ui_sumir(driver)
            clicar(driver, aguardar_clicavel(driver, HITS_SELECTORS["menu_reservas"], TIMEOUTS["clique_menu"]))
            aguardar_block_ui_sumir(driver)
            clicar(driver, aguardar_clicavel(driver, HITS_SELECTORS["menu_sub_reservas"], TIMEOUTS["clique_menu"]))
            aguardar_block_ui_sumir(driver)
            aguardar_elemento(driver, HITS_SELECTORS["botao_voucher"])
            logging.info("Tela de reservas acessada")
            op_log("[OK] Tela de reservas aberta")
            return
        except Exception as exc:
            ultimo_erro = exc
            logging.warning("Falha ao acessar menu na tentativa %s: %s", tentativa, exc)
            time.sleep(TIMEOUTS["clique_menu"])
    salvar_artefatos_erro(driver, "MENU", "FALHA_MENU")
    raise RuntimeError("Nao foi possivel acessar Reservas > Sub-reservas") from ultimo_erro


def remover_filtro_data(driver: WebDriver) -> None:
    botoes = elementos_visiveis_habilitados(driver, HITS_SELECTORS["remover_filtro_data"])
    if not botoes:
        logging.info("Filtro de data ja ausente")
        op_log("[OK] Filtro de data ja estava removido")
        return
    clicar(driver, botoes[0])
    wait(driver).until(EC.invisibility_of_element_located((By.XPATH, HITS_SELECTORS["remover_filtro_data"])))
    logging.info("Filtro de data removido")
    op_log("[OK] Filtro de data removido")


def pesquisar_voucher(driver: WebDriver, voucher: str) -> None:
    ultimo_erro: Exception | None = None
    for tentativa in range(1, RETRY_CONFIG["tentativas_pesquisa"] + 1):
        try:
            logging.info("Pesquisando voucher %s (tentativa %s)", voucher, tentativa)
            clicar(driver, aguardar_clicavel(driver, HITS_SELECTORS["botao_voucher"]))
            campo = aguardar_elemento(driver, HITS_SELECTORS["campo_voucher"])
            campo.send_keys(Keys.CONTROL, "a")
            campo.send_keys(Keys.BACKSPACE)
            campo.send_keys(voucher)
            clicar(driver, aguardar_clicavel(driver, HITS_SELECTORS["confirmar_pesquisa"]))
            aguardar_elemento(driver, HITS_SELECTORS["grid_container"])
            esperar_estabilizacao("apos_pesquisa")
            return
        except Exception as exc:
            ultimo_erro = exc
            logging.warning("Falha pesquisando voucher %s na tentativa %s: %s", voucher, tentativa, exc)
    salvar_artefatos_erro(driver, voucher, "GRID_NAO_CARREGADO")
    raise RuntimeError(f"Falha ao pesquisar voucher {voucher}") from ultimo_erro


def ler_grid_resultados(driver: WebDriver, voucher: str) -> list[GridRow]:
    linhas: list[GridRow] = []
    celulas = driver.find_elements(By.XPATH, HITS_SELECTORS["grid_apartamentos"])
    for celula in celulas:
        elemento_id = celula.get_attribute("id") or ""
        match = GRID_APARTAMENTO_ID_RE.match(elemento_id)
        if not match:
            continue
        prefixo, indice_texto = match.groups()
        indice = int(indice_texto)
        categoria_xpath = f'//*[@id="{prefixo}-{indice}-uiGrid-000E-cell"]/div'
        try:
            categoria = normalizar_categoria(driver.find_element(By.XPATH, categoria_xpath).text)
        except NoSuchElementException:
            categoria = ""
        linhas.append(
            GridRow(
                indice_linha=indice,
                apartamento_atual=normalizar_texto_planilha(celula.text) or "N/D",
                categoria_atual=categoria,
                prefixo_grid=prefixo,
            )
        )
    linhas.sort(key=lambda item: item.indice_linha)
    logging.info("Voucher %s: %s linha(s) no grid", voucher, len(linhas))
    if not linhas:
        salvar_artefatos_erro(driver, voucher, "VOUCHER_NAO_ENCONTRADO")
    return linhas


def decidir_tipo_reserva(tarefas_data: list[Tarefa], grid_rows: list[GridRow]) -> str:
    if len(tarefas_data) > 1 or len(grid_rows) > 1:
        return "RESERVA_GRUPO"
    return "RESERVA_INDIVIDUAL"


def abrir_reserva(driver: WebDriver, voucher: str) -> None:
    botoes = elementos_visiveis_habilitados(driver, HITS_SELECTORS["botao_editar"])
    if len(botoes) > 1:
        botoes_restritos: list[WebElement] = []
        for container in driver.find_elements(By.XPATH, HITS_SELECTORS["grid_container"]):
            botoes_restritos.extend(elementos_visiveis_habilitados(container, './/*[starts-with(@id,"btn_edit_")]'))
        botoes = botoes_restritos

    ids_botoes = {(botao.get_attribute("id") or "") for botao in botoes}
    if len(botoes) > 1 and ids_botoes == {f"btn_edit_{voucher}"}:
        logging.info(
            "Voucher %s possui %s botoes de editar com o mesmo id; usando o primeiro visivel do grupo",
            voucher,
            len(botoes),
        )
        botoes = [botoes[0]]

    if len(botoes) == 0:
        salvar_artefatos_erro(driver, voucher, "BOTAO_EDITAR_NAO_ENCONTRADO")
        raise RuntimeError(f"Botao de editar nao encontrado para voucher {voucher}")
    if len(botoes) > 1:
        salvar_artefatos_erro(driver, voucher, "BOTAO_EDITAR_AMBIGUO")
        raise RuntimeError(f"Mais de um botao de editar visivel para voucher {voucher}")

    op_log(f"[...] {voucher} | abrindo reserva")
    clicar(driver, botoes[0])
    aguardar_elemento(driver, HITS_SELECTORS["cards"])
    esperar_estabilizacao("apos_abrir_reserva")
    logging.info("Reserva aberta para voucher %s", voucher)


def interpretar_card_id(card_id: str) -> tuple[str, int]:
    match = CARD_ID_RE.match(card_id)
    if not match:
        raise ValueError(f"ID de card nao reconhecido: {card_id}")
    categoria, indice = match.groups()
    return categoria, int(indice)


def ler_data_card(card: WebElement) -> date:
    texto = card.find_element(By.XPATH, HITS_RELATIVE_SELECTORS["data_card"]).text.strip()
    return parse_data(texto)


def ler_apartamento_card(card: WebElement) -> str:
    return normalizar_texto_planilha(card.find_element(By.XPATH, HITS_RELATIVE_SELECTORS["apartamento_card"]).text) or "N/D"


def obter_id_botao_unico(card: WebElement, xpath: str) -> str | None:
    botoes = elementos_visiveis_habilitados(card, xpath)
    if len(botoes) == 1:
        return botoes[0].get_attribute("id")
    return None


def mapear_cards(driver: WebDriver, voucher: str) -> list[CardInfo]:
    cards: list[CardInfo] = []
    for card in driver.find_elements(By.XPATH, HITS_SELECTORS["cards"]):
        if not card.is_displayed():
            continue
        card_id = card.get_attribute("id") or ""
        try:
            categoria, indice = interpretar_card_id(card_id)
        except ValueError:
            salvar_artefatos_erro(driver, voucher, "CARD_ID_NAO_RECONHECIDO")
            logging.exception("Card com ID nao reconhecido: %s", card_id)
            continue
        try:
            data_checkin = ler_data_card(card)
        except Exception:
            salvar_artefatos_erro(driver, voucher, "CARD_SEM_DATA")
            logging.exception("Nao foi possivel ler data do card %s", card_id)
            continue
        try:
            apartamento = ler_apartamento_card(card)
        except Exception:
            salvar_artefatos_erro(driver, voucher, "NAO_FOI_POSSIVEL_VERIFICAR")
            logging.exception("Nao foi possivel ler apartamento do card %s", card_id)
            apartamento = ""
        cards.append(
            CardInfo(
                card_id=card_id,
                categoria=categoria,
                indice_card=indice,
                data_checkin=data_checkin,
                apartamento_atual=apartamento,
                id_botao_vincular=obter_id_botao_unico(card, HITS_RELATIVE_SELECTORS["botao_vincular"]),
                id_botao_categoria=obter_id_botao_unico(card, HITS_RELATIVE_SELECTORS["botao_categoria"]),
            )
        )
    cards.sort(key=lambda item: item.indice_card)
    logging.info("Voucher %s: %s card(s) mapeado(s)", voucher, len(cards))
    return cards


def localizar_card_por_id(driver: WebDriver, card_id: str) -> WebElement:
    return driver.find_element(By.ID, card_id)


def localizar_botao_vincular_no_card(driver: WebDriver, voucher: str, card_id: str) -> WebElement:
    card = localizar_card_por_id(driver, card_id)
    botoes = elementos_visiveis_habilitados(card, HITS_RELATIVE_SELECTORS["botao_vincular"])
    if len(botoes) != 1:
        salvar_artefatos_erro(driver, voucher, "BOTAO_CAMA_AUSENTE")
        raise RuntimeError(f"Esperado exatamente um botao de vinculacao no card {card_id}; encontrado {len(botoes)}")
    logging.info("Card %s: botao vincular real=%s", card_id, botoes[0].get_attribute("id"))
    return botoes[0]


def localizar_botao_categoria_no_card(driver: WebDriver, voucher: str, card_id: str) -> WebElement:
    card = localizar_card_por_id(driver, card_id)
    botoes = elementos_visiveis_habilitados(card, HITS_RELATIVE_SELECTORS["botao_categoria"])
    if len(botoes) != 1:
        salvar_artefatos_erro(driver, voucher, "BOTAO_CATEGORIA_AUSENTE")
        raise RuntimeError(f"Esperado exatamente um botao de categoria no card {card_id}; encontrado {len(botoes)}")
    logging.info("Card %s: botao categoria real=%s", card_id, botoes[0].get_attribute("id"))
    return botoes[0]


def decidir_acao(
    apartamento_atual: str,
    apartamento_destino: str,
    categoria_atual: str,
    categoria_destino: str,
) -> str:
    if apartamento_atual == apartamento_destino:
        return "NENHUMA_ACAO"
    if categoria_atual == categoria_destino:
        return "ALTERAR_APENAS_APARTAMENTO"
    return "TROCAR_CATEGORIA_E_APARTAMENTO"


def apartamento_modal_esta_selecionado(elemento: WebElement) -> bool:
    atributos = [
        elemento.get_attribute("class") or "",
        elemento.get_attribute("aria-pressed") or "",
        elemento.get_attribute("aria-checked") or "",
        elemento.get_attribute("aria-selected") or "",
        elemento.get_attribute("selected") or "",
    ]
    texto = " ".join(atributos).lower()
    return any(token in texto for token in ("active", "selected", "checked", "true"))


def abrir_modal_apartamentos(driver: WebDriver, voucher: str, card_id: str) -> None:
    if modal_quartos_esta_aberto(driver):
        logging.info("Modal de apartamentos ja esta aberto; seguindo sem clicar novamente na cama")
        return
    botao = localizar_botao_vincular_no_card(driver, voucher, card_id)
    clicar(driver, botao)
    aguardar_elemento(driver, HITS_SELECTORS["titulo_modal_quartos"])
    aguardar_elemento(driver, HITS_SELECTORS["modal_quartos"])


def localizar_apartamento_modal_comum(
    driver: WebDriver,
    apartamento: str,
    timeout: int | float | None = None,
) -> WebElement:
    xpath = (
        f'//*[@id="btn_selectRoom_{apartamento}"]'
        f' | //button[starts-with(@id,"btn_selectRoom_") and '
        f'.//span[@ng-bind="room.Code" and normalize-space(.)="{apartamento}"]]'
    )
    return wait(driver, timeout or TIMEOUTS["padrao"]).until(EC.element_to_be_clickable((By.XPATH, xpath)))


def selecionar_apartamento_modal_comum(
    driver: WebDriver,
    voucher: str,
    apartamento_atual: str,
    apartamento_destino: str,
) -> None:
    aguardar_elemento(driver, HITS_SELECTORS["modal_quartos"])
    if apartamento_atual and apartamento_atual != "N/D":
        botoes_atual = elementos_visiveis_habilitados(driver, f'//*[@id="btn_selectRoom_{apartamento_atual}"]')
        if botoes_atual and apartamento_modal_esta_selecionado(botoes_atual[0]):
            clicar(driver, botoes_atual[0])

    try:
        botao_destino = localizar_apartamento_modal_comum(driver, apartamento_destino)
    except TimeoutException as exc:
        salvar_artefatos_erro(driver, voucher, "APARTAMENTO_NAO_ENCONTRADO")
        raise RuntimeError(f"Apartamento {apartamento_destino} nao encontrado no modal comum") from exc
    clicar(driver, botao_destino)
    clicar(driver, aguardar_clicavel(driver, HITS_SELECTORS["confirmar_quarto"]))
    wait(driver).until(EC.invisibility_of_element_located((By.XPATH, HITS_SELECTORS["titulo_modal_quartos"])))
    esperar_estabilizacao("apos_fechar_modal_quartos")


def xpath_apartamento_troca_categoria(apartamento_destino: str) -> str:
    container = HITS_SELECTORS["container_apartamentos_troca"]
    return (
        f'{container}//div['
        f'starts-with(@id,"btn_linkRoom_updateRoomType_") '
        f'and .//span['
        f'@ng-bind="room.Code" and '
        f'(@title="{apartamento_destino}" or '
        f'normalize-space(.)="{apartamento_destino}")'
        f']'
        f']'
    )


def trocar_categoria_e_apartamento(
    driver: WebDriver,
    voucher: str,
    card_id: str,
    categoria_destino: str,
    apartamento_destino: str,
) -> None:
    botao_categoria = localizar_botao_categoria_no_card(driver, voucher, card_id)
    clicar(driver, botao_categoria)
    esperar_estabilizacao("apos_abrir_troca_categoria")
    clicar(driver, aguardar_clicavel(driver, HITS_SELECTORS["lapis_troca_categoria"]))
    clicar(driver, aguardar_clicavel(driver, HITS_SELECTORS["permitir_overbooking_troca_categoria"]))
    clicar(driver, aguardar_clicavel(driver, HITS_SELECTORS["lupa_troca_categoria"]))
    clicar(driver, aguardar_clicavel(driver, CATEGORY_MAP[categoria_destino]["xpath"]))
    esperar_estabilizacao("apos_selecionar_categoria")
    aguardar_elemento(driver, HITS_SELECTORS["container_apartamentos_troca"])

    apartamento_xpath = xpath_apartamento_troca_categoria(apartamento_destino)
    apartamento = aguardar_clicavel(driver, apartamento_xpath)
    clicar(driver, apartamento)
    clicar(driver, aguardar_clicavel(driver, HITS_SELECTORS["confirmar_troca_categoria"]))
    clicar(driver, aguardar_clicavel(driver, HITS_SELECTORS["voltar_troca_categoria"]))
    esperar_estabilizacao("apos_voltar_troca_categoria")


def encontrar_card_verificacao(
    cards: list[CardInfo],
    data_checkin: date,
    apartamento_destino: str,
    categoria_destino: str | None = None,
) -> CardInfo | None:
    candidatos = [card for card in cards if card.data_checkin == data_checkin]
    for card in candidatos:
        if card.apartamento_atual == apartamento_destino and (categoria_destino is None or card.categoria == categoria_destino):
            return card
    for card in candidatos:
        if card.apartamento_atual == apartamento_destino:
            return card
    return None


def verificar_resultado(
    driver: WebDriver,
    voucher: str,
    tarefa: Tarefa,
    exigir_categoria: bool = False,
) -> tuple[bool, str, CardInfo | None]:
    try:
        cards = mapear_cards(driver, voucher)
        card = encontrar_card_verificacao(
            cards,
            tarefa.data_checkin,
            tarefa.apartamento_destino,
            tarefa.categoria_destino if exigir_categoria else None,
        )
        if card is None:
            candidatos = [c for c in cards if c.data_checkin == tarefa.data_checkin]
            if not candidatos:
                return False, "NAO_FOI_POSSIVEL_VERIFICAR", None
            if any((c.apartamento_atual or "").strip() in ("", "N/D") for c in candidatos):
                return False, "SEM_QUARTO", None
            return False, "APARTAMENTO_DIFERENTE", None
        if card.apartamento_atual == tarefa.apartamento_destino:
            if exigir_categoria and card.categoria != tarefa.categoria_destino:
                return False, "CATEGORIA_DIFERENTE", card
            return True, "VINCULADO_CORRETAMENTE", card
        return False, "APARTAMENTO_DIFERENTE", card
    except Exception:
        salvar_artefatos_erro(driver, voucher, "NAO_FOI_POSSIVEL_VERIFICAR")
        logging.exception("Falha verificando resultado do voucher %s", voucher)
        return False, "NAO_FOI_POSSIVEL_VERIFICAR", None


def registrar_detalhe(
    resumo: ResumoExecucao,
    tarefa: Tarefa,
    tipo: str,
    resultado: str,
    extra: dict[str, Any] | None = None,
) -> None:
    detalhe = {
        "linha_planilha": tarefa.linha_planilha,
        "voucher": tarefa.voucher,
        "data": tarefa.data_checkin.isoformat(),
        "hospede": tarefa.hospede,
        "status_extra": tarefa.status_extra,
        "apartamento_destino": tarefa.apartamento_destino,
        "categoria_destino": tarefa.categoria_destino,
        "tipo": tipo,
        "resultado": resultado,
    }
    if extra:
        detalhe.update(extra)
    resumo.detalhes.append(detalhe)


def selecionar_card_individual(cards: list[CardInfo], tarefa: Tarefa) -> CardInfo | None:
    candidatos = [card for card in cards if card.data_checkin == tarefa.data_checkin]
    if len(candidatos) == 1:
        return candidatos[0]
    if len(cards) == 1:
        return cards[0]
    for card in candidatos:
        if card.apartamento_atual == tarefa.apartamento_destino:
            return card
    return None


def executar_acao_card(
    driver: WebDriver,
    voucher: str,
    tarefa: Tarefa,
    card: CardInfo,
    dry_run: bool,
) -> tuple[bool, str]:
    acao = decidir_acao(
        card.apartamento_atual,
        tarefa.apartamento_destino,
        card.categoria,
        tarefa.categoria_destino,
    )
    logging.info(
        "Voucher=%s linha=%s card=%s data=%s apto_atual=%s apto_destino=%s categoria_atual=%s categoria_destino=%s acao=%s",
        voucher,
        tarefa.linha_planilha,
        card.card_id,
        card.data_checkin.isoformat(),
        card.apartamento_atual,
        tarefa.apartamento_destino,
        card.categoria,
        tarefa.categoria_destino,
        acao,
    )

    if acao == "NENHUMA_ACAO":
        op_log(f"[OK] {voucher} -> {tarefa.apartamento_destino} | ja estava correto")
        return True, "JA_VINCULADO_CORRETAMENTE"

    if dry_run:
        logging.info("DRY-RUN: executaria %s no card %s", acao, card.card_id)
        acao_texto = "vincular apartamento" if acao == "ALTERAR_APENAS_APARTAMENTO" else "trocar categoria e vincular"
        op_log(
            f"[DRY-RUN] {voucher} -> {tarefa.apartamento_destino}/{tarefa.categoria_destino} | "
            f"atual {card.apartamento_atual}/{card.categoria} | acao: {acao_texto}"
        )
        return True, "DRY_RUN_SIMULADO"

    tentativas = (
        RETRY_CONFIG["tentativas_vinculacao"]
        if acao == "ALTERAR_APENAS_APARTAMENTO"
        else RETRY_CONFIG["tentativas_troca_categoria"]
    )
    exigir_categoria = acao == "TROCAR_CATEGORIA_E_APARTAMENTO"

    for tentativa in range(1, tentativas + 1):
        logging.info("Tentativa %s/%s para %s no card %s", tentativa, tentativas, acao, card.card_id)
        try:
            cards_atualizados = mapear_cards(driver, voucher)
            card_atual = encontrar_card_para_tarefa(
                cards_atualizados,
                tarefa,
                preferir_categoria=card.categoria,
                preferir_card_id=card.card_id,
            )
            if card_atual is None:
                raise RuntimeError("Card alvo nao localizado apos remapeamento")
            if acao == "ALTERAR_APENAS_APARTAMENTO":
                abrir_modal_apartamentos(driver, voucher, card_atual.card_id)
                selecionar_apartamento_modal_comum(
                    driver,
                    voucher,
                    card_atual.apartamento_atual,
                    tarefa.apartamento_destino,
                )
            else:
                trocar_categoria_e_apartamento(
                    driver,
                    voucher,
                    card_atual.card_id,
                    tarefa.categoria_destino,
                    tarefa.apartamento_destino,
                )
            ok, resultado, card_final = verificar_resultado(driver, voucher, tarefa, exigir_categoria=exigir_categoria)
            logging.info(
                "Resultado tentativa %s: ok=%s resultado=%s apto_final=%s categoria_final=%s",
                tentativa,
                ok,
                resultado,
                card_final.apartamento_atual if card_final else None,
                card_final.categoria if card_final else None,
            )
            if ok:
                op_log(f"[OK] {voucher} -> {tarefa.apartamento_destino}/{tarefa.categoria_destino} | {resultado}")
                return True, resultado
            if tentativa == tentativas:
                salvar_artefatos_erro(driver, voucher, resultado)
        except StaleElementReferenceException:
            logging.exception("StaleElementReferenceException na tentativa %s", tentativa)
            if tentativa == tentativas:
                salvar_artefatos_erro(driver, voucher, "STALE_RECORRENTE")
                op_log(f"[FALHA] {voucher} -> {tarefa.apartamento_destino} | elemento da tela ficou instavel")
                return False, "STALE_RECORRENTE"
        except Exception as exc:
            logging.exception("Falha controlada na tentativa %s: %s", tentativa, exc)
            if tentativa == tentativas:
                salvar_artefatos_erro(driver, voucher, "LIMITE_TENTATIVAS_ATINGIDO")
                op_log(f"[FALHA] {voucher} -> {tarefa.apartamento_destino} | limite de tentativas atingido")
                return False, "LIMITE_TENTATIVAS_ATINGIDO"
    return False, "LIMITE_TENTATIVAS_ATINGIDO"


def encontrar_card_para_tarefa(
    cards: list[CardInfo],
    tarefa: Tarefa,
    preferir_categoria: str | None = None,
    preferir_card_id: str | None = None,
) -> CardInfo | None:
    candidatos = [card for card in cards if card.data_checkin == tarefa.data_checkin]
    if preferir_card_id:
        for card in candidatos:
            if card.card_id == preferir_card_id:
                return card
    for card in candidatos:
        if card.apartamento_atual == tarefa.apartamento_destino:
            return card
    if preferir_categoria:
        for card in candidatos:
            if card.categoria == preferir_categoria:
                return card
    if candidatos:
        return candidatos[0]
    return None


def processar_reserva_individual(
    driver: WebDriver,
    voucher: str,
    tarefas_data: list[Tarefa],
    grid_rows: list[GridRow],
    dry_run: bool,
    resumo: ResumoExecucao,
) -> None:
    tarefa = tarefas_data[0]
    grid = grid_rows[0] if grid_rows else None
    if grid and grid.apartamento_atual == tarefa.apartamento_destino:
        logging.info("Voucher %s ja esta no apartamento correto pelo grid", voucher)
        op_log(f"[OK] {voucher} -> {tarefa.apartamento_destino}/{tarefa.categoria_destino} | ja estava correto")
        tarefa.status = "CONCLUIDA"
        tarefa.resultado = "JA_VINCULADO_CORRETAMENTE"
        resumo.ja_estavam_corretos += 1
        registrar_detalhe(resumo, tarefa, "RESERVA_INDIVIDUAL", tarefa.resultado, {"origem": "grid"})
        return

    abrir_reserva(driver, voucher)
    try:
        cards = mapear_cards(driver, voucher)
        card = selecionar_card_individual(cards, tarefa)
        if card is None:
            salvar_artefatos_erro(driver, voucher, "QUANTIDADE_CARDS_INCOMPATIVEL")
            raise RuntimeError(f"Nao foi possivel identificar card individual do voucher {voucher}")
        ok, resultado = executar_acao_card(driver, voucher, tarefa, card, dry_run)
        tarefa.status = "CONCLUIDA" if ok else "FALHA"
        tarefa.resultado = resultado
        if resultado == "JA_VINCULADO_CORRETAMENTE":
            resumo.ja_estavam_corretos += 1
        elif ok and resultado in {"VINCULADO_CORRETAMENTE", "DRY_RUN_SIMULADO"}:
            resumo.vinculados_com_sucesso += 1
        else:
            resumo.falhas += 1
        registrar_detalhe(
            resumo,
            tarefa,
            "RESERVA_INDIVIDUAL",
            resultado,
            {"card": card.card_id, "categoria_atual": card.categoria, "apartamento_atual": card.apartamento_atual},
        )
    finally:
        voltar_para_pesquisa(driver, voucher)


def escolher_tarefa_para_card(card: CardInfo, pendentes: list[Tarefa]) -> Tarefa | None:
    for tarefa in pendentes:
        if tarefa.categoria_destino == card.categoria:
            return tarefa
    return pendentes[0] if pendentes else None


def primeira_varredura_grupo(cards: list[CardInfo], tarefas: list[Tarefa], resumo: ResumoExecucao) -> None:
    pendentes = [t for t in tarefas if t.status == "PENDENTE"]
    for card in cards:
        for tarefa in list(pendentes):
            if card.data_checkin == tarefa.data_checkin and card.apartamento_atual == tarefa.apartamento_destino:
                tarefa.status = "CONCLUIDA"
                tarefa.card_id = card.card_id
                tarefa.resultado = "JA_VINCULADO_CORRETAMENTE"
                resumo.ja_estavam_corretos += 1
                pendentes.remove(tarefa)
                logging.info(
                    "Grupo: card %s ja corresponde a linha %s apto %s categoria %s",
                    card.card_id,
                    tarefa.linha_planilha,
                    tarefa.apartamento_destino,
                    tarefa.categoria_destino,
                )
                op_log(f"[OK] {tarefa.voucher} -> {tarefa.apartamento_destino}/{tarefa.categoria_destino} | ja estava correto")
                break


def verificar_grupo_completo(driver: WebDriver, voucher: str, tarefas: list[Tarefa]) -> bool:
    cards = mapear_cards(driver, voucher)
    datas = {tarefa.data_checkin for tarefa in tarefas}
    cards_data = [card for card in cards if card.data_checkin in datas]
    esperados = Counter(tarefa.apartamento_destino for tarefa in tarefas)
    encontrados = Counter(card.apartamento_atual for card in cards_data)
    if encontrados != esperados:
        logging.error("Grupo %s: apartamentos esperados=%s encontrados=%s", voucher, esperados, encontrados)
        return False
    if any((card.apartamento_atual or "").strip() in ("", "N/D") for card in cards_data):
        logging.error("Grupo %s: existe card sem quarto", voucher)
        return False
    categoria_por_apartamento = {tarefa.apartamento_destino: tarefa.categoria_destino for tarefa in tarefas}
    for card in cards_data:
        categoria_esperada = categoria_por_apartamento.get(card.apartamento_atual)
        if categoria_esperada and card.categoria != categoria_esperada:
            logging.error(
                "Grupo %s: categoria final divergente no apto %s: atual=%s esperada=%s",
                voucher,
                card.apartamento_atual,
                card.categoria,
                categoria_esperada,
            )
            return False
    return all(tarefa.status == "CONCLUIDA" for tarefa in tarefas)


def processar_reserva_grupo(
    driver: WebDriver,
    voucher: str,
    tarefas_por_data: dict[date, list[Tarefa]],
    dry_run: bool,
    resumo: ResumoExecucao,
) -> None:
    tarefas = [tarefa for data_key in sorted(tarefas_por_data) for tarefa in tarefas_por_data[data_key]]
    op_log(f"[...] {voucher} | grupo com {len(tarefas)} apto(s): {descrever_tarefas(tarefas)}")
    abrir_reserva(driver, voucher)
    grupo_falhou = False
    try:
        cards = mapear_cards(driver, voucher)
        datas_planilha = set(tarefas_por_data.keys())
        cards_datas_validas = [card for card in cards if card.data_checkin in datas_planilha]
        if len(cards_datas_validas) < len(tarefas):
            salvar_artefatos_erro(driver, voucher, "QUANTIDADE_CARDS_INCOMPATIVEL")
            logging.warning(
                "Grupo %s tem menos cards validos (%s) que tarefas (%s)",
                voucher,
                len(cards_datas_validas),
                len(tarefas),
            )

        primeira_varredura_grupo(cards_datas_validas, tarefas, resumo)

        while any(tarefa.status == "PENDENTE" for tarefa in tarefas):
            cards = mapear_cards(driver, voucher)
            cards_validos = [card for card in cards if card.data_checkin in datas_planilha]
            pendentes = [tarefa for tarefa in tarefas if tarefa.status == "PENDENTE"]
            processou_algum = False

            for card in cards_validos:
                if not pendentes:
                    break
                if any(t.status == "CONCLUIDA" and t.card_id == card.card_id for t in tarefas):
                    continue
                tarefa = escolher_tarefa_para_card(card, pendentes)
                if tarefa is None:
                    continue
                logging.info(
                    "Grupo: Card %s -> linha %s -> apartamento %s -> categoria %s",
                    card.card_id,
                    tarefa.linha_planilha,
                    tarefa.apartamento_destino,
                    tarefa.categoria_destino,
                )
                op_log(f"[...] {voucher} -> {tarefa.apartamento_destino}/{tarefa.categoria_destino} | processando card {card.card_id}")
                ok, resultado = executar_acao_card(driver, voucher, tarefa, card, dry_run)
                tarefa.card_id = card.card_id
                tarefa.status = "CONCLUIDA" if ok else "FALHA"
                tarefa.resultado = resultado
                registrar_detalhe(
                    resumo,
                    tarefa,
                    "RESERVA_GRUPO",
                    resultado,
                    {"card": card.card_id, "categoria_atual": card.categoria, "apartamento_atual": card.apartamento_atual},
                )
                if ok and resultado != "JA_VINCULADO_CORRETAMENTE":
                    resumo.vinculados_com_sucesso += 1
                if not ok:
                    resumo.falhas += 1
                    grupo_falhou = True
                    op_log(f"[FALHA] {voucher} -> {tarefa.apartamento_destino}/{tarefa.categoria_destino} | {resultado}")
                pendentes = [item for item in pendentes if item.status == "PENDENTE"]
                processou_algum = True

            if not processou_algum:
                salvar_artefatos_erro(driver, voucher, "QUANTIDADE_CARDS_INCOMPATIVEL")
                grupo_falhou = True
                op_log(f"[FALHA] {voucher} | quantidade de cards incompativel com a planilha")
                break

        completo = False if dry_run else verificar_grupo_completo(driver, voucher, tarefas)
        if dry_run:
            logging.info("DRY-RUN: varredura final completa nao exige estado gravado")
            completo = all(t.status == "CONCLUIDA" for t in tarefas)
        if completo and not grupo_falhou:
            resumo.grupos_concluidos += 1
            logging.info("GRUPO_CONCLUIDO voucher=%s", voucher)
            op_log(f"[OK] {voucher} | grupo concluido")
        else:
            resumo.grupos_parciais += 1
            logging.warning("GRUPO_CONCLUIDO_PARCIALMENTE voucher=%s", voucher)
            op_log(f"[FALHA] {voucher} | grupo concluido parcialmente")
    finally:
        voltar_para_pesquisa(driver, voucher)


def voltar_para_pesquisa(driver: WebDriver, voucher: str) -> None:
    try:
        clicar(driver, aguardar_clicavel(driver, HITS_SELECTORS["voltar_reserva"]))
        esperar_estabilizacao("apos_sair_reserva")
        aguardar_elemento(driver, HITS_SELECTORS["botao_voucher"])
    except Exception:
        salvar_artefatos_erro(driver, voucher, "FALHA_AO_SAIR_RESERVA")
        raise


def registrar_categoria_desconhecida(
    driver: WebDriver | None,
    resumo: ResumoExecucao,
    tarefa: Tarefa,
) -> None:
    tarefa.status = "FALHA"
    tarefa.resultado = "CATEGORIA_DESCONHECIDA_NA_PLANILHA"
    resumo.categorias_desconhecidas += 1
    registrar_detalhe(resumo, tarefa, "VALIDACAO_PLANILHA", tarefa.resultado)
    logging.error(
        "CATEGORIA_DESCONHECIDA_NA_PLANILHA linha=%s voucher=%s categoria=%s",
        tarefa.linha_planilha,
        tarefa.voucher,
        tarefa.categoria_destino,
    )
    op_log(f"[FALHA] {tarefa.voucher} -> {tarefa.apartamento_destino} | categoria desconhecida: {tarefa.categoria_destino}")
    salvar_artefatos_erro(driver, tarefa.voucher, "CATEGORIA_DESCONHECIDA")


def processar_voucher(
    driver: WebDriver,
    voucher: str,
    tarefas_por_data: dict[date, list[Tarefa]],
    dry_run: bool,
    resumo: ResumoExecucao,
) -> None:
    tarefas = [tarefa for tarefas_data in tarefas_por_data.values() for tarefa in tarefas_data]
    op_log(f"Voucher {voucher} -> {descrever_tarefas(tarefas)}")
    for tarefa in tarefas:
        logging.info(
            "Ordem linha=%s voucher=%s data=%s hospede=%s status_extra=%s apto=%s categoria=%s",
            tarefa.linha_planilha,
            tarefa.voucher,
            tarefa.data_checkin.isoformat(),
            tarefa.hospede,
            tarefa.status_extra,
            tarefa.apartamento_destino,
            tarefa.categoria_destino,
        )

    tarefas_validas_por_data: dict[date, list[Tarefa]] = defaultdict(list)
    for tarefa in tarefas:
        if tarefa.categoria_destino not in CATEGORIAS_CONHECIDAS:
            registrar_categoria_desconhecida(driver, resumo, tarefa)
        else:
            tarefas_validas_por_data[tarefa.data_checkin].append(tarefa)

    if not tarefas_validas_por_data:
        return

    pesquisar_voucher(driver, voucher)
    grid_rows = ler_grid_resultados(driver, voucher)
    if not grid_rows:
        for tarefa in tarefas_validas_por_data.values():
            for item in tarefa:
                op_log(f"[FALHA] {voucher} -> {item.apartamento_destino}/{item.categoria_destino} | voucher nao encontrado no HITS")
        resumo.vouchers_nao_encontrados += 1
        for tarefa in tarefas_validas_por_data.values():
            for item in tarefa:
                item.status = "FALHA"
                item.resultado = "VOUCHER_NAO_ENCONTRADO"
                registrar_detalhe(resumo, item, "PESQUISA", item.resultado)
        return

    todas_tarefas_validas = [item for lista in tarefas_validas_por_data.values() for item in lista]
    tipo = "RESERVA_GRUPO" if len(todas_tarefas_validas) > 1 or len(grid_rows) > 1 else "RESERVA_INDIVIDUAL"
    logging.info("Voucher %s identificado como %s", voucher, tipo)
    op_log(f"[...] {voucher} | HITS retornou {len(grid_rows)} linha(s) | {tipo}")

    if tipo == "RESERVA_INDIVIDUAL":
        processar_reserva_individual(driver, voucher, todas_tarefas_validas, grid_rows, dry_run, resumo)
    else:
        processar_reserva_grupo(driver, voucher, dict(tarefas_validas_por_data), dry_run, resumo)


def gerar_resumo_final(resumo: ResumoExecucao) -> None:
    RESULT_DIR.mkdir(parents=True, exist_ok=True)
    destino = RESULT_DIR / "resumo.json"
    destino.write_text(json.dumps(asdict(resumo), ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    logging.info("Resumo salvo em %s", destino)
    logging.info(
        "Resumo final: linhas=%s vouchers=%s sucesso=%s ja_corretos=%s grupos_ok=%s grupos_parciais=%s nao_encontrados=%s categorias_desconhecidas=%s falhas=%s",
        resumo.total_linhas_planilha,
        resumo.total_vouchers,
        resumo.vinculados_com_sucesso,
        resumo.ja_estavam_corretos,
        resumo.grupos_concluidos,
        resumo.grupos_parciais,
        resumo.vouchers_nao_encontrados,
        resumo.categorias_desconhecidas,
        resumo.falhas,
    )
    op_log(
        "[RESUMO] "
        f"linhas={resumo.total_linhas_planilha} | vouchers={resumo.total_vouchers} | "
        f"sucesso={resumo.vinculados_com_sucesso} | ja_corretos={resumo.ja_estavam_corretos} | "
        f"nao_encontrados={resumo.vouchers_nao_encontrados} | falhas={resumo.falhas}"
    )


def criar_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Vinc3 - robo de vinculacao HITS por planilha Google")
    modo = parser.add_mutually_exclusive_group(required=True)
    modo.add_argument("--visual", action="store_true", help="Executa com Chrome visivel")
    modo.add_argument("--headless", action="store_true", help="Executa com Chrome headless")
    parser.add_argument("--dry-run", action="store_true", help="Le e simula as alteracoes sem confirmar gravacoes")
    return parser


def main() -> int:
    configurar_logging()
    parser = criar_parser()
    args = parser.parse_args()
    resumo = ResumoExecucao()
    driver: WebDriver | None = None

    try:
        modo = "HEADLESS" if args.headless else "VISUAL"
        dry = "DRY-RUN" if args.dry_run else "REAL"
        op_log(f"[INICIO] Vinc3 | modo={modo} | execucao={dry}")
        config = carregar_configuracoes()
        validar_variaveis_ambiente(config)
        worksheet = conectar_planilha(config)
        op_log(f"[OK] Planilha conectada | aba={CONFIG_PLANILHA['nome_aba']}")
        tarefas = ler_tarefas_planilha(worksheet)
        tarefas_por_voucher = agrupar_tarefas_por_voucher(tarefas)
        resumo.total_linhas_planilha = len(tarefas)
        resumo.total_vouchers = len(tarefas_por_voucher)
        op_log(f"[OK] Ordens lidas | linhas={resumo.total_linhas_planilha} | vouchers={resumo.total_vouchers}")

        if not tarefas:
            gerar_resumo_final(resumo)
            return 0

        driver = iniciar_navegador(headless=args.headless)
        fazer_login(driver, config)
        acessar_reservas(driver)
        remover_filtro_data(driver)

        for voucher, tarefas_por_data in tarefas_por_voucher.items():
            try:
                processar_voucher(driver, voucher, tarefas_por_data, args.dry_run, resumo)
            except Exception:
                resumo.falhas += 1
                salvar_artefatos_erro(driver, voucher, "ERRO_PROCESSAMENTO_VOUCHER")
                logging.error("Erro processando voucher %s\n%s", voucher, traceback.format_exc())
                op_log(f"[FALHA] {voucher} | erro no processamento; detalhes em logs/vinc3.log e pasta erros")
                continue

        gerar_resumo_final(resumo)
        return 0 if resumo.falhas == 0 else 1
    except Exception:
        logging.error("Erro global\n%s", traceback.format_exc())
        op_log("[FALHA] Erro global; detalhes em logs/vinc3.log")
        resumo.falhas += 1
        gerar_resumo_final(resumo)
        return 2
    finally:
        if driver is not None:
            driver.quit()


if __name__ == "__main__":
    raise SystemExit(main())
