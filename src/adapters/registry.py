from typing import Dict, Type

from src.adapters.base import DatasetAdapter
from src.adapters.pap import PAPAdapter
from src.adapters.pap_internetes import PAPInternetesAdapter
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
from src.adapters.toxicchat_stylized import (
    ToxicChatStylizedAdapter,
    ToxicChatFancyAdapter,
    ToxicChatStylizedFrakturAdapter,
    ToxicChatStylizedBoldScriptAdapter,
    ToxicChatStylizedScriptAdapter,
    ToxicChatStylizedDoubleStruckAdapter,
    ToxicChatStylizedFullwidthAdapter,
    ToxicChatStylizedRegionalIndicatorAdapter,
    ToxicChatStylizedBoldAdapter,
    ToxicChatStylizedSansBoldItalicAdapter,
)


class AdapterRegistry:
    """Registry for looking up and instantiating dataset adapters."""

    _ADAPTERS: Dict[str, Type[DatasetAdapter]] = {
        "pap": PAPAdapter,
        "pap_internetes": PAPInternetesAdapter,
        "pap_pt_internetes": PAPInternetesAdapter,
        "internetes_pap": PAPInternetesAdapter,
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
        "toxicchat_stylized": ToxicChatStylizedAdapter,
        "toxicchat_fancy": ToxicChatFancyAdapter,
        "toxicchat_stylized_fraktur": ToxicChatStylizedFrakturAdapter,
        "toxicchat_stylized_1": ToxicChatStylizedFrakturAdapter,
        "toxicchat_fancy_1": ToxicChatStylizedFrakturAdapter,
        "toxicchat_stylized_bold_script": ToxicChatStylizedBoldScriptAdapter,
        "toxicchat_stylized_2": ToxicChatStylizedBoldScriptAdapter,
        "toxicchat_fancy_2": ToxicChatStylizedBoldScriptAdapter,
        "toxicchat_stylized_script": ToxicChatStylizedScriptAdapter,
        "toxicchat_stylized_3": ToxicChatStylizedScriptAdapter,
        "toxicchat_fancy_3": ToxicChatStylizedScriptAdapter,
        "toxicchat_stylized_double_struck": ToxicChatStylizedDoubleStruckAdapter,
        "toxicchat_stylized_4": ToxicChatStylizedDoubleStruckAdapter,
        "toxicchat_fancy_4": ToxicChatStylizedDoubleStruckAdapter,
        "toxicchat_stylized_fullwidth": ToxicChatStylizedFullwidthAdapter,
        "toxicchat_stylized_5": ToxicChatStylizedFullwidthAdapter,
        "toxicchat_fancy_5": ToxicChatStylizedFullwidthAdapter,
        "toxicchat_stylized_regional_indicator": ToxicChatStylizedRegionalIndicatorAdapter,
        "toxicchat_stylized_6": ToxicChatStylizedRegionalIndicatorAdapter,
        "toxicchat_fancy_6": ToxicChatStylizedRegionalIndicatorAdapter,
        "toxicchat_stylized_bold": ToxicChatStylizedBoldAdapter,
        "toxicchat_stylized_7": ToxicChatStylizedBoldAdapter,
        "toxicchat_fancy_7": ToxicChatStylizedBoldAdapter,
        "toxicchat_stylized_sans_bold_italic": ToxicChatStylizedSansBoldItalicAdapter,
        "toxicchat_stylized_8": ToxicChatStylizedSansBoldItalicAdapter,
        "toxicchat_fancy_8": ToxicChatStylizedSansBoldItalicAdapter,
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
