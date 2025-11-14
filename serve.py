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
import sys
from datetime import datetime, timedelta, timezone
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

# Configure logging to stderr with timestamp and level
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stderr,
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
    return text.replace(token, "[REDACTED]")


def _read_gitlab_ssh_config(gitlab_url):
    """Read GitLab SSH connection configuration from gitlab.yml.

    Args:
        gitlab_url: GitLab instance URL to extract hostname

    Returns:
        dict with 'hostname', 'ssh_port', 'ssh_user' if found, None otherwise

    Config file location: ~/.config/gitlab_ci_viz/gitlab.yml
    Format:
        hostname: gitlab.example.com
        ssh_port: 12051
        ssh_user: git
    """
    import os

    config_path = os.path.expanduser("~/.config/gitlab_ci_viz/gitlab.yml")
    if not os.path.exists(config_path):
        logging.debug(
            "GitLab SSH config not found at ~/.config/gitlab_ci_viz/gitlab.yml"
        )
        return None

    logging.debug(f"Reading GitLab SSH config from {config_path}")

    try:
        config = {}
        with open(config_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if ":" in line:
                    key, value = line.split(":", 1)
                    key = key.strip()
                    value = value.strip()
                    if key == "hostname":
                        config["hostname"] = value
                    elif key == "ssh_port":
                        try:
                            config["ssh_port"] = int(value)
                        except ValueError:
                            logging.warning(f"Invalid ssh_port value: {value}")
                            return None
                    elif key == "ssh_user":
                        config["ssh_user"] = value

        # Validate all required fields are present
        required = ["hostname", "ssh_port", "ssh_user"]
        if not all(k in config for k in required):
            missing = [k for k in required if k not in config]
            logging.warning(
                f"GitLab SSH config missing required fields: {', '.join(missing)}"
            )
            return None

        return config
    except (IOError, OSError, UnicodeDecodeError) as e:
        logging.warning(f"Failed to read GitLab SSH config: {e}")
        return None


def _read_token_from_glab_config(hostname):
    """Read GitLab token from glab CLI config file.

    Args:
        hostname: GitLab hostname (e.g., 'gitlab.com')

    Returns:
        Token string if found and valid, None otherwise

    Note: glab CLI stores config at ~/.config/glab-cli/config.yml
    This path is glab's default as of v1.x. If glab changes this,
    we'll need to update this path.

    Limitations:
    - Uses line-by-line matching, not proper YAML parser (constrained
      to Python stdlib to avoid external dependencies).
    - May break if glab changes config format.
    """
    import os

    config_path = os.path.expanduser("~/.config/glab-cli/config.yml")
    if not os.path.exists(config_path):
        logging.debug("Config file not found at ~/.config/glab-cli/config.yml")
        return None

    logging.debug(f"Looking for token in config file for host: {hostname}")

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            in_hosts = False
            in_target_host = False
            for line in f:
                line = line.rstrip()
                if line.startswith("hosts:"):
                    in_hosts = True
                    continue
                if in_hosts:
                    # Check if this is our target host
                    if line.strip().startswith(f"{hostname}:"):
                        in_target_host = True
                        continue
                    # Check if we hit another host (means we left our target)
                    if in_target_host and line and not line.startswith("  "):
                        break
                    # Look for token in our target host
                    if in_target_host and "token:" in line:
                        token = line.split("token:", 1)[1].strip()
                        # Validate token format (GitLab tokens are typically 20-200 chars)
                        if not token:
                            logging.warning(
                                f"Config file has empty token for {hostname}"
                            )
                            return None
                        if len(token) < 10 or len(token) > 200:
                            logging.warning(
                                f"Config file token for {hostname} has suspicious length: {len(token)}"
                            )
                            return None
                        return token
    except (IOError, OSError, UnicodeDecodeError) as e:
        logging.warning(f"Failed to read token from config file: {e}")
        return None

    return None


def _create_token_via_ssh(ssh_config):
    """Create a GitLab personal access token via SSH.

    Args:
        ssh_config: dict with 'hostname', 'ssh_port', 'ssh_user'

    Returns:
        Token string if successful, None otherwise

    Creates a token named 'gitlab_ci_viz' with scopes 'read_repository,read_api'
    that expires in 1 day.
    """
    import subprocess

    hostname = ssh_config["hostname"]
    port = ssh_config["ssh_port"]
    user = ssh_config["ssh_user"]

    logging.debug(f"Creating GitLab token via SSH to {user}@{hostname}:{port}")

    try:
        result = subprocess.run(
            [
                "ssh",
                "-p",
                str(port),
                f"{user}@{hostname}",
                "personal_access_token",
                "gitlab_ci_viz",
                "read_repository,read_api",
                "1",
            ],
            capture_output=True,
            text=True,
            check=True,
            timeout=10,
        )

        # Parse output: "Token:   glpat-xxx"
        for line in result.stdout.splitlines():
            line = line.strip()
            if line.startswith("Token:"):
                token = line.split(":", 1)[1].strip()
                if token and len(token) >= 10:
                    logging.info(
                        f"GitLab token created via SSH to {user}@{hostname}:{port}"
                    )
                    return token
                else:
                    logging.warning("SSH returned empty or invalid token")
                    return None

        logging.warning("Could not parse token from SSH output")
        return None

    except subprocess.TimeoutExpired:
        logging.warning("SSH token creation timed out after 10 seconds")
        return None
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr or e.stdout or ""
        logging.warning(f"SSH token creation failed: {error_msg}")
        return None
    except FileNotFoundError:
        logging.warning("'ssh' command not found")
        return None


def get_gitlab_token(gitlab_url="https://gitlab.com"):
    """Obtain GitLab authentication token via fallback chain.

    Tries the following methods in order:
    1. Environment variables: GITLAB_TOKEN or GITLAB_AUTH_TOKEN
    2. SSH token creation using ~/.config/gitlab_ci_viz/gitlab.yml
    3. glab CLI config file: ~/.config/glab-cli/config.yml

    Args:
        gitlab_url: GitLab instance URL (default: https://gitlab.com)
                   Used for SSH config hostname matching and config file lookup

    Returns:
        GitLab personal access token string

    Raises:
        SystemExit: If all methods fail (exits with code 1)

    Note: Environment variables are preferred for reproducibility in
    Docker/CI environments. SSH token creation is second choice (creates
    new short-lived tokens). Config file is last resort (persisted token).
    """
    import os

    logging.debug("Obtaining GitLab token")

    # Extract hostname from gitlab URL for config file lookup
    hostname = urlparse(gitlab_url).netloc

    # 1. Try environment variable first (most reproducible)
    token = os.environ.get("GITLAB_TOKEN") or os.environ.get("GITLAB_AUTH_TOKEN")
    if token:
        logging.info("GitLab token obtained from environment variable")
        return token

    # 2. Try creating token via SSH (second choice - creates fresh token)
    ssh_config = _read_gitlab_ssh_config(gitlab_url)
    if ssh_config:
        token = _create_token_via_ssh(ssh_config)
        if token:
            return token

    # 3. Try reading from glab config file (last resort - persisted token)
    token = _read_token_from_glab_config(hostname)
    if token:
        logging.info(f"GitLab token obtained from config file for {hostname}")
        return token

    # All methods failed
    logging.error("Failed to obtain GitLab token")
    logging.error("Please try one of the following:")
    logging.error("  1. Set GITLAB_TOKEN or GITLAB_AUTH_TOKEN environment variable")
    logging.error(
        "  2. Create ~/.config/gitlab_ci_viz/gitlab.yml with SSH connection details:"
    )
    logging.error("     hostname: your-gitlab-host.com")
    logging.error("     ssh_port: 22")
    logging.error("     ssh_user: git")
    logging.error("  3. Authenticate with: glab auth login")
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
    iso_date_pattern = r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2})?$"
    if re.match(iso_date_pattern, time_spec):
        try:
            # Parse and ensure we have a datetime object
            if "T" in time_spec:
                dt = datetime.fromisoformat(time_spec)
            else:
                # Date only - set time to start of day
                dt = datetime.fromisoformat(time_spec + "T00:00:00")
            # Return in ISO 8601 format with Z suffix
            return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            raise ValueError(
                f"Invalid date format: {time_spec}. "
                "Use ISO 8601 format: 2025-01-10 or 2025-01-10T14:30:00"
            )

    # Handle "last week" special case
    if time_spec.lower() == "last week":
        dt = datetime.now(timezone.utc) - timedelta(weeks=1)
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    # Handle relative time: "N <unit> ago"
    # Examples: "2 days ago", "1 week ago", "3 hours ago"
    relative_pattern = r"^(\d+)\s+(second|minute|hour|day|week)s?\s+ago$"
    match = re.match(relative_pattern, time_spec.lower())

    if match:
        amount = int(match.group(1))
        unit = match.group(2)

        # Map units to timedelta arguments
        unit_mapping = {
            "second": "seconds",
            "minute": "minutes",
            "hour": "hours",
            "day": "days",
            "week": "weeks",
        }

        delta_kwargs = {unit_mapping[unit]: amount}
        dt = datetime.now(timezone.utc) - timedelta(**delta_kwargs)
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

    # If we get here, format is not supported
    raise ValueError(
        "Time format not supported. Use: 2 days ago, 2025-01-10, or last week"
    )


