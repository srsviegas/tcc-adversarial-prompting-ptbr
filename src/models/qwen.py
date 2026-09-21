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

_QWEN_MODEL_INSTANCE = None
_CURRENT_QWEN_MODEL_PATH = None

DEFAULT_QWEN_MODEL_FILENAME = "Qwen3-14B-Q4_K_M.gguf"
DEFAULT_QWEN_MODEL_PATH = f"models/{DEFAULT_QWEN_MODEL_FILENAME}"

DEFAULT_QWEN_CODER_32B_ABLITERATED_MODEL_FILENAME = "Qwen2.5-Coder-32B-Instruct-abliterated-Q4_K_M.gguf"
DEFAULT_QWEN_CODER_32B_ABLITERATED_MODEL_PATH = f"models/{DEFAULT_QWEN_CODER_32B_ABLITERATED_MODEL_FILENAME}"

QWEN_ALIASES = {
    "qwen",
    "qwen3",
    "qwen-3",
    "qwen_3",
    "qwen3_14b",
    "qwen3-14b",
    "qwen_14b",
    "qwen-14b",
    "local_qwen",
}

QWEN_CODER_ALIASES = {
    "qwen_coder",
    "qwen-coder",
    "qwen_coder_32b",
    "qwen-coder-32b",
    "qwen2.5_coder",
    "qwen2.5-coder",
    "qwen2.5_coder_32b",
    "qwen2.5-coder-32b",
    "qwen2.5_coder_32b_abliterated",
    "qwen2.5-coder-32b-instruct-abliterated",
    "qwen2.5_coder_32b_instruct_abliterated",
    "qwen_coder_32b_abliterated",
    "qwen_coder_abliterated",
    "qwen_abliterated",
    "qwen-abliterated",
    "abliterated_coder",
}

# Supported alternative filenames if user downloaded Instruct or alternative naming
ALTERNATIVE_QWEN_FILENAMES = [
    "Qwen3-14B-Q4_K_M.gguf",
    "Qwen3-14B-Instruct-Q4_K_M.gguf",
    "Qwen2.5-14B-Instruct-Q4_K_M.gguf",
    "Qwen2.5-Coder-32B-Instruct-abliterated-Q4_K_M.gguf",
]


def _detect_default_gpu_layers() -> int:
    """
    Auto-detects optimal GPU layers to offload based on available VRAM.
    On RTX 4090 / 24GB+ GPUs, offloads all layers (-1).
    On <=10GB GPUs, defaults to 35 layers to prevent OOM.
    """
    try:
        import torch
        if torch.cuda.is_available():
            vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
            if vram_gb < 12.0:
                return 35
    except Exception:
        pass
    return -1


def resolve_qwen_model_path(model_name: Optional[str] = None) -> str:
    """
    Resolves Qwen model path, checking aliases, raw path, relative path, and ./models directory.
    """
    if model_name and model_name.strip().lower() in QWEN_CODER_ALIASES:
        default_coder_p = Path(DEFAULT_QWEN_CODER_32B_ABLITERATED_MODEL_PATH)
        if default_coder_p.is_file():
            return str(default_coder_p.resolve())
        coder_in_models = Path("models") / DEFAULT_QWEN_CODER_32B_ABLITERATED_MODEL_FILENAME
        if coder_in_models.is_file():
            return str(coder_in_models.resolve())
        return DEFAULT_QWEN_CODER_32B_ABLITERATED_MODEL_PATH

    if not model_name or model_name.strip().lower() in QWEN_ALIASES:
        # Check standard default file first
        default_p = Path(DEFAULT_QWEN_MODEL_PATH)
        if default_p.is_file():
            return str(default_p.resolve())
        # Check if alternative filename exists in models/
        for alt in ALTERNATIVE_QWEN_FILENAMES:
            alt_p = Path("models") / alt
            if alt_p.is_file():
                return str(alt_p.resolve())
        return DEFAULT_QWEN_MODEL_PATH

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


def resolve_qwen_coder_model_path(model_name: Optional[str] = None) -> str:
    """
    Resolves Qwen Coder 32B Abliterated model path specifically.
    """
    if not model_name or model_name.strip().lower() in QWEN_CODER_ALIASES or model_name.strip().lower() in QWEN_ALIASES:
        default_coder_p = Path(DEFAULT_QWEN_CODER_32B_ABLITERATED_MODEL_PATH)
        if default_coder_p.is_file():
            return str(default_coder_p.resolve())
        coder_in_models = Path("models") / DEFAULT_QWEN_CODER_32B_ABLITERATED_MODEL_FILENAME
        if coder_in_models.is_file():
            return str(coder_in_models.resolve())
        return DEFAULT_QWEN_CODER_32B_ABLITERATED_MODEL_PATH
    return resolve_qwen_model_path(model_name)


