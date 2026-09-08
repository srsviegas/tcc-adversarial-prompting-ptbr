import time
import traceback
from typing import Any, Dict, Optional

from google import genai
from google.genai import types

from src.models.base import (
    BaseModelProvider,
    build_error_response,
    build_success_response,
    get_field,
)


class GeminiProvider(BaseModelProvider):
    """Provider implementation for Google Gemini API."""

    def generate(
        self,
        model_name: str,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.6,
        top_p: float = 1.0,
        max_output_tokens: int = 8192,
        seed: Optional[int] = None,
        api_key: Optional[str] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        if not isinstance(user_prompt, str) or not user_prompt.strip():
            return build_error_response(
                latency_seconds=0.0,
                error_message="User prompt is empty or not a valid string.",
            )

        client = genai.Client(api_key=api_key)

        safety_settings = [
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                threshold=types.HarmBlockThreshold.BLOCK_NONE,
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                threshold=types.HarmBlockThreshold.BLOCK_NONE,
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                threshold=types.HarmBlockThreshold.BLOCK_NONE,
            ),
            types.SafetySetting(
                category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold=types.HarmBlockThreshold.BLOCK_NONE,
            ),
        ]

        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=temperature,
            top_p=top_p,
            max_output_tokens=max_output_tokens,
            safety_settings=safety_settings,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
            seed=seed,
        )

        start_time = time.time()
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=user_prompt,
                config=config,
            )

            latency = time.time() - start_time

            candidates = get_field(response, "candidates")
            candidate = candidates[0] if candidates else None
            reason = get_field(candidate, "finishReason", "finish_reason")
            finish_reason = str(getattr(reason, "name", reason)) if reason else "stop"

            usage = get_field(response, "usageMetadata", "usage_metadata")
            extracted_text = get_field(response, "text", default="") or ""

            raw_payload = (
                response.model_dump(mode="json")
                if hasattr(response, "model_dump")
                else response
            )

            return build_success_response(
                latency_seconds=latency,
                extracted_text=extracted_text,
                finish_reason=finish_reason,
                input_tokens=get_field(usage, "promptTokenCount", "prompt_token_count"),
                output_tokens=get_field(usage, "candidatesTokenCount", "candidates_token_count"),
                total_tokens=get_field(usage, "totalTokenCount", "total_token_count"),
                raw_api_payload=raw_payload,
            )

        except Exception as e:
            latency = time.time() - start_time
            return build_error_response(
                latency_seconds=latency,
                error_message=str(e),
                tb_str=traceback.format_exc(),
            )


def call_gemini(
    api_key: str,
    model_name: str,
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.6,
    top_p: float = 1.0,
    max_output_tokens: int = 8192,
    seed: Optional[int] = None,
) -> Dict[str, Any]:
    """Legacy helper function for invoking Gemini model."""
    provider = GeminiProvider()
    return provider.generate(
        model_name=model_name,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=temperature,
        top_p=top_p,
        max_output_tokens=max_output_tokens,
        seed=seed,
        api_key=api_key,
    )
