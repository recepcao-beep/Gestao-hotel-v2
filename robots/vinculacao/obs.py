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
from speed import configure_fast_sleep

os.environ.setdefault("ROBOT_SLEEP_FACTOR", "0.60")
os.environ.setdefault("ROBOT_SLEEP_MAX_SECONDS", "6")
configure_fast_sleep()

class RoboHITS:
    def __init__(self):
        print("🤖 Inicializando Robô HITS - Previsão de 7 Dias (Com Busca Avançada de Vouchers)...")
        chrome_options = Options()
        if os.environ.get("ROBOT_HEADLESS", "1") != "0":
            chrome_options.add_argument("--headless=new")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--disable-extensions")
        
        self.driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
        self.wait = WebDriverWait(self.driver, 30)

    def force_click(self, elemento):
        try:
            ActionChains(self.driver).move_to_element(elemento).click().perform()
        except:
            self.driver.execute_script("arguments[0].click();", elemento)

    def fechar_popup_hits(self):
        """Fecha o pop-up pós-login do HITS e remove o backdrop que bloqueia cliques."""
        self.driver.switch_to.default_content()
        def remover_comunicado_visivel():
            try:
                return bool(self.driver.execute_script("""
                    let removeu = false;
                    const termos = ['COMUNICADO', 'Olá Hoteleiros', 'Ola Hoteleiros'];
                    const contemComunicado = (el) => {
                      const texto = String(el.innerText || el.textContent || '');
                      return termos.some((termo) => texto.includes(termo));
                    };
                    const area = (el) => {
                      const r = el.getBoundingClientRect();
                      return r.width * r.height;
                    };
                    const candidatos = Array.from(document.querySelectorAll('body *'))
                      .filter((el) => {
                        if (!contemComunicado(el)) return false;
                        const r = el.getBoundingClientRect();
                        const visivel = !!(r.width || r.height || el.getClientRects().length);
                        return visivel && r.width >= 250 && r.height >= 120;
                      })
                      .sort((a, b) => area(a) - area(b));
                    candidatos.forEach((el) => {
                      let alvo = el;
                      let atual = el;
                      while (atual.parentElement && atual.parentElement !== document.body) {
                        const pai = atual.parentElement;
                        const r = pai.getBoundingClientRect();
                        if (!contemComunicado(pai)) break;
                        if (r.width >= window.innerWidth * 0.98 || r.height >= window.innerHeight * 0.98) break;
                        alvo = pai;
                        atual = pai;
                      }
                      if (alvo && alvo.parentElement && alvo.tagName !== 'BODY' && alvo.tagName !== 'HTML') {
                        alvo.remove();
                        removeu = true;
                      }
                    });
                    return removeu;
                """))
            except:
                return False

        remover_comunicado_visivel()
        def popup_bloqueando_presente():
            try:
                return bool(self.driver.execute_script("""
                    const textoPagina = String(document.body ? document.body.innerText || '' : '');
                    const temComunicado = textoPagina.includes('COMUNICADO') || textoPagina.includes('Olá Hoteleiros');
                    const temBackdrop = Array.from(document.querySelectorAll('div, [class]')).some((el) => {
                      const cls = String(el.className || '');
                      const bg = String(el.getAttribute('backgroundcolor') || '');
                      const style = String(el.getAttribute('style') || '');
                      return cls.includes('themes-preview-reflect-backdrop')
                        || cls.includes('ug-sdk__sc-1rnuyal')
                        || bg.includes('rgba(0, 0, 0')
                        || (style.includes('pointer-events: all') && style.includes('rgba(0, 0, 0'));
                    });
                    return temComunicado || temBackdrop;
                """))
            except:
                return True

        xpaths_fechar = [
            "/html/body/div/div/div/div/div/div/div[3]/div/button",
            "/html/body/div/div/div/div/div/div/div[1]//*[name()='svg']",
            "/html/body/div/div/div/div/div/div/div[1]//*[name()='svg']/*[name()='path']",
            "/html/body/div/div/div/div/div/div/div[1]//*[normalize-space(.)='×' or normalize-space(.)='x' or normalize-space(.)='X']",
            "//*[contains(normalize-space(.), 'COMUNICADO')]/ancestor::*[self::div][1]//*[normalize-space(.)='OK']",
            "//button[contains(normalize-space(.), 'Fechar')]",
            "//button[normalize-space(.)='OK' or .//*[normalize-space(.)='OK']]",
            "//*[@role='button' and (normalize-space(.)='OK' or .//*[normalize-space(.)='OK'])]",
            "//button[contains(normalize-space(.), 'Entendi')]",
        ]
        for _ in range(6):
            if remover_comunicado_visivel():
                time.sleep(0.5)
            if not popup_bloqueando_presente():
                break
            fechou = False
            for xpath in xpaths_fechar:
                try:
                    botoes = self.driver.find_elements(By.XPATH, xpath)
                    for botao in botoes:
                        if botao.is_displayed() or "svg" in xpath:
                            self.driver.execute_script("""
                                const el = arguments[0];
                                const disparar = (alvo) => {
                                  if (!alvo) return;
                                  ['mouseover', 'mousedown', 'mouseup', 'click'].forEach((nome) => {
                                    try { alvo.dispatchEvent(new MouseEvent(nome, { bubbles: true, cancelable: true, view: window })); } catch (e) {}
                                  });
                                  try { alvo.click(); } catch (e) {}
                                };
                                disparar(el);
                                disparar(el.closest && (el.closest('button') || el.closest('[role="button"]') || el.closest('svg')));
                                let pai = el.parentElement;
                                for (let i = 0; pai && i < 6; i += 1, pai = pai.parentElement) disparar(pai);
                            """, botao)
                            time.sleep(0.8)
                            fechou = True
                            break
                    if fechou:
                        break
                except:
                    continue
            if not fechou:
                try:
                    ActionChains(self.driver).send_keys(Keys.ESCAPE).perform()
                    time.sleep(0.3)
                except:
                    pass
            try:
                fechou_js = self.driver.execute_script("""
                    let clicou = false;
                    const disparar = (alvo) => {
                      if (!alvo) return;
                      ['mouseover', 'mousedown', 'mouseup', 'click'].forEach((nome) => {
                        try { alvo.dispatchEvent(new MouseEvent(nome, { bubbles: true, cancelable: true, view: window })); } catch (e) {}
                      });
                      try { alvo.click(); clicou = true; } catch (e) {}
                    };
                    const fecharPath = document.evaluate(
                      "/html/body/div/div/div/div/div/div/div[1]//*[name()='svg']/*[name()='path']",
                      document,
                      null,
                      XPathResult.FIRST_ORDERED_NODE_TYPE,
                      null
                    ).singleNodeValue;
                    const fecharSvg = document.evaluate(
                      "/html/body/div/div/div/div/div/div/div[1]//*[name()='svg']",
                      document,
                      null,
                      XPathResult.FIRST_ORDERED_NODE_TYPE,
                      null
                    ).singleNodeValue;
                    disparar(fecharPath);
                    disparar(fecharSvg);
                    let paiFechar = (fecharPath || fecharSvg || {}).parentElement;
                    for (let i = 0; paiFechar && i < 8; i += 1, paiFechar = paiFechar.parentElement) disparar(paiFechar);
                    Array.from(document.querySelectorAll('button, [role="button"], a, div, span')).forEach((el) => {
                      const texto = String(el.innerText || el.textContent || '').trim();
                      const visivel = !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
                      if (visivel && (texto === 'OK' || texto === 'Fechar' || texto === 'Entendi')) {
                        try { el.click(); clicou = true; } catch (e) {}
                      }
                    });
                    const comunicados = Array.from(document.querySelectorAll('body *'))
                      .filter((el) => {
                        const texto = String(el.innerText || '');
                        if (!texto.includes('COMUNICADO') && !texto.includes('Olá Hoteleiros')) return false;
                        const rect = el.getBoundingClientRect();
                        return rect.width >= 250 && rect.height >= 120 && rect.width < window.innerWidth * 0.95 && rect.height < window.innerHeight * 0.98;
                      })
                      .sort((a, b) => (b.getBoundingClientRect().width * b.getBoundingClientRect().height) - (a.getBoundingClientRect().width * a.getBoundingClientRect().height));
                    if (comunicados.length) {
                      const alvo = comunicados[0];
                      if (alvo && alvo.tagName !== 'BODY' && alvo.tagName !== 'HTML') {
                        alvo.remove();
                        clicou = true;
                      }
                    }
                    Array.from(document.querySelectorAll('div, [class]')).forEach((el) => {
                      const cls = String(el.className || '');
                      const bg = String(el.getAttribute('backgroundcolor') || '');
                      const style = String(el.getAttribute('style') || '');
                      const bloqueiaTela = cls.includes('themes-preview-reflect-backdrop')
                        || cls.includes('ug-sdk__sc-1rnuyal')
                        || bg.includes('rgba(0, 0, 0')
                        || (style.includes('pointer-events: all') && style.includes('rgba(0, 0, 0'));
                      if (bloqueiaTela) { el.remove(); clicou = true; }
                    });
                    return clicou;
                """)
                fechou = fechou or bool(fechou_js)
            except:
                pass
            if not fechou:
                break
        self.driver.switch_to.default_content()

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
            time.sleep(1) # Aguarda 1 segundo antes de tentar procurar de novo
        return False

    def clicar_com_espera(self, xpath, timeout=15):
        """Espera o elemento renderizar no iframe correto e tenta clicar."""
        self.fechar_popup_hits()
        if self.aguardar_e_focar(xpath, timeout):
            try:
                self.force_click(self.driver.find_element(By.XPATH, xpath))
                return True
            except Exception as e:
                print(f"⚠️ Achou o quadro, mas falhou ao clicar: {e}")
                return False
        return False

    def clicar_primeiro_disponivel(self, descricao, xpaths, timeout=20):
        for xpath in xpaths:
            if self.clicar_com_espera(xpath, timeout):
                return xpath
        raise RuntimeError(f"{descricao} não encontrado.")

    def realizar_login(self):
        url_hits = "https://susceptor.apphotel.one/account/login?returnUrl=%2Fconnect%2Fauthorize%2Flogin%3F" \
                   "response_type%3Did_token%2520token%26client_id%3DB37748FC-ED13-4858-AE26-28AB3512A171%26" \
                   "redirect_uri%3Dhttps%253A%252F%252Fnacionalinn.hitspms.net%252FCallback%26scope%3Dopenid%2520profile" \
                   "%2520webapi%26nonce%3DN0.28324722615515141770822279499%26state%3D17708222794990.2983837305966167"
        try:
            print("🌐 Acessando HITS...")
            if not os.environ.get("HITS_EMAIL") or not os.environ.get("HITS_PASSWORD"):
                raise RuntimeError("HITS_EMAIL/HITS_PASSWORD não configurados no ambiente.")
            self.driver.get(url_hits)
            self.wait.until(EC.presence_of_element_located((By.ID, "Email"))).send_keys(os.environ["HITS_EMAIL"])
            self.driver.find_element(By.ID, "Password").send_keys(os.environ["HITS_PASSWORD"])
            self.driver.find_element(By.XPATH, "//button[@type='submit']").click()
            print("⏳ Login enviado. Aguardando 15 segundos para carregar painel...")
            time.sleep(15) 
            self.fechar_popup_hits()
            if not self.aguardar_e_focar("//*[@id='menuPrimary']/a", 30):
                raise RuntimeError("Login enviado, mas o menu principal do HITS não carregou.")
            print("✅ Login confirmado no HITS.")
            return True
        except Exception as e:
            print(f"❌ Erro no Login: {e}")
            raise

    def navegar_ate_relatorio(self):
        try:
            self.clicar_primeiro_disponivel("Menu principal", ["//*[@id='menuPrimary']/a"], 30)
            time.sleep(3)

            self.clicar_primeiro_disponivel(
                "Menu Recepção",
                [
                    "//*[@id='menufrontdesk']",
                    "/html/body/div[3]/div/header/nav[6]/div/ul/li[1]/a",
                ],
                20,
            )
            time.sleep(3)

            self.clicar_primeiro_disponivel(
                "Mapa de reservas",
                [
                    "//*[@id='menunewChart']/a",
                    "//span[contains(text(), 'Mapa de reserva')]",
                    "//a[contains(., 'Mapa de reserva')]",
                    "/html/body/div[3]/div/header/nav[6]/div/ul/li[1]/ul/li[1]/a",
                ],
                20,
            )
            print("⏳ Carregando o mapa de reservas...")
            time.sleep(10)

            self.clicar_primeiro_disponivel(
                "Botão de relatório do mapa",
                ["//button[contains(@ng-click, 'moreOptionsShowReport')]"],
                30,
            )
            time.sleep(3)

            self.clicar_primeiro_disponivel(
                "Opção do relatório de observações",
                ["//*[@id='one2']/div/div[2]/button[2]"],
                20,
            )
            print("✅ Relatório acessado.")
            time.sleep(5)

            if not self.aguardar_e_focar("//*[@id='one-search-filters-container']", 30):
                raise RuntimeError("Relatório abriu, mas os filtros não carregaram.")
            return True
        except Exception as e:
            print(f"❌ Erro na Navegação: {e}")
            raise

    def aplicar_filtros_e_obs(self):
        try:
            print("🔍 Aplicando filtros inteligentes...")
            filtros_ok = 0
            
            # --- PRIMEIRO FILTRO ---
            xpath_btn1 = "//*[@id='one-search-filters-container']/div[2]/span[8]/one-translate"
            xpath_opt1 = "//*[@id='one-search-modal-content']/div/div/div[1]"
            xpath_ok = "/html/body/div[1]/div/div/div[4]/button"

            if self.clicar_com_espera(xpath_btn1):
                time.sleep(1)
                if self.clicar_com_espera(xpath_opt1):
                    time.sleep(1)
                    self.clicar_com_espera(xpath_ok)
                    filtros_ok += 1
                    time.sleep(3)
                else:
                    print("⚠️ Modal do 1º filtro não carregou a tempo.")
            else:
                print("⚠️ Botão do 1º filtro não encontrado.")

            # --- SEGUNDO FILTRO ---
            xpath_btn2 = "//*[@id='one-search-filters-container']/div[2]/span[10]"
            xpath_btn2_expand = "//*[@id='one-search-filters-container']/div[2]/span[10]/one-translate"
            # CORREÇÃO AQUI: Alterado para button[17]
            xpath_opt2 = "//*[@id='one-search-modal-content']/div/div[1]/button[17]"

            if self.clicar_com_espera(xpath_btn2):
                time.sleep(1)
                if self.clicar_com_espera(xpath_btn2_expand):
                    time.sleep(1)
                    if self.clicar_com_espera(xpath_opt2):
                        time.sleep(1)
                        # Clica no botão de confirmar após selecionar o button[17]
                        self.clicar_com_espera(xpath_ok)
                        print("🎯 Filtros OK. Iniciando extração...")
                        filtros_ok += 1
                        time.sleep(6)
                    else:
                        print("⚠️ Opção dentro do 2º filtro não carregou.")
                else:
                    print("⚠️ Menu do 2º filtro não expandiu.")
            else:
                print("⚠️ Botão principal do 2º filtro não encontrado.")

            if filtros_ok == 0:
                raise RuntimeError("Nenhum filtro foi aplicado. Provavelmente o relatório correto não carregou.")
            return True

        except Exception as e:
            print(f"❌ Erro crítico nos Filtros: {e}")
            raise

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
                time.sleep(1) 
                self.fechar_popup_hits()
                
                campos = []
                for seletor in [
                    (By.CSS_SELECTOR, "input.form-control.report-range-picker"),
                    (By.XPATH, "//*[@id='one-search-modal-content']//input"),
                    (By.XPATH, "//input[@date-range-picker]"),
                    (By.XPATH, "//input[contains(@ng-model, 'datePicker.date')]"),
                    (By.XPATH, "//input[contains(@class, 'form-control')]"),
                ]:
                    try:
                        campos.extend(self.driver.find_elements(*seletor))
                    except:
                        pass
                campo_data = next((campo for campo in campos if campo.is_displayed()), campos[0] if campos else None)
                if not campo_data:
                    raise RuntimeError("Campo de data nao encontrado.")

                try:
                    self.driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", campo_data)
                    campo_data.click()
                    time.sleep(0.5) 
                    campo_data.send_keys(Keys.CONTROL + "a")
                    time.sleep(0.2) 
                    campo_data.send_keys(Keys.BACKSPACE)
                    time.sleep(0.2) 
                    campo_data.send_keys(texto_data)
                    time.sleep(0.5) 
                    campo_data.send_keys(Keys.ENTER)
                except:
                    self.driver.execute_script("""
                        const el = arguments[0];
                        const valor = arguments[1];
                        el.removeAttribute('readonly');
                        el.disabled = false;
                        el.value = valor;
                        ['input', 'change', 'keyup', 'blur'].forEach((nome) => {
                          el.dispatchEvent(new Event(nome, { bubbles: true }));
                        });
                    """, campo_data, texto_data)
                time.sleep(1) 
                
                botao_confirmar = self.driver.find_element(By.XPATH, "/html/body/div[1]/div/div/div[4]/button")
                self.force_click(botao_confirmar)
                
                print("⏳ Recarregando tabela (10s)...")
                time.sleep(10) 
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
            "STANDARD", "SEM SACADA", "COM SACADA", "VALOR", "PAGAMENTO", "PIX", 
            "EMAIL", "TARIFARIO", "TARIFÁRIO", "MOTOR DE RESERVA", "MOTOR DE RESERVAS", 
            "COMENTÁRIOS DA RESERVA", "COMENTARIOS DA RESERVA", "RESP:", "RESPONSAVEL:", 
            "BEE2PAY", "INTEGRAÇÃO", "CRIADOR:", "DUPLO", "CATEGORIA", "ALL INCLUSIVE", 
            "NOME ", "CONTATO", "TOTAL R$", "AGDO PAGTO", "OP R$", "CANAL", "LOCALIZADOR", "TARIFA"
        ]
        
        linhas_limpas = []
        for linha in partes:
            linha_limpa = linha.strip()
            if len(linha_limpa) < 4: continue
            
            linha_upper = linha_limpa.upper().replace("STANDARD", "STD")
            
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
                    apto_categoria_raw = corpo.find_element(By.XPATH, "./tr[1]/td[6]").text.strip().upper()
                    match_categoria = re.search(r'\b(1CC|1CSS|2CC|2CSS)\b', apto_categoria_raw)
                    cat_sistema = match_categoria.group(1) if match_categoria else apto_categoria_raw
                    
                    partes_obs = []
                    for linha_obs in corpo.find_elements(By.XPATH, "./tr[position() > 1]"):
                        texto_linha = linha_obs.text.strip()
                        if texto_linha:
                            partes_obs.append(texto_linha)
                    obs_raw = " | ".join(partes_obs)
                    
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
                time.sleep(2)
            if self.focar_quadro("//*[@id='menureservation']"):
                self.force_click(self.driver.find_element(By.XPATH, "//*[@id='menureservation']"))
                time.sleep(2)
            if self.focar_quadro("//*[@id='menureservations']/a"):
                self.force_click(self.driver.find_element(By.XPATH, "//*[@id='menureservations']/a"))
                print("⏳ Carregando tela principal de Reservas (12s)...")
                time.sleep(12)

            try:
                xpath_btn_limpar_data = "//*[@id='one-search-filters-container']/div[1]/button[3]/em"
                if self.focar_quadro(xpath_btn_limpar_data):
                    print("🧹 Limpando filtro de data padrão...")
                    self.force_click(self.driver.find_element(By.XPATH, xpath_btn_limpar_data))
                    time.sleep(3)
            except:
                print("⚠️ Botão 'X' da data não encontrado ou já limpo.")

            try:
                print("🔍 Procurando botão 'Mais' para expandir filtros...")
                xpath_btn_mais = "//span[contains(@class, 'options-filter') and contains(@ng-click, 'showMoreOpt')]"
                if self.focar_quadro(xpath_btn_mais):
                    btn_mais = self.driver.find_element(By.XPATH, xpath_btn_mais)
                    self.force_click(btn_mais)
                    print("🖱️ Clicou em 'Mais' com sucesso!")
                    time.sleep(2)
                else:
                    xpath_btn_mais_alt = "//one-translate[@resource='lblMore']"
                    if self.focar_quadro(xpath_btn_mais_alt):
                        btn_mais = self.driver.find_element(By.XPATH, xpath_btn_mais_alt)
                        self.force_click(btn_mais)
                        print("🖱️ Clicou em 'Mais' (método secundário) com sucesso!")
                        time.sleep(2)
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
                            time.sleep(2)
                        else:
                            print("⚠️ Botão de localizador não achado pelo texto. Tentando o fallback...")
                            self.force_click(self.driver.find_element(By.XPATH, "//*[@id='one-search-filters-container']/div[2]/span[14]"))
                            time.sleep(2)
                        
                        campo_busca = self.driver.find_element(By.XPATH, "//*[@id='one-search-modal-content']/div/input")
                        campo_busca.click()
                        time.sleep(0.5)
                        campo_busca.send_keys(Keys.CONTROL + "a")
                        time.sleep(0.5)
                        campo_busca.send_keys(Keys.BACKSPACE)
                        time.sleep(0.5)
                        campo_busca.send_keys(res)
                        time.sleep(1)
                        
                        btn_confirma = self.driver.find_element(By.XPATH, "/html/body/div[1]/div/div/div[4]/button")
                        self.force_click(btn_confirma)
                        
                        print("⏳ Aguardando resultado da busca (6s)...")
                        time.sleep(6)
                        
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
                            time.sleep(2)
                        except: pass
                            
                except Exception as ex_res:
                    print(f"❌ Erro ao buscar o código {res}: {ex_res}")
                    self.driver.refresh()
                    time.sleep(8)

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
            escopos = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
            creds = None
            
            diretorio_atual = os.path.dirname(os.path.abspath(__file__))
            caminho_token = os.path.join(diretorio_atual, 'token.json')
            caminho_secret = os.path.join(diretorio_atual, 'client_secret.json')
            
            if os.path.exists(caminho_token):
                creds = Credentials.from_authorized_user_file(caminho_token, escopos)
                
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                else:
                    flow = InstalledAppFlow.from_client_secrets_file(caminho_secret, escopos)
                    creds = flow.run_local_server(port=0)
                    
                with open(caminho_token, 'w') as token:
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
            try:
                url_webhook = "https://script.google.com/macros/s/AKfycbwcfhQySj2OoJVSzaWnjMCHZzfHPCQHc5fZHKt5sLmhJ7wTtD24SvR-kk-at7lFo_31EA/exec"
                resposta = requests.get(url_webhook)
                print(f"🤖 Resposta do Google Sheets: {resposta.text}")
            except Exception as e_web:
                print(f"⚠️ Erro ao acionar o Webhook: {e_web}")

        except Exception as e:
            print(f"❌ Erro na etapa do Google Sheets: {e}")

if __name__ == "__main__":
    robo = RoboHITS()
    try:
        robo.realizar_login()
        robo.navegar_ate_relatorio()
        robo.aplicar_filtros_e_obs()
        robo.processar_semana_e_salvar()
    except Exception as e:
        print(f"❌ Execução interrompida: {e}")
        raise
    finally:
        print("🏁 Encerrando e fechando o navegador...")
        robo.driver.quit()
