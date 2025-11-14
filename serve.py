#!/usr/bin/env python3
"""
GitLab CI GANTT Visualizer Backend Server

This minimal Python server:
1. Obtains GitLab auth token via 'glab auth token'
2. Parses command-line arguments for configuration
3. Injects token and config into HTML as JavaScript variables
4. Serves static files via HTTP server

Uses only Python standard library (no external dependencies).
"""

import argparse
import json
import logging
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

# Configure logging to stderr with timestamp and level
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    stream=sys.stderr
)


def redact_token(text, token):
    """Replace token occurrences in text with [REDACTED].

    Args:
        text: String to redact from (can be None or empty)
        token: Token to redact (must not be None or empty)

    Returns:
        Text with token occurrences replaced by [REDACTED]

    Raises:
        AssertionError: If token is None or empty (programming error)
    """
    assert token, (
        "redact_token() called with empty token - programming error. "
        "Token must be validated before calling this function. "
        "Check call site: only call redact_token() with non-empty tokens."
    )
    if not text:
        return text  # Empty/None text is fine, nothing to redact
    return text.replace(token, '[REDACTED]')


def get_gitlab_token():
    """Execute 'glab auth token' and return the token."""
    logging.debug("Executing 'glab auth token' command")
    try:
        result = subprocess.run(
            ['glab', 'auth', 'token'],
            capture_output=True,
            text=True,
            check=True
        )
        logging.debug("glab auth token command completed with exit code 0")
        token = result.stdout.strip()
        if not token:
            logging.error("glab auth token returned empty output")
            sys.exit(1)
        logging.info("GitLab token obtained successfully")
        return token
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr or e.stdout or "Unknown error"
        # Note: Cannot redact token here as it doesn't exist yet (we're trying to obtain it)
        # Token should not appear in glab error output
        logging.error(f"Failed to get GitLab token (exit {e.returncode}): {error_msg}")
        sys.exit(1)
    except FileNotFoundError:
        logging.error("'glab' command not found in PATH. Please install GitLab CLI.")
        sys.exit(1)


def parse_time_spec(time_spec):
    """Parse time specification string and convert to ISO 8601 timestamp.

    Supports:
    - Relative time: "2 days ago", "1 week ago", "3 hours ago"
    - Absolute date: ISO 8601 format "2025-01-10", "2025-01-10T14:30:00"
    - Special keywords: "last week"

    Args:
        time_spec: String specification of time/date

    Returns:
        ISO 8601 formatted timestamp string (e.g., "2025-01-13T10:00:00Z")

    Raises:
        ValueError: If time specification format is not supported
    """
    time_spec = time_spec.strip()

    # Try absolute ISO 8601 date/datetime first
    # Supports: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
    iso_date_pattern = r'^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$'
    if re.match(iso_date_pattern, time_spec):
        try:
            # Parse and ensure we have a datetime object
            if 'T' in time_spec:
                dt = datetime.fromisoformat(time_spec)
            else:
                # Date only - set time to start of day
                dt = datetime.fromisoformat(time_spec + 'T00:00:00')
            # Return in ISO 8601 format with Z suffix
            return dt.strftime('%Y-%m-%dT%H:%M:%SZ')
        except ValueError:
            raise ValueError(
                f"Invalid date format: {time_spec}. "
                "Use ISO 8601 format: 2025-01-10 or 2025-01-10T14:30:00"
            )

    # Handle "last week" special case
    if time_spec.lower() == 'last week':
        dt = datetime.now(timezone.utc) - timedelta(weeks=1)
        return dt.strftime('%Y-%m-%dT%H:%M:%SZ')

    # Handle relative time: "N <unit> ago"
    # Examples: "2 days ago", "1 week ago", "3 hours ago"
    relative_pattern = r'^(\d+)\s+(second|minute|hour|day|week)s?\s+ago$'
    match = re.match(relative_pattern, time_spec.lower())

    if match:
        amount = int(match.group(1))
        unit = match.group(2)

        # Map units to timedelta arguments
        unit_mapping = {
            'second': 'seconds',
            'minute': 'minutes',
            'hour': 'hours',
            'day': 'days',
            'week': 'weeks'
        }

        delta_kwargs = {unit_mapping[unit]: amount}
        dt = datetime.now(timezone.utc) - timedelta(**delta_kwargs)
        return dt.strftime('%Y-%m-%dT%H:%M:%SZ')

    # If we get here, format is not supported
    raise ValueError(
        "Time format not supported. Use: 2 days ago, 2025-01-10, or last week"
    )


