import unittest
from unittest.mock import patch

import requests

from robots.vinculacao import webhook_google


class RespostaFalsa:
    def __init__(self, texto, erro_http=None):
        self.text = texto
        self.erro_http = erro_http

    def raise_for_status(self):
        if self.erro_http:
            raise self.erro_http


class WebhookGoogleTests(unittest.TestCase):
    @patch.object(webhook_google.time, "sleep")
    @patch.object(webhook_google.requests, "get")
    def test_aceita_resposta_explicita_de_sucesso(self, requisitar, dormir):
        requisitar.return_value = RespostaFalsa(
            "Script executado com sucesso pelo Python!"
        )

        resposta = webhook_google.acionar_webhook_mapa()

        self.assertIn("sucesso", resposta)
        requisitar.assert_called_once_with(webhook_google.URL_WEBHOOK_MAPA, timeout=60)
        dormir.assert_not_called()

    @patch.object(webhook_google.time, "sleep")
    @patch.object(webhook_google.requests, "get")
    def test_repete_quando_google_devolve_pagina_nao_encontrada(
        self, requisitar, dormir
    ):
        pagina_nao_encontrada = RespostaFalsa(
            "<html><title>Page Not Found</title>unable to open the file</html>"
        )
        requisitar.side_effect = [
            pagina_nao_encontrada,
            pagina_nao_encontrada,
            RespostaFalsa("Script executado com sucesso pelo Python!"),
        ]

        resposta = webhook_google.acionar_webhook_mapa(pausa_entre_tentativas=0)

        self.assertIn("sucesso", resposta)
        self.assertEqual(requisitar.call_count, 3)
        self.assertEqual(dormir.call_count, 2)

    @patch.object(webhook_google.time, "sleep")
    @patch.object(webhook_google.requests, "get")
    def test_falha_depois_de_esgotar_as_tentativas(self, requisitar, dormir):
        resposta_http = requests.Response()
        resposta_http.status_code = 503
        requisitar.return_value = RespostaFalsa(
            "erro temporario",
            requests.HTTPError(
                "503 Service Unavailable em URL temporaria",
                response=resposta_http,
            ),
        )

        with self.assertRaises(RuntimeError) as contexto:
            webhook_google.acionar_webhook_mapa(pausa_entre_tentativas=0)

        self.assertIn("3 tentativas", str(contexto.exception))
        self.assertIn("HTTP 503", str(contexto.exception))
        self.assertEqual(requisitar.call_count, 3)
        self.assertEqual(dormir.call_count, 2)


if __name__ == "__main__":
    unittest.main()
