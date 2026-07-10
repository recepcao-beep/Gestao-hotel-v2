from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys
import time
import unicodedata
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

import gspread
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow


ID_PLANILHA = "1oMKFu9aobTP5sBuF0jjSR4In3Z6EcWfATCe_9ijNFXA"
ABA_PLANO = "VINCULACAO_HOJE"
ABA_DADOS = "DADOS_BRUTOS_HITS"
ABA_INVENTARIO = "MAPA_7_DIAS"
ACOES_VALIDAS = {"MANTER", "TROCAR", "VINCULAR", "OVERBOOKING", "REVISAR", "BLOQUEADO"}


@dataclass(frozen=True)
class Intervalo:
    inicio: datetime
    fim: datetime


@dataclass
class Quarto:
    apto: str
    categoria: str
    andar: int


@dataclass
class RegistroHits:
    indice: int
    apto: str
    voucher: str
    checkin: datetime
    checkout: datetime
    status: str
    hospede: str
    categoria: str


@dataclass
class ItemPlano:
    idx: int
    linha_planilha: int
    voucher: str
    sugerido: str
    categoria: str
    hospede: str
    checkin: datetime
    checkout: datetime
    status_extra: str
    atual: str
    acao_original: str
    origem: RegistroHits
    atribuido: str = ""
    overbooking: bool = False
    revisar: str = ""
    upgrade: bool = False

    @property
    def intervalo(self) -> Intervalo:
        return Intervalo(self.checkin, self.checkout)


@dataclass(frozen=True)
class OcupacaoFixa:
    apto: str
    intervalo: Intervalo
    identificador: str


