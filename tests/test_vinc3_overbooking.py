import os
import unittest
from unittest.mock import patch

from robots.vinculacao.vinc3 import clique_overbooking_habilitado


class Vinc3OverbookingTests(unittest.TestCase):
    def test_clique_fica_habilitado_por_padrao(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertTrue(clique_overbooking_habilitado())

    def test_valores_positivos_mantem_clique_habilitado(self):
        for valor in ("1", "true", "yes", "sim", "on"):
            with self.subTest(valor=valor):
                self.assertTrue(clique_overbooking_habilitado(valor))

    def test_zero_desabilita_clique_para_emergencia(self):
        with patch.dict(
            os.environ,
            {"PERMITIR_CLIQUE_OVERBOOKING": "0"},
            clear=True,
        ):
            self.assertFalse(clique_overbooking_habilitado())


if __name__ == "__main__":
    unittest.main()
