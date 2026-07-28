import unittest
from unittest.mock import patch

import requests

from robots.vinculacao import obs


class RespostaFalsa:
    def __init__(self, texto, erro_http=None):
        self.text = texto
        self.erro_http = erro_http

    def raise_for_status(self):
        if self.erro_http:
            raise self.erro_http


class WebhookObsTests(unittest.TestCase):
    @patch.object(obs.time, "sleep")
    @patch.object(obs.requests, "get")
    def test_aceita_resposta_explicita_de_sucesso(self, requisitar, dormir):
        requisitar.return_value = RespostaFalsa(
            "Script executado com sucesso pelo Python!"
        )

        resposta = obs.acionar_webhook_obs()

        self.assertIn("sucesso", resposta)
        requisitar.assert_called_once_with(obs.URL_WEBHOOK_OBS, timeout=60)
        dormir.assert_not_called()

    @patch.object(obs.time, "sleep")
    @patch.object(obs.requests, "get")
    def test_repete_pagina_nao_encontrada(self, requisitar, dormir):
        pagina_nao_encontrada = RespostaFalsa(
            "<html><title>Page Not Found</title>unable to open the file</html>"
        )
        requisitar.side_effect = [
            pagina_nao_encontrada,
            pagina_nao_encontrada,
            RespostaFalsa("Script executado com sucesso pelo Python!"),
        ]

        resposta = obs.acionar_webhook_obs(pausa_entre_tentativas=0)

        self.assertIn("sucesso", resposta)
        self.assertEqual(requisitar.call_count, 3)
        self.assertEqual(dormir.call_count, 2)

    @patch.object(obs.time, "sleep")
    @patch.object(obs.requests, "get")
    def test_falha_depois_de_esgotar_tentativas(self, requisitar, dormir):
        resposta_http = requests.Response()
        resposta_http.status_code = 503
        requisitar.return_value = RespostaFalsa(
            "erro temporario",
            requests.HTTPError("503 Service Unavailable", response=resposta_http),
        )

        with self.assertRaises(RuntimeError) as contexto:
            obs.acionar_webhook_obs(pausa_entre_tentativas=0)

        self.assertIn("Webhook do OBS", str(contexto.exception))
        self.assertIn("HTTP 503", str(contexto.exception))
        self.assertEqual(requisitar.call_count, 3)
        self.assertEqual(dormir.call_count, 2)


if __name__ == "__main__":
    unittest.main()
