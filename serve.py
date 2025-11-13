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
import subprocess
import sys
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
        ValueError: If token is None or empty (programming error)
    """
    if not text:
        return text  # Empty/None text is fine, nothing to redact
    if not token:
        # This should never happen - indicates programming error
        logging.error("SECURITY BUG: redact_token called with empty token")
        raise ValueError("Cannot redact with empty token - security violation")
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

    logging.info("CLI arguments validated successfully")


def create_config_js(token, args):
    """Generate JavaScript configuration object using JSON serialization."""
    config = {
        'gitlabToken': token,
        'gitlabUrl': args.gitlab_url,
        'since': args.since,
        'port': args.port
    }

    if args.group:
        config['groupId'] = args.group
    else:
        # Convert comma-separated string to array
        project_ids = [pid.strip() for pid in args.projects.split(',')]
        config['projectIds'] = project_ids

    # Use standard JSON serialization for proper escaping
    return f'const CONFIG = {json.dumps(config, indent=2)};'


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
