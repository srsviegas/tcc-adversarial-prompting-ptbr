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

_GEMMA_MODEL_INSTANCE = None
_CURRENT_GEMMA_MODEL_PATH = None

DEFAULT_GEMMA_MODEL_FILENAME = "gemma-4-12B-it-Q4_K_M.gguf"
DEFAULT_GEMMA_MODEL_PATH = f"models/{DEFAULT_GEMMA_MODEL_FILENAME}"

DEFAULT_GEMMA_2_27B_ABLITERATED_MODEL_FILENAME = "gemma-2-27b-it-abliterated.Q5_K_M.gguf"
DEFAULT_GEMMA_2_27B_ABLITERATED_MODEL_PATH = f"models/{DEFAULT_GEMMA_2_27B_ABLITERATED_MODEL_FILENAME}"

GEMMA_ALIASES = {
    "gemma",
    "gemma4",
    "gemma-4",
    "gemma_4",
    "gemma4_12b",
    "gemma4-12b",
    "gemma-4-12b",
    "gemma_4_12b",
    "gemma-12b",
    "gemma_12b",
    "local_gemma",
}

GEMMA_27B_ALIASES = {
    "gemma2",
    "gemma-2",
    "gemma2_27b",
    "gemma-2-27b",
    "gemma_27b",
    "gemma-27b",
    "gemma2_27b_abliterated",
    "gemma-2-27b-abliterated",
    "gemma-2-27b-it-abliterated",
    "gemma2_27b_it_abliterated",
    "gemma_27b_abliterated",
    "gemma-27b-abliterated",
    "gemma_abliterated",
    "gemma-abliterated",
    "abliterated_gemma",
}

# Alternative variations for filename resolution
ALTERNATIVE_GEMMA_FILENAMES = [
    "gemma-4-12B-it-Q4_K_M.gguf",
    "gemma-4-12b-it-Q4_K_M.gguf",
    "gemma-4-12B-Q4_K_M.gguf",
    "gemma-4-12b-Q4_K_M.gguf",
    "gemma-4-12B-it.gguf",
    "gemma-3-12b-it-Q4_K_M.gguf",
    "gemma-2-27b-it-abliterated.Q5_K_M.gguf",
]


def _detect_default_gpu_layers() -> int:
    """
    Auto-detects optimal GPU layers to offload based on available VRAM.
    On RTX 4090 / 24GB+ GPUs, offloads all layers (-1).
    On <=10GB GPUs, defaults to 30 layers to prevent OOM.
    """
    try:
        import torch
        if torch.cuda.is_available():
            vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
            if vram_gb < 12.0:
                return 30
    except Exception:
        pass
    return -1


def resolve_gemma_model_path(model_name: Optional[str] = None) -> str:
    """
    Resolves Gemma model path, checking aliases, raw path, relative path, and ./models directory.
    """
    if model_name and model_name.strip().lower() in GEMMA_27B_ALIASES:
        default_27b_p = Path(DEFAULT_GEMMA_2_27B_ABLITERATED_MODEL_PATH)
        if default_27b_p.is_file():
            return str(default_27b_p.resolve())
        in_models = Path("models") / DEFAULT_GEMMA_2_27B_ABLITERATED_MODEL_FILENAME
        if in_models.is_file():
            return str(in_models.resolve())
        return DEFAULT_GEMMA_2_27B_ABLITERATED_MODEL_PATH

    if not model_name or model_name.strip().lower() in GEMMA_ALIASES:
        default_p = Path(DEFAULT_GEMMA_MODEL_PATH)
        if default_p.is_file():
            return str(default_p.resolve())
        for alt in ALTERNATIVE_GEMMA_FILENAMES:
            alt_p = Path("models") / alt
            if alt_p.is_file():
                return str(alt_p.resolve())
        return DEFAULT_GEMMA_MODEL_PATH

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


def resolve_gemma_27b_model_path(model_name: Optional[str] = None) -> str:
    """
    Resolves Gemma 2 27B-it Abliterated model path specifically.
    """
    if not model_name or model_name.strip().lower() in GEMMA_27B_ALIASES or model_name.strip().lower() in GEMMA_ALIASES:
        default_27b_p = Path(DEFAULT_GEMMA_2_27B_ABLITERATED_MODEL_PATH)
        if default_27b_p.is_file():
            return str(default_27b_p.resolve())
        in_models = Path("models") / DEFAULT_GEMMA_2_27B_ABLITERATED_MODEL_FILENAME
        if in_models.is_file():
            return str(in_models.resolve())
        return DEFAULT_GEMMA_2_27B_ABLITERATED_MODEL_PATH
    return resolve_gemma_model_path(model_name)


