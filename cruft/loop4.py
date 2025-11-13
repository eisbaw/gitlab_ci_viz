#!/usr/bin/env python3
"""
Interactive TUI for continuous Claude Code sessions with human interjections.

Architecture:
    - MessageRenderer: Stateless rendering of Claude JSON messages to formatted text
    - CursesUI: Terminal UI management and interaction loop
    - Session management: Subprocess execution with rate limiting

Displays Claude's streaming output in a human-friendly format (upper pane) and
allows humans to provide input between sessions (lower pane).

Configuration:
    CLAUDE_TUI_OUTPUT: Environment variable for output log path
                       (default: <tmpdir>/claude_tui_output.json)

Notes:
    - Logging goes to stderr to not interfere with curses
    - Rate limiting auto-enables --continue to preserve context
    - Terminal must be at least 40x10 for proper display
"""

import argparse
import curses
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
import textwrap
import time
from collections import deque
from datetime import datetime
from pathlib import Path
from typing import Optional

# ============================================================================
# CONFIGURATION CONSTANTS
# ============================================================================

# Output buffer configuration
MAX_OUTPUT_LINES = 10000  # ~500KB at 50 chars/line; prevents memory growth
MAX_JSON_BUFFER_LINES = 100  # Prevents unbounded accumulation of malformed JSON
MAX_INPUT_CHARS = 10000  # Prevents memory exhaustion from stuck keys

# UI rendering configuration
PREVIEW_LINES = 5  # Lines shown in tool input/result previews
PREVIEW_CHAR_WIDTH = 70  # Character width for preview truncation
INPUT_DISPLAY_LINES = 2  # Lines visible in input window
WRAP_WIDTH_OFFSET = 10  # Chars reserved for box borders in wrapping

# Window layout configuration
STATUS_HEIGHT = 1  # Height of status bar
INPUT_HEIGHT = 4  # Height of input pane
MIN_TERMINAL_HEIGHT = 10  # Minimum terminal height required
MIN_TERMINAL_WIDTH = 40  # Minimum terminal width required

# Rate limiting configuration
RATE_LIMIT_MAX_FUTURE_HOURS = 24  # Max hours in future for rate limit reset
RATE_LIMIT_MIN_PAST_HOURS = 1  # Max hours in past for rate limit reset

# Session management
SESSION_PAUSE_SECONDS = 2  # Pause between sessions
SEPARATOR_WIDTH = 60  # Width of session separator lines

# Output file configuration
DEFAULT_OUTPUT_FILENAME = "claude_tui_output.json"

# Configure output path with environment variable support and platform fallback
OUTPUT_PATH = Path(
    os.environ.get(
        "CLAUDE_TUI_OUTPUT",
        str(Path(tempfile.gettempdir()) / DEFAULT_OUTPUT_FILENAME)
    )
)

# Patterns for rate limiting detection
RATE_LIMIT_MSG = re.compile(r"Claude.*(?:usage|use|limit).*reach", re.IGNORECASE)

# ============================================================================
# LOGGING SETUP
# ============================================================================

# Log to stderr to not interfere with curses UI
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stderr
)
logger = logging.getLogger(__name__)


# ============================================================================
# MESSAGE RENDERING
# ============================================================================

