import sys
from pathlib import Path
import pandas as pd

project_root = Path(__file__).resolve().parent.parent
dataset_dir = project_root / "dataset" / "toxicchat_pt_dataset"


def split_dataset(input_filename: str, split_name: str) -> None:
    input_path = dataset_dir / input_filename
    if not input_path.exists():
        print(f"File not found: {input_path}")
        return

    print(f"\n==================================================")
    print(f"Splitting: {input_filename} ({split_name})")
    df = pd.read_parquet(input_path)
    total_rows = len(df)

    # Masks
    mask_jailbreak = df.get("jailbreaking", 0) == 1
    mask_malicious = (df.get("toxicity", 0) == 1) | mask_jailbreak
    mask_benign = (df.get("toxicity", 0) == 0) & (df.get("jailbreaking", 0) == 0)

    df_malicious = df[mask_malicious].copy()
    df_jailbreak = df[mask_jailbreak].copy()
    df_benign = df[mask_benign].copy()

    # File paths
    malicious_path = dataset_dir / f"toxicchat_pt_{split_name}_malicious.parquet"
    jailbreak_path = dataset_dir / f"toxicchat_pt_{split_name}_jailbreak.parquet"
    benign_path = dataset_dir / f"toxicchat_pt_{split_name}_benign.parquet"

    df_malicious.to_parquet(malicious_path, index=False)
    df_jailbreak.to_parquet(jailbreak_path, index=False)
    df_benign.to_parquet(benign_path, index=False)

    print(f"Total rows:        {total_rows}")
    print(f"-> Malicious (tox=1 or jb=1): {len(df_malicious)} ({len(df_malicious)/total_rows*100:.1f}%) -> {malicious_path.name}")
    print(f"-> Pure Jailbreaks (jb=1):     {len(df_jailbreak)} ({len(df_jailbreak)/total_rows*100:.1f}%) -> {jailbreak_path.name}")
    print(f"-> Benign (tox=0 and jb=0):    {len(df_benign)} ({len(df_benign)/total_rows*100:.1f}%) -> {benign_path.name}")


def main():
    print("ToxicChat Label Separation Tool")
    # Prefer final clean parquet, fall back to checkpoint if needed
    train_file = "toxicchat_pt_train.parquet" if (dataset_dir / "toxicchat_pt_train.parquet").exists() else "checkpoint_train.parquet"
    test_file = "toxicchat_pt_test.parquet" if (dataset_dir / "toxicchat_pt_test.parquet").exists() else "checkpoint_test.parquet"

    split_dataset(train_file, "train")
    split_dataset(test_file, "test")


if __name__ == "__main__":
    main()