def parse_arguments():
    """Parse command-line arguments."""
    logging.debug("Parsing command-line arguments")
    parser = argparse.ArgumentParser(
        description='GitLab CI GANTT Visualizer Server',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    # Project selection (mutually exclusive)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        '--group',
        type=str,
        help='GitLab group ID to fetch projects from'
    )
    group.add_argument(
        '--projects',
        type=str,
        help='Comma-separated list of project IDs'
    )

    # Time range
    parser.add_argument(
        '--since',
        type=str,
        required=True,
        help='Time range start (e.g., "2 days ago", "2025-01-10")'
    )

    # Server configuration
    parser.add_argument(
        '--port',
        type=int,
        default=8000,
        help='HTTP server port (default: 8000)'
    )

    parser.add_argument(
        '--gitlab-url',
        type=str,
        default='https://gitlab.com',
        help='GitLab instance URL (default: https://gitlab.com)'
    )

    parser.add_argument(
        '--allow-non-localhost',
        action='store_true',
        help='Allow serving on non-localhost addresses (INSECURE: token exposed to network)'
    )

    parser.add_argument(
        '--refresh-interval',
        type=int,
        default=60,
        help='Auto-refresh interval in seconds (default: 60, 0 to disable)'
    )

    args = parser.parse_args()

    # Log parsed arguments at INFO level (without sensitive token)
    logging.info(f"CLI arguments parsed: gitlab_url={args.gitlab_url}, "
                 f"port={args.port}, since={args.since}")
    if args.group:
        logging.info(f"Target: group_id={args.group}")
    else:
        logging.info(f"Target: project_ids={args.projects}")

    return args


def validate_arguments(args):
    """Validate parsed arguments and fail fast on invalid input."""
    logging.debug("Validating CLI arguments")

    # Validate port range
    if not (1 <= args.port <= 65535):
        logging.error(f"Invalid port {args.port}. Must be between 1 and 65535.")
        sys.exit(1)

    # Validate refresh interval (0 to disable, max 86400 = 24 hours)
    if args.refresh_interval < 0 or args.refresh_interval > 86400:
        logging.error(f"Invalid refresh interval {args.refresh_interval}. Must be 0-86400 seconds (0 disables auto-refresh, max 24 hours).")
        sys.exit(1)

    # Validate GitLab URL
    parsed_url = urlparse(args.gitlab_url)
    if not parsed_url.scheme or not parsed_url.netloc:
        logging.error(f"Invalid GitLab URL: {args.gitlab_url}. URL must include scheme (http/https) and hostname.")
        sys.exit(1)

    # Validate project IDs if provided
    if args.projects:
        project_ids = [p.strip() for p in args.projects.split(',')]
        if not all(p for p in project_ids):
            logging.error("Project IDs list contains empty values")
            sys.exit(1)

    # Validate and parse time specification
    try:
        args.updated_after = parse_time_spec(args.since)
        logging.debug(f"Parsed time spec '{args.since}' to '{args.updated_after}'")
    except ValueError as e:
        logging.error(str(e))
        sys.exit(1)

    logging.info("CLI arguments validated successfully")


def create_config_js(token, args):
    r"""Generate JavaScript configuration object using JSON serialization.

    Security: Escapes </script> and <script> to prevent XSS when embedding in HTML.
    The HTML parser processes these tags before JavaScript runs, so even within
    a JSON string, an unescaped </script> would close the containing <script> tag.

    Threat Model:
    - All input to this function comes from CLI args and glab token (no user input)
    - Main risk: HTML parser interference when embedding JSON in <script> tag
    - Mitigated by escaping HTML-significant sequences: </script> and <script>
    - JavaScript will correctly interpret <\/script> as </script> in strings

    Note: If user-controlled input ever flows here, additional escaping may be needed.
    """
    config = {
        'gitlabToken': token,
        'gitlabUrl': args.gitlab_url,
        'since': args.since,
        'updatedAfter': args.updated_after,
        'port': args.port,
        'refreshInterval': args.refresh_interval
    }

    if args.group:
        config['groupId'] = args.group
    else:
        # Convert comma-separated string to array
        project_ids = [pid.strip() for pid in args.projects.split(',')]
        config['projectIds'] = project_ids

    # Use standard JSON serialization for proper escaping
    json_str = json.dumps(config, indent=2)

    # Critical XSS prevention: escape </script> and <script> to prevent HTML injection
    # Replace </script> with <\/script> and <script> with <\script>
    # These are valid in JavaScript strings but won't be interpreted as tags by HTML parser
    json_str = json_str.replace('</script>', r'<\/script>')
    json_str = json_str.replace('<script>', r'<\script>')

    return f'const CONFIG = {json_str};'


