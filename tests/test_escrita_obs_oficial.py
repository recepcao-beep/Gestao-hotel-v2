import json
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
ROBOTS_DIR = ROOT / "robots" / "vinculacao"
sys.path.insert(0, str(ROBOTS_DIR))

import testar_escrita_obs_oficial as oficial  # noqa: E402


def linhas_validas():
    return [
        ["11/07/2026", "4055717", "300", "RES1", "1CC", "mimo"],
        ["12/07/2026", "4071561", "", "", "2CC", ""],
    ]


def artifact_valido(linhas=None):
    linhas = linhas or linhas_validas()
    linhas_norm = oficial.normalizar_linhas(linhas)
    quantidade_por_data = {}
    for linha in linhas_norm:
        quantidade_por_data[linha[0]] = quantidade_por_data.get(linha[0], 0) + 1
    return {
        "schema_version": 1,
        "gerado_em": "2026-07-11T08:00:00",
        "periodo": {"inicio": "11/07/2026", "fim": "12/07/2026", "dias": 2},
        "cabecalhos": oficial.HEADERS,
        "quantidade_registros": len(linhas_norm),
        "vouchers_unicos": 2,
        "quantidade_por_data": dict(sorted(quantidade_por_data.items())),
        "hash_linhas": oficial.hash_json(linhas_norm),
        "linhas_extraidas": linhas_norm,
    }


def gravar_json(tmp_path, payload):
    caminho = tmp_path / "obs_linhas_extraidas.json"
    caminho.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    return caminho


class AbaOficialFake:
    def __init__(self, reler_override=None, falhar_update=False):
        self.title = oficial.ABA_DESTINO
        self.valores = [["Data", "Voucher", "Andar", "Vínculo", "Categoria", "Observação"], ["antigo"]]
        self.reler_override = reler_override
        self.falhar_update = falhar_update
        self.backup_existia_antes_de_limpar = False
        self.backup_path = None
        self.clear_count = 0
        self.batch_clears = []
        self.updates = []

    def get_all_values(self):
        return [linha[:] for linha in self.valores]

    def get(self, faixa):
        if self.reler_override is not None and faixa.startswith("A2:F"):
            return self.reler_override
        if faixa.startswith("A2:F"):
            return [linha[:] for linha in self.valores[1:]]
        return self.get_all_values()

    def update(self, values, range_name, value_input_option=None):
        self.updates.append((values, range_name, value_input_option))
        if self.falhar_update and range_name == "A2":
            raise RuntimeError("falha simulada")
        if range_name == "A1:F1":
            if self.valores:
                self.valores[0] = values[0]
            else:
                self.valores = values
        elif range_name == "A2":
            self.valores = [self.valores[0] if self.valores else oficial.HEADERS] + [linha[:] for linha in values]
        elif range_name == "A1":
            self.valores = [linha[:] for linha in values]

    def batch_clear(self, ranges):
        self.batch_clears.append(ranges)
        self.backup_existia_antes_de_limpar = bool(self.backup_path and self.backup_path.exists())
        self.valores = self.valores[:1]

    def clear(self):
        self.clear_count += 1
        self.valores = []


class PlanilhaFake:
    title = "Controle de ocupantes teste"

    def __init__(self, aba):
        self.aba = aba
        self.worksheet_calls = []

    def worksheet(self, nome):
        self.worksheet_calls.append(nome)
        if nome != oficial.ABA_DESTINO:
            raise AssertionError(f"Aba inesperada: {nome}")
        return self.aba


class ClienteFake:
    def __init__(self, planilha):
        self.planilha = planilha
        self.opened_keys = []

    def open_by_key(self, key):
        self.opened_keys.append(key)
        return self.planilha


def cliente_fake(aba):
    planilha = PlanilhaFake(aba)
    return ClienteFake(planilha), planilha


