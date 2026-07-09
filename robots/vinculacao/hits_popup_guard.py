import time

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains


def fechar_popups_hits(driver, tentativas=4, pausa=0.35):
    """Remove comunicados e backdrops do HITS que bloqueiam cliques dos robos."""
    try:
        driver.switch_to.default_content()
    except Exception:
        pass

    def remover_por_js():
        try:
            return bool(driver.execute_script("""
                let alterou = false;
                const termos = ['COMUNICADO', 'Olá Hoteleiros', 'Ola Hoteleiros'];
                const textoDe = (el) => String(el.innerText || el.textContent || '');
                const contemComunicado = (el) => termos.some((termo) => textoDe(el).includes(termo));
                const area = (el) => {
                  const r = el.getBoundingClientRect();
                  return r.width * r.height;
                };

                const fecharAlvos = [
                  "/html/body/div/div/div/div/div/div/div[1]//*[name()='svg']",
                  "/html/body/div/div/div/div/div/div/div[1]//*[name()='svg']/*[name()='path']",
                  "/html/body/div/div/div/div/div/div/div[3]/div/button",
                ];
                const disparar = (alvo) => {
                  if (!alvo) return;
                  ['mouseover', 'mousedown', 'mouseup', 'click'].forEach((nome) => {
                    try { alvo.dispatchEvent(new MouseEvent(nome, { bubbles: true, cancelable: true, view: window })); } catch (e) {}
                  });
                  try { alvo.click(); alterou = true; } catch (e) {}
                };
                fecharAlvos.forEach((xp) => {
                  const alvo = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                  disparar(alvo);
                  let pai = alvo && alvo.parentElement;
                  for (let i = 0; pai && i < 8; i += 1, pai = pai.parentElement) disparar(pai);
                });

                const comunicados = Array.from(document.querySelectorAll('body *'))
                  .filter((el) => {
                    if (!contemComunicado(el)) return false;
                    const r = el.getBoundingClientRect();
                    const visivel = !!(r.width || r.height || el.getClientRects().length);
                    return visivel && r.width >= 250 && r.height >= 120;
                  })
                  .sort((a, b) => area(a) - area(b));
                comunicados.forEach((el) => {
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
                    alterou = true;
                  }
                });

                Array.from(document.querySelectorAll('div, [class]')).forEach((el) => {
                  const cls = String(el.className || '');
                  const bg = String(el.getAttribute('backgroundcolor') || '');
                  const style = String(el.getAttribute('style') || '');
                  const bloqueiaTela = cls.includes('themes-preview-reflect-backdrop')
                    || cls.includes('ug-sdk__sc-1rnuyal')
                    || bg.includes('rgba(0, 0, 0')
                    || (style.includes('pointer-events: all') && style.includes('rgba(0, 0, 0'));
                  if (bloqueiaTela) {
                    el.remove();
                    alterou = true;
                  }
                });
                return alterou;
            """))
        except Exception:
            return False

    for _ in range(tentativas):
        alterou = remover_por_js()
        for xpath in [
            "/html/body/div/div/div/div/div/div/div[1]//*[name()='svg']",
            "/html/body/div/div/div/div/div/div/div[1]//*[name()='svg']/*[name()='path']",
            "/html/body/div/div/div/div/div/div/div[3]/div/button",
            "//button[normalize-space(.)='OK' and (ancestor::*[contains(., 'COMUNICADO')] or ancestor::*[contains(., 'Olá Hoteleiros')])]",
            "//button[contains(normalize-space(.), 'Fechar')]",
            "//button[contains(normalize-space(.), 'Entendi')]",
        ]:
            try:
                for elemento in driver.find_elements(By.XPATH, xpath):
                    if elemento.is_displayed() or "svg" in xpath:
                        driver.execute_script("""
                            const el = arguments[0];
                            const alvo = el.closest && (el.closest('button') || el.closest('[role="button"]') || el.closest('svg'));
                            (alvo || el).click();
                        """, elemento)
                        alterou = True
                        time.sleep(pausa)
                        break
            except Exception:
                continue
        try:
            ActionChains(driver).send_keys(Keys.ESCAPE).perform()
        except Exception:
            pass
        if not alterou:
            break
        time.sleep(pausa)

    try:
        driver.switch_to.default_content()
    except Exception:
        pass


def click_hits_seguro(driver, elemento):
    fechar_popups_hits(driver)
    try:
        driver.execute_script("arguments[0].scrollIntoView({block: 'center', inline: 'center'});", elemento)
    except Exception:
        pass
    try:
        elemento.click()
    except Exception:
        fechar_popups_hits(driver)
        driver.execute_script("arguments[0].click();", elemento)
