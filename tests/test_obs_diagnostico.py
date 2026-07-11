import inspect
import json
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
ROBOTS_DIR = ROOT / "robots" / "vinculacao"
sys.path.insert(0, str(ROBOTS_DIR))

import obs  # noqa: E402


def robo_sem_chrome(**attrs):
    robo = object.__new__(obs.RoboHITS)
    robo.dias = attrs.pop("dias", 2)
    robo.diagnostico = attrs.pop("diagnostico", False)
    robo.no_write = attrs.pop("no_write", False)
    robo.exportar_linhas = attrs.pop("exportar_linhas", None)
    robo.metricas_por_data = []
    robo.ultima_metrica_extracao = None
    robo.salvar_screenshot = lambda nome: Path(nome)
    robo.salvar_relatorio_diagnostico = lambda *args, **kwargs: None
    for nome, valor in attrs.items():
        setattr(robo, nome, valor)
    return robo


def metrica(data, voucher="100", texto="obs", observacoes=1):
    payload = {
        "vouchers": [voucher] if voucher else [],
        "textos": [texto] if texto else [],
        "observacoes": [[voucher, "", "", "", texto]] if observacoes else [],
    }
    return {
        "data_solicitada": data,
        "data_confirmada": data,
        "linhas_brutas": 1 if texto else 0,
        "vouchers_unicos": 1 if voucher else 0,
        "observacoes_validas": observacoes,
        "vouchers": [voucher] if voucher else [],
        "textos": [texto] if texto else [],
        "hash": obs.RoboHITS.hash_json(payload),
        "primeiros_vouchers": [voucher] if voucher else [],
    }


def test_duas_datas_diferentes_com_conteudos_diferentes_validam():
    robo = robo_sem_chrome()
    robo.metricas_por_data = [
        metrica("10/07/2026", "100", "mimo"),
        metrica("11/07/2026", "101", "berco"),
    ]

    robo.validar_datas_extraidas()
    robo.validar_repeticao_suspeita()


def test_repeticao_suspeita_faz_nova_tentativa_e_falha_se_persistir():
    chamadas = []
    metricas = [
        metrica("10/07/2026", "100", "mimo"),
        metrica("11/07/2026", "100", "mimo"),
        metrica("11/07/2026", "100", "mimo"),
    ]

    def mudar_data_para(dias_para_frente, assinatura_anterior=None):
        chamadas.append(dias_para_frente)
        return metricas[len(chamadas) - 1]["data_confirmada"], f"sig-{len(chamadas)}"

    def extrair(_data):
        robo.ultima_metrica_extracao = metricas[len(chamadas) - 1]
        return [["linha"]]

    robo = robo_sem_chrome(dias=2, no_write=True)
    robo.mudar_data_para = mudar_data_para
    robo.extrair_dados_pagina_atual = extrair

    with pytest.raises(RuntimeError, match="Repetição suspeita confirmada"):
        robo.processar_semana_e_salvar()

    assert chamadas == [0, 1, 1]


def test_duas_datas_sem_observacoes_nao_sao_repeticao_suspeita():
    robo = robo_sem_chrome()
    robo.metricas_por_data = [
        metrica("10/07/2026", "", "", observacoes=0),
        metrica("11/07/2026", "", "", observacoes=0),
    ]

    robo.validar_repeticao_suspeita()


def test_primeiro_filtro_falhou_lanca_runtime_error():
    robo = robo_sem_chrome()
    robo.clicar_com_espera = lambda xpath: False

    with pytest.raises(RuntimeError, match="Primeiro filtro obrigatório"):
        robo.aplicar_filtros_e_obs()


def test_segundo_filtro_falhou_lanca_runtime_error():
    respostas = iter([True, True, True, False])
    robo = robo_sem_chrome()
    robo.clicar_com_espera = lambda xpath: next(respostas)

    with pytest.raises(RuntimeError, match="Segundo filtro obrigatório"):
        robo.aplicar_filtros_e_obs()


def test_data_esperada_diferente_da_exibida_lanca_runtime_error():
    robo = robo_sem_chrome()
    robo.texto_filtro_data_atual = lambda: "11/07/2026 - 11/07/2026"

    with pytest.raises(RuntimeError, match="não confere"):
        robo.confirmar_data_aplicada("10/07/2026")