def test_confirmacao_ausente_ou_incorreta_aborta_antes_do_google(tmp_path):
    caminho = gravar_json(tmp_path, artifact_valido())
    chamado = False

    def autenticar():
        nonlocal chamado
        chamado = True

    with pytest.raises(oficial.EscritaOficialError):
        oficial.executar("ERRADO", caminho, autenticar_fn=autenticar)

    assert chamado is False
    with pytest.raises(SystemExit):
        oficial.parse_args(["--arquivo-dados", str(caminho)])


def test_backup_acontece_antes_da_limpeza(tmp_path, monkeypatch):
    caminho = gravar_json(tmp_path, artifact_valido())
    aba = AbaOficialFake()
    cliente, _planilha = cliente_fake(aba)
    backup_path = tmp_path / "backup_solicitacoes_oficial.json"
    aba.backup_path = backup_path
    monkeypatch.setattr(oficial, "BACKUP_PATH", backup_path)

    oficial.executar(oficial.CONFIRMACAO_EXATA, caminho, autenticar_fn=lambda: cliente)

    assert aba.backup_existia_antes_de_limpar is True
    assert backup_path.exists()
    backup = json.loads(backup_path.read_text(encoding="utf-8"))
    assert backup["aba"] == oficial.ABA_DESTINO


def test_escrita_e_releitura_iguais(tmp_path, monkeypatch):
    caminho = gravar_json(tmp_path, artifact_valido())
    aba = AbaOficialFake()
    cliente, planilha = cliente_fake(aba)
    monkeypatch.setattr(oficial, "BACKUP_PATH", tmp_path / "backup.json")

    resultado = oficial.executar(oficial.CONFIRMACAO_EXATA, caminho, autenticar_fn=lambda: cliente)

    assert resultado["quantidade_preparada"] == 2
    assert resultado["quantidade_escrita"] == 2
    assert resultado["quantidade_relida"] == 2
    assert resultado["hash_preparado"] == resultado["hash_relido"]
    assert aba.batch_clears == [["A2:F"]]
    assert planilha.worksheet_calls == [oficial.ABA_DESTINO]
    assert cliente.opened_keys == [oficial.ID_PLANILHA]


def test_hash_divergente_restaura_backup(tmp_path, monkeypatch):
    caminho = gravar_json(tmp_path, artifact_valido())
    aba = AbaOficialFake(reler_override=[linhas_validas()[0], ["12/07/2026", "999", "", "", "2CC", ""]])
    cliente, _planilha = cliente_fake(aba)
    monkeypatch.setattr(oficial, "BACKUP_PATH", tmp_path / "backup.json")

    with pytest.raises(RuntimeError, match="Hash divergente"):
        oficial.executar(oficial.CONFIRMACAO_EXATA, caminho, autenticar_fn=lambda: cliente)

    assert aba.clear_count == 1
    assert aba.valores == [["Data", "Voucher", "Andar", "Vínculo", "Categoria", "Observação"], ["antigo"]]


def test_restauracao_em_falha_de_escrita(tmp_path, monkeypatch):
    caminho = gravar_json(tmp_path, artifact_valido())
    aba = AbaOficialFake(falhar_update=True)
    cliente, _planilha = cliente_fake(aba)
    monkeypatch.setattr(oficial, "BACKUP_PATH", tmp_path / "backup.json")

    with pytest.raises(RuntimeError, match="falha simulada"):
        oficial.executar(oficial.CONFIRMACAO_EXATA, caminho, autenticar_fn=lambda: cliente)

    assert aba.clear_count == 1
    assert aba.valores == [["Data", "Voucher", "Andar", "Vínculo", "Categoria", "Observação"], ["antigo"]]


def test_webhook_inexistente_e_destino_fixo():
    assert not hasattr(oficial, "requests")
    assert "WEBHOOK" not in vars(oficial)
    assert oficial.ABA_DESTINO == "SOLICITAÇÕES"
    assert oficial.CONFIRMACAO_EXATA == "ESCREVER_SOLICITACOES_SEM_WEBHOOK"
