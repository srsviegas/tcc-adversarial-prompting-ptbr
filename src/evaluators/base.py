from abc import ABC, abstractmethod
from typing import Any, Dict


class BaseEvaluator(ABC):
    """Abstract base class for model response evaluators."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique identifier name for this evaluator."""
        pass

    @abstractmethod
    def evaluate(self, text: str, **kwargs: Any) -> Dict[str, Any]:
        """
        Evaluates the provided response text.
        Returns a dictionary containing standardized evaluation metadata
        and raw evaluator outputs.
        """
        pass