def test_data_esperada_igual_a_exibida_continua():
    robo = robo_sem_chrome()
    robo.texto_filtro_data_atual = lambda: "10/07/2026 - 10/07/2026"

    assert robo.confirmar_data_aplicada("10/07/2026") == "10/07/2026"


def test_hash_normaliza_entrada_e_diferencia_conteudo():
    linhas_a = [[" 10/07/2026 ", "100", None]]
    linhas_b = [["10/07/2026", "100", ""]]
    linhas_c = [["10/07/2026", "101", ""]]

    assert obs.RoboHITS.hash_linhas(linhas_a) == obs.RoboHITS.hash_linhas(linhas_b)
    assert obs.RoboHITS.hash_linhas(linhas_b) != obs.RoboHITS.hash_linhas(linhas_c)


def test_no_write_nao_chama_clear_update_ou_webhook():
    metricas = [
        metrica("10/07/2026", "100", "mimo"),
        metrica("11/07/2026", "101", "berco"),
    ]

    def mudar_data_para(dias_para_frente, assinatura_anterior=None):
        return metricas[dias_para_frente]["data_confirmada"], f"sig-{dias_para_frente}"

    def extrair(_data):
        indice = len(robo.metricas_por_data)
        robo.ultima_metrica_extracao = metricas[indice]
        return [[metricas[indice]["data_confirmada"], "100", "", "", "", "obs"]]

    robo = robo_sem_chrome(dias=2, no_write=True)
    robo.mudar_data_para = mudar_data_para
    robo.extrair_dados_pagina_atual = extrair
    robo.abrir_aba_solicitacoes = lambda: pytest.fail("nao deveria abrir a planilha")
    robo.acionar_webhook_e_validar = lambda *_: pytest.fail("nao deveria chamar webhook")

    robo.processar_semana_e_salvar()


class AbaFake:
    def __init__(self, relido):
        self.relido = relido

    def get(self, faixa):
        return self.relido


def test_escrita_releitura_igual_valida():
    robo = robo_sem_chrome()
    dados = [["10/07/2026", "100", "", "", "", "mimo"]]

    robo.reler_e_validar_solicitacoes(AbaFake(dados), dados, "teste")


def test_escrita_releitura_diferente_lanca_runtime_error():
    robo = robo_sem_chrome()
    dados = [["10/07/2026", "100", "", "", "", "mimo"]]
    relido = [["10/07/2026", "999", "", "", "", "mimo"]]

    with pytest.raises(RuntimeError, match="não conferem"):
        robo.reler_e_validar_solicitacoes(AbaFake(relido), dados, "teste")


def test_falha_no_webhook_propaga_excecao(monkeypatch):
    robo = robo_sem_chrome()

    def falha(*args, **kwargs):
        raise RuntimeError("webhook caiu")

    monkeypatch.setattr(obs.requests, "get", falha)

    with pytest.raises(RuntimeError, match="webhook caiu"):
        robo.acionar_webhook_e_validar(AbaFake([]), [])


def test_status_http_erro_propaga_raise_for_status(monkeypatch):
    robo = robo_sem_chrome()

    class Resposta:
        status_code = 500
        text = "erro"

        def raise_for_status(self):
            raise RuntimeError("500")

    monkeypatch.setattr(obs.requests, "get", lambda *args, **kwargs: Resposta())

    with pytest.raises(RuntimeError, match="500"):
        robo.acionar_webhook_e_validar(AbaFake([]), [])


def test_excecao_critica_nao_vira_apenas_print():
    robo = robo_sem_chrome(dias=1)
    robo.mudar_data_para = lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("falha critica"))

    with pytest.raises(RuntimeError, match="falha critica"):
        robo.processar_semana_e_salvar()


def test_configurar_console_utf8_usa_replace_e_ignora_fluxo_sem_reconfigure(monkeypatch):
    class FluxoLimitado:
        def __init__(self):
            self.chamadas = []

        def reconfigure(self, **kwargs):
            self.chamadas.append(kwargs)

    class FluxoSemReconfigure:
        pass

    stdout_fake = FluxoLimitado()
    stderr_fake = FluxoSemReconfigure()
    monkeypatch.setattr(obs.sys, "stdout", stdout_fake)
    monkeypatch.setattr(obs.sys, "stderr", stderr_fake)

    obs.configurar_console_utf8()

    assert stdout_fake.chamadas == [{"encoding": "utf-8", "errors": "replace"}]


