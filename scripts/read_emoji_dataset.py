import sys
import argparse
from pathlib import Path
import pandas as pd
from rich.console import Console
from rich.panel import Panel

if sys.stdout.encoding.lower() != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

console = Console()

project_root = Path(__file__).resolve().parent.parent
file = project_root / "dataset" / "emoji_pt_dataset" / "emoji_pt_eval.parquet"
if not file.exists():
    file = project_root / "dataset" / "emoji_pt_dataset" / "checkpoint_eval.parquet"


def parse_args():
    parser = argparse.ArgumentParser(description="Inspect Emoji PT-BR dataset rows")
    parser.add_argument(
        "row",
        nargs="?",
        type=int,
        default=0,
        help="Row index to inspect (0-indexed, default: 0)"
    )
    parser.add_argument(
        "-r", "--row",
        type=int,
        dest="row_flag",
        default=None,
        help="Row index (e.g. -r 5)"
    )
    return parser.parse_args()


def main():
    args = parse_args()
    row_idx = args.row_flag if args.row_flag is not None else args.row

    if not file.exists():
        console.print(f"[bold red]Error:[/] Dataset file not found at: {file}")
        console.print(f"[yellow]Run the translation notebook first:[/] [bold]notebooks/03__emoji_translation_google.ipynb[/bold]")
        sys.exit(1)

    df = pd.read_parquet(file)
    total_rows = len(df)

    if row_idx < 0 or row_idx >= total_rows:
        console.print(
            f"[bold red]Error:[/] Row index [yellow]{row_idx}[/yellow] is out of bounds. "
            f"Valid range is [green]0[/green] to [green]{total_rows - 1}[/green]."
        )
        sys.exit(1)

    row = df.iloc[row_idx]

    console.print(f"\n[bold #cccccc]Dataset:[/] [dim]{file.name}[/dim]  |  [bold #cccccc]Displaying Row:[/] [bold cyan]#{row_idx}[/bold cyan] [dim](of {total_rows:,} total)[/dim]\n")

    console.print(Panel(
        f"[bold yellow]ID:[/] {row.get('id')}  |  [bold yellow]Label:[/] {row.get('label')}  |  [bold yellow]GPT Raw Label:[/] {row.get('gpt_raw_label')}",
        title="[bold black on yellow] METADATA & LABELS [/]",
        expand=False
    ))

    console.print(Panel(f"[bold red]{row.get('query', '')}[/bold red]", title="[bold white on red] QUERY (EN) [/]", expand=False))
    console.print(Panel(f"[bold red]{row.get('query_pt', '')}[/bold red]", title="[bold white on red] QUERY (PT-BR) [/]", expand=False))

    console.print(Panel(f"[cyan]{row.get('emoji_prompt', '')}[/cyan]", title="[bold white on cyan] EMOJI_PROMPT (EN) [/]", expand=False))
    console.print(Panel(f"[cyan]{row.get('emoji_prompt_pt', '')}[/cyan]", title="[bold white on cyan] EMOJI_PROMPT (PT-BR) [/]", expand=False))

    if "input_prompt_pt" in row and row.get("input_prompt_pt"):
        console.print(Panel(f"[dim]{row.get('input_prompt_pt', '')}[/dim]", title="[bold white on blue] FULL INPUT_PROMPT (PT-BR) [/]", expand=False))

    if "output" in row and row.get("output"):
        console.print(Panel(f"[magenta]{row.get('output', '')}[/magenta]", title="[bold white on magenta] BASELINE OUTPUT [/]", expand=False))


if __name__ == "__main__":
    main()
