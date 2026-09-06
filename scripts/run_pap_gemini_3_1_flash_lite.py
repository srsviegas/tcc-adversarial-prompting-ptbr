import sys
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

from src.run_generation import run_benchmark

def main():
    dataset_path = project_root / "dataset" / "pap_pt_dataset" / "pap_pt_train.parquet"
    
    # max_workers=None automatically sets parallel workers equal to the number of
    # API keys configured in GEMINI_API_KEYS (or 1 if a single key is set).
    # Set to an explicit integer (e.g. max_workers=5) to override.
    run_benchmark(
        dataset_path=str(dataset_path),
        dataset_type="pap",
        provider="gemini",
        model="gemini-3.1-flash-lite",
        iterations=5,
        temperature=0.6,
        top_p=1.0,
        max_output_tokens=8192,
        sleep=0.0,
        max_workers=None,
    )

if __name__ == "__main__":
    main()
