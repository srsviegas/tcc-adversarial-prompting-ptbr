import time
import threading
from collections import deque
from typing import Dict, List, Optional
from rich.console import Console, Group
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.live import Live
from rich.progress import (
    Progress,
    SpinnerColumn,
    TextColumn,
    BarColumn,
    TaskProgressColumn,
    TimeElapsedColumn,
    TimeRemainingColumn,
    MofNCompleteColumn,
)


class EvaluationUI:
    """
    Modular Rich UI renderer for evaluating benchmark responses.
    Matches the aesthetic and behavior of BenchmarkUI.
    """

    def __init__(self, console: Optional[Console] = None, max_history: int = 10):
        self._lock = threading.Lock()
        if console is None:
            import sys
            is_cp1252 = False
            try:
                if hasattr(sys.stdout, "encoding") and sys.stdout.encoding and "cp1252" in sys.stdout.encoding.lower():
                    is_cp1252 = True
            except Exception:
                pass
            self.console = Console(safe_box=True)
            spinner = "line" if is_cp1252 else "dots"
        else:
            self.console = console
            spinner = "line"

        self.max_history = max_history
        self.history = deque(maxlen=max_history)
        self.progress = Progress(
            SpinnerColumn(spinner_name=spinner, style="dim cyan"),
            TextColumn("[dim white]{task.description}"),
            BarColumn(bar_width=28, style="dim #333333", complete_style="#00aaee"),
            TaskProgressColumn(text_format="[dim white]{task.percentage:>3.0f}%[/dim white]"),
            TextColumn("[dim]|[/dim]"),
            MofNCompleteColumn(),
            TextColumn("[dim]|[/dim]"),
            TimeElapsedColumn(),
            TextColumn("[dim](ETA:[/dim]"),
            TimeRemainingColumn(),
            TextColumn("[dim])[/dim]"),
            console=self.console,
        )
        self.task_id = None
        self.live: Optional[Live] = None

    def show_header(
        self,
        source_log: str,
        output_log: str,
        evaluator_name: str,
        model: str,
        total_rows: int,
        checkpoint_count: int,
    ):
        """Displays a minimalist header card with evaluation details and checkpoint status."""
        table = Table.grid(padding=(0, 2))
        table.add_column(style="dim", justify="right")
        table.add_column(style="white")

        remaining = max(0, total_rows - checkpoint_count)

        table.add_row("Source Log:", f"{source_log} [dim]({total_rows:,} total records)[/dim]")
        table.add_row("Evaluated Log:", f"[cyan]{output_log}[/cyan]")
        table.add_row("Evaluator:", f"[bold cyan]{evaluator_name}[/bold cyan] [dim](Model: {model})[/dim]")

        if checkpoint_count > 0:
            state_text = (
                f"[dim green]{checkpoint_count:,}[/dim green] already evaluated in checkpoint "
                f"[dim]({remaining:,} remaining to evaluate)[/dim]"
            )
        else:
            state_text = f"Fresh evaluation [dim]({total_rows:,} to process)[/dim]"

        table.add_row("State:", state_text)

        panel = Panel(
            table,
            title="[bold #cccccc]Response Evaluation Configuration[/bold #cccccc]",
            title_align="left",
            border_style="dim #666666",
            padding=(1, 2),
        )
        self.console.print()
        self.console.print(panel)
        self.console.print()

    def _render_history_table(self) -> Panel:
        """Renders the fixed-height rolling window of recent evaluation activity."""
        table = Table.grid(padding=(0, 1), expand=True)
        table.add_column(style="dim #777777", width=10)       # Timestamp
        table.add_column(width=9)                             # Status Tag
        table.add_column(style="dim", width=12)               # Row #
        table.add_column(width=28)                            # Flagged Categories
        table.add_column(style="dim", width=18)               # Top Score
        table.add_column(style="dim #888888", justify="right")# Latency

        if not self.history:
            table.add_row("", "[dim]Waiting for first response evaluation...[/dim]")
        else:
            for item in self.history:
                table.add_row(
                    item["timestamp"],
                    item["status_tag"],
                    f"Row #{item['row_idx']}",
                    item["categories_str"],
                    item["score_str"],
                    item["latency_str"],
                )

        # Pad with empty rows to preserve a constant height
        empty_rows = self.max_history - max(1, len(self.history))
        for _ in range(empty_rows):
            table.add_row("", "")

        return Panel(
            table,
            title=f"[dim]Recent Activity (Last {self.max_history})[/dim]",
            title_align="left",
            border_style="dim #555555",
            padding=(0, 1),
        )

    def _get_renderable(self) -> Group:
        """Combines the rolling history panel and progress bar into one display group."""
        return Group(
            self._render_history_table(),
            Text(""),
            self.progress,
        )

    def start_live(self, total: int, completed: int = 0):
        """Starts the live display."""
        self.task_id = self.progress.add_task(
            "Evaluating",
            total=total,
            completed=completed,
        )
        self.live = Live(
            self._get_renderable(),
            console=self.console,
            refresh_per_second=10,
            transient=False,
        )
        self.live.start()

    def stop_live(self):
        """Stops the live display."""
        if self.live:
            self.live.stop()
            self.live = None

    def log_task_completion(
        self,
        row_idx: int,
        status: str,
        flagged: Optional[bool],
        flagged_categories: List[str],
        highest_category: Optional[str],
        highest_score: float,
        latency_sec: Optional[float] = None,
    ):
        """Appends to the rolling history window and refreshes display."""
        timestamp = time.strftime("%H:%M:%S")

        if status == "skipped":
            status_tag = "[dim #888888] SKIP [/dim #888888]"
            cat_str = "[dim]No text / failed[/dim]"
            score_str = ""
        elif status == "error":
            status_tag = "[bold yellow] ERROR [/bold yellow]"
            cat_str = "[yellow]API Error[/yellow]"
            score_str = ""
        elif flagged:
            status_tag = "[bold red]FLAGGED[/bold red]"
            cat_str = f"[red]{', '.join(flagged_categories[:2])}[/red]" if flagged_categories else "[red]Flagged[/red]"
            score_str = f"[red]{highest_score:.3f}[/red] [dim]({highest_category})[/dim]" if highest_category else ""
        else:
            status_tag = "[dim green] PASS  [/dim green]"
            cat_str = "[dim green]clean[/dim green]"
            score_str = f"[dim]{highest_score:.3f} ({highest_category})[/dim]" if highest_category else ""

        latency_str = f"{latency_sec:.2f}s" if latency_sec is not None else ""

        with self._lock:
            self.history.append({
                "timestamp": timestamp,
                "status_tag": status_tag,
                "row_idx": row_idx,
                "categories_str": cat_str,
                "score_str": score_str,
                "latency_str": latency_str,
            })

            if self.live:
                self.live.update(self._get_renderable())

    def update_progress(self, advance: int = 1, status_desc: Optional[str] = None):
        """Updates the progress bar."""
        with self._lock:
            if self.task_id is not None:
                kwargs = {"advance": advance}
                if status_desc:
                    kwargs["description"] = status_desc
                self.progress.update(self.task_id, **kwargs)
                if self.live:
                    self.live.update(self._get_renderable())

    def log_error(self, message: str):
        """Prints an error message."""
        timestamp = time.strftime("%H:%M:%S")
        msg = f"[dim #666666]{timestamp}[/dim #666666] [red]ERROR[/red] [dim #aaaaaa]{message}[/dim #aaaaaa]"
        with self._lock:
            if self.live:
                self.live.console.print(msg)
            else:
                self.console.print(msg)

    def log_warning(self, message: str):
        """Prints a warning message."""
        timestamp = time.strftime("%H:%M:%S")
        msg = f"[dim #666666]{timestamp}[/dim #666666] [dim #cc9900]WARN[/dim #cc9900]  [dim #aaaaaa]{message}[/dim #aaaaaa]"
        with self._lock:
            if self.live:
                self.live.console.print(msg)
            else:
                self.console.print(msg)

    def log_info(self, message: str):
        """Prints an informational message."""
        timestamp = time.strftime("%H:%M:%S")
        msg = f"[dim #666666]{timestamp}[/dim #666666] [dim #00aaff]INFO[/dim #00aaff]  [dim #aaaaaa]{message}[/dim #aaaaaa]"
        with self._lock:
            if self.live:
                self.live.console.print(msg)
            else:
                self.console.print(msg)

    def show_summary(
        self,
        total_records: int,
        evaluated_now: int,
        flagged_count: int,
        clean_count: int,
        skipped_count: int,
        error_count: int,
        category_breakdown: Dict[str, int],
        elapsed_sec: float,
        output_filepath: str,
    ):
        """Displays a clean end-of-run summary panel."""
        minutes, seconds = divmod(int(elapsed_sec), 60)
        hours, minutes = divmod(minutes, 60)
        time_str = f"{hours:02d}h {minutes:02d}m {seconds:02d}s" if hours else f"{minutes:02d}m {seconds:02d}s"
        avg_speed = (elapsed_sec / evaluated_now) if evaluated_now > 0 else 0.0

        grid = Table.grid(padding=(0, 2))
        grid.add_column(style="dim", justify="right")
        grid.add_column(style="white")

        grid.add_row("Status:", "[bold green]Evaluation Finished[/bold green]")
        grid.add_row("Total Records:", f"{total_records:,} (Evaluated this run: {evaluated_now:,})")

        flagged_pct = (flagged_count / (flagged_count + clean_count) * 100) if (flagged_count + clean_count) > 0 else 0.0
        grid.add_row(
            "Flagged Content:",
            f"[bold red]{flagged_count:,}[/bold red] [dim]({flagged_pct:.1f}% violation rate)[/dim]",
        )
        grid.add_row("Clean Content:", f"[green]{clean_count:,}[/green]")

        if skipped_count > 0:
            grid.add_row("Skipped (Empty):", f"[dim]{skipped_count:,}[/dim]")
        if error_count > 0:
            grid.add_row("API Errors:", f"[yellow]{error_count:,}[/yellow]")

        if category_breakdown:
            top_cats = sorted(category_breakdown.items(), key=lambda x: x[1], reverse=True)[:5]
            cat_text = ", ".join([f"[red]{cat}[/red]: {cnt}" for cat, cnt in top_cats])
            grid.add_row("Top Categories:", cat_text)

        grid.add_row("Elapsed Time:", f"{time_str} [dim]({avg_speed:.2f}s per item avg)[/dim]")
        grid.add_row("Saved Output:", f"[bold cyan]{output_filepath}[/bold cyan]")

        panel = Panel(
            grid,
            title="[bold #cccccc]OpenAI Moderation Evaluation Summary[/bold #cccccc]",
            title_align="left",
            border_style="dim #666666",
            padding=(1, 2),
        )
        self.console.print()
        self.console.print(panel)
        self.console.print()
