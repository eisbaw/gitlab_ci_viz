# GitLab CI GANTT Visualizer

A web-based GANTT chart visualization tool for GitLab CI/CD pipelines and jobs, showing activity across multiple projects and runners organized by user.

## Overview

This tool provides CI/CD Activity Intelligence by transforming GitLab's project-centric pipeline data into user-centric activity timelines. It enables DevOps engineers and team leads to:

- View overall team CI/CD activity patterns
- Identify runner utilization and bottlenecks
- Understand timing and duration of pipelines across the organization
- Monitor pipeline execution in real-time

## Dependencies

### vis.js Timeline Library

- **Version**: 8.3.1
- **Downloaded**: 2025-11-13
- **Build**: Standalone (no external dependencies)
- **Files**:
  - `static/vis-timeline-graph2d-8.3.1.min.js` (529KB)
  - `static/vis-timeline-graph2d-8.3.1.min.css` (20KB)
- **Source**: https://unpkg.com/vis-timeline@8.3.1/

### API Features Used

The following vis.js Timeline API features are used in this project:

- `vis.Timeline` - Main timeline component
- `vis.DataSet` - Data management for timeline items and groups
- Timeline options: width, height, grouping
- Item properties: id, content, start, end
- (Additional features will be documented as implementation progresses)

### Updating vis.js

To update to a newer version of vis-timeline:

```bash
just update-visjs VERSION
```

Where VERSION is the desired version (e.g., `8.4.0`).

This will:
1. Download the new version files
2. Rename files to include the version number
3. Update this README with the new version and date
4. Prompt you to update HTML templates

**Important**: After updating, manually verify:
- All HTML files use the new versioned filenames
- The timeline still renders correctly
- No breaking API changes affect our code

## Python Backend: Standard Library Only

### Why Standard Library Only?

The Python backend (`serve.py`) intentionally uses **only the Python standard library** with no external dependencies. This constraint serves three key purposes:

1. **Zero-dependency deployment**: Users can run the tool anywhere Python 3 is installed without pip, virtual environments, or package management. This is critical for:
   - Corporate environments with restricted PyPI access
   - Air-gapped networks and secure environments
   - Quick deployment on minimal systems (containers, CI runners)
   - Educational contexts where dependency management is a distraction

2. **Learning and hackability**: The codebase remains approachable for developers at all levels. Anyone comfortable with Python can read, understand, and modify the code without learning external frameworks or libraries.

3. **Principle of least power**: The backend's role is minimal (token injection and static file serving). Using only stdlib keeps the tool simple, maintainable, and aligned with UNIX philosophy - do one thing well.

### What Breaks If Dependencies Are Added?

Adding external dependencies would break the tool for users in:

- **Restricted environments**: Companies with PyPI blocked, air-gapped networks, or security policies prohibiting unapproved packages
- **Minimal environments**: Containers, CI runners, or systems without pip/virtualenv
- **Educational settings**: Classrooms where dependency installation creates friction
- **Quick deployments**: Scenarios where users want to clone and run immediately without setup

The frontend already handles all complex logic (API calls, data transformation, visualization), so the backend doesn't need external libraries to accomplish its goals.

### Known Limitations

The stdlib-only constraint creates specific limitations:

1. **Date parsing**: `--since` argument accepts string input (validation not yet implemented). When implemented, will use basic string handling rather than robust parsing libraries like `dateutil` or `arrow`. Complex relative dates ("last Tuesday", "3 weeks ago") will not be supported.

2. **HTTP server**: Uses `http.server.SimpleHTTPRequestHandler` which is:
   - Single-threaded (adequate for local use)
   - Less performant than production servers (uvicorn, gunicorn)
   - Limited error handling compared to frameworks like Flask/FastAPI

3. **Configuration**: Uses CLI arguments and environment variables rather than config file libraries (YAML/TOML parsers)

4. **Testing utilities**: Limited to pytest (dev dependency) rather than specialized HTTP testing libraries

These limitations are acceptable because:
- The tool targets **local development use** (single user, localhost only)
- The backend is **intentionally minimal** (config injection and file serving)
- Complex features are **frontend responsibilities** (JavaScript handles API, parsing, visualization)

### When to Reconsider This Constraint

Consider lifting the stdlib-only constraint if:

1. **Maintenance burden exceeds benefits**: Implementing stdlib workarounds becomes significantly more complex than using well-tested libraries

2. **Feature requirements change fundamentally**:
   - Multi-user support requiring authentication/authorization
   - Production deployment needs (SSL, load balancing, caching)
   - Complex backend processing (data aggregation, caching layers)

3. **User base shifts**: If the primary audience moves from "quick local use" to "deployed service," deployment friction becomes less critical

4. **stdlib implementations prove buggy**: If custom date parsing or HTTP handling causes persistent issues that would be solved by dependencies

### What We'd Use If Constraint Lifted

If external dependencies became acceptable, here's what would improve the implementation:

```python
# requirements.txt.example - hypothetical dependencies
flask>=3.0.0           # Robust HTTP framework with better error handling
python-dateutil>=2.8.2 # Comprehensive date parsing ("2 weeks ago", "last Monday")
requests>=2.31.0       # Better HTTP client (if backend needs to query APIs)
pyyaml>=6.0           # Config file support (alternative to CLI args)
click>=8.1.0          # Enhanced CLI argument parsing with validation
```

**Example improvements with dependencies**:

```python
# With dateutil - robust date parsing
from dateutil.parser import parse
from dateutil.relativedelta import relativedelta

def parse_since_arg(since_str):
    """Parse complex relative dates like 'last Tuesday', '3 weeks ago'"""
    return parse(since_str)  # Handles dozens of formats automatically

# With Flask - cleaner HTTP handling
from flask import Flask, render_template_string

app = Flask(__name__)

@app.route('/')
def index():
    return render_template_string(html_template, config=config_js)
```

However, these improvements are **not worth the deployment friction** for the tool's current scope and audience.

### Decision Record

- **Decision**: Use Python standard library only for backend
- **Date**: 2025-11-14
- **Status**: Active constraint
- **Review trigger**: Maintenance burden or fundamental feature change
- **Documented in**: README.md

## Development Environment

This project uses Nix for reproducible development environments.

### Prerequisites

- Nix package manager
- glab CLI (included in nix-shell)

### Setup

```bash
# Enter development environment
nix-shell

# This provides:
# - Python 3.12.8
# - glab CLI 1.51.0
# - pytest 8.3.3 with coverage
# - just task runner
```

## Project Status

Currently in initial setup phase. See `backlog/tasks/` for implementation tasks.

## License

(To be determined)
