import sys
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

from src.run_generation import run_benchmark


def main():
    dataset_path = project_root / "dataset" / "toxicchat_pt_dataset" / "toxicchat_pt_train.parquet"
    if not dataset_path.exists():
        dataset_path = project_root / "dataset" / "toxicchat_pt_dataset" / "checkpoint_train.parquet"

    filter_label = sys.argv[1] if len(sys.argv) > 1 else "all"

    run_benchmark(
        dataset_path=str(dataset_path),
        dataset_type="toxicchat_prefix",
        provider="gemini",
        model="gemini-3.5-flash-lite",
        iterations=1,
        temperature=0.6,
        top_p=1.0,
        max_output_tokens=8192,
        sleep=0.0,
        max_workers=None,
        filter_label=filter_label,
    )


if __name__ == "__main__":
    main()