class ConfigInjectingHandler(SimpleHTTPRequestHandler):
    """HTTP request handler that injects configuration into index.html."""

    config_js = None  # Class variable to hold the config JavaScript
    token = None  # Class variable to hold token for redaction

    def do_GET(self):
        """Handle GET requests, injecting config into index.html."""
        if self.path == '/' or self.path == '/index.html':
            # Serve index.html with injected config
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()

            # Read index.html template
            index_path = Path(__file__).parent / 'index.html'
            try:
                with open(index_path, 'r', encoding='utf-8') as f:
                    html_content = f.read()

                # Validate HTML template has injection point
                if '</head>' not in html_content:
                    logging.error("index.html has no closing </head> tag")
                    self.send_error(500, "Invalid HTML template - missing </head>")
                    return

                # Inject config as a <script> tag before closing </head>
                config_script = f'    <script>\n{self.config_js}\n    </script>\n'
                html_with_config = html_content.replace('</head>', f'{config_script}</head>')

                self.wfile.write(html_with_config.encode('utf-8'))
            except FileNotFoundError as e:
                error_msg = redact_token(str(e), self.token)
                logging.error(f"index.html not found at {index_path}")
                self.send_error(404, f"index.html not found: {error_msg}")
        else:
            # Serve other static files normally
            super().do_GET()

    def log_message(self, format, *args):
        """Override to provide cleaner logging with token redaction."""
        message = format % args
        message = redact_token(message, self.token)
        print(f"[{self.log_date_time_string()}] {message}")


def main():
    """Main entry point."""
    logging.info("GitLab CI GANTT Visualizer Server starting")

    args = parse_arguments()
    validate_arguments(args)

    # Security: Enforce localhost-only binding unless explicitly overridden
    bind_address = '127.0.0.1'
    if args.allow_non_localhost:
        logging.warning("⚠️  SECURITY WARNING: Binding to all interfaces (0.0.0.0)")
        logging.warning("⚠️  GitLab token will be exposed to your network!")
        logging.warning("⚠️  Only use --allow-non-localhost in trusted networks")
        bind_address = ''
    else:
        logging.info("Binding to localhost only (127.0.0.1) for security")

    # Get GitLab token
    print("Obtaining GitLab authentication token...")
    token = get_gitlab_token()
    print("Token obtained successfully.")

    # Generate config JavaScript
    logging.debug("Generating JavaScript configuration")
    config_js = create_config_js(token, args)
    ConfigInjectingHandler.config_js = config_js
    ConfigInjectingHandler.token = token  # Store for redaction in error messages
    logging.info("Configuration prepared successfully")

    # Start HTTP server
    server_address = (bind_address, args.port)
    httpd = HTTPServer(server_address, ConfigInjectingHandler)

    print(f"\n{'='*60}")
    print("GitLab CI GANTT Visualizer Server")
    print(f"{'='*60}")
    print(f"Server running at: http://localhost:{args.port}/")
    print(f"GitLab URL: {args.gitlab_url}")
    if args.group:
        print(f"Group ID: {args.group}")
    else:
        print(f"Project IDs: {args.projects}")
    print(f"Time range: since {args.since}")
    print("\nPress Ctrl+C to stop the server")
    print(f"{'='*60}\n")

    logging.info(f"HTTP server listening on port {args.port}")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logging.info("Shutdown signal received")
        print("\n\nShutting down server...")
        httpd.server_close()
        logging.info("Server stopped successfully")
        print("Server stopped.")


if __name__ == '__main__':
    main()
