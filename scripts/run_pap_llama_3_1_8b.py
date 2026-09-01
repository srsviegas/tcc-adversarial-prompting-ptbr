import sys
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

from src.run_generation import run_benchmark


def main():
    dataset_path = project_root / "dataset" / "pap_pt_dataset" / "pap_pt_train.parquet"
    model_path = project_root / "models" / "Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf"

    run_benchmark(
        dataset_path=str(dataset_path),
        dataset_type="pap",
        provider="local",
        model=str(model_path),
        iterations=5,
        temperature=0.6,
        top_p=1.0,
        max_output_tokens=8192,
        sleep=0.0,
    )


if __name__ == "__main__":
    main()
