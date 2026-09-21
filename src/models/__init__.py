from typing import Any, Dict, Optional

from src.models.base import BaseModelProvider, extract_thought_process
from src.models.deepseek_r1 import DeepSeekR1Provider, call_deepseek_r1
from src.models.gemini import GeminiProvider, call_gemini
from src.models.gemma import Gemma4Provider, GemmaProvider, call_gemma4, call_gemma
from src.models.local_llama import LocalLlamaProvider, call_local_llama
from src.models.qwen import (
    Qwen3Provider,
    QwenProvider,
    Qwen25Coder32BAbliteratedProvider,
    QwenCoderProvider,
    QwenCoderAbliteratedProvider,
    call_qwen3,
    call_qwen,
    call_qwen_coder,
)
from src.models.registry import ProviderRegistry


def generate_response(
    model_provider: str,
    api_key: Optional[str],
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.6,
    top_p: float = 1.0,
    max_output_tokens: int = 8192,
    seed: Optional[int] = None,
    **kwargs: Any,
) -> Dict[str, Any]:
    """
    Unified entrypoint to generate responses using registered model providers.
    """
    provider = ProviderRegistry.get_provider(model_provider)
    return provider.generate(
        model_name=model_name,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=temperature,
        top_p=top_p,
        max_output_tokens=max_output_tokens,
        seed=seed,
        api_key=api_key,
        **kwargs,
    )


__all__ = [
    "BaseModelProvider",
    "DeepSeekR1Provider",
    "GeminiProvider",
    "Gemma4Provider",
    "GemmaProvider",
    "LocalLlamaProvider",
    "ProviderRegistry",
    "Qwen3Provider",
    "QwenProvider",
    "Qwen25Coder32BAbliteratedProvider",
    "QwenCoderProvider",
    "QwenCoderAbliteratedProvider",
    "call_deepseek_r1",
    "call_gemini",
    "call_gemma",
    "call_gemma4",
    "call_local_llama",
    "call_qwen",
    "call_qwen3",
    "call_qwen_coder",
    "extract_thought_process",
    "generate_response",
]
