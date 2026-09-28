from typing import Dict, Type

from src.evaluators.base import BaseEvaluator
from src.evaluators.openai_moderation import OpenAIModerationEvaluator
from src.evaluators.aegis_llamaguard import AegisLlamaGuardEvaluator
from src.evaluators.qwen_judge import QwenJudgeEvaluator


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
        "qwen_judge": QwenJudgeEvaluator,
        "qwen-judge": QwenJudgeEvaluator,
        "qwen": QwenJudgeEvaluator,
        "qwen_32b_judge": QwenJudgeEvaluator,
        "qwen-32b-judge": QwenJudgeEvaluator,
        "qwen2.5_judge": QwenJudgeEvaluator,
        "qwen2.5-judge": QwenJudgeEvaluator,
        "llm_judge": QwenJudgeEvaluator,
        "llm-judge": QwenJudgeEvaluator,
        "judge": QwenJudgeEvaluator,
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
