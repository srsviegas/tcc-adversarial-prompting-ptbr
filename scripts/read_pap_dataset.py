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
file = project_root / "dataset" / "pap_pt_dataset" / "pap_pt_train.parquet"


def parse_args():
    parser = argparse.ArgumentParser(description="Inspect PAP PT-BR dataset rows")
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

    console.print(f"\n[bold #cccccc]Dataset:[/] [dim]pap_pt_train.parquet[/dim]  |  [bold #cccccc]Displaying Row:[/] [bold cyan]#{row_idx}[/bold cyan] [dim](of {total_rows:,} total)[/dim]\n")

    console.print(Panel(f"[bold red]{row.get('bad_q', '')}[/bold red]", title="[bold white on red] BAD_Q (EN) [/]", expand=False))
    console.print(Panel(f"[bold red]{row.get('bad_q_pt', '')}[/bold red]", title="[bold white on red] BAD_Q (PT-BR) [/]", expand=False))

    console.print(Panel(f"[bold yellow]{row.get('ss_category', '')}[/bold yellow]", title="[bold black on yellow] SS_CATEGORY [/]", expand=False))

    console.print(Panel(f"[cyan]{row.get('ss_prompt', '')}[/cyan]", title="[bold white on cyan] SS_PROMPT (EN) [/]", expand=False))
    console.print(Panel(f"[cyan]{row.get('ss_prompt_pt', '')}[/cyan]", title="[bold white on cyan] SS_PROMPT (PT-BR) [/]", expand=False))

    console.print(Panel(f"[magenta]{row.get('ori_output', '')}[/magenta]", title="[bold white on magenta] ORI_OUTPUT [/]", expand=False))
    console.print(Panel(f"[green]{row.get('jb_output', '')}[/green]", title="[bold white on green] JB_OUTPUT [/]", expand=False))


if __name__ == "__main__":
    main()