class MessageRenderer:
    """
    Renders Claude Code JSON messages in a human-friendly format.

    The renderer maintains minimal state for code block tracking within a single
    message render operation. State is explicitly reset between messages to prevent
    rendering artifacts.

    Attributes:
        width: Terminal width for text wrapping calculations
    """

    def __init__(self, width: int = 80):
        """
        Initialize renderer with terminal width.

        Args:
            width: Terminal width for wrapping (must be > WRAP_WIDTH_OFFSET)

        Raises:
            ValueError: If width is too small for rendering
        """
        if width <= WRAP_WIDTH_OFFSET:
            raise ValueError(f"Width must be > {WRAP_WIDTH_OFFSET}, got {width}")

        self.width = width
        # Rendering state (reset at start of each render_message call)
        self._current_box_type = ""
        self._assistant_in_code_block = False

    def _reset_state(self):
        """
        Reset rendering state.

        Called at the start of render_message() to ensure each message
        renders independently without artifacts from previous renders.
        """
        self._current_box_type = ""
        self._assistant_in_code_block = False

    def wrap_text(self, text: str, width: Optional[int] = None) -> list[str]:
        """
        Wrap text to specified width.

        Args:
            text: Text to wrap
            width: Maximum line width (default: self.width - WRAP_WIDTH_OFFSET)

        Returns:
            List of wrapped lines
        """
        if width is None:
            width = self.width - WRAP_WIDTH_OFFSET

        if not text:
            return []

        return textwrap.wrap(
            text,
            width=width,
            break_long_words=False,
            break_on_hyphens=False
        )

    def render_user_message(self, json_obj: dict) -> list[str]:
        """
        Render a user message in a green box.

        Args:
            json_obj: JSON object with type="user"

        Returns:
            List of formatted output lines
        """
        lines = []
        content = json_obj.get("message", {}).get("content", [])

        if content and isinstance(content, list) and len(content) > 0:
            # Extract text from first content item
            if isinstance(content[0], dict):
                text = content[0].get("text", "")
            else:
                text = str(content[0])

            if text:
                lines.append("╭─── User")
                for wrapped_line in self.wrap_text(text):
                    lines.append(f"│  {wrapped_line}")
                lines.append("╰───")

        return lines

    def render_assistant_text(self, text: str) -> list[str]:
        """
        Render assistant text with markdown-like formatting.

        Supports:
            - Code blocks (```)
            - Headers (# ## ###)
            - Text wrapping

        Args:
            text: Raw text from assistant message

        Returns:
            List of formatted lines with markdown styling

        Note:
            Uses self._assistant_in_code_block to track code block state.
            This state persists within a single message but is reset between messages.
        """
        lines = []

        # Process text line by line
        for line in text.split('\n'):
            stripped = line.strip()

            if stripped.startswith('```'):
                # Code block delimiter
                self._assistant_in_code_block = not self._assistant_in_code_block
                if self._assistant_in_code_block:
                    # Opening code block - extract language
                    lang = stripped[3:].strip()
                    if lang:
                        lines.append(f"│  ┌─[{lang}]")
                continue

            if not stripped:
                # Empty line
                lines.append("│  ")
                continue

            if self._assistant_in_code_block:
                # Inside code block - preserve formatting
                lines.append(f"│     │ {line}")
            elif stripped.startswith('### '):
                # H3 header
                header = stripped[4:]
                lines.append(f"│  ▌ {header}")
            elif stripped.startswith('## '):
                # H2 header
                header = stripped[3:]
                lines.append(f"│  ━━ {header}")
            elif stripped.startswith('# '):
                # H1 header
                header = stripped[2:]
                lines.append(f"│  ═══ {header} ═══")
            else:
                # Regular text with wrapping
                for wrapped_line in self.wrap_text(line):
                    lines.append(f"│  {wrapped_line}")

        return lines

    def render_assistant_message(self, json_obj: dict) -> list[str]:
        """
        Render an assistant message with text and/or tool uses.

        Args:
            json_obj: JSON object with type="assistant"

        Returns:
            List of formatted output lines
        """
        lines = []
        content = json_obj.get("message", {}).get("content", [])

        for item in content:
            if not isinstance(item, dict):
                continue

            item_type = item.get("type")

            if item_type == "text":
                # Text content
                if not lines or self._current_box_type != "assistant":
                    lines.append("  ╭─── Assistant")
                    self._current_box_type = "assistant"

                text = item.get("text", "")
                lines.extend(["  " + line for line in self.render_assistant_text(text)])

            elif item_type == "tool_use":
                # Tool call
                tool_name = item.get("name", "unknown")
                tool_input = item.get("input", {})

                # Close assistant box if open
                if self._current_box_type == "assistant":
                    lines.append("  ╰───")
                    self._current_box_type = ""

                # Show tool call with abbreviated input
                lines.append(f"    ╭─── Tool: {tool_name}")
                input_str = json.dumps(tool_input, indent=2)
                input_lines = input_str.split('\n')[:PREVIEW_LINES]

                for input_line in input_lines:
                    # Truncate long lines
                    if len(input_line) > PREVIEW_CHAR_WIDTH:
                        input_line = input_line[:PREVIEW_CHAR_WIDTH] + "..."
                    lines.append(f"    │  {input_line}")

                if len(input_str.split('\n')) > PREVIEW_LINES:
                    lines.append("    │  ...")
                lines.append("    ╰───")

        # Close assistant box if still open
        if self._current_box_type == "assistant":
            lines.append("  ╰───")
            self._current_box_type = ""

        return lines

    def render_system_message(self, json_obj: dict) -> list[str]:
        """
        Render a system message (e.g., initialization).

        Args:
            json_obj: JSON object with type="system"

        Returns:
            List of formatted output lines
        """
        lines = []
        subtype = json_obj.get("subtype", "unknown")

        if subtype == "init":
            model = json_obj.get("model", "unknown")
            cwd = json_obj.get("cwd", "")

            lines.append("╭─── System Init")
            lines.append(f"│  Model: {model}")
            if cwd:
                lines.append(f"│  CWD: {cwd}")
            lines.append("╰───")

        return lines

    def render_tool_result(self, json_obj: dict) -> list[str]:
        """
        Render tool execution results.

        Args:
            json_obj: JSON object containing tool_result content

        Returns:
            List of formatted output lines
        """
        lines = []
        content = json_obj.get("message", {}).get("content", [])

        if content and isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get("type") == "tool_result":
                    result_content = item.get("content", "")
                    is_error = item.get("is_error", False)

                    color_marker = "[ERROR]" if is_error else "[OK]"
                    lines.append(f"    ╭─── Tool Result {color_marker}")

                    # Show first few lines of result
                    result_lines = str(result_content).split('\n')[:PREVIEW_LINES]
                    for result_line in result_lines:
                        # Truncate long lines
                        if len(result_line) > PREVIEW_CHAR_WIDTH:
                            result_line = result_line[:PREVIEW_CHAR_WIDTH] + "..."
                        lines.append(f"    │  {result_line}")

                    if len(str(result_content).split('\n')) > PREVIEW_LINES:
                        lines.append("    │  ...")
                    lines.append("    ╰───")

        return lines

    def render_message(self, json_obj: dict) -> list[str]:
        """
        Render a JSON message object based on its type.

        This is the main entry point for rendering. State is reset at the
        start to ensure independent rendering of each message.

        Args:
            json_obj: Parsed JSON object from Claude Code stream

        Returns:
            List of formatted output lines ready for display
        """
        # Reset state to prevent artifacts from previous messages
        self._reset_state()

        msg_type = json_obj.get("type", "")

        if msg_type == "user":
            return self.render_user_message(json_obj)
        elif msg_type == "assistant":
            return self.render_assistant_message(json_obj)
        elif msg_type == "system":
            return self.render_system_message(json_obj)
        else:
            # Try to detect tool results
            content = json_obj.get("message", {}).get("content", [])
            if content and isinstance(content, list):
                for item in content:
                    if isinstance(item, dict) and item.get("type") == "tool_result":
                        return self.render_tool_result(json_obj)

        return []


