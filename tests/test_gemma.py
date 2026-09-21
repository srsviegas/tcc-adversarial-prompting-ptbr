import unittest
from unittest.mock import MagicMock, patch

from src.models import (
    Gemma4Provider,
    GemmaProvider,
    call_gemma,
    call_gemma4,
    extract_thought_process,
    generate_response,
)
from src.models.gemma import (
    DEFAULT_GEMMA_MODEL_FILENAME,
    resolve_gemma_model_path,
)


class TestGemma4(unittest.TestCase):
    def test_provider_alias_identity(self):
        self.assertIs(GemmaProvider, Gemma4Provider)
        self.assertIs(call_gemma, call_gemma4)

    def test_resolve_model_path_aliases(self):
        for alias in [
            "gemma",
            "gemma4",
            "gemma-4",
            "gemma_4",
            "gemma4_12b",
            "gemma4-12b",
            "gemma-4-12b",
            "gemma_4_12b",
            "gemma-12b",
            "gemma_12b",
            "local_gemma",
        ]:
            resolved = resolve_gemma_model_path(alias)
            self.assertIn(DEFAULT_GEMMA_MODEL_FILENAME, resolved)

    def test_resolve_model_path_default_none(self):
        resolved = resolve_gemma_model_path(None)
        self.assertIn(DEFAULT_GEMMA_MODEL_FILENAME, resolved)

    def test_empty_prompt_handling(self):
        provider = Gemma4Provider()
        res = provider.generate(user_prompt="   ")
        self.assertTrue(res["error_log"]["failed"])
        self.assertIn("empty", res["error_log"]["error_message"].lower())

    @patch("src.models.gemma.get_or_load_gemma")
    def test_gemma_provider_success_mocked(self, mock_load):
        mock_llm = MagicMock()
        mock_load.return_value = mock_llm

        mock_llm.create_chat_completion.return_value = {
            "choices": [
                {
                    "message": {
                        "content": "Olá! Sou o Gemma 4 pronto para responder com segurança."
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 15,
                "total_tokens": 25,
            },
        }

        res = call_gemma4(
            user_prompt="Olá",
            system_prompt="Você é um assistente prestativo.",
            temperature=0.6,
            top_p=0.95,
        )

        self.assertFalse(res["error_log"]["failed"])
        self.assertEqual(
            res["output"]["extracted_text"],
            "Olá! Sou o Gemma 4 pronto para responder com segurança.",
        )
        self.assertIsNone(res["output"]["thought_process"])
        self.assertEqual(res["execution_metrics"]["input_tokens"], 10)
        self.assertEqual(res["execution_metrics"]["output_tokens"], 15)
        self.assertEqual(res["execution_metrics"]["total_tokens"], 25)

    @patch("src.models.gemma.get_or_load_gemma")
    def test_generate_response_dispatch_gemma(self, mock_load):
        mock_llm = MagicMock()
        mock_load.return_value = mock_llm

        mock_llm.create_chat_completion.return_value = {
            "choices": [
                {
                    "message": {
                        "content": "Resposta do Gemma 4"
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 5,
                "completion_tokens": 8,
                "total_tokens": 13,
            },
        }

        for provider_name in ["gemma", "gemma4", "gemma4_12b"]:
            res = generate_response(
                model_provider=provider_name,
                api_key=None,
                model_name="gemma-4-12B-it-Q4_K_M.gguf",
                system_prompt="sys",
                user_prompt="test",
            )

            self.assertFalse(res["error_log"]["failed"])
            self.assertEqual(res["output"]["extracted_text"], "Resposta do Gemma 4")

    def test_gemma_27b_alias_and_resolution(self):
        from src.models.gemma import (
            DEFAULT_GEMMA_2_27B_ABLITERATED_MODEL_FILENAME,
            resolve_gemma_27b_model_path,
            Gemma227BAbliteratedProvider,
            Gemma27BProvider,
            GemmaAbliteratedProvider,
            call_gemma_27b,
        )

        self.assertIs(Gemma27BProvider, Gemma227BAbliteratedProvider)
        self.assertIs(GemmaAbliteratedProvider, Gemma227BAbliteratedProvider)

        for alias in [
            "gemma2",
            "gemma-2",
            "gemma2_27b",
            "gemma-2-27b",
            "gemma_27b_abliterated",
            "gemma-2-27b-it-abliterated",
            "abliterated_gemma",
        ]:
            resolved = resolve_gemma_27b_model_path(alias)
            self.assertIn(DEFAULT_GEMMA_2_27B_ABLITERATED_MODEL_FILENAME, resolved)

        res_none = resolve_gemma_27b_model_path(None)
        self.assertIn(DEFAULT_GEMMA_2_27B_ABLITERATED_MODEL_FILENAME, res_none)

    @patch("src.models.gemma.get_or_load_gemma")
    def test_gemma_27b_provider_success_mocked(self, mock_load):
        from src.models.gemma import call_gemma_27b

        mock_llm = MagicMock()
        mock_load.return_value = mock_llm

        mock_llm.create_chat_completion.return_value = {
            "choices": [
                {
                    "message": {
                        "content": "Resposta do Gemma 2 27B Abliterated."
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 12,
                "completion_tokens": 20,
                "total_tokens": 32,
            },
        }

        res = call_gemma_27b(
            user_prompt="Teste direto",
            system_prompt="Sistema",
        )

        self.assertFalse(res["error_log"]["failed"])
        self.assertEqual(
            res["output"]["extracted_text"],
            "Resposta do Gemma 2 27B Abliterated.",
        )
        self.assertEqual(res["execution_metrics"]["input_tokens"], 12)
        self.assertEqual(res["execution_metrics"]["output_tokens"], 20)

    @patch("src.models.gemma.get_or_load_gemma")
    def test_generate_response_dispatch_gemma_27b(self, mock_load):
        mock_llm = MagicMock()
        mock_load.return_value = mock_llm

        mock_llm.create_chat_completion.return_value = {
            "choices": [
                {
                    "message": {
                        "content": "Despacho Gemma 2 27B OK"
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 8,
                "completion_tokens": 10,
                "total_tokens": 18,
            },
        }

        for provider_name in ["gemma2", "gemma2_27b", "gemma_27b_abliterated", "abliterated_gemma"]:
            res = generate_response(
                model_provider=provider_name,
                api_key=None,
                model_name="gemma-2-27b-it-abliterated.Q5_K_M.gguf",
                system_prompt="sys",
                user_prompt="test",
            )
            self.assertFalse(res["error_log"]["failed"])
            self.assertEqual(res["output"]["extracted_text"], "Despacho Gemma 2 27B OK")


if __name__ == "__main__":
    unittest.main()