def parse_arguments():
    """Parse command-line arguments."""
    logging.debug("Parsing command-line arguments")
    parser = argparse.ArgumentParser(
        description="GitLab CI GANTT Visualizer Server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    # Project selection (mutually exclusive)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--group", type=str, help="GitLab group ID to fetch projects from"
    )
    group.add_argument(
        "--projects", type=str, help="Comma-separated list of project IDs"
    )

    # Time range
    parser.add_argument(
        "--since",
        type=str,
        required=True,
        help='Time range start (e.g., "2 days ago", "2025-01-10")',
    )

    # Server configuration
    parser.add_argument(
        "--port", type=int, default=8000, help="HTTP server port (default: 8000)"
    )

    parser.add_argument(
        "--gitlab-url",
        type=str,
        default="https://gitlab.com",
        help="GitLab instance URL (default: https://gitlab.com)",
    )

    parser.add_argument(
        "--allow-non-localhost",
        action="store_true",
        help="Allow serving on non-localhost addresses (INSECURE: token exposed to network)",
    )

    parser.add_argument(
        "--refresh-interval",
        type=int,
        default=60,
        help="Auto-refresh interval in seconds (default: 60, 0 to disable)",
    )

    args = parser.parse_args()

    # Log parsed arguments at INFO level (without sensitive token)
    logging.info(
        f"CLI arguments parsed: gitlab_url={args.gitlab_url}, "
        f"port={args.port}, since={args.since}"
    )
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
        logging.error(
            f"Invalid refresh interval {args.refresh_interval}. Must be 0-86400 seconds (0 disables auto-refresh, max 24 hours)."
        )
        sys.exit(1)

    # Validate GitLab URL
    parsed_url = urlparse(args.gitlab_url)
    if not parsed_url.scheme or not parsed_url.netloc:
        logging.error(
            f"Invalid GitLab URL: {args.gitlab_url}. URL must include scheme (http/https) and hostname."
        )
        sys.exit(1)

    # Validate project IDs if provided
    if args.projects:
        project_ids = [p.strip() for p in args.projects.split(",")]
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
        "gitlabToken": token,
        "gitlabUrl": args.gitlab_url,
        "since": args.since,
        "updatedAfter": args.updated_after,
        "port": args.port,
        "refreshInterval": args.refresh_interval,
    }

    if args.group:
        config["groupId"] = args.group
    else:
        # Convert comma-separated string to array
        project_ids = [pid.strip() for pid in args.projects.split(",")]
        config["projectIds"] = project_ids

    # Use standard JSON serialization for proper escaping
    json_str = json.dumps(config, indent=2)

    # Critical XSS prevention: escape </script> and <script> to prevent HTML injection
    # Replace </script> with <\/script> and <script> with <\script>
    # These are valid in JavaScript strings but won't be interpreted as tags by HTML parser
    json_str = json_str.replace("</script>", r"<\/script>")
    json_str = json_str.replace("<script>", r"<\script>")

    return f"const CONFIG = {json_str};"


