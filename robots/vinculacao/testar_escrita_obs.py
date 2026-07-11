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
ABA_DESTINO_PERMITIDA = "SOLICITACOES_TESTE_OBS"
ABA_DESTINO = ABA_DESTINO_PERMITIDA
ABA_PRODUCAO = "SOLICITAÇÕES"
ARTIFACTS_DIR = Path("artifacts") / "verificacao_diaria"
JSON_DIAGNOSTICO = ARTIFACTS_DIR / "obs_diagnostico.json"
JSON_LINHAS_EXTRAIDAS = ARTIFACTS_DIR / "obs_linhas_extraidas.json"
BACKUP_PATH = ARTIFACTS_DIR / "backup_solicitacoes_teste_obs.json"
HEADERS = ["Data", "Voucher", "Andar", "Vínculo", "Categoria", "Observação"]
CHAVES_LINHAS = (
    "linhas_extraidas",
    "dados_extraidos",
    "registros",
    "linhas",
    "observacoes_extraidas",
)
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


class EscritaObsError(RuntimeError):
    pass


class DadosInsuficientesError(EscritaObsError):
    pass


def hash_json(valor):
    texto = json.dumps(valor, ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()


def normalizar_linha(linha, colunas=6):
    valores = [str(celula or "").strip() for celula in linha[:colunas]]
    return valores + [""] * (colunas - len(valores))


def normalizar_linhas(linhas, colunas=6):
    return [normalizar_linha(linha, colunas) for linha in linhas]


def carregar_json(caminho):
    caminho = Path(caminho)
    if not caminho.exists():
        raise FileNotFoundError(f"Arquivo de diagnóstico não encontrado: {caminho}")
    try:
        payload = json.loads(caminho.read_text(encoding="utf-8"))
    except json.JSONDecodeError as erro:
        raise ValueError(f"JSON inválido em {caminho}: {erro}") from erro
    if not isinstance(payload, dict):
        raise ValueError("JSON de diagnóstico precisa ser um objeto.")
    return payload


def validar_sem_credenciais(valor, caminho="root"):
    if isinstance(valor, dict):
        for chave, item in valor.items():
            chave_lower = str(chave).lower()
            if any(critica in chave_lower for critica in CHAVES_CRITICAS):
                raise ValueError(f"Campo crítico inesperado no JSON: {caminho}.{chave}")
            validar_sem_credenciais(item, f"{caminho}.{chave}")
    elif isinstance(valor, list):
        for indice, item in enumerate(valor):
            validar_sem_credenciais(item, f"{caminho}[{indice}]")
    elif isinstance(valor, str):
        marcadores = ("HITS_EMAIL", "HITS_PASSWORD", "BEGIN PRIVATE KEY", "Bearer ")
        if any(marcador in valor for marcador in marcadores):
            raise ValueError(f"Valor com aparência de credencial no JSON: {caminho}")


def linha_de_dict(registro):
    mapa = {str(chave).strip().lower(): valor for chave, valor in registro.items()}
    return [
        mapa.get("data", ""),
        mapa.get("voucher", ""),
        mapa.get("andar", ""),
        mapa.get("vinculo", mapa.get("vínculo", "")),
        mapa.get("categoria", ""),
        mapa.get("observacao", mapa.get("observação", "")),
    ]


def normalizar_registro(registro):
    if isinstance(registro, dict):
        return normalizar_linha(linha_de_dict(registro))
    if isinstance(registro, (list, tuple)):
        if len(registro) < 6:
            raise ValueError(f"Linha incompatível: esperado ao menos 6 colunas, recebido {len(registro)}.")
        return normalizar_linha(registro)
    raise ValueError(f"Registro incompatível: {type(registro).__name__}")


def localizar_linhas_extraidas(payload):
    for chave in CHAVES_LINHAS:
        if chave in payload:
            return payload[chave], chave

    linhas = []
    for metrica in payload.get("metricas", []) or []:
        if not isinstance(metrica, dict):
            continue
        for chave in CHAVES_LINHAS:
            if chave in metrica:
                linhas.extend(metrica[chave])
    if linhas:
        return linhas, "metricas.*"

    raise DadosInsuficientesError(
        "O artifact obs_diagnostico.json contém métricas, mas não contém as linhas completas extraídas. "
        "A escrita foi interrompida antes de acessar o Google Sheets."
    )


def preparar_linhas_do_diagnostico(caminho=JSON_LINHAS_EXTRAIDAS):
    payload = carregar_json(caminho)
    validar_sem_credenciais(payload)
    if "schema_version" in payload or "hash_linhas" in payload:
        return validar_artifact_linhas(payload)

    linhas_brutas, origem = localizar_linhas_extraidas(payload)
    if not isinstance(linhas_brutas, list) or not linhas_brutas:
        raise DadosInsuficientesError("JSON não contém registros extraídos para escrita.")

    linhas = [normalizar_registro(registro) for registro in linhas_brutas]
    resumo = resumir_linhas(linhas)
    resumo["origem_linhas"] = origem
    resumo["estrutura_json"] = sorted(payload.keys())
    return linhas, resumo


def resumir_linhas(linhas):
    por_data = {}
    vouchers = set()
    for linha in linhas:
        data = linha[0]
        voucher = linha[1]
        por_data[data] = por_data.get(data, 0) + 1
        if voucher:
            vouchers.add(voucher)
    return {
        "quantidade": len(linhas),
        "datas": sorted(por_data.keys()),
        "por_data": dict(sorted(por_data.items())),
        "vouchers_unicos": len(vouchers),
        "hash": hash_json(normalizar_linhas(linhas)),
    }


def validar_artifact_linhas(payload):
    if payload.get("schema_version") != 1:
        raise ValueError("Schema desconhecido no artifact de extração.")
    if payload.get("cabecalhos") != HEADERS:
        raise ValueError("Cabeçalhos ausentes ou divergentes no artifact de extração.")
    if not isinstance(payload.get("periodo"), dict):
        raise ValueError("Período ausente no artifact de extração.")
    if "linhas_extraidas" not in payload:
        raise DadosInsuficientesError("Artifact não contém linhas_extraidas.")

    linhas = [normalizar_registro(registro) for registro in payload["linhas_extraidas"]]
    resumo = resumir_linhas(linhas)

    if payload.get("quantidade_registros") != len(linhas):
        raise RuntimeError("Quantidade declarada diverge da lista de linhas_extraidas.")
    if payload.get("hash_linhas") != resumo["hash"]:
        raise RuntimeError("Artifact de extração com hash inválido.")
    if payload.get("quantidade_por_data") != resumo["por_data"]:
        raise RuntimeError("Quantidade por data diverge das linhas_extraidas.")

    periodo = payload["periodo"]
    if periodo.get("dias") is None or "inicio" not in periodo or "fim" not in periodo:
        raise ValueError("Período incompleto no artifact de extração.")
    if resumo["datas"]:
        if periodo.get("inicio") != resumo["datas"][0] or periodo.get("fim") != resumo["datas"][-1]:
            raise RuntimeError("Período declarado diverge das datas extraídas.")

    resumo["origem_linhas"] = "linhas_extraidas"
    resumo["estrutura_json"] = sorted(payload.keys())
    resumo["periodo"] = periodo
    return linhas, resumo


def autenticar_google_sheets():
    print("Autenticando no Google Sheets via OAuth...")
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


def garantir_destino_seguro(nome_aba):
    if nome_aba != ABA_DESTINO_PERMITIDA:
        raise RuntimeError("Destino de escrita não autorizado.")


def abrir_ou_criar_aba_teste(planilha):
    garantir_destino_seguro(ABA_DESTINO)
    try:
        return planilha.worksheet(ABA_DESTINO), False
    except gspread.WorksheetNotFound:
        return planilha.add_worksheet(title=ABA_DESTINO, rows=2000, cols=6), True


def ler_valores(aba):
    if hasattr(aba, "get_all_values"):
        return aba.get_all_values()
    return aba.get("A1:F2000")


def salvar_backup_aba(aba, caminho=BACKUP_PATH):
    valores = ler_valores(aba)
    backup = {
        "aba": ABA_DESTINO,
        "gerado_em": datetime.datetime.now().isoformat(timespec="seconds"),
        "quantidade_linhas": len(valores),
        "hash": hash_json(normalizar_linhas(valores)) if valores else hash_json([]),
        "valores": valores,
    }
    caminho = Path(caminho)
    caminho.parent.mkdir(parents=True, exist_ok=True)
    caminho.write_text(json.dumps(backup, ensure_ascii=False, indent=2), encoding="utf-8")
    return backup


def restaurar_backup(aba, valores):
    aba.clear()
    if valores:
        aba.update(values=valores, range_name="A1", value_input_option="USER_ENTERED")


def escrever_linhas(aba, linhas):
    garantir_destino_seguro(ABA_DESTINO)
    aba.update(values=[HEADERS], range_name="A1:F1", value_input_option="USER_ENTERED")
    aba.batch_clear(["A2:F2000"])
    if linhas:
        faixa = f"A2:F{len(linhas) + 1}"
        aba.update(values=linhas, range_name="A2", value_input_option="USER_ENTERED")
    else:
        faixa = "A2:F1"
    return faixa


def reler_linhas(aba, quantidade):
    if quantidade <= 0:
        return []
    return normalizar_linhas(aba.get(f"A2:F{quantidade + 1}"))


def validar_releitura(linhas_preparadas, linhas_relidas):
    preparadas = normalizar_linhas(linhas_preparadas)
    relidas = normalizar_linhas(linhas_relidas)
    if len(preparadas) != len(relidas):
        raise RuntimeError(f"Quantidade divergente: preparada={len(preparadas)} relida={len(relidas)}")
    hash_preparado = hash_json(preparadas)
    hash_relido = hash_json(relidas)
    if hash_preparado != hash_relido or preparadas != relidas:
        raise RuntimeError(f"Hash divergente: preparado={hash_preparado} relido={hash_relido}")
    return hash_preparado, hash_relido


def hash_aba(aba):
    valores = ler_valores(aba)
    return {
        "quantidade": len(valores),
        "hash": hash_json(normalizar_linhas(valores)) if valores else hash_json([]),
    }


def executar(caminho_json=JSON_LINHAS_EXTRAIDAS, autenticar_fn=autenticar_google_sheets):
    linhas, resumo = preparar_linhas_do_diagnostico(caminho_json)

    print(f"Estrutura JSON: {', '.join(resumo['estrutura_json'])}")
    print(f"Origem das linhas: {resumo['origem_linhas']}")
    print(f"Datas presentes: {', '.join(resumo['datas'])}")
    print(f"Quantidade de registros: {resumo['quantidade']}")
    print(f"Vouchers únicos: {resumo['vouchers_unicos']}")
    print(f"Quantidade por data: {resumo['por_data']}")
    print(f"Hash preparado: {resumo['hash']}")

    gc = autenticar_fn()
    planilha = gc.open_by_key(ID_PLANILHA)
    print(f"Planilha confirmada: {planilha.title}")
    print(f"ID confirmado: {ID_PLANILHA}")
    print(f"Aba destino: {ABA_DESTINO}")

    aba_producao = planilha.worksheet(ABA_PRODUCAO)
    producao_antes = hash_aba(aba_producao)
    print(f"SOLICITAÇÕES antes: quantidade={producao_antes['quantidade']} hash={producao_antes['hash']}")

    aba_teste, criada = abrir_ou_criar_aba_teste(planilha)
    print(f"Aba temporária {'criada' if criada else 'encontrada'}: {ABA_DESTINO}")
    backup = salvar_backup_aba(aba_teste)
    print(f"Backup temporário: {BACKUP_PATH}")
    print(f"Quantidade anterior na aba teste: {backup['quantidade_linhas']}")
    print(f"Hash anterior na aba teste: {backup['hash']}")

    try:
        faixa = escrever_linhas(aba_teste, linhas)
        relidas = reler_linhas(aba_teste, len(linhas))
        hash_preparado, hash_relido = validar_releitura(linhas, relidas)

        producao_depois = hash_aba(aba_producao)
        if producao_antes != producao_depois:
            raise RuntimeError("A aba SOLICITAÇÕES foi alterada durante o teste.")

        resultado = {
            "quantidade_preparada": len(linhas),
            "quantidade_enviada": len(linhas),
            "quantidade_relida": len(relidas),
            "hash_preparado": hash_preparado,
            "hash_relido": hash_relido,
            "faixa": faixa,
            "por_data": resumo["por_data"],
            "vouchers_unicos": resumo["vouchers_unicos"],
            "backup": str(BACKUP_PATH),
        }
        print(f"Quantidade preparada: {resultado['quantidade_preparada']}")
        print(f"Quantidade enviada: {resultado['quantidade_enviada']}")
        print(f"Quantidade relida: {resultado['quantidade_relida']}")
        print(f"Faixa escrita: {faixa}")
        print(f"Hash relido: {hash_relido}")
        print("SOLICITAÇÕES permaneceu inalterada.")
        print("Webhook não chamado.")
        return resultado
    except Exception:
        restaurar_backup(aba_teste, backup["valores"])
        raise


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Testa escrita/releitura segura das observacoes extraidas.")
    parser.add_argument(
        "--arquivo-dados",
        default=str(JSON_LINHAS_EXTRAIDAS),
        help="Artifact JSON com linhas_extraidas validado.",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args() if argv is None else parse_args(argv)
    try:
        executar(args.arquivo_dados)
        return 0
    except DadosInsuficientesError as erro:
        print(f"Teste interrompido antes da escrita: {erro}")
        print("Nenhuma planilha foi aberta para escrita.")
        print("Webhook não chamado.")
        return 1
    except Exception as erro:
        print(f"Falha no teste de escrita OBS: {erro}")
        print("Webhook não chamado.")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
