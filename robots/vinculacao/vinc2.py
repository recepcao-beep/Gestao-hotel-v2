import os
import re
import time
import hashlib
import sys
from datetime import datetime
from pathlib import Path
import gspread
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
try:
    from hits_popup_guard import fechar_popups_hits, click_hits_seguro
except Exception:
    fechar_popups_hits = None
    click_hits_seguro = None

configure_fast_sleep()

def executar_vinculacao_2_0():
    # --- CONFIGURAÇÕES ---
    ID_PLANILHA = "1oMKFu9aobTP5sBuF0jjSR4In3Z6EcWfATCe_9ijNFXA"
    NOME_ABA = "VINCULACAO_HOJE"
    DRY_RUN = (
        "--dry-run" in sys.argv[1:]
        or os.environ.get("VINC2_DRY_RUN", "0") == "1"
        or os.environ.get("VINCULACAO_DRY_RUN", "0") == "1"
    )
    MAX_OPERACOES = int(os.environ.get("VINC2_MAX_OPERACOES", "30"))
    artifacts_dir = Path(__file__).resolve().parent / "artifacts" / "conciliacao"
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    relatorio_dry_run = artifacts_dir / "relatorio_dry_run.txt"
    
    URL_HITS = "https://susceptor.apphotel.one/account/login?returnUrl=%2Fconnect%2Fauthorize%2Flogin%3F" \
               "response_type%3Did_token%2520token%26client_id%3DB37748FC-ED13-4858-AE26-28AB3512A171%26" \
               "redirect_uri%3Dhttps%253A%252F%252Fnacionalinn.hitspms.net%252FCallback%26scope%3Dopenid%2520profile" \
               "%2520webapi%26nonce%3DN0.28324722615515141770822279499%26state%3D17708222794990.2983837305966167"

    # DICIONÁRIO DE CATEGORIAS ATUALIZADO
    XPATH_CATS = {
        "3CS":  "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[1]",
        "1CSS": "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[2]",
        "1CC":  "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[3]",
        "2CSS": "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[4]",
        "2CC":  "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[5]",
        "SP":   "/html/body/div[1]/div/div/modal-update-grouped-rooms-detail/div[2]/div[1]/button[6]"
    }
    CATEGORIAS_VALIDAS = sorted(XPATH_CATS.keys(), key=len, reverse=True)

    chrome_options = Options()
    if os.environ.get("ROBOT_HEADLESS", "1") != "0":
        chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--disable-extensions")
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
    wait = WebDriverWait(driver, 15)

    def log_dry(mensagem):
        print(mensagem)
        if DRY_RUN:
            with open(relatorio_dry_run, "a", encoding="utf-8") as arquivo:
                arquivo.write(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} {mensagem}\n")

    def salvar_screenshot(nome):
        caminho = artifacts_dir / nome
        try:
            driver.save_screenshot(str(caminho))
            log_dry(f"📸 Screenshot salvo: {caminho}")
        except Exception as erro:
            log_dry(f"⚠️ Falha ao salvar screenshot {nome}: {erro}")

    def js_click(elemento):
        if fechar_popups_hits:
            fechar_popups_hits(driver)
        if click_hits_seguro:
            click_hits_seguro(driver, elemento)
        else:
            driver.execute_script("arguments[0].click();", elemento)

    def fechar_popup_hits():
        """Fecha o pop-up pós-login do HITS e remove o backdrop que bloqueia cliques."""
        if fechar_popups_hits:
            fechar_popups_hits(driver)
            return
        driver.switch_to.default_content()
        def remover_comunicado_visivel():
            try:
                return bool(driver.execute_script("""
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
                return bool(driver.execute_script("""
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
                    botoes = driver.find_elements(By.XPATH, xpath)
                    for botao in botoes:
                        if botao.is_displayed() or "svg" in xpath:
                            driver.execute_script("""
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
                    ActionChains(driver).send_keys(Keys.ESCAPE).perform()
                    time.sleep(0.3)
                except:
                    pass
            try:
                fechou_js = driver.execute_script("""
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
        driver.switch_to.default_content()

    def focar_quadro_do_elemento(xpath_alvo, tempo_maximo=15):
        tempo_inicial = time.time()
        while time.time() - tempo_inicial < tempo_maximo:
            driver.switch_to.default_content()
            if len(driver.find_elements(By.XPATH, xpath_alvo)) > 0: return True
            iframes = driver.find_elements(By.TAG_NAME, "iframe")
            for i in range(len(iframes)):
                try:
                    driver.switch_to.frame(i)
                    if len(driver.find_elements(By.XPATH, xpath_alvo)) > 0: return True
                    driver.switch_to.parent_frame()
                except: continue
            time.sleep(0.5)
        return False

    def esperar_loading_sumir():
        try:
            WebDriverWait(driver, 10).until(
                EC.invisibility_of_element_located((By.CLASS_NAME, "block-ui-overlay"))
            )
        except: pass

    def xpath_literal(texto):
        if "'" not in texto:
            return f"'{texto}'"
        if '"' not in texto:
            return f'"{texto}"'
        partes = texto.split("'")
        return "concat(" + ', "\'", '.join(f"'{parte}'" for parte in partes) + ")"

    def normalizar_categoria(texto):
        texto_upper = (texto or "").upper()
        for categoria in CATEGORIAS_VALIDAS:
            if re.search(rf"(?<![A-Z0-9]){re.escape(categoria)}(?![A-Z0-9])", texto_upper):
                return categoria
        return ""

    def obter_categoria_bloco(indice_bloco):
        candidatos_xpath = (
            "//reservation-edit//*[self::span or self::div]["
            "contains(translate(normalize-space(.), 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), '1CSS') or "
            "contains(translate(normalize-space(.), 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), '1CC') or "
            "contains(translate(normalize-space(.), 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), '2CSS') or "
            "contains(translate(normalize-space(.), 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), '2CC') or "
            "contains(translate(normalize-space(.), 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), '3CS') or "
            "contains(translate(normalize-space(.), 'abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'), 'SP')"
            "]"
        )

        categorias = []
        driver.switch_to.default_content()
        for elemento in driver.find_elements(By.XPATH, candidatos_xpath):
            try:
                if not elemento.is_displayed():
                    continue
                texto = elemento.text.strip()
                if not texto or len(texto) > 80:
                    continue
                categoria = normalizar_categoria(texto)
                if categoria and (not categorias or categorias[-1] != categoria):
                    categorias.append(categoria)
            except:
                continue

        if indice_bloco < len(categorias):
            return categorias[indice_bloco]
        return ""

    def clicar_apartamento_no_popup(ap_alvo):
        ap_literal = xpath_literal(str(ap_alvo).strip())
        container_xpath = "/html/body/div[1]/div/div/modal-reservation-edit-select-update-grouped-rooms/div[2]/div/div[5]"
        xpaths_busca = [
            f"{container_xpath}//button[contains(concat(' ', normalize-space(.), ' '), concat(' ', {ap_literal}, ' '))]",
            f"{container_xpath}//*[self::span or self::label][normalize-space(.)={ap_literal}]",
            f"//modal-reservation-edit-select-update-grouped-rooms//button[contains(concat(' ', normalize-space(.), ' '), concat(' ', {ap_literal}, ' '))]",
            f"//modal-reservation-edit-select-update-grouped-rooms//*[self::span or self::label][normalize-space(.)={ap_literal}]",
            f"//button[.//span[normalize-space(.)={ap_literal}] or normalize-space(.)={ap_literal}]",
            f"//span[normalize-space(.)={ap_literal}]",
        ]

        for xpath_busca in xpaths_busca:
            try:
                if not focar_quadro_do_elemento(xpath_busca, 3):
                    continue
                for elemento in driver.find_elements(By.XPATH, xpath_busca):
                    try:
                        if not elemento.is_displayed():
                            continue

                        clicavel = elemento
                        for ancestral_xpath in [
                            "./ancestor-or-self::button[1]",
                            "./ancestor::label[1]",
                            "./ancestor::*[contains(@class, 'btn')][1]",
                        ]:
                            try:
                                ancestral = elemento.find_element(By.XPATH, ancestral_xpath)
                                if ancestral and ancestral.is_displayed():
                                    clicavel = ancestral
                                    break
                            except:
                                pass

                        classe = clicavel.get_attribute("class") or ""
                        if clicavel.get_attribute("disabled") or "disabled" in classe:
                            continue

                        try:
                            ActionChains(driver).move_to_element(clicavel).click().perform()
                        except:
                            js_click(clicavel)
                        return True
                    except:
                        continue
            except:
                continue
        return False

    def fechar_modal_selecao_apartamento():
        xpaths_cancelar = [
            "//button[@ng-click='cancelRooms(reservationRoom)' or @title='Cancelar']",
            "/html/body/div[1]/div/div/modal-reservation-edit-select-update-grouped-rooms/div[3]/button[2]",
            "//*[@id='abandonUpdateRooms']"
        ]

        for xp_fechar in xpaths_cancelar:
            if focar_quadro_do_elemento(xp_fechar, 3):
                print("❌ Clicando no botão Cancelar/X...")
                js_click(driver.find_element(By.XPATH, xp_fechar))
                time.sleep(1.5)
                return True

        print("⚠️ Botão X bloqueado! Forçando fechamento com tecla ESC...")
        ActionChains(driver).send_keys(Keys.ESCAPE).perform()
        time.sleep(1.5)
        return False

    def fechar_aviso_modificado():
        try:
            xpath_ok_erro = "//button[contains(text(), 'OK')] | //button[@ng-click='closeModal()']"
            aviso = driver.find_elements(By.XPATH, xpath_ok_erro)
            if aviso and len(aviso) > 0:
                if aviso[0].is_displayed():
                    print("⚠️ Detectado pop-up 'Registro Modificado'. Fechando...")
                    js_click(aviso[0])
                    time.sleep(1.5)
                    return True
        except: pass
        return False

    def confirmar_acao(is_overbooking=False):
        time.sleep(1) 
        fechar_aviso_modificado() 
        if is_overbooking:
            xpath_conf_over = "/html/body/div[1]/div/div/modal-update-room-type/div[6]/button[1]"
            if focar_quadro_do_elemento(xpath_conf_over, 10):
                js_click(driver.find_element(By.XPATH, xpath_conf_over))
                print("✅ Confirmação de overbooking enviada!")
                time.sleep(2)
                fechar_aviso_modificado()
                return True
        else:
            xpath_btn_confirmar = "//button[@ng-click='saveRooms(reservationRoom)' or @title='Confirmar']"
            if focar_quadro_do_elemento(xpath_btn_confirmar, 10):
                botao = driver.find_element(By.XPATH, xpath_btn_confirmar)
                try: botao.click()
                except: js_click(botao)
                print("✅ Confirmação de vinculação enviada!")
                time.sleep(2)
                fechar_aviso_modificado()
                return True
            else:
                xpath_fallback = "/html/body/div[1]/div/div/modal-reservation-edit-select-update-grouped-rooms/div[3]/button[1]"
                if focar_quadro_do_elemento(xpath_fallback, 5):
                    js_click(driver.find_element(By.XPATH, xpath_fallback))
                    print("✅ Confirmação enviada (via fallback)!")
                    time.sleep(2)
                    fechar_aviso_modificado()
                    return True
        return False

    def obter_dados():
        print("📡 Lendo 'VINCULACAO_HOJE' via OAuth...")
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

        cliente = gspread.authorize(creds)
        aba = cliente.open_by_key(ID_PLANILHA).worksheet(NOME_ABA)

        def normalizar_cabecalho(texto):
            texto = str(texto or "").strip().upper()
            texto = re.sub(r"[^A-Z0-9]+", "_", texto)
            return texto.strip("_")

        def montar_agrupados(linhas):
            agrupados = {}

            for numero_linha, linha in enumerate(linhas, start=2):
                if len(linha) < 3:
                    continue
                if numero_linha == 2 and normalizar_cabecalho(linha[0]) in {"VOUCHER", "VOUCHER_CONTA"}:
                    continue

                v_s = str(linha[0]).strip()
                a_s = str(linha[1]).strip()
                c_s = str(linha[2]).strip().upper()
                hospede = str(linha[3]).strip() if len(linha) > 3 else ""
                checkin = str(linha[4]).strip() if len(linha) > 4 else ""
                status_extra = str(linha[5]).strip() if len(linha) > 5 else ""
                resumo = str(linha[6]).strip() if len(linha) > 6 else ""
                atual = str(linha[7]).strip() if len(linha) > 7 else ""
                acao = str(linha[8]).strip().upper() if len(linha) > 8 else ""
                if not acao:
                    acao = "VINCULAR"

                if acao in {"REVISAR", "BLOQUEADO"}:
                    raise RuntimeError(
                        f"Execução bloqueada antes de abrir o HITS: linha {numero_linha}, "
                        f"voucher {v_s}, ação {acao}."
                    )
                if acao == "MANTER":
                    continue
                if acao == "TROCAR" and not atual:
                    raise RuntimeError(f"Linha {numero_linha}: TROCAR sem apartamento atual.")
                if acao not in {"TROCAR", "VINCULAR", "OVERBOOKING"}:
                    raise RuntimeError(f"Linha {numero_linha}: ação desconhecida/indefinida: {acao}")

                if v_s and a_s and c_s:
                    if v_s not in agrupados:
                        agrupados[v_s] = []
                    agrupados[v_s].append({
                        "ap": a_s,
                        "cat": c_s,
                        "acao": acao,
                        "atual": atual,
                        "linha": numero_linha,
                        "hospede": hospede,
                        "checkin": checkin,
                        "status_extra": status_extra,
                        "resumo": resumo,
                    })

            return agrupados

        def assinatura_agrupados(agrupados):
            partes = []
            for voucher in sorted(agrupados.keys()):
                for item in agrupados[voucher]:
                    partes.append(f"{voucher}:{item['ap']}:{item['cat']}:{item.get('acao','')}:{item.get('atual','')}")
            texto = "|".join(partes)
            return hashlib.sha1(texto.encode("utf-8")).hexdigest()[:12]

        tentativas = int(os.environ.get("VINCULACAO_PLANILHA_TENTATIVAS", "4"))
        intervalo = int(os.environ.get("VINCULACAO_PLANILHA_INTERVALO", "4"))
        assinatura_anterior = None
        agrupados_anterior = {}

        for tentativa in range(1, tentativas + 1):
            linhas = aba.get_all_values()[1:]
            agrupados = montar_agrupados(linhas)
            total_aps = sum(len(lista) for lista in agrupados.values())
            assinatura = assinatura_agrupados(agrupados)
            primeiros_vouchers = ", ".join(sorted(agrupados.keys())[:8])

            print(
                f"📊 Leitura {tentativa}/{tentativas} da VINCULACAO_HOJE: "
                f"{len(agrupados)} voucher(s), {total_aps} apartamento(s), assinatura {assinatura}"
            )
            if primeiros_vouchers:
                print(f"   Primeiros vouchers lidos: {primeiros_vouchers}")

            if assinatura_anterior == assinatura:
                print("✅ Aba VINCULACAO_HOJE estabilizada em duas leituras consecutivas.")
                return agrupados

            if assinatura_anterior is not None:
                print("⏳ A aba VINCULACAO_HOJE mudou entre as leituras. Aguardando recalculo da planilha...")

            assinatura_anterior = assinatura
            agrupados_anterior = agrupados

            if tentativa < tentativas:
                time.sleep(intervalo)

        print("⚠️ A aba VINCULACAO_HOJE não estabilizou dentro do tempo. Seguindo com a última leitura disponível.")
        return agrupados_anterior

    def ler_apartamento_marcado_no_modal():
        candidatos = []
        xpaths = [
            "//modal-reservation-edit-select-update-grouped-rooms//button[contains(@class,'btn-success') or contains(@class,'active') or .//*[contains(@class,'fa-check') or contains(@class,'check')]]",
            "//modal-reservation-edit-select-update-grouped-rooms//*[contains(@class,'btn-success') or contains(@class,'active') or .//*[contains(@class,'fa-check') or contains(@class,'check')]]",
            "//button[contains(@class,'btn-success') or .//*[contains(@class,'fa-check') or contains(@class,'check')]]",
        ]
        for xpath in xpaths:
            for elemento in driver.find_elements(By.XPATH, xpath):
                try:
                    if not elemento.is_displayed():
                        continue
                    texto = elemento.text.strip()
                    match = re.search(r"\b(\d{3,4})\b", texto)
                    if match:
                        candidatos.append(match.group(1))
                except:
                    continue
        return candidatos[0] if candidatos else ""

    def dry_run_inspecionar_quarto(voucher, indice, item, botao_cama):
        ap_alvo = item["ap"]
        cat_alvo = item["cat"]
        acao = item.get("acao", "")
        atual_planilha = item.get("atual", "")
        linha = item.get("linha", "?")
        cat_bloco_atual = obter_categoria_bloco(indice)

        log_dry(
            f"[DRY-RUN] Voucher {voucher} linha {linha} quarto {indice + 1}: "
            f"ação={acao}, planilha atual={atual_planilha or '-'}, destino={ap_alvo}, "
            f"cat planilha={cat_alvo}, cat HITS={cat_bloco_atual or '-'}"
        )

        try:
            js_click(botao_cama)
            focar_quadro_do_elemento("//modal-reservation-edit-select-update-grouped-rooms", 8)
            time.sleep(1)
            atual_hits = ler_apartamento_marcado_no_modal()
        except Exception as erro:
            atual_hits = ""
            log_dry(f"[DRY-RUN] Falha ao abrir/ler modal do quarto {indice + 1}: {erro}")

        divergencias = []
        if atual_planilha and atual_hits and atual_hits != atual_planilha:
            divergencias.append(f"HITS={atual_hits}, planilha H={atual_planilha}")
        if cat_bloco_atual and cat_alvo and cat_bloco_atual != cat_alvo and acao != "OVERBOOKING":
            divergencias.append(f"categoria HITS={cat_bloco_atual}, planilha C={cat_alvo}")
        if acao == "TROCAR" and atual_hits and atual_hits == ap_alvo:
            divergencias.append("ação TROCAR, mas o HITS já está no apartamento destino")
        if acao == "VINCULAR" and atual_hits:
            divergencias.append(f"ação VINCULAR, mas o HITS já mostra apartamento {atual_hits}")

        if divergencias:
            log_dry(f"[DRY-RUN] DIVERGÊNCIA voucher {voucher}: " + " | ".join(divergencias))
            salvar_screenshot(f"divergencia_{voucher}_linha_{linha}.png")
        else:
            log_dry(
                f"[DRY-RUN] OK voucher {voucher}: faria {acao} "
                f"{atual_hits or atual_planilha or '-'} -> {ap_alvo}."
            )

        fechar_modal_selecao_apartamento()
        driver.switch_to.default_content()
        esperar_loading_sumir()

    def aplicar_filtro_voucher(voucher):
        xpath_abrir_filtro = '//*[@id="one-search-filters-container"]/div[2]/span[5]/one-translate'
        if not focar_quadro_do_elemento(xpath_abrir_filtro, 10):
            log_dry(f"⚠️ Não encontrei o filtro de voucher para {voucher}.")
            if DRY_RUN:
                salvar_screenshot(f"filtro_voucher_nao_encontrado_{voucher}.png")
            return False

        js_click(driver.find_element(By.XPATH, xpath_abrir_filtro))
        time.sleep(1)

        input_xpaths = [
            '//*[@id="one-search-modal-content"]//input',
            "//div[contains(@class, 'modal') or @id='one-search-modal-content']//input",
            "//input[@type='text' and not(@disabled)]",
        ]
        input_v = None
        for xpath in input_xpaths:
            if focar_quadro_do_elemento(xpath, 5):
                candidatos = driver.find_elements(By.XPATH, xpath)
                for candidato in candidatos:
                    try:
                        if candidato.is_displayed() and candidato.is_enabled():
                            input_v = candidato
                            break
                    except:
                        continue
            if input_v:
                break

        if not input_v:
            log_dry(f"⚠️ Modal do filtro abriu, mas não encontrei o campo para voucher {voucher}.")
            if DRY_RUN:
                salvar_screenshot(f"campo_filtro_voucher_nao_encontrado_{voucher}.png")
            return False

        js_click(input_v)
        input_v.send_keys(Keys.CONTROL + "a")
        input_v.send_keys(Keys.DELETE)
        input_v.send_keys(voucher)
        time.sleep(0.5)

        botoes_xpath = [
            '/html/body/div[1]/div/div/div[4]/button',
            "//*[@id='one-search-modal-content']/ancestor::div[contains(@class,'modal')][1]//button[not(@disabled)]",
            "//button[normalize-space(.)='Aplicar' or normalize-space(.)='Confirmar' or normalize-space(.)='Filtrar' or normalize-space(.)='Buscar' or normalize-space(.)='OK']",
            "//button[.//*[normalize-space(.)='Aplicar' or normalize-space(.)='Confirmar' or normalize-space(.)='Filtrar' or normalize-space(.)='Buscar' or normalize-space(.)='OK']]",
        ]
        for xpath in botoes_xpath:
            try:
                botoes = driver.find_elements(By.XPATH, xpath)
                for botao in botoes:
                    try:
                        if not botao.is_displayed() or not botao.is_enabled():
                            continue
                        texto = (botao.text or "").strip().upper()
                        classe = botao.get_attribute("class") or ""
                        if texto in {"CANCELAR", "FECHAR"} or "cancel" in classe.lower():
                            continue
                        js_click(botao)
                        time.sleep(2)
                        esperar_loading_sumir()
                        time.sleep(1)
                        return True
                    except:
                        continue
            except:
                continue

        try:
            input_v.send_keys(Keys.ENTER)
            time.sleep(2)
            esperar_loading_sumir()
            time.sleep(1)
            return True
        except:
            pass

        log_dry(f"⚠️ Não consegui confirmar o filtro do voucher {voucher}.")
        if DRY_RUN:
            salvar_screenshot(f"confirmar_filtro_voucher_falhou_{voucher}.png")
        return False

    def aplicar_filtro_voucher(voucher):
        """Aplica o filtro de voucher sem usar a blindagem de pop-up dentro do modal."""
        def clique_modal_sem_guard(elemento):
            try:
                driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'center'});", elemento)
            except:
                pass
            try:
                elemento.click()
            except:
                driver.execute_script("arguments[0].click();", elemento)

        def modal_filtro_aberto():
            try:
                return bool(driver.execute_script("""
                    const el = document.querySelector('#one-search-modal-content');
                    if (!el) return false;
                    const r = el.getBoundingClientRect();
                    return !!(r.width || r.height || el.getClientRects().length);
                """))
            except:
                return False

        def lista_tem_voucher():
            try:
                texto = driver.execute_script("return String(document.body ? document.body.innerText || '' : '');")
                return str(voucher) in texto
            except:
                return False

        def aguardar_filtro_confirmado():
            fim = time.time() + 8
            while time.time() < fim:
                esperar_loading_sumir()
                if lista_tem_voucher() and not modal_filtro_aberto():
                    return True
                time.sleep(0.5)
            return lista_tem_voucher()

        def clicar_botao_modal_por_js():
            try:
                return bool(driver.execute_script("""
                    const visivel = (el) => {
                      const r = el.getBoundingClientRect();
                      return !!(r.width || r.height || el.getClientRects().length);
                    };
                    const input = document.querySelector('#one-search-modal-content input');
                    let root = input || document.querySelector('#one-search-modal-content');
                    for (let i = 0; root && i < 8; i += 1) {
                      const buttons = Array.from(root.querySelectorAll ? root.querySelectorAll('button') : []);
                      const candidatos = buttons.filter((btn) => {
                        const texto = String(btn.innerText || btn.textContent || '').trim().toUpperCase();
                        const classe = String(btn.className || '').toLowerCase();
                        return visivel(btn)
                          && !btn.disabled
                          && texto !== 'CANCELAR'
                          && texto !== 'FECHAR'
                          && !classe.includes('cancel');
                      });
                      if (candidatos.length) {
                        const alvo = candidatos[candidatos.length - 1];
                        ['mouseover', 'mousedown', 'mouseup', 'click'].forEach((nome) => {
                          alvo.dispatchEvent(new MouseEvent(nome, { bubbles: true, cancelable: true, view: window }));
                        });
                        try { alvo.click(); } catch (e) {}
                        return true;
                      }
                      root = root.parentElement;
                    }
                    return false;
                """))
            except:
                return False

        try:
            xpath_abrir_filtro = '//*[@id="one-search-filters-container"]/div[2]/span[5]/one-translate'
            if not focar_quadro_do_elemento(xpath_abrir_filtro, 10):
                log_dry(f"[DRY-RUN] Filtro de voucher nao encontrado: {voucher}")
                if DRY_RUN:
                    salvar_screenshot(f"filtro_voucher_nao_encontrado_{voucher}.png")
                return False

            js_click(driver.find_element(By.XPATH, xpath_abrir_filtro))
            time.sleep(1)

            input_xpaths = [
                '//*[@id="one-search-modal-content"]//input',
                "//div[contains(@class, 'modal') or @id='one-search-modal-content']//input",
                "//input[@type='text' and not(@disabled)]",
            ]
            input_v = None
            for xpath in input_xpaths:
                if focar_quadro_do_elemento(xpath, 5):
                    for candidato in driver.find_elements(By.XPATH, xpath):
                        try:
                            if candidato.is_displayed() and candidato.is_enabled():
                                input_v = candidato
                                break
                        except:
                            continue
                if input_v:
                    break

            if not input_v:
                log_dry(f"[DRY-RUN] Campo do filtro de voucher nao encontrado: {voucher}")
                if DRY_RUN:
                    salvar_screenshot(f"campo_filtro_voucher_nao_encontrado_{voucher}.png")
                return False

            clique_modal_sem_guard(input_v)
            input_v.send_keys(Keys.CONTROL + "a")
            input_v.send_keys(Keys.DELETE)
            input_v.send_keys(voucher)
            time.sleep(0.5)

            try:
                input_v.send_keys(Keys.ENTER)
                if aguardar_filtro_confirmado():
                    return True
            except:
                pass

            if clicar_botao_modal_por_js() and aguardar_filtro_confirmado():
                return True

            botoes_xpath = [
                '/html/body/div[1]/div/div/div[4]/button',
                "//*[@id='one-search-modal-content']/ancestor::*[contains(@class,'modal') or contains(@class,'one')][1]//button[not(@disabled)]",
                "//button[normalize-space(.)='Aplicar' or normalize-space(.)='Confirmar' or normalize-space(.)='Filtrar' or normalize-space(.)='Buscar' or normalize-space(.)='OK']",
                "//button[.//*[normalize-space(.)='Aplicar' or normalize-space(.)='Confirmar' or normalize-space(.)='Filtrar' or normalize-space(.)='Buscar' or normalize-space(.)='OK']]",
            ]
            for xpath in botoes_xpath:
                for botao in driver.find_elements(By.XPATH, xpath):
                    try:
                        if not botao.is_displayed() or not botao.is_enabled():
                            continue
                        texto = (botao.text or "").strip().upper()
                        classe = botao.get_attribute("class") or ""
                        if texto in {"CANCELAR", "FECHAR"} or "cancel" in classe.lower():
                            continue
                        clique_modal_sem_guard(botao)
                        if aguardar_filtro_confirmado():
                            return True
                    except:
                        continue

            log_dry(f"[DRY-RUN] Nao consegui confirmar o filtro do voucher {voucher}.")
            if DRY_RUN:
                salvar_screenshot(f"confirmar_filtro_voucher_falhou_{voucher}.png")
            return False
        except Exception as erro:
            log_dry(f"[DRY-RUN] Erro controlado ao aplicar filtro do voucher {voucher}: {erro}")
            if DRY_RUN:
                salvar_screenshot(f"erro_filtro_voucher_{voucher}.png")
            return False

    try:
        dados = obter_dados()
        if DRY_RUN:
            with open(relatorio_dry_run, "w", encoding="utf-8") as arquivo:
                arquivo.write("DRY-RUN VISUAL VINC2 - nenhuma confirmação será clicada\n")
            log_dry(f"[DRY-RUN] {len(dados)} voucher(s) carregados para inspeção visual.")
        if not dados:
            print("Nenhum voucher acionável encontrado na VINCULACAO_HOJE.")
            return
        driver.get(URL_HITS)
        wait.until(EC.visibility_of_element_located((By.ID, "Email"))).send_keys(os.environ["HITS_EMAIL"])
        driver.find_element(By.ID, "Password").send_keys(os.environ["HITS_PASSWORD"])
        driver.find_element(By.XPATH, "//button[@type='submit']").click()
        time.sleep(8)
        fechar_popup_hits()
        
        js_click(wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="menuPrimary"]/a'))))
        time.sleep(1); js_click(wait.until(EC.presence_of_element_located((By.XPATH, '//*[@id="menureservation"]'))))
        time.sleep(1); js_click(wait.until(EC.presence_of_element_located((By.XPATH, '//*[@id="menureservations"]/a'))))
        
        focar_quadro_do_elemento('//*[@id="one-search-filters-container"]', 20)
        
        print("🧹 Limpando filtro de datas inicial...")
        xpath_limpar_datas = '//*[@id="one-search-filters-container"]/div[1]/button[3]/em'
        if focar_quadro_do_elemento(xpath_limpar_datas, 10):
            js_click(driver.find_element(By.XPATH, xpath_limpar_datas))
            time.sleep(1)
            esperar_loading_sumir()

        operacoes_dry = 0
        for voucher, lista_aps in dados.items():
            if DRY_RUN and operacoes_dry >= MAX_OPERACOES:
                log_dry(f"[DRY-RUN] Limite VINC2_MAX_OPERACOES={MAX_OPERACOES} atingido. Encerrando inspeção.")
                break
            fechar_popup_hits()
            print(f"\n🚀 VOUCHER: {voucher} | Requisições na planilha: {len(lista_aps)}")
            driver.switch_to.default_content()
            esperar_loading_sumir()
            
            if not aplicar_filtro_voucher(voucher):
                if DRY_RUN:
                    log_dry(f"[DRY-RUN] Pulando voucher {voucher} porque o filtro não foi aplicado.")
                    continue
                raise RuntimeError(f"Filtro de voucher não aplicado: {voucher}")
            
            aps_necessarios = [d["ap"] for d in lista_aps]
            todos_vinculados_corretamente = True
            
            print("🔎 Verificando se os apartamentos já estão vinculados na tela...")
            for ap in aps_necessarios:
                xpath_check_tela = f"//div[contains(@class, 'ui-grid-cell-contents') and contains(text(), '{ap}')]"
                if not driver.find_elements(By.XPATH, xpath_check_tela):
                    todos_vinculados_corretamente = False
                    break

            if todos_vinculados_corretamente:
                if DRY_RUN:
                    log_dry(
                        f"[DRY-RUN] A lista já mostra {aps_necessarios} no voucher {voucher}; "
                        "abrindo a reserva mesmo assim para conferência visual."
                    )
                else:
                    print(f"✨ Todos os apartamentos ({aps_necessarios}) já estão perfeitamente vinculados! Pulando voucher...")
                    continue

            if DRY_RUN:
                print("🔎 Abrindo reserva para conferência visual em dry-run...")
            else:
                print("⚠️ Algum apartamento faltando ou errado. Abrindo reserva para correção...")
            
            xpath_lapis = "(//div[contains(@class, 'ui-grid-row')]//div[contains(@class, 'ui-grid-cell')]//a)[1]"
            if focar_quadro_do_elemento(xpath_lapis, 20):
                js_click(driver.find_element(By.XPATH, xpath_lapis))
                
                focar_quadro_do_elemento("//button[contains(@id, 'btnRoomSelectInEdit')]", 15)

                xpath_qtd_grupo = '//*[@id="summaryRoomTypesReservation"]/div[3]/div[2]/span[2]'
                qtd_quartos_reserva = 1
                if focar_quadro_do_elemento(xpath_qtd_grupo, 5):
                    try: qtd_quartos_reserva = int(driver.find_element(By.XPATH, xpath_qtd_grupo).text.strip())
                    except: pass
                
                print(f"🏨 Status da Reserva: Contém {qtd_quartos_reserva} quarto(s). Validando com os {len(lista_aps)} requeridos na planilha...")

                for i, dados_alvo in enumerate(lista_aps):
                    if DRY_RUN and operacoes_dry >= MAX_OPERACOES:
                        break
                    ap_alvo = dados_alvo["ap"]
                    cat_alvo = dados_alvo["cat"]
                    acao_alvo = dados_alvo.get("acao", "VINCULAR")
                    
                    print(f"\n🔄 Processando Quarto {i+1} -> Destino: {ap_alvo} (Cat: {cat_alvo})")
                    
                    botoes_cama = driver.find_elements(By.XPATH, "//button[contains(@id, 'btnRoomSelectInEdit')]")
                    if i >= len(botoes_cama):
                        print(f"⚠️ Erro: Não há ícones de cama suficientes para processar o {i+1}º quarto. Parando este voucher.")
                        break
                        
                    btn_c = botoes_cama[i]
                    
                    if btn_c.get_attribute("disabled") or "disabled" in (btn_c.get_attribute("class") or ""):
                        print(f"🔒 Cama {i+1} bloqueada (Provável Check-in realizado). Pulando...")
                        continue

                    if DRY_RUN:
                        operacoes_dry += 1
                        dry_run_inspecionar_quarto(voucher, i, dados_alvo, btn_c)
                        continue

                    cat_bloco_atual = obter_categoria_bloco(i)
                    if cat_bloco_atual:
                        print(f"🏷️ Categoria atual do bloco {i+1}: {cat_bloco_atual}")
                    else:
                        print(f"⚠️ Não consegui identificar a categoria atual do bloco {i+1}.")
                    
                    js_click(btn_c)
                    focar_quadro_do_elemento("//button[contains(@id, 'btnRoomSelectInEdit')]", 10)
                    time.sleep(1.5) 

                    quarto_vinculado_btn = None
                    botoes_tela = driver.find_elements(By.XPATH, "//button[contains(@id, 'btnRoomSelectInEdit')]")
                    for btn in botoes_tela:
                        classes = btn.get_attribute("class") or ""
                        icones_check = btn.find_elements(By.XPATH, ".//*[contains(@class, 'fa-check') or contains(@class, 'check')]")
                        if any(icone.is_displayed() for icone in icones_check) or "btn-success" in classes:
                            quarto_vinculado_btn = btn
                            break

                    if quarto_vinculado_btn:
                        if ap_alvo in quarto_vinculado_btn.text:
                            print(f"✨ A cama já está com o AP {ap_alvo} marcado. Confirmando e seguindo...")
                            confirmar_acao(is_overbooking=False)
                            time.sleep(1.5)
                            continue 

                        print(f"🧹 Desmarcando quarto errado/antigo ({quarto_vinculado_btn.text.strip()})...")
                        js_click(quarto_vinculado_btn); time.sleep(1)
                        if confirmar_acao(is_overbooking=False):
                            print("✅ Desvinculação inicial concluída."); time.sleep(1)
                            botoes_cama_novos = driver.find_elements(By.XPATH, "//button[contains(@id, 'btnRoomSelectInEdit')]")
                            js_click(botoes_cama_novos[i]); time.sleep(1.5)

                    ap_literal = xpath_literal(str(ap_alvo).strip())
                    xpath_alvo_vinc = f"//button[.//span[normalize-space(.)={ap_literal}] or normalize-space(.)={ap_literal}] | //span[normalize-space(.)={ap_literal}]"
                    elementos_presentes = driver.find_elements(By.XPATH, xpath_alvo_vinc)

                    if elementos_presentes:
                        print(f"🎯 Selecionando {ap_alvo} na tela atual...")
                        try: ActionChains(driver).move_to_element(elementos_presentes[0]).click().perform()
                        except: js_click(elementos_presentes[0])
                        time.sleep(1.5)
                        confirmar_acao(is_overbooking=False)
                        time.sleep(1.5)
                        continue 

                    if clicar_apartamento_no_popup(ap_alvo):
                        print(f"🎯 Selecionando {ap_alvo} no pop-up de apartamentos agrupados...")
                        time.sleep(1.5)
                        confirmar_acao(is_overbooking=False)
                        time.sleep(1.5)
                        continue

                    if acao_alvo != "OVERBOOKING" and cat_bloco_atual and cat_bloco_atual == cat_alvo:
                        print(
                            f"🛑 Overbooking bloqueado: bloco {i+1} já é da categoria {cat_bloco_atual}, "
                            f"igual à planilha ({cat_alvo}). O AP {ap_alvo} deveria estar no pop-up normal."
                        )
                        fechar_modal_selecao_apartamento()
                        driver.switch_to.default_content()
                        esperar_loading_sumir()
                        continue

                    if acao_alvo != "OVERBOOKING":
                        print(
                            f"🛑 AP {ap_alvo} não encontrado e ação da planilha é {acao_alvo}. "
                            "Overbooking só é permitido quando a coluna I estiver como OVERBOOKING."
                        )
                        fechar_modal_selecao_apartamento()
                        driver.switch_to.default_content()
                        esperar_loading_sumir()
                        continue

                    print(f"⚠️ AP {ap_alvo} não encontrado. Fechando modal e iniciando OVERBOOKING na Cama {i+1}...")
                    
                    fechar_modal_selecao_apartamento()
                        
                    driver.switch_to.default_content()
                    esperar_loading_sumir()
                    
                    xpath_setas = "//button[@title='Atualizar/realizar upgrade' or contains(@ng-click, 'openUpdateGroupedRooms') or .//em[text()='compare_arrows']]"
                    
                    if focar_quadro_do_elemento(xpath_setas, 10):
                        setas = driver.find_elements(By.XPATH, xpath_setas)
                        if i < len(setas):
                            print(f"🔄 Entrando na tela de Overbooking do bloco {i+1}...")
                            js_click(setas[i]); time.sleep(1.5)
                            
                            xpath_edit = '//*[@id="reservations"]/div[3]/reservation-update-grouped-rooms-component/div[2]/div[2]/div[1]/div[1]/div[2]/button'
                            if focar_quadro_do_elemento(xpath_edit, 15):
                                print("✏️ Abrindo edição da categoria...")
                                js_click(driver.find_element(By.XPATH, xpath_edit)); time.sleep(1)
                                
                                xpath_btn1 = '/html/body/div[1]/div/div/modal-update-room-type/div[2]/div[2]/div[2]/div/button[1]'
                                if focar_quadro_do_elemento(xpath_btn1, 10):
                                    js_click(driver.find_element(By.XPATH, xpath_btn1)); time.sleep(1)
                                    
                                    xpath_lupa = '/html/body/div[1]/div/div/modal-update-room-type/div[2]/div[2]/div[2]/div/button[2]'
                                    if focar_quadro_do_elemento(xpath_lupa, 10):
                                        print("🔍 Clicando na lupa de categorias...")
                                        js_click(driver.find_element(By.XPATH, xpath_lupa)); time.sleep(1)
                                        
                                        if cat_alvo in XPATH_CATS:
                                            if focar_quadro_do_elemento(XPATH_CATS[cat_alvo], 10):
                                                js_click(driver.find_element(By.XPATH, XPATH_CATS[cat_alvo])); time.sleep(1.5)
                                                
                                                xpath_final_ap = f"//button[.//span[text()='{ap_alvo}'] | text()='{ap_alvo}'] | //div[contains(@class, 'room')]//span[text()='{ap_alvo}']"
                                                if focar_quadro_do_elemento(xpath_final_ap, 15):
                                                    print(f"🎯 AP {ap_alvo} encontrado! Vinculando...")
                                                    el_ap_over = driver.find_element(By.XPATH, xpath_final_ap)
                                                    try: ActionChains(driver).move_to_element(el_ap_over).click().perform()
                                                    except: js_click(el_ap_over)
                                                    
                                                    time.sleep(2) 
                                                    confirmar_acao(is_overbooking=True)
                                                    
                                                    esperar_loading_sumir()
                                                    print("🔙 Retornando da tela de Overbooking para a aba da reserva...")
                                                    xpath_voltar_apos_overbooking = "//*[@id='abandonUpdateRooms']"
                                                    if focar_quadro_do_elemento(xpath_voltar_apos_overbooking, 5):
                                                        js_click(driver.find_element(By.XPATH, xpath_voltar_apos_overbooking))
                                                        time.sleep(1.5)
                                                        esperar_loading_sumir()

                                                else: print(f"⚠️ Erro: AP {ap_alvo} não encontrado no Overbooking.")
                                            else: print(f"⚠️ Erro: Categoria {cat_alvo} indisponível ou XPath incorreto.")
                                        else: print(f"⚠️ Erro Crítico: Categoria '{cat_alvo}' não configurada!")
                                    else: print("⚠️ Erro: Lupa não encontrada.")
                                else: print("⚠️ Erro: Botão 1 não encontrado.")
                            else: print("⚠️ Erro: Botão Lápis (Edição de Categoria) não encontrado.")
                        else: print(f"⚠️ Erro: Seta de overbooking não encontrada para o bloco {i+1}.")
                    else:
                        print("⚠️ Erro FATAL: O botão de Seta (Overbooking) não apareceu na tela principal!")

                print("⬅️ Concluídos os quartos deste Voucher. Retornando ao mapa principal...")
                if focar_quadro_do_elemento('//*[@id="cancelReservation"]', 10):
                    js_click(driver.find_element(By.ID, "cancelReservation")); time.sleep(2)
                    esperar_loading_sumir()

    except Exception as e: print(f"❌ Erro Crítico: {e}")
    finally: driver.quit(); print("🏁 Fim.")

if __name__ == "__main__":
    executar_vinculacao_2_0()
