import time

import requests


URL_WEBHOOK_MAPA = (
    "https://script.google.com/macros/s/"
    "AKfycbwcfhQySj2OoJVSzaWnjMCHZzfHPCQHc5fZHKt5sLmhJ7wTtD24SvR-kk-at7lFo_31EA/exec"
)
MENSAGEM_SUCESSO_WEBHOOK = "script executado com sucesso"


def resumir_erro_webhook(erro):
    if isinstance(erro, requests.HTTPError) and erro.response is not None:
        return f"HTTP {erro.response.status_code}"
    if isinstance(erro, requests.RequestException):
        return erro.__class__.__name__
    return str(erro)


def acionar_webhook_mapa(
    url=URL_WEBHOOK_MAPA,
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

            if MENSAGEM_SUCESSO_WEBHOOK not in corpo.casefold():
                resumo = " ".join(corpo.split())[:200] or "resposta vazia"
                raise RuntimeError(f"Resposta inesperada do Google: {resumo}")

            return corpo
        except (requests.RequestException, RuntimeError) as erro:
            ultimo_erro = erro
            print(
                f"Webhook falhou na tentativa {tentativa}/{tentativas}: "
                f"{resumir_erro_webhook(erro)}",
                flush=True,
            )
            if tentativa < tentativas:
                time.sleep(pausa_entre_tentativas)

    raise RuntimeError(
        f"Webhook do mapa falhou apos {tentativas} tentativas: "
        f"{resumir_erro_webhook(ultimo_erro)}"
    ) from ultimo_erro
