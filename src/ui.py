import time
from collections import deque
from typing import Optional
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


class BenchmarkUI:
    """
    Modular UI renderer for benchmark runs using Rich.
    """

    def __init__(self, console: Optional[Console] = None, max_history: int = 10):
        self.console = console or Console()
        self.max_history = max_history
        self.history = deque(maxlen=max_history)
        self.progress = Progress(
            SpinnerColumn(spinner_name="dots", style="dim"),
            TextColumn("[dim white]{task.description}"),
            BarColumn(bar_width=28, style="dim #333333", complete_style="#aaaaaa"),
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
        dataset_name: str,
        total_rows: int,
        provider: str,
        model: str,
        iterations: int,
        temperature: float,
        top_p: float,
        total_executions: int,
        checkpoint_count: int,
    ):
        """Displays a minimalist header card with run details and checkpoint status."""
        table = Table.grid(padding=(0, 2))
        table.add_column(style="dim", justify="right")
        table.add_column(style="white")

        remaining = total_executions - checkpoint_count

        table.add_row("Dataset:", f"{dataset_name} [dim]({total_rows:,} rows)[/dim]")
        table.add_row("Model:", f"{model} [dim](Provider: {provider})[/dim]")
        table.add_row(
            "Config:",
            f"temp={temperature}, top_p={top_p}, iters={iterations} [dim](Total Tasks: {total_executions:,})[/dim]",
        )

        if checkpoint_count > 0:
            state_text = (
                f"[dim green]{checkpoint_count:,}[/dim green] completed from checkpoint "
                f"[dim]({remaining:,} remaining)[/dim]"
            )
        else:
            state_text = f"Fresh run [dim]({total_executions:,} remaining)[/dim]"

        table.add_row("State:", state_text)

        panel = Panel(
            table,
            title="[bold #cccccc]Benchmark Run Configuration[/bold #cccccc]",
            title_align="left",
            border_style="dim #666666",
            padding=(1, 2),
        )
        self.console.print()
        self.console.print(panel)
        self.console.print()

    def _render_history_table(self) -> Panel:
        """Renders the fixed-height rolling window of recent history with subtle tones."""
        table = Table.grid(padding=(0, 1), expand=True)
        table.add_column(style="dim #777777", width=10)       # Timestamp (subtle)
        table.add_column(width=6)                             # Status
        table.add_column(style="dim", width=12)               # Row #
        table.add_column(style="dim white", width=8)          # Lang
        table.add_column(style="dim white", width=8)          # Style
        table.add_column(style="dim", width=16)               # Iteration
        table.add_column(style="dim #888888", justify="right")# Latency

        if not self.history:
            table.add_row("", "[dim]Waiting for first task to complete...[/dim]")
        else:
            for item in self.history:
                table.add_row(
                    item["timestamp"],
                    item["status_tag"],
                    f"Row #{item['row_idx']}",
                    f"[dim]|[/dim] {item['lang'].upper()}",
                    f"[dim]|[/dim] {item['style'].upper()}",
                    f"[dim]|[/dim] Iter {item['iteration']}/{item['total_iterations']}",
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
        """Starts the unified live display."""
        self.task_id = self.progress.add_task(
            "Generating",
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
        lang: str,
        style: str,
        iteration: int,
        total_iterations: int,
        latency_sec: Optional[float] = None,
        failed: bool = False,
    ):
        """Appends to the rolling history window and refreshes display."""
        timestamp = time.strftime("%H:%M:%S")
        status_tag = "[bold red]FAIL[/bold red]" if failed else "[dim green] OK [/dim green]"
        latency_str = f"{latency_sec:.2f}s" if latency_sec is not None else ""

        self.history.append({
            "timestamp": timestamp,
            "status_tag": status_tag,
            "row_idx": row_idx,
            "lang": lang,
            "style": style,
            "iteration": iteration,
            "total_iterations": total_iterations,
            "latency_str": latency_str,
        })

        if self.live:
            self.live.update(self._get_renderable())

    def update_progress(self, advance: int = 1, status_desc: Optional[str] = None):
        """Updates the progress bar."""
        if self.task_id is not None:
            kwargs = {"advance": advance}
            if status_desc:
                kwargs["description"] = status_desc
            self.progress.update(self.task_id, **kwargs)
            if self.live:
                self.live.update(self._get_renderable())

    def log_warning(self, message: str):
        """Prints a subtle grayish warning."""
        timestamp = time.strftime("%H:%M:%S")
        msg = f"[dim #666666]{timestamp}[/dim #666666] [dim #cc9900]WARN[/dim #cc9900]  [dim #aaaaaa]{message}[/dim #aaaaaa]"
        if self.live:
            self.live.console.print(msg)
        else:
            self.console.print(msg)

    def log_error(self, message: str):
        """Prints an error message."""
        timestamp = time.strftime("%H:%M:%S")
        msg = f"[dim #666666]{timestamp}[/dim #666666] [red]ERROR[/red] [dim #aaaaaa]{message}[/dim #aaaaaa]"
        if self.live:
            self.live.console.print(msg)
        else:
            self.console.print(msg)

    def log_info(self, message: str):
        """Prints a subtle grayish info message."""
        timestamp = time.strftime("%H:%M:%S")
        msg = f"[dim #666666]{timestamp}[/dim #666666] [dim]INFO[/dim]  [dim #aaaaaa]{message}[/dim #aaaaaa]"
        if self.live:
            self.live.console.print(msg)
        else:
            self.console.print(msg)

    def log_quota_exhausted(self):
        """Displays a clear notice for quota exhaustion."""
        text = Text.from_markup(
            "[bold red]Daily API Quota Exhausted[/bold red]\n"
            "[dim white]Execution halted gracefully. All completed progress has been saved to the checkpoint.\n"
            "You can rerun this script when your quota refreshes to continue where you left off.[/dim white]"
        )
        panel = Panel(
            text,
            title="[dim red]Quota Limit[/dim red]",
            title_align="left",
            border_style="dim red",
            padding=(1, 2),
        )
        if self.live:
            self.live.console.print(panel)
        else:
            self.console.print(panel)

    def show_summary(self, total_completed: int, total_planned: int, elapsed_time_sec: float):
        """Displays a clean end-of-run summary panel."""
        minutes, seconds = divmod(int(elapsed_time_sec), 60)
        hours, minutes = divmod(minutes, 60)
        time_str = f"{hours:02d}h {minutes:02d}m {seconds:02d}s" if hours else f"{minutes:02d}m {seconds:02d}s"

        avg_speed = (elapsed_time_sec / total_completed) if total_completed > 0 else 0.0

        grid = Table.grid(padding=(0, 2))
        grid.add_column(style="dim", justify="right")
        grid.add_column(style="white")

        grid.add_row("Status:", "[bold #cccccc]Completed[/bold #cccccc]")
        grid.add_row("Tasks Done:", f"{total_completed:,} / {total_planned:,}")
        grid.add_row("Total Time:", f"{time_str} [dim]({avg_speed:.2f}s per task avg)[/dim]")

        panel = Panel(
            grid,
            title="[bold #cccccc]Benchmark Summary[/bold #cccccc]",
            title_align="left",
            border_style="dim #666666",
            padding=(1, 2),
        )
        self.console.print()
        self.console.print(panel)
        self.console.print()
