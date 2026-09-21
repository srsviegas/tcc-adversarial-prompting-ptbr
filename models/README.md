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

- **GGUF Model:** https://huggingface.co/Qwen/Qwen_Qwen3-14B-GGUF

```bash
hf download Qwen/Qwen3-14B-GGUF Qwen3-14B-Q4_K_M.gguf --local-dir ./models
```

## Google Gemma 4 12B-it Q4_K_M

- **GGUF Model:** https://huggingface.co/bartowski/gemma-4-12B-it-GGUF

```bash
hf download bartowski/gemma-4-12B-it-GGUF gemma-4-12B-it-Q4_K_M.gguf --local-dir ./models
```

## Qwen 2.5 Coder 32B Instruct (Abliterated) Q4_K_M

- **Original Model:** https://huggingface.co/Qwen/Qwen2.5-Coder-32B-Instruct
- **GGUF Model (Abliterated):** https://huggingface.co/bartowski/Qwen2.5-Coder-32B-Instruct-abliterated-GGUF
- **File:** `Qwen2.5-Coder-32B-Instruct-abliterated-Q4_K_M.gguf`

```bash
py -m pip install huggingface_hub

py -m huggingface_hub.cli.hf download bartowski/Qwen2.5-Coder-32B-Instruct-abliterated-GGUF Qwen2.5-Coder-32B-Instruct-abliterated-Q4_K_M.gguf --local-dir ./models

## Or,
hf download bartowski/Qwen2.5-Coder-32B-Instruct-abliterated-GGUF Qwen2.5-Coder-32B-Instruct-abliterated-Q4_K_M.gguf --local-dir ./models
```

## NVIDIA Aegis AI Content Safety LlamaGuard Defensive 1.0

- **Base Model:** https://huggingface.co/meta-llama/LlamaGuard-7b (Gated, requires accepting Llama license)
- **LoRA Adapter:** https://huggingface.co/nvidia/Aegis-AI-Content-Safety-LlamaGuard-Defensive-1.0

### Access & Setup:
1. Accept terms on Hugging Face for `meta-llama/LlamaGuard-7b`.
2. Set your Hugging Face token:
```bash
export HF_TOKEN="your_hf_token"
```

### Run Evaluation:
```bash
# Full precision / bfloat16 on RTX 4090:
python scripts/evaluate_aegis.py logs/gemini_gemini-3.1-flash-lite_pap_eval.jsonl

# Or in 4-bit quantization to conserve VRAM:
python scripts/evaluate_aegis.py logs/gemini_gemini-3.1-flash-lite_pap_eval.jsonl --load-in-4bit
```
