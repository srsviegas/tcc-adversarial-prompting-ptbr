# Models

Below are instructions on how to download models.

## Llama 3.1 8B Q4_K_M

- **Original Model:** https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct
- **GGUF Model:** https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF

Use the command below in your terminal to download the GGUF model.

```bash
py -m pip install huggingface_hub

py -m huggingface_hub.cli.hf download bartowski/Meta-Llama-3.1-8B-Instruct-GGUF Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf --local-dir ./models

## Or,
hf download bartowski/Meta-Llama-3.1-8B-Instruct-GGUF Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf --local-dir ./models
```

## DeepSeek R1 Distill Qwen-14B

- **GGUF Model:** https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-14B-GGUF

```bash
py -m pip install huggingface_hub

py -m huggingface_hub.cli.hf download bartowski/DeepSeek-R1-Distill-Qwen-14B-GGUF DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf --local-dir ./models

## Or,
hf download bartowski/DeepSeek-R1-Distill-Qwen-14B-GGUF DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf --local-dir ./models
```

## Qwen3 14B Q4_K_M

- **GGUF Model:** https://huggingface.co/bartowski/Qwen_Qwen3-14B-GGUF

```bash
# Linux (Server with RTX 4090)
pip install -U huggingface_hub
huggingface-cli download bartowski/Qwen_Qwen3-14B-GGUF Qwen3-14B-Q4_K_M.gguf --local-dir ./models

# Windows
py -m pip install -U huggingface_hub
py -m huggingface_hub.cli.hf download bartowski/Qwen_Qwen3-14B-GGUF Qwen3-14B-Q4_K_M.gguf --local-dir ./models

# Or directly with hf CLI:
hf download bartowski/Qwen_Qwen3-14B-GGUF Qwen3-14B-Q4_K_M.gguf --local-dir ./models
```

## Google Gemma 4 12B-it Q4_K_M

- **GGUF Model:** https://huggingface.co/bartowski/gemma-4-12B-it-GGUF

```bash
# Linux (Server with RTX 4090)
pip install -U huggingface_hub
huggingface-cli download bartowski/gemma-4-12B-it-GGUF gemma-4-12B-it-Q4_K_M.gguf --local-dir ./models

# Windows
py -m pip install -U huggingface_hub
py -m huggingface_hub.cli.hf download bartowski/gemma-4-12B-it-GGUF gemma-4-12B-it-Q4_K_M.gguf --local-dir ./models

# Or directly with hf CLI:
hf download bartowski/gemma-4-12B-it-GGUF gemma-4-12B-it-Q4_K_M.gguf --local-dir ./models
```
