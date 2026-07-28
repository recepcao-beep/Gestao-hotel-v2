import unittest
from unittest.mock import MagicMock, patch

from robots.vinculacao.limpeza import executar_ciclos_limpeza, executar_limpeza


class CiclosLimpezaTest(unittest.TestCase):
    def test_reabre_mapa_antes_do_ciclo_de_conferencia(self):
        eventos = []
        resultados = iter([2, 0])

        def preparar_e_abrir():
            eventos.append("abrir")

        def varrer(ciclo):
            eventos.append(f"varrer:{ciclo}")
            return next(resultados)

        def fechar():
            eventos.append("fechar")
            return True

        total = executar_ciclos_limpeza(preparar_e_abrir, varrer, fechar)

        self.assertEqual(total, 2)
        self.assertEqual(
            eventos,
            [
                "abrir",
                "varrer:1",
                "fechar",
                "abrir",
                "varrer:2",
                "fechar",
            ],
        )

    def test_falha_quando_mapa_nao_fecha(self):
        with self.assertRaisesRegex(RuntimeError, "nao foi fechado"):
            executar_ciclos_limpeza(lambda: None, lambda ciclo: 1, lambda: False)

    @patch("robots.vinculacao.limpeza.ChromeDriverManager.install", return_value="chromedriver")
    @patch("robots.vinculacao.limpeza.webdriver.Chrome")
    def test_propaga_erro_critico_para_acionar_retry(self, criar_chrome, _instalar_driver):
        driver = MagicMock()
        driver.get.side_effect = RuntimeError("falha simulada")
        criar_chrome.return_value = driver

        with self.assertRaisesRegex(RuntimeError, "falha simulada"):
            executar_limpeza(headless=True)

        driver.quit.assert_called_once()


if __name__ == "__main__":
    unittest.main()
