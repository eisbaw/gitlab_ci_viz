# GitLab CI GANTT Visualizer - Task Automation

# Show available commands
default:
    @just --list

# Run all tests
test:
    pytest -v --cov=. --cov-report=term-missing --cov-report=html

# Run performance benchmarks
benchmark:
    python test/run_performance_benchmarks.py

# Run linting and code quality checks
lint:
    ruff check .
    ruff format --check .

# Run all tests (Python + Node.js)
test-all:
    pytest -v --cov=. --cov-report=term-missing
    npm test

# Run Node.js tests only
test-node:
    npm test

# Run mock GitLab API server standalone
mock-server PORT="8001":
    python mock_gitlab_server.py --port {{PORT}}

# Run visualization server with mock GitLab (development mode)
run-mock *ARGS:
    python serve.py --gitlab-url mock --group 1 --since "2 days ago" {{ ARGS }}

# Run the server with real GitLab instance
run *ARGS:
    python serve.py --group example-group --since '2 days ago' --gitlab-url https://gitlab.example.com {{ ARGS }}

# Clean temporary files and caches
clean:
    rm -rf __pycache__
    rm -rf .pytest_cache
    rm -rf htmlcov
    rm -rf *.pyc
    find . -type d -name __pycache__ -exec rm -rf {} +
    @echo "Cleaned temporary files"

# Launch Chrome with project-local profile (for manual testing)
chrome *ARGS:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -z "${CHROMIUM_PATH:-}" ]; then
        echo "Error: CHROMIUM_PATH not set. Run this from within nix-shell"
        exit 1
    fi
    if [ -z "${CHROME_PROFILE_DIR:-}" ]; then
        echo "Error: CHROME_PROFILE_DIR not set. Run this from within nix-shell"
        exit 1
    fi
    echo "Launching Chrome with project-local profile: $CHROME_PROFILE_DIR"
    "$CHROMIUM_PATH" --user-data-dir="$CHROME_PROFILE_DIR" {{ ARGS }} &

# Launch Chrome with DevTools open
chrome-devtools *ARGS:
    just chrome --auto-open-devtools-for-tabs {{ ARGS }}

# Clean Chrome profile data (removes all project-local browser data)
clean-chrome:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -z "${CHROME_PROFILE_DIR:-}" ]; then
        echo "Error: CHROME_PROFILE_DIR not set. Run this from within nix-shell"
        exit 1
    fi
    echo "Removing Chrome profile directory: $CHROME_PROFILE_DIR"
    rm -rf "$CHROME_PROFILE_DIR"
    echo "Chrome profile cleaned"
