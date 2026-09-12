from typing import Dict, Type

from src.models.base import BaseModelProvider
from src.models.deepseek_r1 import DeepSeekR1Provider
from src.models.gemini import GeminiProvider
from src.models.local_llama import LocalLlamaProvider


class ProviderRegistry:
    """Registry for looking up and instantiating model providers."""

    _PROVIDERS: Dict[str, Type[BaseModelProvider]] = {
        "gemini": GeminiProvider,
        "local": LocalLlamaProvider,
        "llama": LocalLlamaProvider,
        "local_llama": LocalLlamaProvider,
        "deepseek": DeepSeekR1Provider,
        "deepseek_r1": DeepSeekR1Provider,
        "deepseek-r1": DeepSeekR1Provider,
        "deepseek_r1_distill_qwen_14b": DeepSeekR1Provider,
        "deepseek-r1-distill-qwen-14b": DeepSeekR1Provider,
        "r1": DeepSeekR1Provider,
    }

    @classmethod
    def register_provider(cls, name: str, provider_cls: Type[BaseModelProvider]) -> None:
        """Register a new provider implementation dynamically."""
        cls._PROVIDERS[name.lower()] = provider_cls

    @classmethod
    def get_provider(cls, provider_name: str) -> BaseModelProvider:
        """Get an instance of a registered model provider by name."""
        key = provider_name.lower()
        if key not in cls._PROVIDERS:
            supported = ", ".join(sorted(cls._PROVIDERS.keys()))
            raise ValueError(
                f"Unknown model provider: '{provider_name}'. Supported providers: {supported}"
            )
        return cls._PROVIDERS[key]()