def linhas_exportacao():
    return [
        ["11/07/2026", "4055717", "300", "RES1", "BASE", "mimo"],
        ["", "", "", "", "", ""],
        ["12/07/2026", "4071561", "301", "", "BASE", "berco"],
    ]


def test_exportar_linhas_exige_no_write_ou_diagnostico(tmp_path):
    robo = robo_sem_chrome(no_write=False, diagnostico=False)

    with pytest.raises(RuntimeError, match="--exportar-linhas"):
        robo.exportar_linhas_extraidas(tmp_path / "linhas.json", linhas_exportacao())


def test_exportacao_contem_todas_as_linhas_validas(tmp_path):
    robo = robo_sem_chrome(no_write=True, dias=2)
    caminho = tmp_path / "obs_linhas_extraidas.json"

    payload = robo.exportar_linhas_extraidas(caminho, linhas_exportacao())
    relido = json.loads(caminho.read_text(encoding="utf-8"))

    assert relido == payload
    assert relido["linhas_extraidas"] == [linhas_exportacao()[0], linhas_exportacao()[2]]
    assert relido["quantidade_registros"] == 2
    assert relido["quantidade_por_data"] == {"11/07/2026": 1, "12/07/2026": 1}


def test_exportacao_quantidade_e_hash_correspondem_as_linhas(tmp_path):
    robo = robo_sem_chrome(no_write=True, dias=2)
    caminho = tmp_path / "obs_linhas_extraidas.json"

    payload = robo.exportar_linhas_extraidas(caminho, linhas_exportacao())

    assert payload["quantidade_registros"] == len(payload["linhas_extraidas"])
    assert payload["hash_linhas"] == obs.RoboHITS.hash_linhas(payload["linhas_extraidas"])


def test_exportacao_substitui_tmp_pelo_final(tmp_path):
    robo = robo_sem_chrome(no_write=True, dias=2)
    caminho = tmp_path / "obs_linhas_extraidas.json"

    robo.exportar_linhas_extraidas(caminho, linhas_exportacao())

    assert caminho.exists()
    assert not caminho.with_name(f"{caminho.name}.tmp").exists()


def test_erro_de_escrita_nao_deixa_arquivo_final_invalido(tmp_path):
    robo = robo_sem_chrome(no_write=True, dias=2)
    caminho = tmp_path / "destino_como_diretorio"
    caminho.mkdir()

    with pytest.raises(Exception):
        robo.exportar_linhas_extraidas(caminho, linhas_exportacao())

    assert caminho.is_dir()
    assert not caminho.with_name(f"{caminho.name}.tmp").exists()


def test_exportacao_no_processamento_nao_chama_google_sheets_ou_webhook(tmp_path):
    metricas = [
        metrica("11/07/2026", "4055717", "mimo"),
        metrica("12/07/2026", "4071561", "berco"),
    ]
    linhas = [
        ["11/07/2026", "4055717", "300", "RES1", "BASE", "mimo"],
        ["12/07/2026", "4071561", "301", "", "BASE", "berco"],
    ]
    caminho = tmp_path / "obs_linhas_extraidas.json"
    robo = robo_sem_chrome(dias=2, no_write=True, exportar_linhas=str(caminho))
    robo.mudar_data_para = lambda dias_para_frente, assinatura_anterior=None: (
        metricas[dias_para_frente]["data_confirmada"],
        f"sig-{dias_para_frente}",
    )

    def extrair(_data):
        indice = len(robo.metricas_por_data)
        robo.ultima_metrica_extracao = metricas[indice]
        return [linhas[indice]]

    robo.extrair_dados_pagina_atual = extrair
    robo.abrir_aba_solicitacoes = lambda: pytest.fail("nao deveria abrir Google Sheets")
    robo.acionar_webhook_e_validar = lambda *_: pytest.fail("nao deveria chamar webhook")

    robo.processar_semana_e_salvar()

    assert caminho.exists()


def test_exportacao_nao_altera_funcoes_dos_filtros():
    fonte = inspect.getsource(obs.RoboHITS.aplicar_filtros_e_obs)

    assert "span[8]/one-translate" in fonte
    assert "span[10]/one-translate" in fonte
    assert "button[17]" in fonte
    assert "aplicar_filtro_obrigatorio" not in fonte


