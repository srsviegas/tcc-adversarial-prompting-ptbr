import os
import time
import traceback
from pathlib import Path
from typing import Any, Dict, Optional

from src.models.base import (
    BaseModelProvider,
    build_error_response,
    build_success_response,
    extract_thought_process,
)

_LOCAL_MODEL_INSTANCE = None
_CURRENT_LOADED_MODEL_PATH = None

DEFAULT_LLAMA_MODEL_FILENAME = "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf"
DEFAULT_LLAMA_MODEL_PATH = f"models/{DEFAULT_LLAMA_MODEL_FILENAME}"

DEFAULT_LLAMA_3_3_70B_ABLITERATED_MODEL_FILENAME = "Llama-3.3-70B-Instruct-abliterated-Q4_K_M.gguf"
DEFAULT_LLAMA_3_3_70B_ABLITERATED_MODEL_PATH = f"models/{DEFAULT_LLAMA_3_3_70B_ABLITERATED_MODEL_FILENAME}"

LLAMA_ALIASES = {
    "local",
    "llama",
    "local_llama",
    "llama3",
    "llama-3",
    "llama3.1",
    "llama-3.1",
    "llama3_8b",
    "llama-3.1-8b",
}

LLAMA_70B_ALIASES = {
    "llama3.3",
    "llama-3.3",
    "llama3.3_70b",
    "llama-3.3-70b",
    "llama_70b",
    "llama-70b",
    "llama3.3_70b_abliterated",
    "llama-3.3-70b-abliterated",
    "llama3.3_70b_instruct_abliterated",
    "llama-3.3-70b-instruct-abliterated",
    "llama_70b_abliterated",
    "llama-70b-abliterated",
    "llama3_3_70b_abliterated",
    "llama_abliterated",
    "llama-abliterated",
    "abliterated_llama",
}

ALTERNATIVE_LLAMA_FILENAMES = [
    "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf",
    "Meta-Llama-3-8B-Instruct-Q4_K_M.gguf",
    "Llama-3.3-70B-Instruct-abliterated-Q4_K_M.gguf",
    "Llama-3.3-70B-Instruct-Q4_K_M.gguf",
]


def _detect_llama_gpu_layers() -> int:
    """Auto-detects GPU offload layers for Llama models."""
    try:
        import torch
        if torch.cuda.is_available():
            vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
            if vram_gb < 12.0:
                return 33
    except Exception:
        pass
    return -1


def resolve_model_path(model_name: Optional[str] = None) -> str:
    """Resolves local model path, checking raw path, relative path, and ./models directory."""
    if model_name and model_name.strip().lower() in LLAMA_70B_ALIASES:
        default_70b_p = Path(DEFAULT_LLAMA_3_3_70B_ABLITERATED_MODEL_PATH)
        if default_70b_p.is_file():
            return str(default_70b_p.resolve())
        in_models = Path("models") / DEFAULT_LLAMA_3_3_70B_ABLITERATED_MODEL_FILENAME
        if in_models.is_file():
            return str(in_models.resolve())
        return DEFAULT_LLAMA_3_3_70B_ABLITERATED_MODEL_PATH

    if not model_name or model_name.strip().lower() in LLAMA_ALIASES:
        default_8b_p = Path(DEFAULT_LLAMA_MODEL_PATH)
        if default_8b_p.is_file():
            return str(default_8b_p.resolve())
        for alt in ALTERNATIVE_LLAMA_FILENAMES:
            alt_p = Path("models") / alt
            if alt_p.is_file():
                return str(alt_p.resolve())
        return DEFAULT_LLAMA_MODEL_PATH

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


def resolve_llama_70b_model_path(model_name: Optional[str] = None) -> str:
    """Resolves Llama 3.3 70B Abliterated model path specifically."""
    if not model_name or model_name.strip().lower() in LLAMA_70B_ALIASES or model_name.strip().lower() in LLAMA_ALIASES:
        default_70b_p = Path(DEFAULT_LLAMA_3_3_70B_ABLITERATED_MODEL_PATH)
        if default_70b_p.is_file():
            return str(default_70b_p.resolve())
        in_models = Path("models") / DEFAULT_LLAMA_3_3_70B_ABLITERATED_MODEL_FILENAME
        if in_models.is_file():
            return str(in_models.resolve())
        return DEFAULT_LLAMA_3_3_70B_ABLITERATED_MODEL_PATH
    return resolve_model_path(model_name)


def _get_or_load_llama(
    model_path: str,
    n_ctx: int = 8192,
    n_gpu_layers: Optional[int] = None,
    flash_attn: bool = True,
):
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

        effective_layers = n_gpu_layers if n_gpu_layers is not None else _detect_llama_gpu_layers()
        print(f"[*] Loading local model into VRAM: {resolved_path} (GPU layers: {effective_layers}, n_ctx: {n_ctx})")
        _LOCAL_MODEL_INSTANCE = Llama(
            model_path=resolved_path,
            n_gpu_layers=effective_layers,
            n_ctx=n_ctx,
            flash_attn=flash_attn,
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
            n_gpu_layers = kwargs.get("n_gpu_layers", None)
            flash_attn = kwargs.get("flash_attn", True)
            llm = _get_or_load_llama(model_name, n_ctx=n_ctx, n_gpu_layers=n_gpu_layers, flash_attn=flash_attn)

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
            raw_content = choice["message"]["content"] or ""
            finish_reason = choice.get("finish_reason", "stop")
            usage = response.get("usage", {})

            extracted_text, thought_process = extract_thought_process(raw_content)

            return build_success_response(
                latency_seconds=latency,
                extracted_text=extracted_text,
                finish_reason=finish_reason,
                input_tokens=usage.get("prompt_tokens"),
                output_tokens=usage.get("completion_tokens"),
                total_tokens=usage.get("total_tokens"),
                raw_api_payload=response,
                thought_process=thought_process,
            )

        except Exception as e:
            latency = time.time() - start_time
            return build_error_response(
                latency_seconds=latency,
                error_message=str(e),
                tb_str=traceback.format_exc(),
            )


def call_local_llama(
    model_name: str = DEFAULT_LLAMA_MODEL_PATH,
    system_prompt: str = "",
    user_prompt: str = "",
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


class Llama3370BAbliteratedProvider(LocalLlamaProvider):
    """Provider implementation for Llama-3.3-70B-Instruct-abliterated-Q4_K_M.gguf via llama-cpp-python."""

    def generate(
        self,
        model_name: str = DEFAULT_LLAMA_3_3_70B_ABLITERATED_MODEL_PATH,
        system_prompt: str = "",
        user_prompt: str = "",
        temperature: float = 0.6,
        top_p: float = 1.0,
        max_output_tokens: int = 8192,
        seed: Optional[int] = None,
        api_key: Optional[str] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        return super().generate(
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


Llama70BProvider = Llama3370BAbliteratedProvider
Llama70BAbliteratedProvider = Llama3370BAbliteratedProvider
LlamaAbliteratedProvider = Llama3370BAbliteratedProvider


def call_llama_70b(
    model_name: str = DEFAULT_LLAMA_3_3_70B_ABLITERATED_MODEL_PATH,
    system_prompt: str = "",
    user_prompt: str = "",
    temperature: float = 0.6,
    top_p: float = 1.0,
    max_output_tokens: int = 8192,
    seed: Optional[int] = None,
    api_key: Optional[str] = None,
    **kwargs: Any,
) -> Dict[str, Any]:
    provider = Llama3370BAbliteratedProvider()
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

