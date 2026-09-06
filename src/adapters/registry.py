from typing import Dict, Type

from src.adapters.base import DatasetAdapter
from src.adapters.pap import PAPAdapter
from src.adapters.toxicchat import ToxicChatPlainAdapter


class AdapterRegistry:
    """Registry for looking up and instantiating dataset adapters."""

    _ADAPTERS: Dict[str, Type[DatasetAdapter]] = {
        "pap": PAPAdapter,
        "toxicchat": ToxicChatPlainAdapter,
        "toxicchat_plain": ToxicChatPlainAdapter,
    }

    @classmethod
    def register_adapter(cls, name: str, adapter_cls: Type[DatasetAdapter]) -> None:
        """Register a new adapter dynamically."""
        cls._ADAPTERS[name.lower().strip()] = adapter_cls

    @classmethod
    def get_adapter(cls, dataset_type: str) -> DatasetAdapter:
        """Get an instance of a registered dataset adapter by name."""
        key = dataset_type.lower().strip()
        if key not in cls._ADAPTERS:
            supported = ", ".join(sorted(cls._ADAPTERS.keys()))
            raise ValueError(
                f"Unknown dataset type: '{dataset_type}'. Supported dataset types: {supported}"
            )
        return cls._ADAPTERS[key]()


def get_adapter(dataset_type: str) -> DatasetAdapter:
    """Convenience factory function matching legacy get_adapter."""
    return AdapterRegistry.get_adapter(dataset_type)