def test_campos_proibidos_nao_aparecem_no_json(tmp_path):
    robo = robo_sem_chrome(no_write=True, dias=2)
    caminho = tmp_path / "obs_linhas_extraidas.json"

    payload = robo.exportar_linhas_extraidas(caminho, linhas_exportacao())
    texto = json.dumps(payload, ensure_ascii=False)

    for proibido in ["HITS_EMAIL", "HITS_PASSWORD", "client_secret", "token.json", "Bearer "]:
        assert proibido not in texto


class ElementoFake:
    def __init__(self, texto=""):
        self.text = texto


class ElementoStaleUmaVez:
    def __init__(self, texto=""):
        self.texto = texto
        self.chamadas = 0

    @property
    def text(self):
        self.chamadas += 1
        if self.chamadas == 1:
            raise obs.StaleElementReferenceException("stale texto")
        return self.texto


class CorpoFake:
    def __init__(
        self,
        voucher="100",
        pax="1/0",
        categoria="101 1CC",
        observacoes=None,
        erro_obs=None,
        erro_voucher=None,
        erro_categoria=None,
        stale_texto=False,
        stale_voucher=False,
        stale_obs=False,
    ):
        self.voucher = voucher
        self.pax = pax
        self.categoria = categoria
        self.observacoes = observacoes or []
        self.erro_obs = erro_obs
        self.erro_voucher = erro_voucher
        self.erro_categoria = erro_categoria
        self.stale_texto = stale_texto
        self.stale_voucher = stale_voucher
        self.stale_obs = stale_obs
        self._texto_chamadas = 0
        self._voucher_chamadas = 0
        self._obs_chamadas = 0

    @property
    def text(self):
        self._texto_chamadas += 1
        if self.stale_texto and self._texto_chamadas == 1:
            raise obs.StaleElementReferenceException("stale bloco")
        partes = [self.voucher, self.pax, self.categoria, *self.observacoes]
        return "\n".join(str(parte) for parte in partes if parte)

    def find_element(self, _by, xpath):
        if xpath == "./tr[1]/td[7]":
            self._voucher_chamadas += 1
            if self.stale_voucher and self._voucher_chamadas == 1:
                raise obs.StaleElementReferenceException("stale voucher")
            if self.erro_voucher:
                raise self.erro_voucher
            return ElementoFake(self.voucher)
        if xpath == "./tr[1]/td[4]":
            return ElementoFake(self.pax)
        if xpath == "./tr[1]/td[6]":
            if self.erro_categoria:
                raise self.erro_categoria
            return ElementoFake(self.categoria)
        raise LookupError(xpath)

    def find_elements(self, _by, xpath):
        if xpath == "./tr[position() > 1]/td":
            self._obs_chamadas += 1
            if self.stale_obs and self._obs_chamadas == 1:
                raise obs.StaleElementReferenceException("stale obs")
            if self.erro_obs:
                raise self.erro_obs
            return [ElementoFake(texto) for texto in self.observacoes]
        return []


class DriverFake:
    def __init__(self, corpos):
        self.corpos = corpos

    def find_elements(self, *_args):
        return self.corpos


class DriverSequencial:
    def __init__(self, sequencias):
        self.sequencias = list(sequencias)
        self.ultima = self.sequencias[-1] if self.sequencias else []

    def find_elements(self, *_args):
        if self.sequencias:
            self.ultima = self.sequencias.pop(0)
        return self.ultima


class CorpoSempreStale(CorpoFake):
    @property
    def text(self):
        raise obs.StaleElementReferenceException("stale permanente")


def robo_com_corpos(corpos):
    robo = robo_sem_chrome()
    robo.driver = DriverFake(corpos)
    robo.focar_quadro = lambda _xpath: True
    robo.aguardar_tabela_estavel_para_extracao = lambda _xpath: len(corpos)
    return robo


def test_stale_no_voucher_e_recuperado_rebuscando_dom():
    corpo = CorpoFake(voucher="120", stale_voucher=True, observacoes=["Berco"])
    robo = robo_com_corpos([corpo])

    linhas = robo.extrair_dados_pagina_atual("12/07/2026")

    assert linhas == [["12/07/2026", "120", "", "", "1CC", "BERCO"]]
    assert corpo._voucher_chamadas == 2


