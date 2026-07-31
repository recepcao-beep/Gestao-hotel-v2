import argparse
import json
import getpass
import time
import re
import os
import random
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
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys


URL_WEBHOOK_OBS = (
    "https://script.google.com/macros/s/"
    "AKfycbwcfhQySj2OoJVSzaWnjMCHZzfHPCQHc5fZHKt5sLmhJ7wTtD24SvR-kk-at7lFo_31EA/exec"
)
MENSAGEM_SUCESSO_WEBHOOK_OBS = "script executado com sucesso"


def resumir_erro_webhook_obs(erro):
    if isinstance(erro, requests.HTTPError) and erro.response is not None:
        return f"HTTP {erro.response.status_code}"
    if isinstance(erro, requests.RequestException):
        return erro.__class__.__name__
    return str(erro)


def acionar_webhook_obs(
    url=URL_WEBHOOK_OBS,
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

            if MENSAGEM_SUCESSO_WEBHOOK_OBS not in corpo.casefold():
                resumo = " ".join(corpo.split())[:200] or "resposta vazia"
                raise RuntimeError(f"Resposta inesperada do Google no OBS: {resumo}")

            return corpo
        except (requests.RequestException, RuntimeError) as erro:
            ultimo_erro = erro
            print(
                f"Webhook do OBS falhou na tentativa {tentativa}/{tentativas}: "
                f"{resumir_erro_webhook_obs(erro)}",
                flush=True,
            )
            if tentativa < tentativas:
                time.sleep(pausa_entre_tentativas)

    raise RuntimeError(
        f"Webhook do OBS falhou apos {tentativas} tentativas: "
        f"{resumir_erro_webhook_obs(ultimo_erro)}"
    ) from ultimo_erro


class RoboHITS:
    def __init__(self, headless=None, fator_pausa=0.7):
        print("🤖 Inicializando Robô HITS - Previsão de 7 Dias (Com Busca Avançada de Vouchers)...")

        if headless is None:
            headless = (
                os.getenv("GITHUB_ACTIONS", "").lower() == "true"
                or os.getenv("ROBOT_HEADLESS", "").lower() in {"1", "true", "yes", "sim"}
            )

        self.fator_pausa = max(0.5, float(fator_pausa))

        chrome_options = Options()
        chrome_options.add_argument("--start-maximized")

        if headless:
            chrome_options.add_argument("--headless=new")
            chrome_options.add_argument("--window-size=1920,1080")
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-gpu")

        self.driver = webdriver.Chrome(
            service=Service(ChromeDriverManager().install()),
            options=chrome_options,
        )
        self.wait = WebDriverWait(self.driver, 30)

        print(
            f"🖥️ Modo: {'HEADLESS/GITHUB ACTIONS' if headless else 'VISUAL'} | "
            f"Fator de pausa: {self.fator_pausa}"
        )

    def pausar(self, segundos):
        """Aplica um fator seguro às pausas originais."""
        time.sleep(max(0.15, float(segundos) * self.fator_pausa))

    def force_click(self, elemento):
        try:
            ActionChains(self.driver).move_to_element(elemento).click().perform()
        except:
            self.driver.execute_script("arguments[0].click();", elemento)

    def focar_quadro(self, xpath_alvo, max_depth=3):
        self.driver.switch_to.default_content()
        def procurar(profundidade):
            if profundidade > max_depth: return False
            if len(self.driver.find_elements(By.XPATH, xpath_alvo)) > 0: return True
            iframes = self.driver.find_elements(By.TAG_NAME, "iframe")
            for i in range(len(iframes)):
                try:
                    self.driver.switch_to.frame(i)
                    if procurar(profundidade + 1): return True
                    self.driver.switch_to.parent_frame()
                except: continue
            return False
        return procurar(0)

    def aguardar_e_focar(self, xpath_alvo, timeout=15):
        """Tenta focar no quadro repetidamente até o timeout estourar."""
        tempo_inicial = time.time()
        while time.time() - tempo_inicial < timeout:
            if self.focar_quadro(xpath_alvo):
                return True
            self.pausar(1) # Aguarda 1 segundo antes de tentar procurar de novo
        return False

    def clicar_com_espera(self, xpath, timeout=15):
        """Espera o elemento renderizar no iframe correto e tenta clicar."""
        if self.aguardar_e_focar(xpath, timeout):
            try:
                self.force_click(self.driver.find_element(By.XPATH, xpath))
                return True
            except Exception as e:
                print(f"⚠️ Achou o quadro, mas falhou ao clicar: {e}")
                return False
        return False

    def realizar_login(self):
        url_hits = "https://susceptor.apphotel.one/account/login?returnUrl=%2Fconnect%2Fauthorize%2Flogin%3F" \
                   "response_type%3Did_token%2520token%26client_id%3DB37748FC-ED13-4858-AE26-28AB3512A171%26" \
                   "redirect_uri%3Dhttps%253A%252F%252Fnacionalinn.hitspms.net%252FCallback%26scope%3Dopenid%2520profile" \
                   "%2520webapi%26nonce%3DN0.28324722615515141770822279499%26state%3D17708222794990.2983837305966167"
        try:
            print("🌐 Acessando HITS...")
            self.driver.get(url_hits)
            hits_email = os.getenv("HITS_EMAIL") or input("Digite o HITS_EMAIL: ").strip()
            hits_password = os.getenv("HITS_PASSWORD") or getpass.getpass("Digite o HITS_PASSWORD: ")
            if not hits_email or not hits_password:
                raise RuntimeError("HITS_EMAIL/HITS_PASSWORD não configurados.")
            self.wait.until(EC.presence_of_element_located((By.ID, "Email"))).send_keys(hits_email)
            self.driver.find_element(By.ID, "Password").send_keys(hits_password)
            self.driver.find_element(By.XPATH, "//button[@type='submit']").click()
            print("⏳ Login enviado. Aguardando 15 segundos para carregar painel...")
            self.pausar(15)
        except Exception as e:
            print(f"❌ Erro no Login: {e}")

    def navegar_ate_relatorio(self):
        try:
            if self.focar_quadro("//*[@id='menuPrimary']/a"):
                self.force_click(self.driver.find_element(By.XPATH, "//*[@id='menuPrimary']/a"))
                self.pausar(4)
            if self.focar_quadro("//*[@id='menufrontdesk']"):
                self.force_click(self.driver.find_element(By.XPATH, "//*[@id='menufrontdesk']"))
                self.pausar(4)
            if self.focar_quadro("//span[contains(text(), 'Mapa de reserva')]"):
                self.force_click(self.driver.find_element(By.XPATH, "//span[contains(text(), 'Mapa de reserva')]"))
                print("⏳ Carregando o mapa de reservas (12s)...")
                self.pausar(12)
            if self.focar_quadro("//button[contains(@ng-click, 'moreOptionsShowReport')]"):
                self.force_click(self.driver.find_element(By.XPATH, "//button[contains(@ng-click, 'moreOptionsShowReport')]"))
                self.pausar(4)
            if self.focar_quadro("//*[@id='one2']/div/div[2]/button[2]"):
                self.force_click(self.driver.find_element(By.XPATH, "//*[@id='one2']/div/div[2]/button[2]"))
                print("✅ Relatório acessado.")
                self.pausar(6)
        except Exception as e:
            print(f"❌ Erro na Navegação: {e}")

    def aplicar_filtros_e_obs(self):
        try:
            print("🔍 Aplicando filtros inteligentes...")

            # --- PRIMEIRO FILTRO ---
            xpath_btn1 = "//*[@id='one-search-filters-container']/div[2]/span[8]/one-translate"
            xpath_opt1 = "//*[@id='one-search-modal-content']/div/div/div[1]"
            xpath_ok = "/html/body/div[1]/div/div/div[4]/button"

            if self.clicar_com_espera(xpath_btn1):
                self.pausar(1)
                if self.clicar_com_espera(xpath_opt1):
                    self.pausar(1)
                    self.clicar_com_espera(xpath_ok)
                    self.pausar(3)
                else:
                    print("⚠️ Modal do 1º filtro não carregou a tempo.")
            else:
                print("⚠️ Botão do 1º filtro não encontrado.")

            # --- SEGUNDO FILTRO ---
            xpath_btn2 = "//*[@id='one-search-filters-container']/div[2]/span[10]"
            xpath_btn2_expand = "//*[@id='one-search-filters-container']/div[2]/span[10]/one-translate"
            xpath_opt2 = "//*[@id='one-search-modal-content']/div/div[1]/button[17]"

            if self.clicar_com_espera(xpath_btn2):
                self.pausar(1)
                if self.clicar_com_espera(xpath_btn2_expand):
                    self.pausar(1)
                    if self.clicar_com_espera(xpath_opt2):
                        self.pausar(1)
                        self.clicar_com_espera(xpath_ok)
                        print("🎯 Filtros OK. Iniciando extração...")
                        self.pausar(6)
                    else:
                        print("⚠️ Opção dentro do 2º filtro não carregou.")
                else:
                    print("⚠️ Menu do 2º filtro não expandiu.")
            else:
                print("⚠️ Botão principal do 2º filtro não encontrado.")

        except Exception as e:
            print(f"❌ Erro crítico nos Filtros: {e}")

    def mudar_data_para(self, dias_para_frente):
        data_alvo = datetime.datetime.now() + datetime.timedelta(days=dias_para_frente)
        data_f = data_alvo.strftime("%d/%m/%y")
        texto_data = f"{data_f} - {data_f}"

        print(f"➡️ Alterando data para: {texto_data}")
        xpath_botao_periodo = '//*[@id="one-search-filters-container"]/div[1]/button[1]'

        try:
            if self.focar_quadro(xpath_botao_periodo):
                botao = self.driver.find_element(By.XPATH, xpath_botao_periodo)
                self.force_click(botao)
                self.pausar(1)

                try:
                    campo_data = self.driver.find_element(By.CSS_SELECTOR, "input.form-control.report-range-picker")
                except:
                    campo_data = self.driver.find_element(By.XPATH, "//input[contains(@class, 'form-control')]")

                campo_data.click()
                self.pausar(0.5)
                campo_data.send_keys(Keys.CONTROL + "a")
                self.pausar(0.2)
                campo_data.send_keys(Keys.BACKSPACE)
                self.pausar(0.2)
                campo_data.send_keys(texto_data)
                self.pausar(0.5)

                campo_data.send_keys(Keys.ENTER)
                self.pausar(1)

                botao_confirmar = self.driver.find_element(By.XPATH, "/html/body/div[1]/div/div/div[4]/button")
                self.force_click(botao_confirmar)

                print("⏳ Recarregando tabela (10s)...")
                self.pausar(10)
                return True
            else:
                return False
        except Exception as e:
            print(f"❌ Falha ao interagir com campo de data: {e}")
            return False

    def analisar_texto_e_extrair(self, obs_raw):
        partes = re.split(r'[\n;\|]|\s{4,}', obs_raw)

        relevantes = [
            "MIMO", "ANIVERSARIO", "ANIVERSÁRIO", "LEMBRANCA", "LEMBRANÇA", "VIP",
            "BERCO", "BERÇO", "BANHEIRA", "PROXIMO", "PRÓXIMO", "PERTO", "VIZINHO",
            "ANDAR", "ALA", "TÉRREO", "TERREO", "ELEVADOR", "LADO A LADO", "JUNTOS",
            "COLADO", "RECEPÇÃO", "RECEPCAO", "CAMA", "RESTAURANTE", "AREJADO",
            "AMPLO", "ACIMA", "ALTO", "ALOCAR", "PRIMEIRO", "SEGUNDO", "TERCEIRO",
            "1º", "2º", "3º", "1O", "2O", "3O",
            "COPINHA", "BABY", "MAMÃE", "MAMAE"
        ]

        lixos = [
            "STANDARD", "STANDART", "SEM SACADA", "COM SACADA", "VALOR", "PAGAMENTO", "PIX",
            "EMAIL", "TARIFARIO", "TARIFÁRIO", "MOTOR DE RESERVA", "MOTOR DE RESERVAS",
            "COMENTÁRIOS DA RESERVA", "COMENTARIOS DA RESERVA", "RESP:", "RESPONSAVEL:",
            "BEE2PAY", "INTEGRAÇÃO", "CRIADOR:", "DUPLO", "CATEGORIA", "ALL INCLUSIVE",
            "NOME ", "CONTATO", "TOTAL R$", "AGDO PAGTO", "OP R$", "CANAL", "LOCALIZADOR", "TARIFA"
        ]

        linhas_limpas = []
        for linha in partes:
            linha_limpa = linha.strip()
            if len(linha_limpa) < 4: continue

            linha_upper = linha_limpa.upper()

            if not any(r in linha_upper for r in relevantes):
                continue

            for lixo in lixos:
                linha_upper = linha_upper.replace(lixo, "")

            linha_final = linha_upper.strip(" :|-")
            if len(linha_final) > 3:
                linhas_limpas.append(linha_final)

        texto_final_limpo = " | ".join(linhas_limpas)

        if not texto_final_limpo:
            return "", "", ""

        andar = ""
        andares_num = re.findall(r'\b(200|300|400|500|600|700)\b', texto_final_limpo)

        if andares_num:
            andar = andares_num[0]
        elif "COPINHA BABY" in texto_final_limpo or "COPINHA DA MAMÃE" in texto_final_limpo or "COPINHA DA MAMAE" in texto_final_limpo or "COPA" in texto_final_limpo:
            andar = random.choice(["400", "700"])
        elif "PRIMEIRO" in texto_final_limpo or "1º" in texto_final_limpo or "1O " in texto_final_limpo:
            andar = random.choice(["400", "700"])
        elif "SEGUNDO" in texto_final_limpo or "2º" in texto_final_limpo or "2O " in texto_final_limpo:
            andar = random.choice(["300", "600"])
        elif "TERCEIRO" in texto_final_limpo or "3º" in texto_final_limpo or "3O " in texto_final_limpo:
            andar = random.choice(["200", "500"])
        elif "TERREO" in texto_final_limpo or "TÉRREO" in texto_final_limpo:
            andar = random.choice(["200", "500"])
        elif "RESTAURANTE" in texto_final_limpo:
            andar = random.choice(["400", "700"])
        elif "RECEPÇÃO" in texto_final_limpo or "RECEPCAO" in texto_final_limpo:
            andar = random.choice(["300", "600"])
        elif "ACIMA" in texto_final_limpo or "ALTO" in texto_final_limpo:
            andar = random.choice(["600", "700"])
        elif "AREJADO" in texto_final_limpo or "AMPLO" in texto_final_limpo:
            andar = random.choice(["300", "400", "600", "700"])

        vinculo = ""
        padrao_vinculo = r'(?:PRÓXIM[OA]|PROXIM[OA]|VINCULAD[OA]|JUNTO|PERTO|LADO|MESMO|COM).*?(RES[- ]?\d+[-0-9]*|\b\d{5,10}\b)'
        vinculo_matches = re.findall(padrao_vinculo, texto_final_limpo)

        if vinculo_matches:
            vinculo = vinculo_matches[0].strip()

        return andar, vinculo, texto_final_limpo

    def calcular_categoria_verificada(self, obs_raw, pax_raw, categoria_sistema):
        try:
            partes_pax = pax_raw.split('/')
            total_pax = int(partes_pax[0]) + int(partes_pax[1])
        except:
            total_pax = 1

        obs_upper = obs_raw.upper()
        tem_sacada = None

        if any(x in obs_upper for x in ["COM SACADA", "C/ SACADA", "VARANDA", "C/ VARANDA", "SUPERIOR"]):
            tem_sacada = True
        elif any(x in obs_upper for x in ["SEM SACADA", "S/ SACADA", "SEM VARANDA", "S/ VARANDA"]):
            tem_sacada = False

        if tem_sacada is None:
            prefixo = "2" if str(categoria_sistema).startswith("2") else "1"
            tem_sacada = (prefixo == "1")

        if tem_sacada:
            return "1CC" if total_pax <= 3 else "1CSS"
        else:
            return "2CC" if total_pax <= 3 else "2CSS"

    def extrair_dados_pagina_atual(self, data_atual_loop):
        xpath_tbodies = "//*[@id='arrivalsDeparturesReport']//table[1]/tbody"
        pedidos_do_dia = []
        vouchers_processados = set()

        if self.focar_quadro(xpath_tbodies):
            tbodies = self.driver.find_elements(By.XPATH, xpath_tbodies)
            for corpo in tbodies:
                try:
                    voucher = corpo.find_element(By.XPATH, "./tr[1]/td[7]").text.strip()

                    pax_raw = corpo.find_element(By.XPATH, "./tr[1]/td[4]").text.strip()
                    cat_sistema = corpo.find_element(By.XPATH, "./tr[1]/td[8]").text.strip().upper()

                    obs_raw = corpo.find_element(By.XPATH, "./tr[3]/td").text.strip()

                    if not obs_raw or len(obs_raw) < 5: continue

                    andar, vinculo, texto_limpo = self.analisar_texto_e_extrair(obs_raw)

                    cat_verificada = self.calcular_categoria_verificada(obs_raw, pax_raw, cat_sistema)

                    if not texto_limpo and not cat_verificada: continue

                    if voucher not in vouchers_processados:
                        pedidos_do_dia.append([data_atual_loop, voucher, andar, vinculo, cat_verificada, texto_limpo])
                        vouchers_processados.add(voucher)
                except: continue
        return pedidos_do_dia

    def buscar_vouchers_de_res(self, res_codes):
        if not res_codes:
            return {}

        print(f"🔍 Traduzindo {len(res_codes)} códigos 'RES' para Vouchers reais...")
        mapa_res = {}

        try:
            if self.focar_quadro("//*[@id='menuPrimary']/a"):
                self.force_click(self.driver.find_element(By.XPATH, "//*[@id='menuPrimary']/a"))
                self.pausar(2)
            if self.focar_quadro("//*[@id='menureservation']"):
                self.force_click(self.driver.find_element(By.XPATH, "//*[@id='menureservation']"))
                self.pausar(2)
            if self.focar_quadro("//*[@id='menureservations']/a"):
                self.force_click(self.driver.find_element(By.XPATH, "//*[@id='menureservations']/a"))
                print("⏳ Carregando tela principal de Reservas (12s)...")
                self.pausar(12)

            try:
                xpath_btn_limpar_data = "//*[@id='one-search-filters-container']/div[1]/button[3]/em"
                if self.focar_quadro(xpath_btn_limpar_data):
                    print("🧹 Limpando filtro de data padrão...")
                    self.force_click(self.driver.find_element(By.XPATH, xpath_btn_limpar_data))
                    self.pausar(3)
            except:
                print("⚠️ Botão 'X' da data não encontrado ou já limpo.")

            try:
                print("🔍 Procurando botão 'Mais' para expandir filtros...")
                xpath_btn_mais = "//span[contains(@class, 'options-filter') and contains(@ng-click, 'showMoreOpt')]"
                if self.focar_quadro(xpath_btn_mais):
                    btn_mais = self.driver.find_element(By.XPATH, xpath_btn_mais)
                    self.force_click(btn_mais)
                    print("🖱️ Clicou em 'Mais' com sucesso!")
                    self.pausar(2)
                else:
                    xpath_btn_mais_alt = "//one-translate[@resource='lblMore']"
                    if self.focar_quadro(xpath_btn_mais_alt):
                        btn_mais = self.driver.find_element(By.XPATH, xpath_btn_mais_alt)
                        self.force_click(btn_mais)
                        print("🖱️ Clicou em 'Mais' (método secundário) com sucesso!")
                        self.pausar(2)
                    else:
                        print("⚠️ O botão 'Mais' não foi achado. (Talvez o menu já esteja expandido).")
            except Exception as e:
                print(f"⚠️ Erro ao tentar expandir botão 'Mais': {e}")

            for res in res_codes:
                try:
                    print(f"➡️ Pesquisando localizador: {res}")

                    xpath_container_filtros = "//*[@id='one-search-filters-container']/div[2]"

                    if self.focar_quadro(xpath_container_filtros):
                        container = self.driver.find_element(By.XPATH, xpath_container_filtros)
                        botoes = container.find_elements(By.TAG_NAME, "span")

                        botao_localizador = None
                        for btn in botoes:
                            texto_btn = btn.text.upper()
                            if "LOCALIZADOR DE CANAL" in texto_btn or "LOCALIZADOR" in texto_btn:
                                if "GESTOR" not in texto_btn:
                                    botao_localizador = btn
                                    break

                        if botao_localizador:
                            self.force_click(botao_localizador)
                            self.pausar(2)
                        else:
                            print("⚠️ Botão de localizador não achado pelo texto. Tentando o fallback...")
                            self.force_click(self.driver.find_element(By.XPATH, "//*[@id='one-search-filters-container']/div[2]/span[14]"))
                            self.pausar(2)

                        campo_busca = self.driver.find_element(By.XPATH, "//*[@id='one-search-modal-content']/div/input")
                        campo_busca.click()
                        self.pausar(0.5)
                        campo_busca.send_keys(Keys.CONTROL + "a")
                        self.pausar(0.5)
                        campo_busca.send_keys(Keys.BACKSPACE)
                        self.pausar(0.5)
                        campo_busca.send_keys(res)
                        self.pausar(1)

                        btn_confirma = self.driver.find_element(By.XPATH, "/html/body/div[1]/div/div/div[4]/button")
                        self.force_click(btn_confirma)

                        print("⏳ Aguardando resultado da busca (6s)...")
                        self.pausar(6)

                        try:
                            primeira_linha = self.driver.find_element(By.CSS_SELECTOR, ".ui-grid-row")
                            celulas = primeira_linha.find_elements(By.CSS_SELECTOR, ".ui-grid-cell-contents")

                            voucher_encontrado = None
                            for celula in celulas:
                                txt = celula.text.strip()
                                if re.fullmatch(r'\d{6,8}', txt):
                                    voucher_encontrado = txt
                                    break

                            if voucher_encontrado:
                                mapa_res[res] = voucher_encontrado
                                print(f"✔️ Traduzido: {res} = {voucher_encontrado}")
                            else:
                                print(f"⚠️ Voucher não encontrado na grid para o código {res}.")
                        except:
                            print(f"⚠️ Nenhuma reserva encontrada no HITS para o localizador {res}.")

                        try:
                            btn_limpar = self.driver.find_element(By.XPATH, "//*[@id='one-search-bar']/div[1]/button[2]")
                            self.force_click(btn_limpar)
                            self.pausar(2)
                        except: pass

                except Exception as ex_res:
                    print(f"❌ Erro ao buscar o código {res}: {ex_res}")
                    self.driver.refresh()
                    self.pausar(8)

        except Exception as e:
            print(f"❌ Erro ao navegar para a tela de reservas: {e}")

        return mapa_res

    def processar_semana_e_salvar(self):
        try:
            dados_totais_semana = []
            for dia in range(7):
                if dia > 0:
                    sucesso = self.mudar_data_para(dias_para_frente=dia)
                    if not sucesso: continue

                data_atual_loop = (datetime.datetime.now() + datetime.timedelta(days=dia)).strftime("%d/%m/%y")
                print(f"📅 Lendo dados e filtrando de: {data_atual_loop} ...")

                pedidos_hoje = self.extrair_dados_pagina_atual(data_atual_loop)

                if pedidos_hoje:
                    if dados_totais_semana:
                        dados_totais_semana.append(["", "", "", "", "", ""])

                    dados_totais_semana.extend(pedidos_hoje)
                    print(f"✔️ {len(pedidos_hoje)} observações especiais identificadas.")

            if not dados_totais_semana:
                print("⚠️ Nenhuma observação especial relevante na semana.")
                return

            codigos_res_pendentes = set()
            for linha in dados_totais_semana:
                if len(linha) > 3 and linha[3] and "RES" in str(linha[3]).upper():
                    codigos_res_pendentes.add(str(linha[3]).strip())

            if codigos_res_pendentes:
                mapa_vouchers = self.buscar_vouchers_de_res(list(codigos_res_pendentes))

                for i in range(len(dados_totais_semana)):
                    if len(dados_totais_semana[i]) > 3 and dados_totais_semana[i][3]:
                        vinculo_atual = str(dados_totais_semana[i][3]).strip()
                        if vinculo_atual in mapa_vouchers:
                            dados_totais_semana[i][3] = mapa_vouchers[vinculo_atual]

            # --- INÍCIO DA NOVA AUTENTICAÇÃO OAUTH ---
            print("☁️ Autenticando no Google Sheets via OAuth...")
            escopos = [
                "https://www.googleapis.com/auth/spreadsheets",
                "https://www.googleapis.com/auth/drive",
            ]
            creds = None

            diretorio_atual = os.path.dirname(os.path.abspath(__file__))

            caminho_token = os.getenv(
                "GOOGLE_TOKEN_PATH",
                os.path.join(diretorio_atual, "token.json"),
            )
            if not os.path.exists(caminho_token) and os.path.exists("token.json"):
                caminho_token = "token.json"

            caminho_secret = os.getenv(
                "GOOGLE_CLIENT_SECRET_PATH",
                os.path.join(diretorio_atual, "client_secret.json"),
            )
            if not os.path.exists(caminho_secret) and os.path.exists("client_secret.json"):
                caminho_secret = "client_secret.json"

            token_json_env = os.getenv("GOOGLE_TOKEN_JSON", "").strip()

            if token_json_env:
                creds = Credentials.from_authorized_user_info(
                    json.loads(token_json_env),
                    escopos,
                )
            elif os.path.exists(caminho_token):
                creds = Credentials.from_authorized_user_file(
                    caminho_token,
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
                        caminho_secret,
                        escopos,
                    )
                    creds = flow.run_local_server(port=0)

                if not token_json_env:
                    with open(caminho_token, "w", encoding="utf-8") as token:
                        token.write(creds.to_json())

            gc = gspread.authorize(creds)
            # --- FIM DA NOVA AUTENTICAÇÃO OAUTH ---

            print("🔍 Abrindo a planilha e a aba...")
            planilha = gc.open("Controle de ocupantes (mapinha)")
            aba = planilha.worksheet("SOLICITAÇÕES")

            print("🧹 Limpando os dados antigos (da linha 2 para baixo)...")
            aba.batch_clear(["A2:F2000"])

            print("📝 Escrevendo os novos dados atualizados na planilha...")
            aba.update(values=dados_totais_semana, range_name="A2", value_input_option='USER_ENTERED')
            print("✅ SUCESSO ABSOLUTO! Planilha limpa e atualizada com os novos 7 dias.")

            print("🚀 Acionando o Google Sheets para processar as solicitações especiais e atualizar o mapa...")
            resposta_webhook = acionar_webhook_obs()
            print(f"🤖 Resposta do Google Sheets: {resposta_webhook}")

        except Exception as e:
            print(f"❌ Erro na etapa do Google Sheets: {e}", flush=True)
            raise

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Robô OBS - solicitações HITS")
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
        default=float(os.getenv("OBS_FATOR_PAUSA", "0.7")),
        help="Multiplicador das pausas originais. Padrão: 0.7.",
    )
    args = parser.parse_args()

    modo_headless = None
    if args.headless:
        modo_headless = True
    elif args.visual:
        modo_headless = False

    robo = RoboHITS(
        headless=modo_headless,
        fator_pausa=args.fator_pausa,
    )

    try:
        robo.realizar_login()
        robo.navegar_ate_relatorio()
        robo.aplicar_filtros_e_obs()
        robo.processar_semana_e_salvar()
    finally:
        print("🏁 Encerrando e fechando o navegador...")
        robo.driver.quit()
