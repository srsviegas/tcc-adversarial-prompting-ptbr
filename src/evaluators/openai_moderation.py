import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from src.evaluators.base import BaseEvaluator

DEFAULT_MODERATION_MODEL = "omni-moderation-latest"


class OpenAIModerationEvaluator(BaseEvaluator):
    """
    Evaluator that leverages OpenAI's free Moderation API (omni-moderation-latest).
    Preserves all categorization data, confidence scores, and raw response payloads.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = DEFAULT_MODERATION_MODEL,
        max_retries: int = 3,
        base_backoff_sec: float = 2.0,
    ):
        self._api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model
        self.max_retries = max_retries
        self.base_backoff_sec = base_backoff_sec
        self._client = None

    @property
    def name(self) -> str:
        return "openai_moderation"

    def _get_client(self):
        if self._client is None:
            try:
                from openai import OpenAI
            except ImportError as e:
                raise ImportError(
                    "The openai package is required to use OpenAIModerationEvaluator. "
                    "Install it using: pip install openai"
                ) from e

            # If api_key is None, OpenAI() automatically attempts to read OPENAI_API_KEY
            self._client = OpenAI(api_key=self._api_key)
        return self._client

    def evaluate(self, text: str, **kwargs: Any) -> Dict[str, Any]:
        """
        Runs moderation check on the provided text.
        """
        now_utc = datetime.now(timezone.utc).isoformat()

        if not text or not isinstance(text, str) or not text.strip():
            return {
                "evaluator": self.name,
                "model": self.model,
                "evaluated_at": now_utc,
                "latency_seconds": 0.0,
                "status": "skipped",
                "skip_reason": "Empty or non-string response text",
                "flagged": None,
                "flagged_categories": [],
                "highest_scoring_category": None,
                "highest_score": 0.0,
                "categories": {},
                "category_scores": {},
                "category_applied_input_types": {},
                "raw_response": None,
            }

        client = self._get_client()
        start_time = time.time()
        last_exception = None

        for attempt in range(self.max_retries):
            try:
                response = client.moderations.create(
                    model=self.model,
                    input=text,
                )
                latency = time.time() - start_time

                result = response.results[0]
                flagged = bool(result.flagged)

                categories = (
                    result.categories.model_dump()
                    if hasattr(result.categories, "model_dump")
                    else dict(result.categories)
                )

                category_scores = (
                    result.category_scores.model_dump()
                    if hasattr(result.category_scores, "model_dump")
                    else dict(result.category_scores)
                )

                category_applied_types = None
                if hasattr(result, "category_applied_input_types") and result.category_applied_input_types is not None:
                    if hasattr(result.category_applied_input_types, "model_dump"):
                        category_applied_types = result.category_applied_input_types.model_dump()
                    else:
                        category_applied_types = dict(result.category_applied_input_types)

                flagged_categories = [cat for cat, val in categories.items() if val]

                highest_scoring_category = None
                highest_score = 0.0
                if category_scores:
                    highest_scoring_category, highest_score = max(
                        category_scores.items(), key=lambda x: x[1]
                    )

                raw_response = (
                    response.model_dump()
                    if hasattr(response, "model_dump")
                    else {"results": [result.model_dump() if hasattr(result, "model_dump") else str(result)]}
                )

                return {
                    "evaluator": self.name,
                    "model": self.model,
                    "evaluated_at": now_utc,
                    "latency_seconds": round(latency, 3),
                    "status": "success",
                    "flagged": flagged,
                    "flagged_categories": flagged_categories,
                    "highest_scoring_category": highest_scoring_category,
                    "highest_score": round(float(highest_score), 6),
                    "categories": categories,
                    "category_scores": category_scores,
                    "category_applied_input_types": category_applied_types,
                    "raw_response": raw_response,
                }

            except Exception as exc:
                last_exception = exc
                err_str = str(exc).lower()
                # Account-level errors (0 balance, bad key, invalid request) are permanent and should not be retried
                if "invalid_request_error" in err_str or "insufficient_quota" in err_str or "invalid_api_key" in err_str:
                    break
                is_transient = "timeout" in err_str or "connection" in err_str or "503" in err_str or ("429" in err_str and "rate limit" in err_str)
                if attempt < self.max_retries - 1 and is_transient:
                    backoff = self.base_backoff_sec * (2 ** attempt)
                    time.sleep(backoff)
                    continue
                break

        latency = time.time() - start_time
        return {
            "evaluator": self.name,
            "model": self.model,
            "evaluated_at": now_utc,
            "latency_seconds": round(latency, 3),
            "status": "error",
            "error_message": str(last_exception),
            "flagged": None,
            "flagged_categories": [],
            "highest_scoring_category": None,
            "highest_score": 0.0,
            "categories": {},
            "category_scores": {},
            "category_applied_input_types": {},
            "raw_response": None,
        }