def normalizar_texto(valor: object) -> str:
    texto = "" if valor is None else str(valor)
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(ch for ch in texto if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", texto.strip().upper())


def normalizar_header(valor: object) -> str:
    return re.sub(r"[^A-Z0-9]+", "_", normalizar_texto(valor)).strip("_")


def normalizar_voucher(valor: object) -> str:
    texto = "" if valor is None else str(valor).strip()
    digitos = re.sub(r"\D", "", texto)
    return digitos or texto.upper()


def limpar_apto(valor: object) -> str:
    texto = "" if valor is None else str(valor).strip()
    if not texto:
        return ""
    match = re.search(r"\b(\d{3,4})\b", texto)
    return match.group(1) if match else texto


def parse_data(valor: object) -> datetime:
    if isinstance(valor, datetime):
        return valor.replace(hour=0, minute=0, second=0, microsecond=0)
    texto = str(valor or "").strip()
    if not texto:
        raise ValueError("Data vazia")
    texto = texto.split(" ")[0]
    formatos = ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d", "%Y/%m/%d")
    for formato in formatos:
        try:
            return datetime.strptime(texto, formato)
        except ValueError:
            pass
    raise ValueError(f"Data invalida: {valor!r}")


def sobrepoe(a: Intervalo, b: Intervalo) -> bool:
    return a.inicio < b.fim and b.inicio < a.fim


def familia_categoria(valor: str) -> str:
    c = normalizar_texto(valor).replace(" ", "")
    if not c:
        return ""
    if "SEMSACADA" in c:
        return "SEM SACADA"
    if "CONSAGRADO" in c:
        return "CONSAGRADO"
    if "SACADA" in c:
        return "COM SACADA"
    if "PRESIDENCIAL" in c:
        return "PRESIDENCIAL"
    if "PCD" in c or "ADAPTADO" in c:
        return "PCD"
    return normalizar_texto(valor)


def categoria_permitida(cat_reserva: str, cat_apto: str) -> Tuple[bool, bool]:
    reserva_norm = normalizar_texto(cat_reserva)
    apto_norm = normalizar_texto(cat_apto)
    reserva = familia_categoria(cat_reserva)
    apto = familia_categoria(cat_apto)

    if not reserva_norm or not apto_norm:
        return False, False
    if reserva_norm == apto_norm or reserva == apto:
        return True, False
    if reserva == "CONSAGRADO" and apto == "SEM SACADA":
        return False, False
    if reserva == "PRESIDENCIAL" and apto != "PRESIDENCIAL":
        return False, False
    if reserva == "PCD" and apto != "PCD":
        return False, False

    upgrades = {
        "SEM SACADA": {"COM SACADA", "CONSAGRADO"},
        "COM SACADA": {"CONSAGRADO"},
    }
    if apto in upgrades.get(reserva, set()):
        return True, True

    prefixo_reserva = reserva_norm[:1]
    prefixo_apto = apto_norm[:1]
    if prefixo_reserva.isdigit() and prefixo_apto.isdigit():
        if prefixo_reserva == prefixo_apto:
            return True, False
        if prefixo_reserva == "2" and prefixo_apto == "1":
            return True, True
    return False, False


def autenticar() -> gspread.Client:
    escopos = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    base = os.path.dirname(os.path.abspath(__file__))
    token = os.path.join(base, "token.json")
    secret = os.path.join(base, "client_secret.json")
    creds = None
    if os.path.exists(token):
        creds = Credentials.from_authorized_user_file(token, escopos)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(secret):
                raise FileNotFoundError(f"Credencial ausente: {secret}")
            creds = InstalledAppFlow.from_client_secrets_file(secret, escopos).run_local_server(port=0)
        with open(token, "w", encoding="utf-8") as arquivo:
            arquivo.write(creds.to_json())
    return gspread.authorize(creds)


def indice_header(cabecalho: Sequence[str], nomes: Iterable[str], fallback: Optional[int] = None) -> int:
    mapa = {normalizar_header(v): i for i, v in enumerate(cabecalho)}
    for nome in nomes:
        chave = normalizar_header(nome)
        if chave in mapa:
            return mapa[chave]
    if fallback is not None:
        return fallback
    raise KeyError(f"Cabecalho nao encontrado. Opcoes: {list(nomes)}")


def ler_estavel(aba: gspread.Worksheet, tentativas: int = 5, intervalo: float = 3.0) -> List[List[str]]:
    anterior: Optional[List[List[str]]] = None
    for tentativa in range(1, tentativas + 1):
        atual = aba.get_all_values()
        assinatura = hashlib.sha1(repr(atual).encode("utf-8")).hexdigest()[:12]
        print(f"Leitura {tentativa}/{tentativas} de {aba.title}: assinatura {assinatura}")
        if anterior == atual:
            print(f"Aba {aba.title} estabilizada.")
            return atual
        anterior = atual
        if tentativa < tentativas:
            time.sleep(intervalo)
    print(f"Aviso: {aba.title} nao estabilizou; usando a ultima leitura.")
    return anterior or []


def carregar_inventario(valores: List[List[str]]) -> Dict[str, Quarto]:
    inventario: Dict[str, Quarto] = {}
    for linha in valores[1:]:
        if not linha:
            continue
        apto = limpar_apto(linha[0] if len(linha) > 0 else "")
        if not apto:
            continue
        categoria = ""
        if len(linha) > 2 and str(linha[2]).strip():
            categoria = str(linha[2]).strip()
        elif len(linha) > 1:
            categoria = str(linha[1]).strip()
        numero = int(re.sub(r"\D", "", apto) or 0)
        inventario[apto] = Quarto(apto=apto, categoria=categoria, andar=(numero // 100) * 100)
    if not inventario:
        raise RuntimeError("Inventario vazio na aba MAPA_7_DIAS.")
    return inventario


def carregar_dados_hits(valores: List[List[str]]) -> Tuple[List[RegistroHits], Dict[datetime, Set[str]], Dict[datetime, Set[int]]]:
    if not valores:
        raise RuntimeError("Aba DADOS_BRUTOS_HITS vazia.")
    registros: List[RegistroHits] = []
    aptos_bloqueados: Dict[datetime, Set[str]] = {}
    andares_bloqueados: Dict[datetime, Set[int]] = {}

    for i, linha in enumerate(valores[1:], start=2):
        def col(indice: int) -> str:
            return str(linha[indice]).strip() if len(linha) > indice else ""

        apto = limpar_apto(col(0))
        voucher = normalizar_voucher(col(1))
        status = normalizar_texto(col(4))
        if voucher and col(2) and col(3):
            try:
                checkin = parse_data(col(2))
                checkout = parse_data(col(3))
            except ValueError:
                checkin = checkout = None
            if checkin and checkout and checkout > checkin:
                registros.append(
                    RegistroHits(
                        indice=i,
                        apto=apto,
                        voucher=voucher,
                        checkin=checkin,
                        checkout=checkout,
                        status=status,
                        hospede=col(6),
                        categoria=col(7),
                    )
                )

        # Excecoes configuradas em DADOS_BRUTOS_HITS:
        # O = Data de excecao, P = Andares a ignorar.
        data_excecao = col(14)
        if data_excecao:
            try:
                data = parse_data(data_excecao)
            except ValueError:
                continue
            if col(15):
                for valor in re.split(r"[,;]", col(15)):
                    numero = re.sub(r"\D", "", valor)
                    if numero:
                        andares_bloqueados.setdefault(data, set()).add(int(numero))
    return registros, aptos_bloqueados, andares_bloqueados


def escolher_origem(
    linha: List[str],
    registros: List[RegistroHits],
    usados: Set[int],
    idx_voucher: int,
    idx_hospede: int,
    idx_checkin: int,
    idx_atual: int,
    idx_cat: int,
) -> RegistroHits:
    voucher = normalizar_voucher(linha[idx_voucher] if len(linha) > idx_voucher else "")
    hospede = normalizar_texto(linha[idx_hospede] if len(linha) > idx_hospede else "")
    atual = limpar_apto(linha[idx_atual] if len(linha) > idx_atual else "")
    categoria = normalizar_texto(linha[idx_cat] if len(linha) > idx_cat else "")
    data = parse_data(linha[idx_checkin])

    candidatos = [r for r in registros if r.indice not in usados and r.voucher == voucher]
    if not candidatos:
        raise RuntimeError(f"Voucher {voucher} da planilha nao encontrado em DADOS_BRUTOS_HITS.")

    def pontuacao(r: RegistroHits) -> Tuple[int, int]:
        score = 0
        if r.checkin == data:
            score += 100
        if atual and r.apto == atual:
            score += 80
        if hospede and normalizar_texto(r.hospede).startswith(hospede[:20]):
            score += 40
        if categoria and normalizar_texto(r.categoria) == categoria:
            score += 20
        return score, -r.indice

    escolhido = max(candidatos, key=pontuacao)
    usados.add(escolhido.indice)
    return escolhido


def carregar_plano(valores: List[List[str]], registros: List[RegistroHits]) -> Tuple[List[ItemPlano], List[List[str]]]:
    if len(valores) < 2:
        raise RuntimeError("Aba VINCULACAO_HOJE sem linhas para conciliar.")
    cab = valores[0]
    idx_voucher = indice_header(cab, ["Voucher"], 0)
    idx_sugerido = indice_header(cab, ["Apto Sugerido", "Apartamento Sugerido"], 1)
    idx_cat = indice_header(cab, ["Categoria"], 2)
    idx_hospede = indice_header(cab, ["Hospede", "Hóspede"], 3)
    idx_checkin = indice_header(cab, ["Data Check-in", "Check-in"], 4)
    idx_status = indice_header(cab, ["Status Extra", "Status"], 5)
    idx_atual = indice_header(cab, ["Apto Atual", "Apartamento Atual"], 7)
    idx_acao = indice_header(cab, ["Acao", "Ação"], 8)

    usados: Set[int] = set()
    itens: List[ItemPlano] = []
    linhas_saida = [list(linha) + [""] * max(0, 9 - len(linha)) for linha in valores]
    for n, linha in enumerate(valores[1:], start=2):
        voucher = normalizar_voucher(linha[idx_voucher] if len(linha) > idx_voucher else "")
        if not voucher:
            continue
        acao = normalizar_texto(linha[idx_acao] if len(linha) > idx_acao else "")
        if acao and acao not in ACOES_VALIDAS:
            raise RuntimeError(f"Acao desconhecida na linha {n}: {acao}")
        if acao in {"REVISAR", "BLOQUEADO"}:
            raise RuntimeError(f"Plano bloqueado antes da conciliacao: linha {n}, voucher {voucher}, acao {acao}")
        origem = escolher_origem(linha, registros, usados, idx_voucher, idx_hospede, idx_checkin, idx_atual, idx_cat)
        item = ItemPlano(
            idx=len(itens),
            linha_planilha=n,
            voucher=voucher,
            sugerido=limpar_apto(linha[idx_sugerido] if len(linha) > idx_sugerido else ""),
            categoria=str(linha[idx_cat] if len(linha) > idx_cat else origem.categoria).strip() or origem.categoria,
            hospede=str(linha[idx_hospede] if len(linha) > idx_hospede else origem.hospede).strip(),
            checkin=origem.checkin,
            checkout=origem.checkout,
            status_extra=str(linha[idx_status] if len(linha) > idx_status else "").strip(),
            atual=origem.apto or limpar_apto(linha[idx_atual] if len(linha) > idx_atual else ""),
            acao_original=acao,
            origem=origem,
        )
        if not item.acao_original:
            if item.atual and item.sugerido and item.atual == item.sugerido:
                item.acao_original = "MANTER"
            elif item.atual:
                item.acao_original = "TROCAR"
            else:
                item.acao_original = "VINCULAR"
        if item.acao_original == "MANTER":
            if not item.atual:
                raise RuntimeError(f"Linha {n}: MANTER sem apartamento atual.")
            if item.sugerido and item.sugerido != item.atual:
                raise RuntimeError(
                    f"Linha {n}: MANTER divergente (atual {item.atual}, sugerido {item.sugerido})."
                )
            item.atribuido = item.atual
        itens.append(item)
    if not itens:
        raise RuntimeError("Nenhuma reserva encontrada em VINCULACAO_HOJE.")
    return itens, linhas_saida


def assinatura_plano(linhas: List[List[str]]) -> str:
    partes = []
    for linha in linhas[1:]:
        if not linha or not str(linha[0]).strip():
            continue
        partes.append("|".join(str(v).strip() for v in (linha + [""] * 9)[:9]))
    return hashlib.sha256("\n".join(partes).encode("utf-8")).hexdigest()[:20]


class Solucionador:
    def __init__(
        self,
        itens: List[ItemPlano],
        inventario: Dict[str, Quarto],
        fixas: List[OcupacaoFixa],
        aptos_bloqueados: Dict[datetime, Set[str]],
        andares_bloqueados: Dict[datetime, Set[int]],
        limite_segundos: float,
    ) -> None:
        self.itens = itens
        self.inventario = inventario
        self.fixas_por_apto: Dict[str, List[OcupacaoFixa]] = {}
        for ocupacao in fixas:
            self.fixas_por_apto.setdefault(ocupacao.apto, []).append(ocupacao)
        self.aptos_bloqueados = aptos_bloqueados
        self.andares_bloqueados = andares_bloqueados
        self.inicio = time.monotonic()
        self.limite = limite_segundos
        self.atribuicoes: Dict[int, str] = {}
        self.por_quarto: Dict[str, Set[int]] = {apto: set() for apto in inventario}
        self.cache_candidatos: Dict[int, List[Tuple[str, bool]]] = {}

    def expirou(self) -> bool:
        return time.monotonic() - self.inicio > self.limite

    def prioridade(self, item: ItemPlano) -> Tuple[datetime, int, int]:
        acao_peso = {"MANTER": 0, "TROCAR": 1, "VINCULAR": 2, "OVERBOOKING": 3, "REVISAR": 4}.get(item.acao_original, 5)
        return item.checkin, acao_peso, item.idx

    def quarto_bloqueado(self, item: ItemPlano, quarto: Quarto) -> bool:
        if quarto.apto in self.aptos_bloqueados.get(item.checkin, set()):
            return True
        return quarto.andar in self.andares_bloqueados.get(item.checkin, set())

    def candidatos(self, item: ItemPlano) -> List[Tuple[str, bool]]:
        if item.idx in self.cache_candidatos:
            return self.cache_candidatos[item.idx]
        candidatos: List[Tuple[Tuple[int, int, int, int], str, bool]] = []
        andar_sugerido = self.inventario.get(item.sugerido, Quarto("", "", 0)).andar if item.sugerido else 0
        for quarto in self.inventario.values():
            permitido, upgrade = categoria_permitida(item.categoria, quarto.categoria)
            if not permitido or self.quarto_bloqueado(item, quarto):
                continue
            if quarto.apto == item.sugerido:
                base = 0
            elif quarto.apto == item.atual:
                base = 5
            elif not upgrade and andar_sugerido and quarto.andar == andar_sugerido:
                base = 15
            elif not upgrade:
                base = 25
            elif andar_sugerido and quarto.andar == andar_sugerido:
                base = 45
            else:
                base = 60
            numero = int(re.sub(r"\D", "", quarto.apto) or 99999)
            candidatos.append(((base, 1 if upgrade else 0, abs(quarto.andar - andar_sugerido), numero), quarto.apto, upgrade))
        candidatos.sort(key=lambda x: x[0])
        resultado = [(apto, upgrade) for _, apto, upgrade in candidatos]
        self.cache_candidatos[item.idx] = resultado
        return resultado

    def conflito_fixo(self, item: ItemPlano, apto: str) -> bool:
        return any(sobrepoe(item.intervalo, fix.intervalo) for fix in self.fixas_por_apto.get(apto, []))

    def bloqueadores(self, item: ItemPlano, apto: str) -> List[int]:
        return [
            outro_id
            for outro_id in self.por_quarto.get(apto, set())
            if outro_id != item.idx and sobrepoe(item.intervalo, self.itens[outro_id].intervalo)
        ]

    def remover(self, item_id: int) -> None:
        apto = self.atribuicoes.pop(item_id, "")
        if apto:
            self.por_quarto.setdefault(apto, set()).discard(item_id)

    def colocar(self, item_id: int, apto: str) -> None:
        self.remover(item_id)
        self.atribuicoes[item_id] = apto
        self.por_quarto.setdefault(apto, set()).add(item_id)

    def snapshot(self) -> Dict[int, str]:
        return dict(self.atribuicoes)

    def restaurar(self, estado: Dict[int, str]) -> None:
        self.atribuicoes = dict(estado)
        self.por_quarto = {apto: set() for apto in self.inventario}
        for item_id, apto in self.atribuicoes.items():
            self.por_quarto.setdefault(apto, set()).add(item_id)

    def tentar_atribuir(
        self,
        item_id: int,
        visitados_itens: Set[int],
        visitados_quartos: Set[str],
        profundidade: int = 0,
    ) -> bool:
        if self.expirou() or profundidade > 24 or item_id in visitados_itens:
            return False
        item = self.itens[item_id]
        visitados_itens = set(visitados_itens)
        visitados_itens.add(item_id)

        lista = self.candidatos(item)
        livres: List[Tuple[str, bool]] = []
        ocupados: List[Tuple[str, bool]] = []
        for apto, upgrade in lista:
            if apto in visitados_quartos or self.conflito_fixo(item, apto):
                continue
            if self.bloqueadores(item, apto):
                ocupados.append((apto, upgrade))
            else:
                livres.append((apto, upgrade))

        for apto, upgrade in livres + ocupados:
            if self.expirou():
                return False
            estado = self.snapshot()
            self.remover(item_id)
            bloqueadores = self.bloqueadores(item, apto)
            sucesso = True
            for bloqueador in sorted(bloqueadores, key=lambda i: self.prioridade(self.itens[i]), reverse=True):
                self.remover(bloqueador)
                if not self.tentar_atribuir(
                    bloqueador,
                    visitados_itens,
                    visitados_quartos | {apto},
                    profundidade + 1,
                ):
                    sucesso = False
                    break
            if sucesso and not self.conflito_fixo(item, apto) and not self.bloqueadores(item, apto):
                self.colocar(item_id, apto)
                item.upgrade = upgrade
                return True
            self.restaurar(estado)
        return False

    def escolher_overbooking(self, item: ItemPlano) -> Tuple[str, bool]:
        melhor: Optional[Tuple[Tuple[int, int, int], str, bool]] = None
        for ordem, (apto, upgrade) in enumerate(self.candidatos(item)):
            conflitos = len(self.bloqueadores(item, apto)) + sum(
                1 for fix in self.fixas_por_apto.get(apto, []) if sobrepoe(item.intervalo, fix.intervalo)
            )
            chave = (conflitos, ordem, 1 if upgrade else 0)
            if melhor is None or chave < melhor[0]:
                melhor = (chave, apto, upgrade)
        if melhor is None:
            return "", False
        return melhor[1], melhor[2]

    def resolver(self, permitir_overbooking: bool) -> None:
        ordem = sorted(
            (item.idx for item in self.itens if item.acao_original != "MANTER"),
            key=lambda i: self.prioridade(self.itens[i]),
        )
        pendentes: List[int] = []
        for item_id in ordem:
            if not self.tentar_atribuir(item_id, set(), set()):
                pendentes.append(item_id)

        for item_id in pendentes:
            item = self.itens[item_id]
            if not permitir_overbooking:
                item.revisar = "SEM SOLUCAO SEM OVERBOOKING"
                continue
            apto, upgrade = self.escolher_overbooking(item)
            if not apto:
                item.revisar = "SEM APARTAMENTO COMPATIVEL"
                continue
            self.colocar(item_id, apto)
            item.overbooking = True
            item.upgrade = upgrade

        for item in self.itens:
            if item.acao_original == "MANTER":
                item.atribuido = item.atual
            else:
                item.atribuido = self.atribuicoes.get(item.idx, "")


def montar_fixas(registros: List[RegistroHits], itens: List[ItemPlano]) -> List[OcupacaoFixa]:
    indices_moveis = {item.origem.indice for item in itens if item.acao_original != "MANTER"}
    fixas: List[OcupacaoFixa] = []
    for item in itens:
        if item.acao_original == "MANTER" and item.atual:
            fixas.append(
                OcupacaoFixa(
                    apto=item.atual,
                    intervalo=item.intervalo,
                    identificador=f"{item.voucher}/MANTER",
                )
            )
    for r in registros:
        if not r.apto:
            continue
        e_fixo = "OCUPADO" in r.status or "INTERDITADO" in r.status or r.indice not in indices_moveis
        if e_fixo:
            fixas.append(
                OcupacaoFixa(
                    apto=r.apto,
                    intervalo=Intervalo(r.checkin, r.checkout),
                    identificador=f"{r.voucher}/{r.status}",
                )
            )
    return fixas


def validar(itens: List[ItemPlano], fixas: List[OcupacaoFixa], inventario: Dict[str, Quarto]) -> List[str]:
    erros: List[str] = []
    por_apto: Dict[str, List[ItemPlano]] = {}
    for item in itens:
        if item.revisar:
            erros.append(f"Linha {item.linha_planilha}: {item.revisar}")
        if item.acao_original in {"REVISAR", "BLOQUEADO"}:
            erros.append(f"Linha {item.linha_planilha}: acao bloqueada {item.acao_original}")
        if not item.voucher or not item.checkin or not item.checkout or not item.categoria:
            erros.append(f"Linha {item.linha_planilha}: dados essenciais vazios")
        if item.acao_original == "MANTER":
            if not item.atual or item.atribuido != item.atual:
                erros.append(f"Linha {item.linha_planilha}: MANTER divergente")
        if item.acao_original == "TROCAR":
            if not item.atual:
                erros.append(f"Linha {item.linha_planilha}: TROCAR sem apartamento atual")
            if item.atribuido and item.atribuido == item.atual:
                erros.append(f"Linha {item.linha_planilha}: TROCAR com atual igual ao sugerido")
        if item.acao_original == "VINCULAR" and item.atual:
            erros.append(f"Linha {item.linha_planilha}: VINCULAR com apartamento atual preenchido")
        if item.atribuido:
            quarto = inventario.get(item.atribuido)
            if not quarto:
                erros.append(f"Linha {item.linha_planilha}: apartamento {item.atribuido} fora do inventario")
            else:
                permitido, _ = categoria_permitida(item.categoria, quarto.categoria)
                if not permitido:
                    erros.append(
                        f"Linha {item.linha_planilha}: categoria incompatível {item.categoria} -> {item.atribuido}/{quarto.categoria}"
                    )
        if item.atribuido:
            por_apto.setdefault(item.atribuido, []).append(item)

    fixas_por_apto: Dict[str, List[OcupacaoFixa]] = {}
    for fix in fixas:
        fixas_por_apto.setdefault(fix.apto, []).append(fix)

    for apto, lista in por_apto.items():
        for i, a in enumerate(lista):
            for b in lista[i + 1 :]:
                if sobrepoe(a.intervalo, b.intervalo) and not (a.overbooking or b.overbooking):
                    erros.append(f"Colisao nao marcada: AP {apto}, vouchers {a.voucher} e {b.voucher}")
            for fix in fixas_por_apto.get(apto, []):
                if fix.identificador == f"{a.voucher}/MANTER":
                    continue
                if sobrepoe(a.intervalo, fix.intervalo) and not a.overbooking:
                    erros.append(f"Colisao com ocupacao fixa: AP {apto}, voucher {a.voucher}, fixo {fix.identificador}")
    return erros


def atualizar_linhas(itens: List[ItemPlano], linhas: List[List[str]]) -> None:
    for item in itens:
        linha = linhas[item.linha_planilha - 1]
        while len(linha) < 9:
            linha.append("")
        linha[1] = item.atribuido
        linha[7] = item.atual
        status = item.status_extra
        tags = []
        if item.acao_original == "MANTER":
            acao = "MANTER"
        elif item.upgrade and "UPGRADE" not in normalizar_texto(status):
            tags.append("UPGRADE")
            acao = ""
        else:
            acao = ""
        if item.overbooking:
            tags.append("OVERBOOKING REAL")
            acao = "OVERBOOKING"
        elif item.revisar or not item.atribuido:
            tags.append(item.revisar or "REVISAR")
            acao = "REVISAR"
        elif acao:
            pass
        elif item.atual and item.atribuido == item.atual:
            acao = "MANTER"
        elif item.atual:
            acao = "TROCAR"
        else:
            acao = "VINCULAR"
        if tags:
            status = " + ".join([parte for parte in [status] + tags if parte])
        linha[5] = status
        linha[8] = acao


def escrever_resultado(aba: gspread.Worksheet, linhas: List[List[str]], assinatura: str) -> None:
    largura = max(9, max(len(linha) for linha in linhas))
    valores = [linha + [""] * (largura - len(linha)) for linha in linhas]
    aba.update(range_name=f"A1:{gspread.utils.rowcol_to_a1(len(valores), largura)}", values=valores)
    aba.update(range_name="K1:L2", values=[
        ["STATUS_CONCILIACAO", "ASSINATURA_CONCILIACAO"],
        ["VALIDADA", assinatura],
    ])


def main() -> int:
    parser = argparse.ArgumentParser(description="Resolve colisões e cadeias da VINCULACAO_HOJE.")
    parser.add_argument("--dry-run", action="store_true", help="Calcula e valida sem escrever na planilha.")
    parser.add_argument("--sem-overbooking", action="store_true", help="Bloqueia quando não há solução física.")
    parser.add_argument("--permitir-overbooking", action="store_true", help="Permite marcar OVERBOOKING quando nao houver solucao fisica.")
    parser.add_argument("--max-seconds", type=float, default=float(os.environ.get("CONCILIACAO_MAX_SECONDS", "240")))
    args = parser.parse_args()

    cliente = autenticar()
    planilha = cliente.open_by_key(ID_PLANILHA)
    aba_plano = planilha.worksheet(ABA_PLANO)
    aba_dados = planilha.worksheet(ABA_DADOS)
    aba_inventario = planilha.worksheet(ABA_INVENTARIO)

    valores_plano = ler_estavel(
        aba_plano,
        tentativas=int(os.environ.get("CONCILIACAO_LEITURAS", "5")),
        intervalo=float(os.environ.get("CONCILIACAO_INTERVALO", "3")),
    )
    valores_dados = aba_dados.get_all_values()
    valores_inventario = aba_inventario.get_all_values()

    inventario = carregar_inventario(valores_inventario)
    registros, aptos_bloqueados, andares_bloqueados = carregar_dados_hits(valores_dados)
    itens, linhas = carregar_plano(valores_plano, registros)
    fixas = montar_fixas(registros, itens)

    solucionador = Solucionador(
        itens=itens,
        inventario=inventario,
        fixas=fixas,
        aptos_bloqueados=aptos_bloqueados,
        andares_bloqueados=andares_bloqueados,
        limite_segundos=args.max_seconds,
    )
    permitir_overbooking = bool(
        args.permitir_overbooking or os.environ.get("CONCILIACAO_PERMITIR_OVERBOOKING") == "1"
    )
    if args.sem_overbooking:
        permitir_overbooking = False
    solucionador.resolver(permitir_overbooking=permitir_overbooking)
    atualizar_linhas(itens, linhas)
    erros = validar(itens, fixas, inventario)

    resumo: Dict[str, int] = {}
    for item in itens:
        acao = linhas[item.linha_planilha - 1][8]
        resumo[acao] = resumo.get(acao, 0) + 1
    print("Resumo da conciliacao: " + ", ".join(f"{k}={v}" for k, v in sorted(resumo.items())))

    if erros:
        print("CONCILIACAO BLOQUEADA:")
        for erro in erros:
            print(f" - {erro}")
        if not args.dry_run:
            aba_plano.update(range_name="K1:L2", values=[
                ["STATUS_CONCILIACAO", "ASSINATURA_CONCILIACAO"],
                ["BLOQUEADA", ""],
            ])
        return 2

    assinatura = assinatura_plano(linhas)
    print(f"CONCILIACAO VALIDADA. Assinatura: {assinatura}")
    if args.dry_run:
        print("Modo dry-run: nenhuma celula foi alterada.")
        return 0

    escrever_resultado(aba_plano, linhas, assinatura)
    print("VINCULACAO_HOJE atualizada e marcada como VALIDADA.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
