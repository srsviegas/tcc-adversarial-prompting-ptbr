import re
import time
import traceback
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Tuple


def get_field(obj: Any, *keys: str, default: Any = None) -> Any:
    """Utility helper to safely extract values from dynamic objects or dictionaries."""
    if not obj:
        return default
    for key in keys:
        if isinstance(obj, dict) and key in obj:
            return obj[key]
        val = getattr(obj, key, None)
        if val is not None:
            return val
    return default


def extract_thought_process(text: str) -> Tuple[str, Optional[str]]:
    """
    Extracts reasoning content from <think>...</think> tags.
    Returns a tuple of (extracted_text, thought_process).
    - If <think>...</think> is present, the inner content is returned as thought_process
      and removed from extracted_text.
    - If an unclosed <think> tag is present (e.g. truncated generation), the content
      following <think> is returned as thought_process.
    - If no <think> tag is present, thought_process is None.
    """
    if not text:
        return "", None

    pattern = r"<think>(.*?)</think>"
    matches = re.findall(pattern, text, flags=re.DOTALL | re.IGNORECASE)
    if matches:
        thought_process = "\n\n".join(m.strip() for m in matches).strip()
        cleaned_text = re.sub(pattern, "", text, flags=re.DOTALL | re.IGNORECASE).strip()
        return cleaned_text, thought_process

    # Handle unclosed <think> tag (e.g. max output tokens reached during reasoning)
    unclosed_match = re.search(r"<think>(.*)", text, flags=re.DOTALL | re.IGNORECASE)
    if unclosed_match:
        thought_process = unclosed_match.group(1).strip()
        cleaned_text = text[:unclosed_match.start()].strip()
        return cleaned_text, thought_process

    return text.strip(), None


def build_success_response(
    latency_seconds: float,
    extracted_text: str,
    finish_reason: str = "stop",
    input_tokens: Optional[int] = None,
    output_tokens: Optional[int] = None,
    total_tokens: Optional[int] = None,
    raw_api_payload: Any = None,
    thought_process: Optional[str] = None,
) -> Dict[str, Any]:
    """Constructs a standardized success response dictionary."""
    return {
        "execution_metrics": {
            "latency_seconds": round(latency_seconds, 2),
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
        },
        "output": {
            "extracted_text": extracted_text,
            "thought_process": thought_process,
            "finish_reason": finish_reason,
        },
        "thought_process": thought_process,
        "raw_api_payload": raw_api_payload,
        "error_log": {
            "failed": False,
            "error_message": None,
            "traceback": None,
        },
    }


def build_error_response(
    latency_seconds: float,
    error_message: str,
    tb_str: Optional[str] = None,
) -> Dict[str, Any]:
    """Constructs a standardized error response dictionary."""
    return {
        "execution_metrics": {
            "latency_seconds": round(latency_seconds, 2),
            "input_tokens": None,
            "output_tokens": None,
            "total_tokens": None,
        },
        "output": {
            "extracted_text": "",
            "thought_process": None,
            "finish_reason": "error",
        },
        "thought_process": None,
        "raw_api_payload": None,
        "error_log": {
            "failed": True,
            "error_message": error_message,
            "traceback": tb_str,
        },
    }


class BaseModelProvider(ABC):
    """Abstract Base Class for LLM Providers."""

    @abstractmethod
    def generate(
        self,
        model_name: str,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.6,
        top_p: float = 1.0,
        max_output_tokens: int = 8192,
        seed: Optional[int] = None,
        api_key: Optional[str] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Generate response from model."""
        pass