def get_or_load_qwen(
    model_path: str,
    n_ctx: int = 8192,
    n_gpu_layers: Optional[int] = None,
    n_batch: int = 512,
    flash_attn: bool = True,
):
    """Loads and caches the Qwen GGUF model in VRAM."""
    global _QWEN_MODEL_INSTANCE, _CURRENT_QWEN_MODEL_PATH

    resolved_path = resolve_qwen_model_path(model_path)

    if _QWEN_MODEL_INSTANCE is None or _CURRENT_QWEN_MODEL_PATH != resolved_path:
        try:
            from llama_cpp import Llama
        except ImportError as e:
            raise ImportError(
                "llama-cpp-python is required to run local GGUF models. "
                "Please install it using: pip install llama-cpp-python"
            ) from e

        if not os.path.exists(resolved_path):
            raise FileNotFoundError(
                f"Qwen GGUF model file not found at '{model_path}' or resolved path '{resolved_path}'."
            )

        effective_gpu_layers = (
            n_gpu_layers if n_gpu_layers is not None else _detect_default_gpu_layers()
        )

        print(f"[*] Loading Qwen model: {resolved_path} (GPU layers: {effective_gpu_layers}, n_ctx: {n_ctx})")
        _QWEN_MODEL_INSTANCE = Llama(
            model_path=resolved_path,
            n_gpu_layers=effective_gpu_layers,
            n_ctx=n_ctx,
            n_batch=n_batch,
            flash_attn=flash_attn,
            verbose=False,
        )
        _CURRENT_QWEN_MODEL_PATH = resolved_path

    return _QWEN_MODEL_INSTANCE


class Qwen3Provider(BaseModelProvider):
    """
    Provider implementation for Qwen3-14B GGUF via llama-cpp-python.
    Optimized for RTX 4090 and high-performance local environments.
    Extracts dual-mode reasoning traces (<think>...</think>) into 'thought_process'.
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
        model_name: str = DEFAULT_QWEN_MODEL_PATH,
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

            resolved_path = resolve_qwen_model_path(model_name)
            llm = get_or_load_qwen(
                model_path=resolved_path,
                n_ctx=n_ctx,
                n_gpu_layers=n_gpu_layers,
                n_batch=n_batch,
                flash_attn=flash_attn,
            )

            messages = []
            if system_prompt and system_prompt.strip():
                messages.append({"role": "system", "content": system_prompt})
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

            # Separate <think>...</think> if dual-mode reasoning was activated
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


# Aliases for provider
QwenProvider = Qwen3Provider


def call_qwen3(
    model_name: str = DEFAULT_QWEN_MODEL_PATH,
    system_prompt: str = "",
    user_prompt: str = "",
    temperature: float = 0.6,
    top_p: float = 0.95,
    max_output_tokens: int = 8192,
    seed: Optional[int] = None,
    api_key: Optional[str] = None,
    **kwargs: Any,
) -> Dict[str, Any]:
    provider = Qwen3Provider()
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


call_qwen = call_qwen3


class Qwen25Coder32BAbliteratedProvider(Qwen3Provider):
    """
    Provider implementation for Qwen2.5-Coder-32B-Instruct-abliterated-Q4_K_M.gguf via llama-cpp-python.
    """

    def generate(
        self,
        model_name: str = DEFAULT_QWEN_CODER_32B_ABLITERATED_MODEL_PATH,
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


QwenCoder32BAbliteratedProvider = Qwen25Coder32BAbliteratedProvider
QwenCoderProvider = Qwen25Coder32BAbliteratedProvider
QwenCoderAbliteratedProvider = Qwen25Coder32BAbliteratedProvider


def call_qwen_coder(
    model_name: str = DEFAULT_QWEN_CODER_32B_ABLITERATED_MODEL_PATH,
    system_prompt: str = "",
    user_prompt: str = "",
    temperature: float = 0.6,
    top_p: float = 0.95,
    max_output_tokens: int = 8192,
    seed: Optional[int] = None,
    api_key: Optional[str] = None,
    **kwargs: Any,
) -> Dict[str, Any]:
    provider = Qwen25Coder32BAbliteratedProvider()
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

