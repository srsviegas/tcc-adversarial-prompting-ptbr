import time
import traceback
from google import genai
from google.genai import types

def _get_field(obj, *keys, default=None):
    if not obj:
        return default
    for key in keys:
        if isinstance(obj, dict) and key in obj:
            return obj[key]
        val = getattr(obj, key, None)
        if val is not None:
            return val
    return default


def call_gemini(api_key: str, model_name: str, system_prompt: str, user_prompt: str, temperature: float, top_p: float, max_output_tokens: int, seed: int):
    if not isinstance(user_prompt, str) or not user_prompt.strip():
        return {
            "execution_metrics": {
                "latency_seconds": 0.0,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0
            },
            "output": {"extracted_text": "", "finish_reason": "error"},
            "raw_api_payload": None,
            "error_log": {
                "failed": True,
                "error_message": "User prompt is empty or not a valid string.",
                "traceback": None
            }
        }

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
        seed=seed
    )
    
    start_time = time.time()
    try:
        response = client.models.generate_content(
            model=model_name,
            contents=user_prompt,
            config=config
        )
        
        latency = time.time() - start_time
        
        candidates = _get_field(response, "candidates")
        candidate = candidates[0] if candidates else None
        reason = _get_field(candidate, "finishReason", "finish_reason")
        finish_reason = str(getattr(reason, "name", reason)) if reason else "stop"

        usage = _get_field(response, "usageMetadata", "usage_metadata")
        extracted_text = _get_field(response, "text", default="") or ""

        return {
            "execution_metrics": {
                "latency_seconds": round(latency, 2),
                "input_tokens": _get_field(usage, "promptTokenCount", "prompt_token_count"),
                "output_tokens": _get_field(usage, "candidatesTokenCount", "candidates_token_count"),
                "total_tokens": _get_field(usage, "totalTokenCount", "total_token_count")
            },
            "output": {
                "extracted_text": extracted_text,
                "finish_reason": finish_reason
            },
            "raw_api_payload": response.model_dump(mode="json") if hasattr(response, 'model_dump') else response, 
            "error_log": {"failed": False, "error_message": None, "traceback": None}
        }
        
    except Exception as e:
        latency = time.time() - start_time
        return {
            "execution_metrics": {
                "latency_seconds": round(latency, 2),
                "input_tokens": None,
                "output_tokens": None,
                "total_tokens": None
            },
            "output": {"extracted_text": "", "finish_reason": "error"},
            "raw_api_payload": None,
            "error_log": {
                "failed": True,
                "error_message": str(e),
                "traceback": traceback.format_exc()
            }
        }


def call_local_llama(model_name: str, system_prompt: str, user_prompt: str, temperature: float):
    pass


def generate_response(model_provider: str, api_key: str, model_name: str, system_prompt: str, user_prompt: str, temperature: float, top_p: float, max_output_tokens: int, seed: int):
    if model_provider == "gemini":
        return call_gemini(api_key, model_name, system_prompt, user_prompt, temperature, top_p, max_output_tokens, seed)
    elif model_provider == "local":
        return call_local_llama(model_name, system_prompt, user_prompt, temperature, top_p, max_output_tokens, seed)
    else:
        raise ValueError(f"Unknown provider: {model_provider}")