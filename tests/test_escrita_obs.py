import json
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
ROBOTS_DIR = ROOT / "robots" / "vinculacao"
sys.path.insert(0, str(ROBOTS_DIR))

import testar_escrita_obs as escrita  # noqa: E402


def gravar_json(tmp_path, payload):
    caminho = tmp_path / "obs_diagnostico.json"
    caminho.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return caminho


def linhas_validas():
    return [
        ["11/07/2026", "4055717", "300", "RES1", "BASE", "mimo"],
        ["12/07/2026", "4071561", "301", "", "BASE", "berco"],
    ]


def artifact_valido(linhas=None):
    linhas = linhas or linhas_validas()
    resumo = escrita.resumir_linhas(linhas)
    return {
        "schema_version": 1,
        "gerado_em": "2026-07-11T08:00:00",
        "periodo": {
            "inicio": resumo["datas"][0],
            "fim": resumo["datas"][-1],
            "dias": len(resumo["datas"]),
        },
        "cabecalhos": escrita.HEADERS,
        "quantidade_registros": len(linhas),
        "vouchers_unicos": resumo["vouchers_unicos"],
        "quantidade_por_data": resumo["por_data"],
        "hash_linhas": resumo["hash"],
        "linhas_extraidas": linhas,
    }


def test_json_valido_prepara_linhas(tmp_path):
    caminho = gravar_json(tmp_path, artifact_valido())

    linhas, resumo = escrita.preparar_linhas_do_diagnostico(caminho)

    assert linhas == linhas_validas()
    assert resumo["quantidade"] == 2
    assert resumo["vouchers_unicos"] == 2
    assert resumo["por_data"] == {"11/07/2026": 1, "12/07/2026": 1}


def test_json_ausente_falha(tmp_path):
    with pytest.raises(FileNotFoundError):
        escrita.preparar_linhas_do_diagnostico(tmp_path / "ausente.json")


def test_json_invalido_falha(tmp_path):
    caminho = tmp_path / "obs_diagnostico.json"
    caminho.write_text("{", encoding="utf-8")

    with pytest.raises(ValueError, match="JSON inválido"):
        escrita.preparar_linhas_do_diagnostico(caminho)


def test_json_sem_linhas_extraidas_falha(tmp_path):
    caminho = gravar_json(tmp_path, {"metricas": [{"data_confirmada": "11/07/2026"}]})

    with pytest.raises(escrita.DadosInsuficientesError, match="não contém as linhas completas"):
        escrita.preparar_linhas_do_diagnostico(caminho)


def test_artifact_com_hash_invalido_falha(tmp_path):
    payload = artifact_valido()
    payload["hash_linhas"] = "hash-invalido"
    caminho = gravar_json(tmp_path, payload)

    with pytest.raises(RuntimeError, match="hash inválido"):
        escrita.preparar_linhas_do_diagnostico(caminho)


def test_artifact_com_quantidade_divergente_falha(tmp_path):
    payload = artifact_valido()
    payload["quantidade_registros"] = 999
    caminho = gravar_json(tmp_path, payload)

    with pytest.raises(RuntimeError, match="Quantidade declarada"):
        escrita.preparar_linhas_do_diagnostico(caminho)


def test_artifact_com_schema_desconhecido_falha(tmp_path):
    payload = artifact_valido()
    payload["schema_version"] = 999
    caminho = gravar_json(tmp_path, payload)

    with pytest.raises(ValueError, match="Schema desconhecido"):
        escrita.preparar_linhas_do_diagnostico(caminho)


def test_artifact_sem_cabecalhos_falha(tmp_path):
    payload = artifact_valido()
    payload.pop("cabecalhos")
    caminho = gravar_json(tmp_path, payload)

    with pytest.raises(ValueError, match="Cabeçalhos"):
        escrita.preparar_linhas_do_diagnostico(caminho)


def test_cli_aceita_caminho_arquivo_dados():
    args = escrita.parse_args(["--arquivo-dados", "artifacts/verificacao_diaria/obs_linhas_extraidas.json"])

    assert args.arquivo_dados == "artifacts/verificacao_diaria/obs_linhas_extraidas.json"