def create_handler(config_js, token):
    """Factory function to create a handler with injected config and token.

    Args:
        config_js: JavaScript configuration string to inject
        token: GitLab token for redaction in logs

    Returns:
        Handler class with config_js and token bound as instance attributes
    """

    class ConfigInjectingHandler(SimpleHTTPRequestHandler):
        """HTTP request handler that injects configuration into index.html."""

        def __init__(self, *args, **kwargs):
            """Initialize handler with config and token as instance attributes."""
            self.config_js = config_js
            self.token = token
            super().__init__(*args, **kwargs)

        def do_GET(self):
            """Handle GET requests, injecting config into index.html."""
            if self.path == "/" or self.path == "/index.html":
                # Serve index.html with injected config
                self.send_response(200)
                self.send_header("Content-type", "text/html")
                self.end_headers()

                # Read index.html template
                index_path = Path(__file__).parent / "index.html"
                try:
                    with open(index_path, "r", encoding="utf-8") as f:
                        html_content = f.read()

                    # Validate HTML template has injection point
                    if "</head>" not in html_content:
                        logging.error("index.html has no closing </head> tag")
                        self.send_error(500, "Invalid HTML template - missing </head>")
                        return

                    # Inject config as a <script> tag before closing </head>
                    config_script = f"    <script>\n{self.config_js}\n    </script>\n"
                    html_with_config = html_content.replace(
                        "</head>", f"{config_script}</head>"
                    )

                    self.wfile.write(html_with_config.encode("utf-8"))
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

    return ConfigInjectingHandler


def main():
    """Main entry point."""
    logging.info("GitLab CI GANTT Visualizer Server starting")

    args = parse_arguments()
    validate_arguments(args)

    # Security: Enforce localhost-only binding unless explicitly overridden
    bind_address = "127.0.0.1"
    if args.allow_non_localhost:
        logging.warning("⚠️  SECURITY WARNING: Binding to all interfaces (0.0.0.0)")
        logging.warning("⚠️  GitLab token will be exposed to your network!")
        logging.warning("⚠️  Only use --allow-non-localhost in trusted networks")
        bind_address = ""
    else:
        logging.info("Binding to localhost only (127.0.0.1) for security")

    # Get GitLab token
    print("Obtaining GitLab authentication token...")
    token = get_gitlab_token(args.gitlab_url)
    print("Token obtained successfully.")

    # Generate config JavaScript
    logging.debug("Generating JavaScript configuration")
    config_js = create_config_js(token, args)
    logging.info("Configuration prepared successfully")

    # Create handler with config and token as instance attributes
    handler_class = create_handler(config_js, token)

    # Start HTTP server
    server_address = (bind_address, args.port)
    httpd = HTTPServer(server_address, handler_class)

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


if __name__ == "__main__":
    main()
