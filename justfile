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

# Run linting and code quality checks
lint:
    @echo "Linting not yet configured"

# Start development server
run *ARGS:
    python serve.py {{ARGS}}

# Clean temporary files and caches
clean:
    rm -rf __pycache__
    rm -rf .pytest_cache
    rm -rf htmlcov
    rm -rf *.pyc
    find . -type d -name __pycache__ -exec rm -rf {} +
    @echo "Cleaned temporary files"