def test_stale_no_texto_e_recuperado_rebuscando_dom():
    corpo = CorpoFake(voucher="121", stale_texto=True, observacoes=[])
    robo = robo_com_corpos([corpo])

    linhas = robo.extrair_dados_pagina_atual("12/07/2026")

    assert linhas == [["12/07/2026", "121", "", "", "1CC", ""]]
    assert corpo._texto_chamadas == 2


def test_stale_por_tres_tentativas_falha():
    robo = robo_com_corpos([CorpoSempreStale(voucher="122")])

    with pytest.raises(RuntimeError, match="3 tentativas"):
        robo.extrair_dados_pagina_atual("12/07/2026")


def test_mudanca_da_quantidade_reinicia_o_dia_e_descarta_parcial():
    corpo_1 = CorpoFake(voucher="123")
    corpo_2 = CorpoFake(voucher="124", observacoes=["Berco"])
    robo = robo_sem_chrome()
    robo.driver = DriverSequencial([
        [corpo_1, corpo_2],
        [corpo_1],
        [corpo_1, corpo_2],
        [corpo_1, corpo_2],
    ])
    robo.focar_quadro = lambda _xpath: True
    robo.aguardar_tabela_estavel_para_extracao = lambda _xpath: 2

    linhas = robo.extrair_dados_pagina_atual("12/07/2026")

    assert linhas == [
        ["12/07/2026", "123", "", "", "1CC", ""],
        ["12/07/2026", "124", "", "", "1CC", "BERCO"],
    ]


def test_erro_real_impede_artifact(tmp_path):
    robo = robo_sem_chrome(no_write=True, dias=1)
    robo.metricas_por_data = [{"data_confirmada": "12/07/2026", "erros_reais_extracao": 1}]
    caminho = tmp_path / "obs_linhas_extraidas.json"

    with pytest.raises(RuntimeError, match="Artifact bloqueado"):
        robo.exportar_linhas_extraidas(caminho, [["12/07/2026", "125", "", "", "1CC", ""]])

    assert not caminho.exists()


def test_reserva_com_solicitacao_especial_entra_com_observacao():
    robo = robo_com_corpos([CorpoFake(observacoes=["Berco no quarto 300"])])

    linhas = robo.extrair_dados_pagina_atual("12/07/2026")

    assert linhas == [["12/07/2026", "100", "300", "", "1CC", "BERCO NO QUARTO 300"]]
    assert robo.ultima_metrica_extracao["com_solicitacao"] == 1
    assert robo.ultima_metrica_extracao["sem_solicitacao"] == 0


def test_reserva_com_texto_generico_entra_com_observacao_vazia():
    robo = robo_com_corpos([CorpoFake(voucher="101", observacoes=["texto administrativo simples"])])

    linhas = robo.extrair_dados_pagina_atual("12/07/2026")

    assert linhas == [["12/07/2026", "101", "", "", "1CC", ""]]
    assert robo.ultima_metrica_extracao["sem_solicitacao"] == 1


def test_reserva_com_tr_observacao_vazio_entra():
    robo = robo_com_corpos([CorpoFake(voucher="102", observacoes=[""])])

    linhas = robo.extrair_dados_pagina_atual("12/07/2026")

    assert linhas == [["12/07/2026", "102", "", "", "1CC", ""]]


def test_reserva_sem_tr_observacao_entra():
    robo = robo_com_corpos([CorpoFake(voucher="103", observacoes=[])])

    linhas = robo.extrair_dados_pagina_atual("12/07/2026")

    assert linhas == [["12/07/2026", "103", "", "", "1CC", ""]]


def test_analise_sem_texto_relevante_nao_impede_exportacao(monkeypatch):
    robo = robo_com_corpos([CorpoFake(voucher="104", observacoes=["qualquer coisa"])])
    monkeypatch.setattr(robo, "analisar_texto_e_extrair", lambda _obs_raw: ("", "", ""))

    linhas = robo.extrair_dados_pagina_atual("12/07/2026")

    assert linhas == [["12/07/2026", "104", "", "", "1CC", ""]]


def test_obs_raw_vazio_calcula_categoria_verificada():
    robo = robo_sem_chrome()

    assert robo.calcular_categoria_verificada("", "2/1", "1CC") == "1CC"


def test_categoria_identificada_e_observacao_vazia_exporta_registro():
    robo = robo_com_corpos([CorpoFake(voucher="105", categoria="Apartamento 2CSS", observacoes=[])])

    linhas = robo.extrair_dados_pagina_atual("12/07/2026")

    assert linhas == [["12/07/2026", "105", "", "", "2CC", ""]]
    assert robo.ultima_metrica_extracao["categorias_preenchidas"] == 1


