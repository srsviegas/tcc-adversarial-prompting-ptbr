import unittest
from unittest.mock import MagicMock, patch

from src.models import (
    DeepSeekR1Provider,
    call_deepseek_r1,
    extract_thought_process,
    generate_response,
)
from src.models.deepseek_r1 import (
    DEFAULT_DEEPSEEK_MODEL_FILENAME,
    resolve_deepseek_model_path,
)


class TestDeepSeekR1(unittest.TestCase):
    def test_extract_thought_process_standard(self):
        raw = "<think>\nThinking about the user query step by step.\n</think>\n\nParis is the capital of France."
        cleaned, thought = extract_thought_process(raw)
        self.assertEqual(cleaned, "Paris is the capital of France.")
        self.assertEqual(thought, "Thinking about the user query step by step.")

    def test_extract_thought_process_unclosed(self):
        raw = "<think>\nThinking process cut off by token limit"
        cleaned, thought = extract_thought_process(raw)
        self.assertEqual(cleaned, "")
        self.assertEqual(thought, "Thinking process cut off by token limit")

    def test_extract_thought_process_multiple(self):
        raw = "<think>Part 1</think>\nIntermediate text.\n<think>Part 2</think>\nFinal answer."
        cleaned, thought = extract_thought_process(raw)
        self.assertEqual(cleaned, "Intermediate text.\n\nFinal answer.")
        self.assertEqual(thought, "Part 1\n\nPart 2")

    def test_extract_thought_process_none(self):
        raw = "Direct response without any thinking tags."
        cleaned, thought = extract_thought_process(raw)
        self.assertEqual(cleaned, "Direct response without any thinking tags.")
        self.assertIsNone(thought)

    def test_extract_thought_process_empty(self):
        cleaned, thought = extract_thought_process("")
        self.assertEqual(cleaned, "")
        self.assertIsNone(thought)

    def test_resolve_model_path_aliases(self):
        for alias in ["deepseek", "deepseek_r1", "deepseek-r1", "deepseek-r1-distill-qwen-14b"]:
            resolved = resolve_deepseek_model_path(alias)
            self.assertIn(DEFAULT_DEEPSEEK_MODEL_FILENAME, resolved)

    def test_empty_prompt_handling(self):
        provider = DeepSeekR1Provider()
        res = provider.generate(user_prompt="   ")
        self.assertTrue(res["error_log"]["failed"])
        self.assertIn("empty", res["error_log"]["error_message"].lower())

    @patch("src.models.deepseek_r1.get_or_load_deepseek")
    def test_deepseek_provider_success_mocked(self, mock_load):
        mock_llm = MagicMock()
        mock_load.return_value = mock_llm

        mock_llm.create_chat_completion.return_value = {
            "choices": [
                {
                    "message": {
                        "content": "<think>\nStep-by-step internal reasoning\n</think>\n\nA capital da França é Paris."
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 15,
                "completion_tokens": 30,
                "total_tokens": 45,
            },
        }

        res = call_deepseek_r1(
            user_prompt="Qual a capital da França?",
            system_prompt="Você é um assistente útil.",
            temperature=0.6,
            top_p=0.95,
        )

        self.assertFalse(res["error_log"]["failed"])
        self.assertEqual(res["output"]["extracted_text"], "A capital da França é Paris.")
        self.assertEqual(res["output"]["thought_process"], "Step-by-step internal reasoning")
        self.assertEqual(res["thought_process"], "Step-by-step internal reasoning")
        self.assertEqual(res["execution_metrics"]["input_tokens"], 15)
        self.assertEqual(res["execution_metrics"]["output_tokens"], 30)
        self.assertEqual(res["execution_metrics"]["total_tokens"], 45)

    @patch("src.models.deepseek_r1.get_or_load_deepseek")
    def test_generate_response_dispatch_deepseek(self, mock_load):
        mock_llm = MagicMock()
        mock_load.return_value = mock_llm

        mock_llm.create_chat_completion.return_value = {
            "choices": [
                {
                    "message": {
                        "content": "<think>Deliberation</think>Answer"
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 5,
                "completion_tokens": 10,
                "total_tokens": 15,
            },
        }

        res = generate_response(
            model_provider="deepseek_r1",
            api_key=None,
            model_name="deepseek-r1-distill-qwen-14b",
            system_prompt="sys",
            user_prompt="test",
        )

        self.assertFalse(res["error_log"]["failed"])
        self.assertEqual(res["output"]["extracted_text"], "Answer")
        self.assertEqual(res["output"]["thought_process"], "Deliberation")
        self.assertEqual(res["thought_process"], "Deliberation")


if __name__ == "__main__":
    unittest.main()
