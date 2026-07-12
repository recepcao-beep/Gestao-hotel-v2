import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path

import gspread
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow


ID_PLANILHA = "1oMKFu9aobTP5sBuF0jjSR4In3Z6EcWfATCe_9ijNFXA"
ABA_DESTINO = "SOLICITAÇÕES"
CONFIRMACAO_EXATA = "ESCREVER_SOLICITACOES_SEM_WEBHOOK"
ARTIFACTS_DIR = Path("artifacts") / "verificacao_diaria"
JSON_LINHAS_EXTRAIDAS = ARTIFACTS_DIR / "obs_linhas_extraidas.json"
BACKUP_PATH = ARTIFACTS_DIR / "backup_solicitacoes_oficial.json"
HEADERS = ["Data", "Voucher", "Andar", "Vínculo", "Categoria", "Observação"]
CHAVES_CRITICAS = (
    "password",
    "senha",
    "secret",
    "client_secret",
    "credential",
    "credencial",
    "authorization",
    "cookie",
    "token",
)


class EscritaOficialError(RuntimeError):
    pass


def hash_json(valor):
    texto = json.dumps(valor, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()


def normalizar_linha(linha, colunas=6):
    valores = [str(celula or "").strip() for celula in linha[:colunas]]
    return valores + [""] * (colunas - len(valores))


def normalizar_linhas(linhas, colunas=6):
    return [normalizar_linha(linha, colunas) for linha in linhas]


def normalizar_data_para_comparacao(valor):
    texto = str(valor or "").strip()
    partes = texto.split("/")
    if len(partes) != 3:
        return texto
    dia, mes, ano = [parte.strip() for parte in partes]
    if not (dia.isdigit() and mes.isdigit() and ano.isdigit()):
        return texto
    ano_int = int(ano)
    if ano_int < 100:
        ano_int += 2000
    try:
        data = datetime.date(ano_int, int(mes), int(dia))
    except ValueError:
        return texto
    return data.strftime("%d/%m/%Y")


def normalizar_linha_para_comparacao(linha, colunas=6):
    valores = normalizar_linha(linha, colunas)
    valores[0] = normalizar_data_para_comparacao(valores[0])
    return valores


def normalizar_linhas_para_comparacao(linhas, colunas=6):
    return [normalizar_linha_para_comparacao(linha, colunas) for linha in linhas]


def validar_confirmacao(confirmacao):
    if confirmacao != CONFIRMACAO_EXATA:
        raise EscritaOficialError("Confirmacao obrigatoria ausente ou incorreta.")


def carregar_json(caminho):
    caminho = Path(caminho)
    if not caminho.exists():
        raise FileNotFoundError(f"Artifact nao encontrado: {caminho}")
    payload = json.loads(caminho.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError("Artifact precisa ser um objeto JSON.")
    return payload


def validar_sem_credenciais(valor, caminho="root"):
    if isinstance(valor, dict):
        for chave, item in valor.items():
            chave_lower = str(chave).lower()
            if any(critica in chave_lower for critica in CHAVES_CRITICAS):
                raise ValueError(f"Campo critico inesperado no artifact: {caminho}.{chave}")
            validar_sem_credenciais(item, f"{caminho}.{chave}")
    elif isinstance(valor, list):
        for indice, item in enumerate(valor):
            validar_sem_credenciais(item, f"{caminho}[{indice}]")
    elif isinstance(valor, str):
        marcadores = ("HITS_EMAIL", "HITS_PASSWORD", "BEGIN PRIVATE KEY", "Bearer ")
        if any(marcador in valor for marcador in marcadores):
            raise ValueError(f"Valor com aparencia de credencial no artifact: {caminho}")


def preparar_linhas(caminho=JSON_LINHAS_EXTRAIDAS):
    payload = carregar_json(caminho)
    validar_sem_credenciais(payload)

    if payload.get("schema_version") != 1:
        raise ValueError("schema_version invalido no artifact.")
    if payload.get("cabecalhos") != HEADERS:
        raise ValueError("Cabecalhos divergentes no artifact.")
    if "linhas_extraidas" not in payload or not isinstance(payload["linhas_extraidas"], list):
        raise ValueError("Artifact sem linhas_extraidas.")

    linhas = normalizar_linhas(payload["linhas_extraidas"])
    if payload.get("quantidade_registros") != len(linhas):
        raise RuntimeError("Quantidade declarada diverge das linhas preparadas.")

    hash_preparado = hash_json(linhas)
    if payload.get("hash_linhas") != hash_preparado:
        raise RuntimeError("Hash declarado diverge das linhas preparadas.")

    quantidade_por_data = {}
    for linha in linhas:
        data = linha[0]
        quantidade_por_data[data] = quantidade_por_data.get(data, 0) + 1
    if payload.get("quantidade_por_data") != dict(sorted(quantidade_por_data.items())):
        raise RuntimeError("Quantidade por data diverge das linhas preparadas.")

    return linhas, {
        "quantidade": len(linhas),
        "hash": hash_preparado,
        "quantidade_por_data": dict(sorted(quantidade_por_data.items())),
    }


def autenticar_google_sheets():
    escopos = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
    creds = None
    diretorio_atual = os.path.dirname(os.path.abspath(__file__))
    caminho_token = os.path.join(diretorio_atual, "token.json")
    caminho_secret = os.path.join(diretorio_atual, "client_secret.json")

    if os.path.exists(caminho_token):
        creds = Credentials.from_authorized_user_file(caminho_token, escopos)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(caminho_secret, escopos)
            creds = flow.run_local_server(port=0)
        with open(caminho_token, "w", encoding="utf-8") as token:
            token.write(creds.to_json())

    return gspread.authorize(creds)


def abrir_aba_oficial(planilha):
    return planilha.worksheet(ABA_DESTINO)


def ler_valores(aba):
    if hasattr(aba, "get_all_values"):
        return aba.get_all_values()
    return aba.get("A1:F")


def salvar_backup_aba(aba, caminho=None):
    caminho = Path(caminho or BACKUP_PATH)
    valores = ler_valores(aba)
    backup = {
        "aba": ABA_DESTINO,
        "gerado_em": datetime.datetime.now().isoformat(timespec="seconds"),
        "quantidade_linhas": len(valores),
        "hash": hash_json(normalizar_linhas(valores)) if valores else hash_json([]),
        "valores": valores,
    }
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text(json.dumps(backup, ensure_ascii=False, indent=2), encoding="utf-8")
    return backup


def restaurar_backup(aba, backup):
    aba.clear()
    valores = backup.get("valores") or []
    if valores:
        aba.update(values=valores, range_name="A1", value_input_option="USER_ENTERED")


def limpar_e_escrever(aba, linhas):
    aba.update(values=[HEADERS], range_name="A1:F1", value_input_option="USER_ENTERED")
    aba.batch_clear(["A2:F"])
    if linhas:
        aba.update(values=linhas, range_name="A2", value_input_option="USER_ENTERED")


def reler_linhas(aba, quantidade):
    if quantidade <= 0:
        return []
    return normalizar_linhas(aba.get(f"A2:F{quantidade + 1}"))


def validar_releitura(linhas_preparadas, linhas_relidas):
    preparadas_brutas = normalizar_linhas(linhas_preparadas)
    relidas_brutas = normalizar_linhas(linhas_relidas)
    if len(preparadas_brutas) != len(relidas_brutas):
        raise RuntimeError(f"Quantidade divergente: preparada={len(preparadas_brutas)} relida={len(relidas_brutas)}")

    preparadas_normalizadas = normalizar_linhas_para_comparacao(preparadas_brutas)
    relidas_normalizadas = normalizar_linhas_para_comparacao(relidas_brutas)
    hashes = {
        "hash_bruto_preparado": hash_json(preparadas_brutas),
        "hash_bruto_relido": hash_json(relidas_brutas),
        "hash_normalizado_preparado": hash_json(preparadas_normalizadas),
        "hash_normalizado_relido": hash_json(relidas_normalizadas),
    }
    if (
        hashes["hash_normalizado_preparado"] != hashes["hash_normalizado_relido"]
        or preparadas_normalizadas != relidas_normalizadas
    ):
        raise RuntimeError(
            "Hash divergente: "
            f"bruto_preparado={hashes['hash_bruto_preparado']} "
            f"bruto_relido={hashes['hash_bruto_relido']} "
            f"normalizado_preparado={hashes['hash_normalizado_preparado']} "
            f"normalizado_relido={hashes['hash_normalizado_relido']}"
        )
    return hashes


def executar(confirmacao, caminho_json=JSON_LINHAS_EXTRAIDAS, autenticar_fn=autenticar_google_sheets):
    validar_confirmacao(confirmacao)
    linhas, resumo = preparar_linhas(caminho_json)

    gc = autenticar_fn()
    planilha = gc.open_by_key(ID_PLANILHA)
    aba = abrir_aba_oficial(planilha)
    backup = salvar_backup_aba(aba)
    hash_anterior = backup["hash"]
    quantidade_anterior = backup["quantidade_linhas"]

    try:
        limpar_e_escrever(aba, linhas)
        relidas = reler_linhas(aba, len(linhas))
        hashes = validar_releitura(linhas, relidas)
    except Exception:
        restaurar_backup(aba, backup)
        print("Backup oficial restaurado com sucesso.")
        raise

    if resumo["quantidade"] != len(linhas) or len(linhas) != len(relidas):
        restaurar_backup(aba, backup)
        print("Backup oficial restaurado com sucesso.")
        raise RuntimeError("Quantidade preparada, escrita e relida divergem.")
    if hashes["hash_normalizado_preparado"] != hashes["hash_normalizado_relido"]:
        restaurar_backup(aba, backup)
        print("Backup oficial restaurado com sucesso.")
        raise RuntimeError("Hash preparado e relido divergem.")

    resultado = {
        "aba": ABA_DESTINO,
        "quantidade_anterior": quantidade_anterior,
        "hash_anterior": hash_anterior,
        "quantidade_preparada": resumo["quantidade"],
        "quantidade_escrita": len(linhas),
        "quantidade_relida": len(relidas),
        "hash_preparado": hashes["hash_normalizado_preparado"],
        "hash_relido": hashes["hash_normalizado_relido"],
        "hash_bruto_preparado": hashes["hash_bruto_preparado"],
        "hash_bruto_relido": hashes["hash_bruto_relido"],
        "hash_normalizado_preparado": hashes["hash_normalizado_preparado"],
        "hash_normalizado_relido": hashes["hash_normalizado_relido"],
        "backup": str(BACKUP_PATH),
        "webhook": "nao_chamado",
    }
    print(json.dumps(resultado, ensure_ascii=False, indent=2, sort_keys=True))
    return resultado


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Valida escrita oficial OBS sem webhook.")
    parser.add_argument("--arquivo-dados", default=str(JSON_LINHAS_EXTRAIDAS))
    parser.add_argument("--confirmacao", required=True)
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    try:
        executar(args.confirmacao, args.arquivo_dados)
        return 0
    except Exception as erro:
        print(f"Falha na validacao oficial sem webhook: {erro}")
        print("Webhook nao chamado.")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
