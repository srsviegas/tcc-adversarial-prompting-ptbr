import time
import traceback
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional


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


def build_success_response(
    latency_seconds: float,
    extracted_text: str,
    finish_reason: str = "stop",
    input_tokens: Optional[int] = None,
    output_tokens: Optional[int] = None,
    total_tokens: Optional[int] = None,
    raw_api_payload: Any = None,
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
            "finish_reason": finish_reason,
        },
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
            "finish_reason": "error",
        },
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