class AbaFake:
    def __init__(self, titulo, valores=None, reler_override=None):
        self.title = titulo
        self.valores = valores or []
        self.reler_override = reler_override
        self.updates = []
        self.clears = []
        self.clear_count = 0

    def get_all_values(self):
        return [linha[:] for linha in self.valores]

    def get(self, faixa):
        if self.reler_override is not None:
            return self.reler_override
        if faixa.startswith("A2:F"):
            return self.valores[1:]
        return self.valores

    def update(self, values, range_name, value_input_option=None):
        self.updates.append((values, range_name, value_input_option))
        if range_name == "A1:F1":
            if self.valores:
                self.valores[0] = values[0]
            else:
                self.valores = values
        elif range_name == "A2":
            self.valores = [self.valores[0] if self.valores else escrita.HEADERS] + values
        elif range_name == "A1":
            self.valores = values

    def batch_clear(self, ranges):
        self.clears.append(ranges)
        self.valores = self.valores[:1]

    def clear(self):
        self.clear_count += 1
        self.valores = []


class PlanilhaFake:
    title = "Controle de ocupantes teste"

    def __init__(self, tem_teste=True, reler_override=None):
        self.aba_producao = AbaFake(escrita.ABA_PRODUCAO, [["prod", "hash"]])
        self.aba_teste = AbaFake(escrita.ABA_DESTINO, [["old"]], reler_override=reler_override)
        self.tem_teste = tem_teste
        self.worksheet_calls = []
        self.add_calls = []

    def worksheet(self, nome):
        self.worksheet_calls.append(nome)
        if nome == escrita.ABA_PRODUCAO:
            return self.aba_producao
        if nome == escrita.ABA_DESTINO and self.tem_teste:
            return self.aba_teste
        raise escrita.gspread.WorksheetNotFound()

    def add_worksheet(self, title, rows, cols):
        self.add_calls.append((title, rows, cols))
        self.tem_teste = True
        self.aba_teste.title = title
        return self.aba_teste


class ClienteFake:
    def __init__(self, planilha):
        self.planilha = planilha
        self.opened_keys = []

    def open_by_key(self, key):
        self.opened_keys.append(key)
        return self.planilha


def test_aba_temporaria_existente():
    planilha = PlanilhaFake(tem_teste=True)

    aba, criada = escrita.abrir_ou_criar_aba_teste(planilha)

    assert aba.title == escrita.ABA_DESTINO
    assert criada is False
    assert planilha.add_calls == []


def test_aba_temporaria_inexistente_e_criada():
    planilha = PlanilhaFake(tem_teste=False)

    aba, criada = escrita.abrir_ou_criar_aba_teste(planilha)

    assert aba.title == escrita.ABA_DESTINO
    assert criada is True
    assert planilha.add_calls == [(escrita.ABA_DESTINO, 2000, 6)]


def test_escrita_e_releitura_identicas():
    aba = AbaFake(escrita.ABA_DESTINO)

    escrita.escrever_linhas(aba, linhas_validas())
    relidas = escrita.reler_linhas(aba, 2)
    hash_preparado, hash_relido = escrita.validar_releitura(linhas_validas(), relidas)

    assert hash_preparado == hash_relido
    assert aba.clears == [["A2:F2000"]]


def test_quantidade_divergente_falha():
    with pytest.raises(RuntimeError, match="Quantidade divergente"):
        escrita.validar_releitura(linhas_validas(), [linhas_validas()[0]])


def test_hash_divergente_falha():
    relidas = [linhas_validas()[0], ["12/07/2026", "999", "301", "", "BASE", "berco"]]

    with pytest.raises(RuntimeError, match="Hash divergente"):
        escrita.validar_releitura(linhas_validas(), relidas)


def test_restauracao_do_backup_em_falha(tmp_path, monkeypatch):
    caminho = gravar_json(tmp_path, artifact_valido())
    planilha = PlanilhaFake(tem_teste=True, reler_override=[linhas_validas()[0]])
    cliente = ClienteFake(planilha)
    monkeypatch.setattr(escrita, "BACKUP_PATH", tmp_path / "backup.json")

    with pytest.raises(RuntimeError, match="Quantidade divergente"):
        escrita.executar(caminho, autenticar_fn=lambda: cliente)

    assert planilha.aba_teste.clear_count == 1
    assert planilha.aba_teste.valores == [["old"]]


def test_solicitacoes_nunca_e_usada_como_destino():
    with pytest.raises(RuntimeError, match="Destino de escrita não autorizado"):
        escrita.garantir_destino_seguro(escrita.ABA_PRODUCAO)


def test_webhook_nunca_e_importado_ou_chamado():
    assert not hasattr(escrita, "requests")
