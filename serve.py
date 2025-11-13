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
import subprocess
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse


def get_gitlab_token():
    """Execute 'glab auth token' and return the token."""
    try:
        result = subprocess.run(
            ['glab', 'auth', 'token'],
            capture_output=True,
            text=True,
            check=True
        )
        token = result.stdout.strip()
        if not token:
            print("Error: glab auth token returned empty output", file=sys.stderr)
            sys.exit(1)
        return token
    except subprocess.CalledProcessError as e:
        error_msg = e.stderr or e.stdout or "Unknown error"
        print(f"Error: Failed to get GitLab token (exit {e.returncode}): {error_msg}", file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError:
        print("Error: 'glab' command not found. Please install GitLab CLI.", file=sys.stderr)
        sys.exit(1)


def parse_arguments():
    """Parse command-line arguments."""
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

    return parser.parse_args()


def validate_arguments(args):
    """Validate parsed arguments and fail fast on invalid input."""
    # Validate port range
    if not (1 <= args.port <= 65535):
        print(f"Error: Invalid port {args.port}. Must be between 1 and 65535.", file=sys.stderr)
        sys.exit(1)

    # Validate GitLab URL
    parsed_url = urlparse(args.gitlab_url)
    if not parsed_url.scheme or not parsed_url.netloc:
        print(f"Error: Invalid GitLab URL: {args.gitlab_url}", file=sys.stderr)
        print("URL must include scheme (http/https) and hostname.", file=sys.stderr)
        sys.exit(1)

    # Validate project IDs if provided
    if args.projects:
        project_ids = [p.strip() for p in args.projects.split(',')]
        if not all(p for p in project_ids):
            print("Error: Project IDs list contains empty values", file=sys.stderr)
            sys.exit(1)


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
                    print("ERROR: index.html has no closing </head> tag", file=sys.stderr)
                    self.send_error(500, "Invalid HTML template - missing </head>")
                    return

                # Inject config as a <script> tag before closing </head>
                config_script = f'    <script>\n{self.config_js}\n    </script>\n'
                html_with_config = html_content.replace('</head>', f'{config_script}</head>')

                self.wfile.write(html_with_config.encode('utf-8'))
            except FileNotFoundError as e:
                print(f"ERROR: index.html not found at {index_path}", file=sys.stderr)
                self.send_error(404, f"index.html not found: {e}")
        else:
            # Serve other static files normally
            super().do_GET()

    def log_message(self, format, *args):
        """Override to provide cleaner logging."""
        print(f"[{self.log_date_time_string()}] {format % args}")


def main():
    """Main entry point."""
    args = parse_arguments()
    validate_arguments(args)

    # Get GitLab token
    print("Obtaining GitLab authentication token...")
    token = get_gitlab_token()
    print("Token obtained successfully.")

    # Generate config JavaScript
    config_js = create_config_js(token, args)
    ConfigInjectingHandler.config_js = config_js

    # Start HTTP server
    server_address = ('', args.port)
    httpd = HTTPServer(server_address, ConfigInjectingHandler)

    print(f"\n{'='*60}")
    print(f"GitLab CI GANTT Visualizer Server")
    print(f"{'='*60}")
    print(f"Server running at: http://localhost:{args.port}/")
    print(f"GitLab URL: {args.gitlab_url}")
    if args.group:
        print(f"Group ID: {args.group}")
    else:
        print(f"Project IDs: {args.projects}")
    print(f"Time range: since {args.since}")
    print(f"\nPress Ctrl+C to stop the server")
    print(f"{'='*60}\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\nShutting down server...")
        httpd.server_close()
        print("Server stopped.")


if __name__ == '__main__':
    main()