# ============================================================================
# CURSES UI
# ============================================================================

class CursesUI:
    """
    Terminal UI for interactive Claude Code sessions.

    Layout:
        - Output pane (scrollable): Claude's responses and tool output
        - Status line: Current operation status
        - Input pane: User input between sessions

    Attributes:
        stdscr: Curses screen object
        prompt: Initial prompt for Claude
        continue_flag: Whether to use --continue flag
    """

    def __init__(self, stdscr, prompt: str, continue_flag: bool = False):
        """
        Initialize curses UI.

        Args:
            stdscr: Curses screen object
            prompt: Initial prompt to send to Claude
            continue_flag: Start with --continue flag

        Raises:
            ValueError: If terminal is too small
        """
        self.stdscr = stdscr
        self.prompt = prompt
        self.continue_flag = continue_flag

        # Output buffer (bounded deque prevents memory growth)
        self.output_lines = deque(maxlen=MAX_OUTPUT_LINES)
        self.input_buffer = ""

        # Validate terminal dimensions
        self.height, self.width = stdscr.getmaxyx()
        if self.height < MIN_TERMINAL_HEIGHT:
            raise ValueError(
                f"Terminal height ({self.height}) too small. "
                f"Minimum: {MIN_TERMINAL_HEIGHT}"
            )
        if self.width < MIN_TERMINAL_WIDTH:
            raise ValueError(
                f"Terminal width ({self.width}) too small. "
                f"Minimum: {MIN_TERMINAL_WIDTH}"
            )

        # Initialize colors
        curses.start_color()
        curses.use_default_colors()
        curses.init_pair(1, curses.COLOR_GREEN, -1)   # User messages
        curses.init_pair(2, curses.COLOR_BLUE, -1)    # Assistant messages
        curses.init_pair(3, curses.COLOR_YELLOW, -1)  # Status line
        curses.init_pair(4, curses.COLOR_RED, -1)     # Errors
        curses.init_pair(5, curses.COLOR_CYAN, -1)    # Tools

        # Setup windows with validated dimensions
        total_fixed_height = STATUS_HEIGHT + INPUT_HEIGHT
        self.output_height = self.height - total_fixed_height
        self.output_win = curses.newwin(self.output_height, self.width, 0, 0)
        self.status_win = curses.newwin(STATUS_HEIGHT, self.width, self.output_height, 0)
        self.input_win = curses.newwin(INPUT_HEIGHT, self.width, self.output_height + STATUS_HEIGHT, 0)

        self.output_win.scrollok(True)
        self.output_win.idlok(True)

        self.renderer = MessageRenderer(width=self.width)

        # Scroll position (0 = showing most recent)
        self.scroll_offset = 0

        logger.info(f"UI initialized: {self.width}x{self.height}, output_path={OUTPUT_PATH}")

    def add_output_line(self, line: str):
        """
        Add a line to the output buffer.

        Args:
            line: Text line to add
        """
        self.output_lines.append(line)
        self.scroll_offset = 0  # Auto-scroll to bottom

    def refresh_output(self):
        """
        Refresh the output window with current buffer contents.

        Handles scrolling and truncation for terminal bounds.
        """
        self.output_win.clear()

        # Calculate visible range
        total_lines = len(self.output_lines)
        visible_lines = self.output_height - 1

        if total_lines <= visible_lines:
            # All lines fit
            start_idx = 0
        else:
            # Show most recent lines with scroll offset
            start_idx = total_lines - visible_lines + self.scroll_offset
            start_idx = max(0, min(start_idx, total_lines - visible_lines))

        # Draw visible lines
        for i, line in enumerate(list(self.output_lines)[start_idx:start_idx + visible_lines]):
            try:
                # Truncate if necessary
                if len(line) > self.width - 1:
                    line = line[:self.width - 2] + "…"
                self.output_win.addstr(i, 0, line)
            except curses.error as e:
                # Expected at screen edges; log unexpected errors
                if i >= self.output_height - 1:
                    # Expected: writing past last line
                    pass
                else:
                    logger.debug(f"Curses render error at line {i}: {e}")

        self.output_win.refresh()

    def refresh_status(self, message: str):
        """
        Update the status line.

        Args:
            message: Status message to display
        """
        self.status_win.clear()
        self.status_win.attron(curses.color_pair(3))
        status_text = f" {message}"

        # Truncate with ellipsis if too long
        if len(status_text) > self.width - 1:
            status_text = status_text[:self.width - 4] + "..."

        self.status_win.addstr(0, 0, status_text.ljust(self.width - 1))
        self.status_win.attroff(curses.color_pair(3))
        self.status_win.refresh()

    def refresh_input(self):
        """
        Refresh the input window with current buffer.

        Shows up to INPUT_DISPLAY_LINES of wrapped text.
        """
        self.input_win.clear()
        self.input_win.border()

        try:
            self.input_win.addstr(0, 2, " Your Input (press Enter to submit, Ctrl+D to skip) ")
        except curses.error:
            pass  # Title line overflow is cosmetic

        # Show input buffer with wrapping
        if self.input_buffer:
            lines = textwrap.wrap(self.input_buffer, width=self.width - 4)
            for i, line in enumerate(lines[:INPUT_DISPLAY_LINES]):
                try:
                    self.input_win.addstr(i + 1, 2, line)
                except curses.error:
                    pass  # Overflow is cosmetic

            # Show indicator if more lines exist
            if len(lines) > INPUT_DISPLAY_LINES:
                try:
                    self.input_win.addstr(INPUT_DISPLAY_LINES, self.width - 6, "(more)")
                except curses.error:
                    pass

        self.input_win.refresh()

    def get_user_input(self) -> Optional[str]:
        """
        Get input from user (blocking).

        Returns:
            User input string, or None if skipped (Ctrl+D/ESC)

        Note:
            Input is limited to MAX_INPUT_CHARS to prevent memory exhaustion.
        """
        self.refresh_status("Waiting for your input... (Ctrl+D to continue without input)")
        self.input_buffer = ""
        self.refresh_input()

        curses.curs_set(1)  # Show cursor

        while True:
            try:
                ch = self.input_win.getch()

                if ch == 4:  # Ctrl+D
                    curses.curs_set(0)
                    logger.info("User skipped input (Ctrl+D)")
                    return None
                elif ch == ord('\n'):  # Enter
                    curses.curs_set(0)
                    result = self.input_buffer.strip()
                    logger.info(f"User provided input ({len(result)} chars)")
                    return result if result else None
                elif ch == 127 or ch == curses.KEY_BACKSPACE:  # Backspace
                    self.input_buffer = self.input_buffer[:-1]
                elif ch == 27:  # ESC
                    curses.curs_set(0)
                    logger.info("User skipped input (ESC)")
                    return None
                elif 32 <= ch <= 126:  # Printable characters
                    # Enforce input limit
                    if len(self.input_buffer) < MAX_INPUT_CHARS:
                        self.input_buffer += chr(ch)
                    else:
                        # Visual feedback: flash screen when limit reached
                        curses.flash()

                self.refresh_input()

            except KeyboardInterrupt:
                curses.curs_set(0)
                logger.info("User interrupted input (Ctrl+C)")
                return None

    def run_claude_session(self, additional_prompt: Optional[str] = None):
        """
        Run a Claude Code session and display output.

        Args:
            additional_prompt: Optional additional context from user input

        Note:
            Streams output to both UI and OUTPUT_PATH file.
            Implements bounded JSON buffering to prevent memory issues.
        """
        # Build command
        cmd = ["claude"]
        if self.continue_flag:
            cmd.append("--continue")
        cmd.extend([
            "--dangerously-skip-permissions",
            "--verbose",
            "--output-format",
            "stream-json",
            "-p",
        ])

        # Combine prompts if additional input provided
        if additional_prompt:
            full_prompt = f"{self.prompt}\n\nAdditional context from user:\n{additional_prompt}"
            cmd.append(full_prompt)
            logger.info(f"Running session with additional prompt ({len(additional_prompt)} chars)")
        else:
            cmd.append(self.prompt)
            logger.info("Running session with initial prompt")

        self.refresh_status(f"Running: {' '.join(cmd[:3])} ...")
        self.add_output_line("")
        self.add_output_line("=" * SEPARATOR_WIDTH)
        self.add_output_line(f"SESSION STARTED: {datetime.now().isoformat()}")
        self.add_output_line("=" * SEPARATOR_WIDTH)
        self.refresh_output()

        # Run Claude and process output
        try:
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )
        except FileNotFoundError:
            error_msg = "ERROR: 'claude' command not found. Is Claude Code installed?"
            logger.error(error_msg)
            self.add_output_line(error_msg)
            self.refresh_output()
            return

        # Also log to file
        try:
            OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            logger.error(f"Failed to create output directory: {e}")
            self.add_output_line(f"WARNING: Could not create output directory: {e}")

        try:
            with OUTPUT_PATH.open("a", buffering=1) as log_fp:
                json_buffer = ""
                json_buffer_lines = 0

                for line in process.stdout:
                    # Log to file
                    try:
                        log_fp.write(line)
                    except OSError as e:
                        logger.warning(f"Failed to write to output file: {e}")

                    # Try to parse as JSON
                    line = line.strip()
                    if not line:
                        continue

                    if line.startswith('{'):
                        # Start of new JSON object
                        json_buffer = line
                        json_buffer_lines = 1
                    elif json_buffer:
                        # Continuation of JSON object
                        json_buffer += line
                        json_buffer_lines += 1

                        # Safety: prevent unbounded buffer growth
                        if json_buffer_lines > MAX_JSON_BUFFER_LINES:
                            error_msg = (
                                f"ERROR: Malformed JSON after {json_buffer_lines} lines. "
                                f"Buffer: {json_buffer[:100]}..."
                            )
                            logger.error(error_msg)
                            self.add_output_line(error_msg)
                            json_buffer = ""
                            json_buffer_lines = 0
                            continue
                    else:
                        # Non-JSON output
                        self.add_output_line(line)
                        self.refresh_output()
                        continue

                    # Try to parse complete JSON
                    try:
                        json_obj = json.loads(json_buffer)
                        # Render the message
                        rendered_lines = self.renderer.render_message(json_obj)
                        for rendered_line in rendered_lines:
                            self.add_output_line(rendered_line)

                        self.refresh_output()
                        self.refresh_status("Running Claude session...")

                        json_buffer = ""
                        json_buffer_lines = 0
                    except json.JSONDecodeError:
                        # Incomplete JSON, keep accumulating
                        pass

        except OSError as e:
            logger.error(f"Failed to open output file: {e}")
            self.add_output_line(f"WARNING: Could not write to output file: {e}")

        exit_code = process.wait()
        if exit_code != 0:
            logger.warning(f"Claude process exited with code {exit_code}")
            self.add_output_line(f"WARNING: Claude exited with code {exit_code}")

        self.add_output_line("")
        self.add_output_line("=" * SEPARATOR_WIDTH)
        self.add_output_line(f"SESSION ENDED: {datetime.now().isoformat()}")
        self.add_output_line("=" * SEPARATOR_WIDTH)
        self.refresh_output()

    def run_loop(self):
        """
        Main interaction loop.

        Flow:
            1. Run Claude session
            2. Check for rate limiting
            3. If rate limited: sleep and continue
            4. Otherwise: prompt for user input
            5. Repeat

        Note:
            continue_flag is auto-enabled after rate limit to preserve context.
        """
        self.refresh_status("Starting...")
        self.refresh_output()
        self.refresh_input()

        additional_input = None

        while True:
            # Run Claude session
            self.run_claude_session(additional_input)

            # Check for rate limiting
            last_line = last_json_line(OUTPUT_PATH)
            reset_epoch = rate_limit_reset_epoch(last_line)

            if reset_epoch is not None:
                # Rate limited - enable continue and sleep
                self.continue_flag = True
                current_epoch = int(time.time())
                sleep_seconds = max(0, reset_epoch - current_epoch)
                reset_time = datetime.fromtimestamp(reset_epoch).isoformat(timespec="seconds")

                msg = f"Rate limited. Sleeping until {reset_time} ({sleep_seconds}s)"
                logger.info(msg)
                self.add_output_line(msg)
                self.refresh_output()
                self.refresh_status(f"Rate limited - sleeping for {sleep_seconds}s...")

                time.sleep(sleep_seconds)
                continue
            else:
                # Not rate limited - reset continue flag
                self.continue_flag = False

            # Get user input for next iteration
            additional_input = self.get_user_input()

            # Brief pause before next iteration
            time.sleep(SESSION_PAUSE_SECONDS)


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def last_json_line(path: Path) -> str:
    """
    Return the last non-empty line from a file.

    Reads backwards from end to avoid loading entire file into memory.
    Efficient for large files where only the last line is needed.

    Args:
        path: Path to file to read

    Returns:
        Last non-empty line as string, or empty string if file doesn't exist

    Note:
        Reads byte-by-byte backwards. For very long last lines, this could
        be slow, but is acceptable for JSON responses (typically < 1KB).
    """
    if not path.exists():
        logger.debug(f"Output file does not exist: {path}")
        return ""

    try:
        with path.open("rb") as fp:
            fp.seek(0, os.SEEK_END)
            pos = fp.tell() - 1
            buf = bytearray()

            while pos >= 0:
                fp.seek(pos)
                char = fp.read(1)
                if char == b"\n":
                    # Skip trailing newline
                    if pos == fp.tell() - 1 and not buf:
                        pos -= 1
                        continue
                    # Found complete line
                    if buf:
                        break
                else:
                    buf.extend(char)
                pos -= 1

            buf.reverse()
            return buf.decode('utf-8', errors='replace')
    except (OSError, UnicodeDecodeError) as e:
        logger.warning(f"Error reading last line from {path}: {e}")
        return ""


