import unittest
from unittest.mock import MagicMock, patch

from src.models import (
    BaseModelProvider,
    DeepSeekR1Provider,
    GeminiProvider,
    LocalLlamaProvider,
    ProviderRegistry,
    Qwen3Provider,
    Gemma4Provider,
    call_deepseek_r1,
    call_gemini,
    call_local_llama,
    call_qwen3,
    call_gemma4,
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

        llama70b_p = ProviderRegistry.get_provider("llama3.3_70b_abliterated")
        self.assertIsInstance(llama70b_p, LocalLlamaProvider)

        deepseek_p = ProviderRegistry.get_provider("deepseek")
        self.assertIsInstance(deepseek_p, DeepSeekR1Provider)

        r1_p = ProviderRegistry.get_provider("deepseek_r1")
        self.assertIsInstance(r1_p, DeepSeekR1Provider)

        qwen_p = ProviderRegistry.get_provider("qwen")
        self.assertIsInstance(qwen_p, Qwen3Provider)

        qwen3_p = ProviderRegistry.get_provider("qwen3")
        self.assertIsInstance(qwen3_p, Qwen3Provider)

        gemma_p = ProviderRegistry.get_provider("gemma")
        self.assertIsInstance(gemma_p, Gemma4Provider)

        gemma4_p = ProviderRegistry.get_provider("gemma4")
        self.assertIsInstance(gemma4_p, Gemma4Provider)

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
            thought_process="Thinking step",
        )

        self.assertEqual(success["execution_metrics"]["latency_seconds"], 1.23)
        self.assertEqual(success["execution_metrics"]["input_tokens"], 10)
        self.assertEqual(success["output"]["extracted_text"], "Test output")
        self.assertEqual(success["output"]["thought_process"], "Thinking step")
        self.assertEqual(success["thought_process"], "Thinking step")
        self.assertFalse(success["error_log"]["failed"])

        error = build_error_response(
            latency_seconds=0.5,
            error_message="Something failed",
            tb_str="Traceback...",
        )
        self.assertEqual(error["execution_metrics"]["latency_seconds"], 0.5)
        self.assertEqual(error["output"]["finish_reason"], "error")
        self.assertIsNone(error["output"]["thought_process"])
        self.assertIsNone(error["thought_process"])
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

        res_deepseek = generate_response(
            model_provider="deepseek",
            api_key=None,
            model_name="models/DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf",
            system_prompt="sys",
            user_prompt="",
        )
        self.assertTrue(res_deepseek["error_log"]["failed"])

        res_qwen = generate_response(
            model_provider="qwen3",
            api_key=None,
            model_name="models/Qwen3-14B-Q4_K_M.gguf",
            system_prompt="sys",
            user_prompt="",
        )
        self.assertTrue(res_qwen["error_log"]["failed"])

        res_gemma = generate_response(
            model_provider="gemma4",
            api_key=None,
            model_name="models/gemma-4-12B-it-Q4_K_M.gguf",
            system_prompt="sys",
            user_prompt="",
        )
        self.assertTrue(res_gemma["error_log"]["failed"])

    def test_resolve_model_path(self):
        from src.models.deepseek_r1 import resolve_deepseek_model_path
        from src.models.qwen import resolve_qwen_model_path
        from src.models.gemma import resolve_gemma_model_path
        path = resolve_model_path("Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf")
        self.assertIn("Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf", path)

        path_ds = resolve_deepseek_model_path("DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf")
        self.assertIn("DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf", path_ds)

        path_qwen = resolve_qwen_model_path("Qwen3-14B-Q4_K_M.gguf")
        self.assertIn("Qwen3-14B-Q4_K_M.gguf", path_qwen)

        path_gemma = resolve_gemma_model_path("gemma-4-12B-it-Q4_K_M.gguf")
        self.assertIn("gemma-4-12B-it-Q4_K_M.gguf", path_gemma)

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

    def test_deepseek_missing_dependency(self):
        with patch("src.models.deepseek_r1.get_or_load_deepseek") as mock_load:
            mock_load.side_effect = ImportError("llama-cpp-python is required...")
            res = call_deepseek_r1(
                model_name="models/DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf",
                system_prompt="sys",
                user_prompt="hello",
                temperature=0.7,
                top_p=1.0,
                max_output_tokens=50,
                seed=42,
            )
            self.assertTrue(res["error_log"]["failed"])
            self.assertIn("llama-cpp-python", res["error_log"]["error_message"])

    def test_llama_70b_model_path_resolution(self):
        from src.models.local_llama import (
            DEFAULT_LLAMA_3_3_70B_ABLITERATED_MODEL_FILENAME,
            resolve_llama_70b_model_path,
        )
        for alias in ["llama3.3", "llama-3.3-70b", "llama3.3_70b_abliterated", "abliterated_llama"]:
            resolved = resolve_llama_70b_model_path(alias)
            self.assertIn(DEFAULT_LLAMA_3_3_70B_ABLITERATED_MODEL_FILENAME, resolved)

        resolved_none = resolve_llama_70b_model_path(None)
        self.assertIn(DEFAULT_LLAMA_3_3_70B_ABLITERATED_MODEL_FILENAME, resolved_none)

    def test_llama_70b_script_instruction_resolution(self):
        from scripts.prompt_llama_3_3_70b_abliterated import resolve_instruction
        from src.prompts import INTERNETES_SYSTEM_PROMPT

        key, prompt = resolve_instruction("internetes")
        self.assertEqual(key, "internetes")
        self.assertEqual(prompt, INTERNETES_SYSTEM_PROMPT)

        key2, prompt2 = resolve_instruction("base64", lang="pt-BR")
        self.assertEqual(key2, "base64")
        self.assertIn("BASE64", prompt2)


if __name__ == "__main__":
    unittest.main()

