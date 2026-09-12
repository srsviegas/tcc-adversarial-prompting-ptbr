from typing import Dict, Type

from src.adapters.base import DatasetAdapter
from src.adapters.pap import PAPAdapter
from src.adapters.toxicchat import ToxicChatPlainAdapter
from src.adapters.toxicchat_cipher import (
    ToxicChatCipherAdapter,
    ToxicChatObfuscationAdapter,
    ToxicChatBase64Adapter,
    ToxicChatRot13Adapter,
    ToxicChatHexAdapter,
    ToxicChatLeetspeakAdapter,
    ToxicChatCaesarAdapter,
    ToxicChatCesarAdapter,
)
from src.adapters.toxicchat_prefix import (
    ToxicChatPrefixAdapter,
    ToxicChatForcedAffirmationAdapter,
    ToxicChatTargetedPrefixAdapter,
)
from src.adapters.toxicchat_gcg import (
    ToxicChatGCGAdapter,
    ToxicChatUniversalSuffixAdapter,
)
from src.adapters.emoji import EmojiAdapter


class AdapterRegistry:
    """Registry for looking up and instantiating dataset adapters."""

    _ADAPTERS: Dict[str, Type[DatasetAdapter]] = {
        "pap": PAPAdapter,
        "toxicchat": ToxicChatPlainAdapter,
        "toxicchat_plain": ToxicChatPlainAdapter,
        "toxicchat_cipher": ToxicChatCipherAdapter,
        "toxicchat_obfuscation": ToxicChatObfuscationAdapter,
        "toxicchat_base64": ToxicChatBase64Adapter,
        "toxicchat_rot13": ToxicChatRot13Adapter,
        "toxicchat_hex": ToxicChatHexAdapter,
        "toxicchat_leetspeak": ToxicChatLeetspeakAdapter,
        "toxicchat_caesar": ToxicChatCaesarAdapter,
        "toxicchat_cesar": ToxicChatCesarAdapter,
        "toxicchat_prefix": ToxicChatPrefixAdapter,
        "toxicchat_prefix_injection": ToxicChatPrefixAdapter,
        "toxicchat_forced_affirmation": ToxicChatForcedAffirmationAdapter,
        "toxicchat_targeted_prefix": ToxicChatTargetedPrefixAdapter,
        "toxicchat_gcg": ToxicChatGCGAdapter,
        "toxicchat_universal_suffix": ToxicChatUniversalSuffixAdapter,
        "emoji": EmojiAdapter,
        "emoji_attack": EmojiAdapter,
        "emoji_pt": EmojiAdapter,
    }

    @classmethod
    def register_adapter(cls, name: str, adapter_cls: Type[DatasetAdapter]) -> None:
        """Register a new adapter dynamically."""
        cls._ADAPTERS[name.lower().strip()] = adapter_cls

    @classmethod
    def get_adapter(cls, dataset_type: str, **kwargs) -> DatasetAdapter:
        """Get an instance of a registered dataset adapter by name."""
        key = dataset_type.lower().strip()
        if key not in cls._ADAPTERS:
            supported = ", ".join(sorted(cls._ADAPTERS.keys()))
            raise ValueError(
                f"Unknown dataset type: '{dataset_type}'. Supported dataset types: {supported}"
            )
        return cls._ADAPTERS[key](**kwargs)


def get_adapter(dataset_type: str, **kwargs) -> DatasetAdapter:
    """Convenience factory function matching legacy get_adapter."""
    return AdapterRegistry.get_adapter(dataset_type, **kwargs)