def get_or_load_gemma(
    model_path: str,
    n_ctx: int = 8192,
    n_gpu_layers: Optional[int] = None,
    n_batch: int = 512,
    flash_attn: bool = True,
):
    """Loads and caches the Gemma GGUF model in VRAM."""
    global _GEMMA_MODEL_INSTANCE, _CURRENT_GEMMA_MODEL_PATH

    resolved_path = resolve_gemma_model_path(model_path)

    if _GEMMA_MODEL_INSTANCE is None or _CURRENT_GEMMA_MODEL_PATH != resolved_path:
        try:
            from llama_cpp import Llama
        except ImportError as e:
            raise ImportError(
                "llama-cpp-python is required to run local GGUF models. "
                "Please install it using: pip install llama-cpp-python"
            ) from e

        if not os.path.exists(resolved_path):
            raise FileNotFoundError(
                f"Gemma GGUF model file not found at '{model_path}' or resolved path '{resolved_path}'."
            )

        effective_gpu_layers = (
            n_gpu_layers if n_gpu_layers is not None else _detect_default_gpu_layers()
        )

        print(f"[*] Loading Gemma model: {resolved_path} (GPU layers: {effective_gpu_layers}, n_ctx: {n_ctx})")
        _GEMMA_MODEL_INSTANCE = Llama(
            model_path=resolved_path,
            n_gpu_layers=effective_gpu_layers,
            n_ctx=n_ctx,
            n_batch=n_batch,
            flash_attn=flash_attn,
            verbose=False,
        )
        _CURRENT_GEMMA_MODEL_PATH = resolved_path

    return _GEMMA_MODEL_INSTANCE


class Gemma4Provider(BaseModelProvider):
    """
    Provider implementation for Google Gemma 4 (12B) GGUF via llama-cpp-python.
    Optimized for RTX 4090 and high-performance local environments.
    """

    def __init__(
        self,
        n_ctx: int = 8192,
        n_gpu_layers: Optional[int] = None,
        n_batch: int = 512,
        flash_attn: bool = True,
    ):
        self.n_ctx = n_ctx
        self.n_gpu_layers = n_gpu_layers
        self.n_batch = n_batch
        self.flash_attn = flash_attn

    def generate(
        self,
        model_name: str = DEFAULT_GEMMA_MODEL_PATH,
        system_prompt: str = "",
        user_prompt: str = "",
        temperature: float = 0.6,
        top_p: float = 0.95,
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
            n_gpu_layers = kwargs.get("n_gpu_layers", self.n_gpu_layers)
            n_batch = kwargs.get("n_batch", self.n_batch)
            flash_attn = kwargs.get("flash_attn", self.flash_attn)

            resolved_path = resolve_gemma_model_path(model_name)
            llm = get_or_load_gemma(
                model_path=resolved_path,
                n_ctx=n_ctx,
                n_gpu_layers=n_gpu_layers,
                n_batch=n_batch,
                flash_attn=flash_attn,
            )

            messages = []
            if system_prompt and system_prompt.strip():
                # Gemma chat templates do not support the "system" role and raise an error
                # ("System role not supported"). Per Google specifications, prepend system instructions to the user prompt.
                effective_user_prompt = f"{system_prompt.strip()}\n\n{user_prompt}"
                messages.append({"role": "user", "content": effective_user_prompt})
            else:
                messages.append({"role": "user", "content": user_prompt})

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


GemmaProvider = Gemma4Provider


def call_gemma4(
    model_name: str = DEFAULT_GEMMA_MODEL_PATH,
    system_prompt: str = "",
    user_prompt: str = "",
    temperature: float = 0.6,
    top_p: float = 0.95,
    max_output_tokens: int = 8192,
    seed: Optional[int] = None,
    api_key: Optional[str] = None,
    **kwargs: Any,
) -> Dict[str, Any]:
    provider = Gemma4Provider()
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


call_gemma = call_gemma4


class Gemma227BAbliteratedProvider(Gemma4Provider):
    """Provider implementation for gemma-2-27b-it-abliterated.Q5_K_M.gguf via llama-cpp-python."""

    def generate(
        self,
        model_name: str = DEFAULT_GEMMA_2_27B_ABLITERATED_MODEL_PATH,
        system_prompt: str = "",
        user_prompt: str = "",
        temperature: float = 0.6,
        top_p: float = 0.95,
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


Gemma27BProvider = Gemma227BAbliteratedProvider
Gemma27BAbliteratedProvider = Gemma227BAbliteratedProvider
GemmaAbliteratedProvider = Gemma227BAbliteratedProvider


def call_gemma_27b(
    model_name: str = DEFAULT_GEMMA_2_27B_ABLITERATED_MODEL_PATH,
    system_prompt: str = "",
    user_prompt: str = "",
    temperature: float = 0.6,
    top_p: float = 0.95,
    max_output_tokens: int = 8192,
    seed: Optional[int] = None,
    api_key: Optional[str] = None,
    **kwargs: Any,
) -> Dict[str, Any]:
    provider = Gemma227BAbliteratedProvider()
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

