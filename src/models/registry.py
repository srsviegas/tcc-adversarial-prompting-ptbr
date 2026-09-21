from typing import Dict, Type

from src.models.base import BaseModelProvider
from src.models.deepseek_r1 import DeepSeekR1Provider
from src.models.gemini import GeminiProvider
from src.models.local_llama import (
    LocalLlamaProvider,
    Llama3370BAbliteratedProvider,
)
from src.models.qwen import (
    Qwen3Provider,
    Qwen25Coder32BAbliteratedProvider,
)
from src.models.gemma import (
    Gemma4Provider,
    Gemma227BAbliteratedProvider,
)


class ProviderRegistry:
    """Registry for looking up and instantiating model providers."""

    _PROVIDERS: Dict[str, Type[BaseModelProvider]] = {
        "gemini": GeminiProvider,
        "local": LocalLlamaProvider,
        "llama": LocalLlamaProvider,
        "local_llama": LocalLlamaProvider,
        "llama3.3": Llama3370BAbliteratedProvider,
        "llama-3.3": Llama3370BAbliteratedProvider,
        "llama3.3_70b": Llama3370BAbliteratedProvider,
        "llama-3.3-70b": Llama3370BAbliteratedProvider,
        "llama_70b": Llama3370BAbliteratedProvider,
        "llama-70b": Llama3370BAbliteratedProvider,
        "llama3.3_70b_abliterated": Llama3370BAbliteratedProvider,
        "llama-3.3-70b-abliterated": Llama3370BAbliteratedProvider,
        "llama3.3_70b_instruct_abliterated": Llama3370BAbliteratedProvider,
        "llama-3.3-70b-instruct-abliterated": Llama3370BAbliteratedProvider,
        "llama_70b_abliterated": Llama3370BAbliteratedProvider,
        "llama-70b-abliterated": Llama3370BAbliteratedProvider,
        "llama3_3_70b_abliterated": Llama3370BAbliteratedProvider,
        "llama_abliterated": Llama3370BAbliteratedProvider,
        "llama-abliterated": Llama3370BAbliteratedProvider,
        "abliterated_llama": Llama3370BAbliteratedProvider,
        "deepseek": DeepSeekR1Provider,
        "deepseek_r1": DeepSeekR1Provider,
        "deepseek-r1": DeepSeekR1Provider,
        "deepseek_r1_distill_qwen_14b": DeepSeekR1Provider,
        "deepseek-r1-distill-qwen-14b": DeepSeekR1Provider,
        "r1": DeepSeekR1Provider,
        "qwen": Qwen3Provider,
        "qwen3": Qwen3Provider,
        "qwen-3": Qwen3Provider,
        "qwen_3": Qwen3Provider,
        "qwen3_14b": Qwen3Provider,
        "qwen3-14b": Qwen3Provider,
        "qwen_14b": Qwen3Provider,
        "qwen-14b": Qwen3Provider,
        "local_qwen": Qwen3Provider,
        "qwen_coder": Qwen25Coder32BAbliteratedProvider,
        "qwen-coder": Qwen25Coder32BAbliteratedProvider,
        "qwen_coder_32b": Qwen25Coder32BAbliteratedProvider,
        "qwen-coder-32b": Qwen25Coder32BAbliteratedProvider,
        "qwen2.5_coder": Qwen25Coder32BAbliteratedProvider,
        "qwen2.5-coder": Qwen25Coder32BAbliteratedProvider,
        "qwen2.5_coder_32b": Qwen25Coder32BAbliteratedProvider,
        "qwen2.5-coder-32b": Qwen25Coder32BAbliteratedProvider,
        "qwen2.5_coder_32b_abliterated": Qwen25Coder32BAbliteratedProvider,
        "qwen2.5-coder-32b-abliterated": Qwen25Coder32BAbliteratedProvider,
        "qwen2.5_coder_32b_instruct_abliterated": Qwen25Coder32BAbliteratedProvider,
        "qwen2.5-coder-32b-instruct-abliterated": Qwen25Coder32BAbliteratedProvider,
        "qwen_coder_32b_abliterated": Qwen25Coder32BAbliteratedProvider,
        "qwen_coder_abliterated": Qwen25Coder32BAbliteratedProvider,
        "qwen_abliterated": Qwen25Coder32BAbliteratedProvider,
        "qwen-abliterated": Qwen25Coder32BAbliteratedProvider,
        "abliterated_coder": Qwen25Coder32BAbliteratedProvider,
        "gemma": Gemma4Provider,
        "gemma4": Gemma4Provider,
        "gemma-4": Gemma4Provider,
        "gemma_4": Gemma4Provider,
        "gemma4_12b": Gemma4Provider,
        "gemma4-12b": Gemma4Provider,
        "gemma-4-12b": Gemma4Provider,
        "gemma_4_12b": Gemma4Provider,
        "gemma-12b": Gemma4Provider,
        "gemma_12b": Gemma4Provider,
        "local_gemma": Gemma4Provider,
        "gemma2": Gemma227BAbliteratedProvider,
        "gemma-2": Gemma227BAbliteratedProvider,
        "gemma2_27b": Gemma227BAbliteratedProvider,
        "gemma-2-27b": Gemma227BAbliteratedProvider,
        "gemma_27b": Gemma227BAbliteratedProvider,
        "gemma-27b": Gemma227BAbliteratedProvider,
        "gemma2_27b_abliterated": Gemma227BAbliteratedProvider,
        "gemma-2-27b-abliterated": Gemma227BAbliteratedProvider,
        "gemma-2-27b-it-abliterated": Gemma227BAbliteratedProvider,
        "gemma2_27b_it_abliterated": Gemma227BAbliteratedProvider,
        "gemma_27b_abliterated": Gemma227BAbliteratedProvider,
        "gemma-27b-abliterated": Gemma227BAbliteratedProvider,
        "gemma_abliterated": Gemma227BAbliteratedProvider,
        "gemma-abliterated": Gemma227BAbliteratedProvider,
        "abliterated_gemma": Gemma227BAbliteratedProvider,
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