def rate_limit_reset_epoch(raw_json: str) -> Optional[int]:
    """
    Extract rate limit reset timestamp from Claude Code error response.

    Expected format: "Claude usage limit reached|<unix_timestamp>"

    Args:
        raw_json: JSON string from last line of output

    Returns:
        Unix epoch timestamp if rate limited, None otherwise

    Note:
        This parsing depends on Anthropic's error message format.
        If format changes, rate limiting detection will silently fail
        and sessions will not auto-continue.
    """
    if not raw_json:
        return None

    try:
        data = json.loads(raw_json.strip())
        if not (data.get("is_error") and "result" in data):
            return None

        result = data["result"]

        # Check for rate limit message
        if not RATE_LIMIT_MSG.search(result):
            return None

        # Extract timestamp after pipe delimiter
        if "|" not in result:
            logger.warning(f"Rate limit message without timestamp: {result[:100]}")
            return None

        timestamp_str = result.split("|", 1)[1].strip()

        try:
            epoch = int(timestamp_str)
        except ValueError:
            logger.warning(f"Could not parse timestamp: {timestamp_str}")
            return None

        # Validate timestamp is reasonable
        current = int(time.time())
        min_past = current - (RATE_LIMIT_MIN_PAST_HOURS * 3600)
        max_future = current + (RATE_LIMIT_MAX_FUTURE_HOURS * 3600)

        if epoch < min_past:
            logger.warning(f"Rate limit timestamp is too far in past: {epoch}")
            return None
        if epoch > max_future:
            logger.warning(f"Rate limit timestamp is too far in future: {epoch}")
            return None

        logger.info(f"Rate limit detected, reset at epoch {epoch}")
        return epoch

    except (json.JSONDecodeError, KeyError) as e:
        logger.debug(f"Error parsing rate limit response: {e}")
        return None


