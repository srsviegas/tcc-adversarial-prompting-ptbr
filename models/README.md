# Models

Below are instructions on how to download models.

## Llama 3.1 8B Q4_K_M

- **Original Model:** https://huggingface.co/meta-llama/Llama-3.1-8B-Instruct
- **GGUF Model:** https://huggingface.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF

Use the command below in your terminal to download the GGUF model.

```bash
# Install the Hugging Face CLI
py -m pip install huggingface_hub

# Download the model
py -m huggingface_hub.cli.hf download bartowski/Meta-Llama-3.1-8B-Instruct-GGUF Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf --local-dir ./models
```