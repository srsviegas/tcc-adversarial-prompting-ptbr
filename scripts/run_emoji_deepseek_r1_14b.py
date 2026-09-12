import sys
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

from src.run_generation import run_benchmark


def main():
    dataset_path = project_root / "dataset" / "emoji_pt_dataset" / "emoji_pt_eval.parquet"
    if not dataset_path.exists():
        dataset_path = project_root / "dataset" / "emoji_pt_dataset" / "checkpoint_eval.parquet"

    model_path = project_root / "models" / "DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf"

    filter_label = sys.argv[1] if len(sys.argv) > 1 else "all"
    iterations = int(sys.argv[2]) if len(sys.argv) > 2 else 3

    run_benchmark(
        dataset_path=str(dataset_path),
        dataset_type="emoji",
        provider="deepseek",
        model=str(model_path),
        iterations=iterations,
        temperature=0.6,
        top_p=0.95,
        max_output_tokens=8192,
        sleep=0.0,
        filter_label=filter_label,
    )


if __name__ == "__main__":
    main()
