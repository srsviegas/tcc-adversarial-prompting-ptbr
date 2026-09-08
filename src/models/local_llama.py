import os
import time
import traceback
from pathlib import Path
from typing import Any, Dict, Optional

from src.models.base import (
    BaseModelProvider,
    build_error_response,
    build_success_response,
)

_LOCAL_MODEL_INSTANCE = None
_CURRENT_LOADED_MODEL_PATH = None


def resolve_model_path(model_name: str) -> str:
    """Resolves local model path, checking raw path, relative path, and ./models directory."""
    path_obj = Path(model_name)
    if path_obj.is_file():
        return str(path_obj.resolve())

    models_dir_path = Path("models") / model_name
    if models_dir_path.is_file():
        return str(models_dir_path.resolve())

    models_dir_basename = Path("models") / path_obj.name
    if models_dir_basename.is_file():
        return str(models_dir_basename.resolve())

    return model_name


def _get_or_load_llama(model_path: str, n_ctx: int = 8192):
    """Loads and caches the GGUF model in VRAM."""
    global _LOCAL_MODEL_INSTANCE, _CURRENT_LOADED_MODEL_PATH

    resolved_path = resolve_model_path(model_path)

    if _LOCAL_MODEL_INSTANCE is None or _CURRENT_LOADED_MODEL_PATH != resolved_path:
        try:
            from llama_cpp import Llama
        except ImportError as e:
            raise ImportError(
                "llama-cpp-python is required to run local GGUF models. "
                "Please install it using: pip install llama-cpp-python"
            ) from e

        if not os.path.exists(resolved_path):
            raise FileNotFoundError(
                f"Local GGUF model file not found at '{model_path}' or resolved path '{resolved_path}'."
            )

        print(f"[*] Loading local model into VRAM: {resolved_path}")
        _LOCAL_MODEL_INSTANCE = Llama(
            model_path=resolved_path,
            n_gpu_layers=-1,      # Descarrega todas as 33 camadas na GPU
            n_ctx=n_ctx,          # Janela de contexto ampliada para 8192
            flash_attn=True,      # Otimização suportada pela arquitetura Ada Lovelace (RTX 4090)
            verbose=False,
        )
        _CURRENT_LOADED_MODEL_PATH = resolved_path

    return _LOCAL_MODEL_INSTANCE


class LocalLlamaProvider(BaseModelProvider):
    """Provider implementation for local GGUF models via llama-cpp-python."""

    def __init__(self, n_ctx: int = 4096):
        self.n_ctx = n_ctx

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

        start_time = time.time()
        try:
            n_ctx = kwargs.get("n_ctx", self.n_ctx)
            llm = _get_or_load_llama(model_name, n_ctx=n_ctx)

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ]

            response = llm.create_chat_completion(
                messages=messages,
                temperature=temperature,
                top_p=top_p,
                max_tokens=max_output_tokens,
                seed=seed if seed is not None else -1,
            )

            latency = time.time() - start_time

            choice = response["choices"][0]
            extracted_text = choice["message"]["content"] or ""
            finish_reason = choice.get("finish_reason", "stop")
            usage = response.get("usage", {})

            return build_success_response(
                latency_seconds=latency,
                extracted_text=extracted_text,
                finish_reason=finish_reason,
                input_tokens=usage.get("prompt_tokens"),
                output_tokens=usage.get("completion_tokens"),
                total_tokens=usage.get("total_tokens"),
                raw_api_payload=response,
            )

        except Exception as e:
            latency = time.time() - start_time
            return build_error_response(
                latency_seconds=latency,
                error_message=str(e),
                tb_str=traceback.format_exc(),
            )


def call_local_llama(
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
    provider = LocalLlamaProvider()
    return provider.generate(
        model_name=model_name,
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=temperature,
        top_p=top_p,
        max_output_tokens=max_output_tokens,
        seed=seed,
        api_key=api_key,
        **kwargs,
    )
