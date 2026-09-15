from typing import Dict, Type

from src.evaluators.base import BaseEvaluator
from src.evaluators.openai_moderation import OpenAIModerationEvaluator
from src.evaluators.aegis_llamaguard import AegisLlamaGuardEvaluator


class EvaluatorRegistry:
    """Registry for looking up and instantiating response evaluators."""

    _EVALUATORS: Dict[str, Type[BaseEvaluator]] = {
        "openai": OpenAIModerationEvaluator,
        "openai_moderation": OpenAIModerationEvaluator,
        "moderation": OpenAIModerationEvaluator,
        "omni_moderation": OpenAIModerationEvaluator,
        "aegis": AegisLlamaGuardEvaluator,
        "aegis_llamaguard": AegisLlamaGuardEvaluator,
        "aegis-llamaguard": AegisLlamaGuardEvaluator,
        "llamaguard": AegisLlamaGuardEvaluator,
        "llama_guard": AegisLlamaGuardEvaluator,
        "aegis_defensive": AegisLlamaGuardEvaluator,
        "aegis-defensive": AegisLlamaGuardEvaluator,
    }

    @classmethod
    def register(cls, name: str, evaluator_cls: Type[BaseEvaluator]) -> None:
        cls._EVALUATORS[name.lower()] = evaluator_cls

    @classmethod
    def get_evaluator(cls, name: str, **kwargs) -> BaseEvaluator:
        key = name.lower()
        if key not in cls._EVALUATORS:
            supported = ", ".join(sorted(cls._EVALUATORS.keys()))
            raise ValueError(f"Unknown evaluator: '{name}'. Supported evaluators: {supported}")
        return cls._EVALUATORS[key](**kwargs)
