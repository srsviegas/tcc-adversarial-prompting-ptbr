from typing import Any, Dict, Optional

from src.models.base import BaseModelProvider
from src.models.gemini import GeminiProvider, call_gemini
from src.models.local_llama import LocalLlamaProvider, call_local_llama
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
    "GeminiProvider",
    "LocalLlamaProvider",
    "ProviderRegistry",
    "call_gemini",
    "call_local_llama",
    "generate_response",
]
