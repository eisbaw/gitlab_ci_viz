# GitLab CI GANTT Visualizer - Task Automation

# Show available commands
default:
    @just --list

# Update vis.js library to a new version
update-visjs VERSION:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "Downloading vis-timeline version {{VERSION}}..."
    curl -L -o static/vis-timeline-graph2d-{{VERSION}}.min.js \
        "https://unpkg.com/vis-timeline@{{VERSION}}/standalone/umd/vis-timeline-graph2d.min.js"
    curl -L -o static/vis-timeline-graph2d-{{VERSION}}.min.css \
        "https://unpkg.com/vis-timeline@{{VERSION}}/styles/vis-timeline-graph2d.min.css"
    echo "Downloaded successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Update README.md with new version and date"
    echo "2. Update all HTML files to reference new versioned filenames"
    echo "3. Remove old version files after verifying new version works"
    echo "4. Commit with message: 'Update vis-timeline to {{VERSION}}'"

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

# Run the server, then connect on localhost:8000
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