def test_voucher_duplicado_exporta_duas_linhas_e_contabiliza_repeticao():
    corpos = [
        CorpoFake(voucher="106", observacoes=["Berco"]),
        CorpoFake(voucher="106", categoria="202 2CC", observacoes=["Berco"]),
    ]
    robo = robo_com_corpos(corpos)

    linhas = robo.extrair_dados_pagina_atual("12/07/2026")

    assert linhas == [
        ["12/07/2026", "106", "", "", "1CC", "BERCO"],
        ["12/07/2026", "106", "", "", "2CC", "BERCO"],
    ]
    assert robo.ultima_metrica_extracao["registros_exportados"] == 2
    assert robo.ultima_metrica_extracao["vouchers_unicos"] == 1
    assert robo.ultima_metrica_extracao["ocorrencias_voucher_repetido"] == 1


def test_erro_ao_ler_observacao_nao_elimina_reserva():
    robo = robo_com_corpos([CorpoFake(voucher="107", erro_obs=RuntimeError("obs indisponivel"))])

    linhas = robo.extrair_dados_pagina_atual("12/07/2026")

    assert linhas == [["12/07/2026", "107", "", "", "1CC", ""]]
    assert robo.ultima_metrica_extracao["erros_extracao"] == 1


def test_erro_ao_ler_voucher_registra_erro_sem_linha_invalida():
    robo = robo_com_corpos([CorpoFake(erro_voucher=RuntimeError("voucher indisponivel"))])

    with pytest.raises(RuntimeError, match="Erro real de extracao"):
        robo.extrair_dados_pagina_atual("12/07/2026")


def test_tbody_sem_celula_voucher_conta_como_bloco_estrutural():
    robo = robo_com_corpos([CorpoFake(erro_voucher=obs.NoSuchElementException("sem td7"))])

    linhas = robo.extrair_dados_pagina_atual("12/07/2026")

    assert linhas == []
    assert robo.ultima_metrica_extracao["blocos_estruturais_ignorados"] == 1
    assert robo.ultima_metrica_extracao["erros_reais_extracao"] == 0


def test_tbody_com_voucher_e_falha_categoria_conta_como_erro_real():
    robo = robo_com_corpos([CorpoFake(voucher="112", erro_categoria=RuntimeError("categoria indisponivel"))])

    with pytest.raises(RuntimeError, match="Erro real de extracao"):
        robo.extrair_dados_pagina_atual("12/07/2026")


def test_metricas_totalizam_com_e_sem_solicitacao_descontando_erros():
    corpos = [
        CorpoFake(voucher="108", observacoes=["Berco"]),
        CorpoFake(voucher="109", observacoes=[]),
        CorpoFake(erro_voucher=obs.NoSuchElementException("sem td7")),
    ]
    robo = robo_com_corpos(corpos)

    linhas = robo.extrair_dados_pagina_atual("12/07/2026")
    metrica_extraida = robo.ultima_metrica_extracao

    assert len(linhas) == 2
    assert metrica_extraida["registros_exportados"] == 2
    assert metrica_extraida["registros_exportados"] == (
        metrica_extraida["com_solicitacao"] + metrica_extraida["sem_solicitacao"]
    )
    assert metrica_extraida["erros_extracao"] == 0
    assert metrica_extraida["blocos_estruturais_ignorados"] == 1


def test_artifact_inclui_registros_com_observacao_vazia(tmp_path):
    robo = robo_sem_chrome(no_write=True, dias=1)
    caminho = tmp_path / "obs_linhas_extraidas.json"
    linhas = [["12/07/2026", "110", "", "", "1CC", ""]]

    payload = robo.exportar_linhas_extraidas(caminho, linhas)

    assert payload["linhas_extraidas"] == linhas
    assert payload["metricas_por_data"] == [
        {
            "data": "12/07/2026",
            "registros_exportados": 1,
            "com_solicitacao": 0,
            "sem_solicitacao": 1,
            "vouchers_unicos": 1,
            "ocorrencias_voucher_repetido": 0,
            "erros_extracao": 0,
            "erros_reais_extracao": 0,
            "blocos_estruturais_ignorados": 0,
        }
    ]