# ============================================================================
# MAIN
# ============================================================================

def main():
    """
    Main entry point.

    Validates environment, parses arguments, and launches curses UI.
    """
    parser = argparse.ArgumentParser(
        description="Interactive TUI for continuous Claude Code sessions",
        epilog=f"Output is logged to: {OUTPUT_PATH} "
               f"(override with CLAUDE_TUI_OUTPUT env var)"
    )
    parser.add_argument(
        "-p", "--prompt",
        required=True,
        help="Initial prompt to send to Claude Code"
    )
    parser.add_argument(
        "--continue",
        dest="continue_flag",
        action="store_true",
        help="Start with --continue flag (preserve conversation context)"
    )

    args = parser.parse_args()

    # Validate claude binary exists
    if not shutil.which("claude"):
        print("ERROR: 'claude' command not found in PATH", file=sys.stderr)
        print("Please install Claude Code: https://docs.claude.com", file=sys.stderr)
        sys.exit(1)

    # Validate output path is writable
    try:
        OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
        # Test write access
        OUTPUT_PATH.touch(exist_ok=True)
    except OSError as e:
        print(f"ERROR: Cannot write to output path: {OUTPUT_PATH}", file=sys.stderr)
        print(f"Error: {e}", file=sys.stderr)
        print("Set CLAUDE_TUI_OUTPUT to a writable path", file=sys.stderr)
        sys.exit(1)

    logger.info(f"Starting Claude TUI with output to {OUTPUT_PATH}")

    try:
        curses.wrapper(lambda stdscr: CursesUI(stdscr, args.prompt, args.continue_flag).run_loop())
    except ValueError as e:
        # Terminal dimension errors
        print(f"ERROR: {e}", file=sys.stderr)
        print(f"Terminal must be at least {MIN_TERMINAL_WIDTH}x{MIN_TERMINAL_HEIGHT}", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nInterrupted by user", file=sys.stderr)
        logger.info("Interrupted by user")


if __name__ == "__main__":
    main()
