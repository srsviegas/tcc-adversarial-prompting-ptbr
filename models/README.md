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
