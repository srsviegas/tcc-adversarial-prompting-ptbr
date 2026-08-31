import sys
import time
import random
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.append(str(project_root))

from src.ui import BenchmarkUI

def run_simulation():
    """
    Simulation script to preview and test the Rich terminal UI
    with a rolling 10-row history panel and live progress bar.
    """
    ui = BenchmarkUI(max_history=10)

    # Simulation parameters
    dataset_name = "pap_pt_train.parquet"
    total_rows = 15
    provider = "gemini"
    model = "gemini-3.5-flash-lite"
    iterations = 2
    tests_per_row = 4  # e.g., en_raw, en_pap, pt_raw, pt_pap
    total_executions = total_rows * tests_per_row * iterations  # 120 total
    mock_checkpoint_count = 20  # Simulate 20 items already finished from a previous run

    # 1. Display Header Card
    ui.show_header(
        dataset_name=dataset_name,
        total_rows=total_rows,
        provider=provider,
        model=model,
        iterations=iterations,
        temperature=0.6,
        top_p=1.0,
        total_executions=total_executions,
        checkpoint_count=mock_checkpoint_count,
    )

    start_time = time.time()
    completed_count = mock_checkpoint_count
    counter = 0

    languages = ["en", "pt"]
    styles = ["raw", "pap"]

    # 2. Start Live Progress Tracker with Rolling History
    ui.start_live(total=total_executions, completed=mock_checkpoint_count)

    try:
        for row_idx in range(total_rows):
            for lang in languages:
                for style in styles:
                    for iteration in range(1, iterations + 1):
                        counter += 1

                        # Skip items already in simulated checkpoint
                        if counter <= mock_checkpoint_count:
                            continue

                        status_desc = f"Generating [dim]| Row #{row_idx} ({lang.upper()}/{style.upper()} iter {iteration}/{iterations})[/dim]"
                        ui.update_progress(advance=0, status_desc=status_desc)

                        # Simulate an event (e.g. rate limit warning on 45th execution)
                        if completed_count == 45:
                            ui.log_warning("Rate limit hit (429). Retrying in 2.0s... (Attempt 1/3)")
                            time.sleep(1.5)
                            ui.log_info("Rate limit resolved. Resuming execution.")

                        # Simulate request delay & latency
                        simulated_latency = random.uniform(0.04, 0.10)
                        time.sleep(simulated_latency)

                        completed_count += 1
                        ui.update_progress(advance=1)

                        ui.log_task_completion(
                            row_idx=row_idx,
                            lang=lang,
                            style=style,
                            iteration=iteration,
                            total_iterations=iterations,
                            latency_sec=simulated_latency,
                        )
    finally:
        ui.stop_live()

    elapsed_time = time.time() - start_time

    # 3. Show Final Summary
    ui.show_summary(
        total_completed=completed_count,
        total_planned=total_executions,
        elapsed_time_sec=elapsed_time,
    )

if __name__ == "__main__":
    run_simulation()