def test_hash_inclui_linhas_com_ultimo_campo_vazio():
    com_vazio = [["12/07/2026", "111", "", "", "1CC", ""]]
    sem_coluna = [["12/07/2026", "111", "", "", "1CC"]]

    assert obs.RoboHITS.hash_linhas(com_vazio) == obs.RoboHITS.hash_linhas(sem_coluna)
    assert obs.RoboHITS.hash_linhas(com_vazio) != obs.RoboHITS.hash_linhas(
        [["12/07/2026", "111", "", "", "1CC", "late checkout"]]
    )


def test_quatro_blocos_com_mesmo_voucher_geram_quatro_linhas():
    corpos = [CorpoFake(voucher="200", categoria=f"{andar} 1CC") for andar in ["101", "102", "103", "104"]]
    robo = robo_com_corpos(corpos)

    linhas = robo.extrair_dados_pagina_atual("12/07/2026")

    assert len(linhas) == 4
    assert [linha[1] for linha in linhas] == ["200", "200", "200", "200"]
    assert robo.ultima_metrica_extracao["vouchers_unicos"] == 1
    assert robo.ultima_metrica_extracao["ocorrencias_voucher_repetido"] == 3


def test_mesmo_voucher_com_categorias_diferentes_preserva_ambas_as_linhas():
    robo = robo_com_corpos([
        CorpoFake(voucher="201", categoria="101 1CC"),
        CorpoFake(voucher="201", categoria="202 2CSS"),
    ])

    linhas = robo.extrair_dados_pagina_atual("12/07/2026")

    assert [linha[4] for linha in linhas] == ["1CC", "2CC"]
    assert len(linhas) == 2


def test_mesmo_voucher_com_e_sem_observacao_preserva_ambas_as_linhas():
    robo = robo_com_corpos([
        CorpoFake(voucher="202", observacoes=["Berco"]),
        CorpoFake(voucher="202", observacoes=[]),
    ])

    linhas = robo.extrair_dados_pagina_atual("12/07/2026")

    assert linhas == [
        ["12/07/2026", "202", "", "", "1CC", "BERCO"],
        ["12/07/2026", "202", "", "", "1CC", ""],
    ]
    assert robo.ultima_metrica_extracao["com_solicitacao"] == 1
    assert robo.ultima_metrica_extracao["sem_solicitacao"] == 1


def test_metricas_24_registros_21_vouchers_unicos_e_3_repeticoes():
    corpos = [CorpoFake(voucher=f"{300 + indice}") for indice in range(21)]
    corpos.extend([CorpoFake(voucher="300"), CorpoFake(voucher="301"), CorpoFake(voucher="302")])
    robo = robo_com_corpos(corpos)

    linhas = robo.extrair_dados_pagina_atual("11/07/2026")

    assert len(linhas) == 24
    assert robo.ultima_metrica_extracao["registros_exportados"] == 24
    assert robo.ultima_metrica_extracao["vouchers_unicos"] == 21
    assert robo.ultima_metrica_extracao["ocorrencias_voucher_repetido"] == 3


def test_inclusao_nao_depende_de_voucher_ja_processado():
    fonte = inspect.getsource(obs.RoboHITS.extrair_dados_pagina_atual)

    assert "vouchers_processados" not in fonte
    assert "voucher in" not in fonte


def test_artifact_aceita_vouchers_repetidos(tmp_path):
    robo = robo_sem_chrome(no_write=True, dias=1)
    caminho = tmp_path / "obs_linhas_extraidas.json"
    linhas = [
        ["12/07/2026", "400", "", "", "1CC", ""],
        ["12/07/2026", "400", "", "", "2CC", ""],
    ]

    payload = robo.exportar_linhas_extraidas(caminho, linhas)

    assert payload["quantidade_registros"] == 2
    assert payload["vouchers_unicos"] == 1
    assert payload["metricas_por_data"][0]["ocorrencias_voucher_repetido"] == 1


def test_hash_considera_todas_as_linhas_com_vouchers_repetidos():
    uma_linha = [["12/07/2026", "401", "", "", "1CC", ""]]
    duas_linhas_repetidas = [
        ["12/07/2026", "401", "", "", "1CC", ""],
        ["12/07/2026", "401", "", "", "1CC", ""],
    ]

    assert obs.RoboHITS.hash_linhas(uma_linha) != obs.RoboHITS.hash_linhas(duas_linhas_repetidas)
