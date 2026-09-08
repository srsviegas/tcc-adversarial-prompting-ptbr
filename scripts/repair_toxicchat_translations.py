import sys
import time
import html
import random
from pathlib import Path
from typing import Optional
from concurrent.futures import ThreadPoolExecutor
import requests
from bs4 import BeautifulSoup
import pandas as pd
from tqdm.auto import tqdm

project_root = Path(__file__).resolve().parent.parent
dataset_dir = project_root / "dataset" / "toxicchat_pt_dataset"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}


def translate_text(
    text: str,
    source_lang: str = "en",
    target_lang: str = "pt",
    max_retries: int = 4,
    base_backoff: float = 2.0,
) -> Optional[str]:
    """
    Translates text to Portuguese via Google Translate mobile endpoint
    with a browser User-Agent, exponential backoff, and HTML entity decoding.
    Returns None if translation fails after all retries (prevents silent corruption).
    """
    if not text or not isinstance(text, str) or not text.strip():
        return ""

    text = text.strip()

    for attempt in range(max_retries):
        try:
            # Polite jitter delay between requests
            time.sleep(random.uniform(0.2, 0.5))

            resp = requests.get(
                "https://translate.google.com/m",
                params={"sl": source_lang, "tl": target_lang, "q": text},
                headers=HEADERS,
                timeout=15,
            )

            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                element = soup.find("div", class_="result-container")
                if element:
                    translated = html.unescape(element.get_text(strip=True))
                    if translated:
                        return translated

            # If rate limited (429 or 500)
            sleep_time = base_backoff * (2 ** attempt) + random.uniform(0.5, 1.5)
            time.sleep(sleep_time)

        except Exception:
            sleep_time = base_backoff * (2 ** attempt) + random.uniform(0.5, 1.5)
            time.sleep(sleep_time)

    return None


def repair_file(file_path: Path, max_workers: int = 2) -> None:
    if not file_path.exists():
        print(f"File not found: {file_path}")
        return

    print(f"\n==================================================")
    print(f"Checking: {file_path.name}")
    df = pd.read_parquet(file_path)

    # A row needs translation if user_input_pt is missing/empty,
    # or identical to user_input (the fallback error from previous runs)
    mask_needs_translation = (
        df["user_input_pt"].isna()
        | (df["user_input_pt"].astype(str).str.strip() == "")
        | (df["user_input"].astype(str).str.strip() == df["user_input_pt"].astype(str).str.strip())
    )

    indices_to_translate = df[mask_needs_translation].index.tolist()
    total_to_translate = len(indices_to_translate)
    already_done = len(df) - total_to_translate

    print(f"Total rows: {len(df)}")
    print(f"Already translated: {already_done}")
    print(f"Rows needing repair: {total_to_translate}")

    if total_to_translate == 0:
        print("All rows are already translated!")
        return

    pbar = tqdm(total=total_to_translate, desc=f"Repairing {file_path.name}")

    def process_row_idx(idx):
        raw_text = df.at[idx, "user_input"]
        translated = translate_text(raw_text)
        return idx, translated

    completed = 0
    save_every = 25

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        for idx, translated in executor.map(process_row_idx, indices_to_translate):
            if translated is not None:
                df.at[idx, "user_input_pt"] = translated
            completed += 1
            pbar.update(1)

            if completed % save_every == 0:
                df.to_parquet(file_path, index=False)

    pbar.close()
    df.to_parquet(file_path, index=False)
    print(f"Saved repaired dataset to: {file_path}")

    # Also save standard filename if it was a checkpoint
    if file_path.name == "checkpoint_train.parquet":
        final_train = file_path.parent / "toxicchat_pt_train.parquet"
        df.to_parquet(final_train, index=False)
        print(f"Exported clean train dataset to: {final_train}")
    elif file_path.name == "checkpoint_test.parquet":
        final_test = file_path.parent / "toxicchat_pt_test.parquet"
        df.to_parquet(final_test, index=False)
        print(f"Exported clean test dataset to: {final_test}")


def main():
    train_file = dataset_dir / "checkpoint_train.parquet"
    test_file = dataset_dir / "checkpoint_test.parquet"

    print("ToxicChat Translation Repair Tool")
    if train_file.exists():
        repair_file(train_file, max_workers=2)
    if test_file.exists():
        repair_file(test_file, max_workers=2)


if __name__ == "__main__":
    main()
