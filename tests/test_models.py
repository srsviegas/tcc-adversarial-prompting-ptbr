import unittest
from unittest.mock import MagicMock, patch

from src.models import (
    BaseModelProvider,
    GeminiProvider,
    LocalLlamaProvider,
    ProviderRegistry,
    call_gemini,
    call_local_llama,
    generate_response,
)
from src.models.base import build_error_response, build_success_response
from src.models.local_llama import resolve_model_path


class TestModelsModule(unittest.TestCase):
    def test_registry_lookup(self):
        gemini_p = ProviderRegistry.get_provider("gemini")
        self.assertIsInstance(gemini_p, GeminiProvider)

        local_p = ProviderRegistry.get_provider("local")
        self.assertIsInstance(local_p, LocalLlamaProvider)

        llama_p = ProviderRegistry.get_provider("llama")
        self.assertIsInstance(llama_p, LocalLlamaProvider)

        with self.assertRaises(ValueError):
            ProviderRegistry.get_provider("non_existent_provider")

    def test_build_response_helpers(self):
        success = build_success_response(
            latency_seconds=1.234,
            extracted_text="Test output",
            finish_reason="stop",
            input_tokens=10,
            output_tokens=5,
            total_tokens=15,
            raw_api_payload={"raw": True},
        )

        self.assertEqual(success["execution_metrics"]["latency_seconds"], 1.23)
        self.assertEqual(success["execution_metrics"]["input_tokens"], 10)
        self.assertEqual(success["output"]["extracted_text"], "Test output")
        self.assertFalse(success["error_log"]["failed"])

        error = build_error_response(
            latency_seconds=0.5,
            error_message="Something failed",
            tb_str="Traceback...",
        )
        self.assertEqual(error["execution_metrics"]["latency_seconds"], 0.5)
        self.assertEqual(error["output"]["finish_reason"], "error")
        self.assertTrue(error["error_log"]["failed"])
        self.assertEqual(error["error_log"]["error_message"], "Something failed")

    def test_empty_prompt_handling(self):
        res = generate_response(
            model_provider="gemini",
            api_key="fake_key",
            model_name="gemini-3.5-flash-lite",
            system_prompt="sys",
            user_prompt="   ",
        )
        self.assertTrue(res["error_log"]["failed"])
        self.assertIn("empty", res["error_log"]["error_message"].lower())

        res_local = generate_response(
            model_provider="local",
            api_key=None,
            model_name="models/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
            system_prompt="sys",
            user_prompt="",
        )
        self.assertTrue(res_local["error_log"]["failed"])

    def test_resolve_model_path(self):
        path = resolve_model_path("Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf")
        self.assertIn("Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf", path)

    @patch("src.models.gemini.genai.Client")
    def test_gemini_provider_success(self, mock_client_cls):
        mock_client = MagicMock()
        mock_client_cls.return_value = mock_client

        mock_response = MagicMock()
        mock_candidate = MagicMock()
        mock_candidate.finishReason.name = "STOP"
        mock_response.candidates = [mock_candidate]
        mock_response.text = "Hello from Gemini"

        mock_usage = MagicMock()
        mock_usage.promptTokenCount = 12
        mock_usage.candidatesTokenCount = 8
        mock_usage.totalTokenCount = 20
        mock_response.usageMetadata = mock_usage

        mock_client.models.generate_content.return_value = mock_response

        res = call_gemini(
            api_key="fake_api_key",
            model_name="gemini-3.5-flash-lite",
            system_prompt="You are helpful.",
            user_prompt="Hi",
            temperature=0.6,
            top_p=1.0,
            max_output_tokens=100,
            seed=42,
        )

        self.assertFalse(res["error_log"]["failed"])
        self.assertEqual(res["output"]["extracted_text"], "Hello from Gemini")
        self.assertEqual(res["execution_metrics"]["input_tokens"], 12)
        self.assertEqual(res["execution_metrics"]["output_tokens"], 8)
        self.assertEqual(res["execution_metrics"]["total_tokens"], 20)

    def test_local_llama_missing_dependency(self):
        with patch("src.models.local_llama._get_or_load_llama") as mock_load:
            mock_load.side_effect = ImportError("llama-cpp-python is required...")
            res = call_local_llama(
                model_name="models/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
                system_prompt="sys",
                user_prompt="hello",
                temperature=0.7,
                top_p=1.0,
                max_output_tokens=50,
                seed=42,
            )
            self.assertTrue(res["error_log"]["failed"])
            self.assertIn("llama-cpp-python", res["error_log"]["error_message"])


if __name__ == "__main__":
    unittest.main()
