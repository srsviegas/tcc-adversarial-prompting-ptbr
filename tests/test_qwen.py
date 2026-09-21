import unittest
from unittest.mock import MagicMock, patch

from src.models import (
    Qwen3Provider,
    QwenProvider,
    call_qwen,
    call_qwen3,
    extract_thought_process,
    generate_response,
)
from src.models.qwen import (
    DEFAULT_QWEN_MODEL_FILENAME,
    resolve_qwen_model_path,
)


class TestQwen3(unittest.TestCase):
    def test_provider_alias_identity(self):
        self.assertIs(QwenProvider, Qwen3Provider)
        self.assertIs(call_qwen, call_qwen3)

    def test_resolve_model_path_aliases(self):
        for alias in ["qwen", "qwen3", "qwen-3", "qwen_3", "qwen3_14b", "qwen3-14b", "qwen_14b", "qwen-14b", "local_qwen"]:
            resolved = resolve_qwen_model_path(alias)
            self.assertIn(DEFAULT_QWEN_MODEL_FILENAME, resolved)

    def test_resolve_model_path_default_none(self):
        resolved = resolve_qwen_model_path(None)
        self.assertIn(DEFAULT_QWEN_MODEL_FILENAME, resolved)

    def test_empty_prompt_handling(self):
        provider = Qwen3Provider()
        res = provider.generate(user_prompt="   ")
        self.assertTrue(res["error_log"]["failed"])
        self.assertIn("empty", res["error_log"]["error_message"].lower())

    @patch("src.models.qwen.get_or_load_qwen")
    def test_qwen_provider_success_mocked(self, mock_load):
        mock_llm = MagicMock()
        mock_load.return_value = mock_llm

        mock_llm.create_chat_completion.return_value = {
            "choices": [
                {
                    "message": {
                        "content": "<think>\nDual-mode reasoning step\n</think>\n\nResposta em português do Qwen."
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 12,
                "completion_tokens": 25,
                "total_tokens": 37,
            },
        }

        res = call_qwen3(
            user_prompt="Explique o conceito de cibersegurança.",
            system_prompt="Você é um assistente prestativo.",
            temperature=0.6,
            top_p=0.95,
        )

        self.assertFalse(res["error_log"]["failed"])
        self.assertEqual(res["output"]["extracted_text"], "Resposta em português do Qwen.")
        self.assertEqual(res["output"]["thought_process"], "Dual-mode reasoning step")
        self.assertEqual(res["thought_process"], "Dual-mode reasoning step")
        self.assertEqual(res["execution_metrics"]["input_tokens"], 12)
        self.assertEqual(res["execution_metrics"]["output_tokens"], 25)
        self.assertEqual(res["execution_metrics"]["total_tokens"], 37)

    @patch("src.models.qwen.get_or_load_qwen")
    def test_qwen_provider_standard_instruct_output_without_think(self, mock_load):
        mock_llm = MagicMock()
        mock_load.return_value = mock_llm

        mock_llm.create_chat_completion.return_value = {
            "choices": [
                {
                    "message": {
                        "content": "Resposta direta sem tags de pensamento."
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

        res = call_qwen(
            user_prompt="Olá",
            system_prompt="",
        )

        self.assertFalse(res["error_log"]["failed"])
        self.assertEqual(res["output"]["extracted_text"], "Resposta direta sem tags de pensamento.")
        self.assertIsNone(res["output"]["thought_process"])
        self.assertIsNone(res["thought_process"])

    @patch("src.models.qwen.get_or_load_qwen")
    def test_generate_response_dispatch_qwen(self, mock_load):
        mock_llm = MagicMock()
        mock_load.return_value = mock_llm

        mock_llm.create_chat_completion.return_value = {
            "choices": [
                {
                    "message": {
                        "content": "<think>Analise interna</think>Resultado da inferencia"
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 6,
                "completion_tokens": 14,
                "total_tokens": 20,
            },
        }

        for provider_name in ["qwen", "qwen3", "qwen3_14b"]:
            res = generate_response(
                model_provider=provider_name,
                api_key=None,
                model_name="Qwen3-14B-Q4_K_M.gguf",
                system_prompt="sys",
                user_prompt="test",
            )

            self.assertFalse(res["error_log"]["failed"])
            self.assertEqual(res["output"]["extracted_text"], "Resultado da inferencia")
            self.assertEqual(res["output"]["thought_process"], "Analise interna")
            self.assertEqual(res["thought_process"], "Analise interna")

    def test_qwen_coder_model_path_resolution(self):
        from src.models.qwen import (
            DEFAULT_QWEN_CODER_32B_ABLITERATED_MODEL_FILENAME,
            resolve_qwen_coder_model_path,
        )
        for alias in ["qwen_coder", "qwen_coder_32b", "qwen2.5_coder_32b_abliterated", "abliterated_coder"]:
            resolved = resolve_qwen_coder_model_path(alias)
            self.assertIn(DEFAULT_QWEN_CODER_32B_ABLITERATED_MODEL_FILENAME, resolved)

        # Testing None defaults to Coder model filename in resolve_qwen_coder_model_path
        resolved_none = resolve_qwen_coder_model_path(None)
        self.assertIn(DEFAULT_QWEN_CODER_32B_ABLITERATED_MODEL_FILENAME, resolved_none)

    @patch("src.models.qwen.get_or_load_qwen")
    def test_qwen_coder_generate_response_mocked(self, mock_load):
        mock_llm = MagicMock()
        mock_load.return_value = mock_llm
        mock_llm.create_chat_completion.return_value = {
            "choices": [
                {
                    "message": {
                        "content": "<think>\nThinking about code\n</think>\n\nprint('Hello World')"
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

        for provider_name in ["qwen_coder", "qwen_coder_32b", "qwen2.5_coder_32b_abliterated"]:
            res = generate_response(
                model_provider=provider_name,
                api_key=None,
                model_name="Qwen2.5-Coder-32B-Instruct-abliterated-Q4_K_M.gguf",
                system_prompt="sys",
                user_prompt="Write hello world",
            )
            self.assertFalse(res["error_log"]["failed"])
            self.assertEqual(res["output"]["extracted_text"], "print('Hello World')")
            self.assertEqual(res["output"]["thought_process"], "Thinking about code")

    def test_internetes_instruction_resolution(self):
        from src.prompts import INTERNETES_SYSTEM_PROMPT, SHITPOST_SYSTEM_PROMPT
        from scripts.prompt_qwen2_5_coder_32b_abliterated import resolve_instruction

        self.assertEqual(INTERNETES_SYSTEM_PROMPT, SHITPOST_SYSTEM_PROMPT)
        self.assertIn("shitpost brasileiro", INTERNETES_SYSTEM_PROMPT)

        key1, text1 = resolve_instruction("internetes")
        self.assertEqual(key1, "internetes")
        self.assertEqual(text1, INTERNETES_SYSTEM_PROMPT)

        key2, text2 = resolve_instruction("shitpost")
        self.assertEqual(key2, "internetes")
        self.assertEqual(text2, INTERNETES_SYSTEM_PROMPT)


if __name__ == "__main__":
    unittest.main()


