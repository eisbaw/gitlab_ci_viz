# GitLab CI GANTT Visualizer

A web-based GANTT chart visualization tool for GitLab CI/CD pipelines and jobs, showing activity across multiple projects and runners organized by user.

## Overview

This tool provides CI/CD Activity Intelligence by transforming GitLab's project-centric pipeline data into user-centric activity timelines. It enables DevOps engineers and team leads to:

- View overall team CI/CD activity patterns
- Identify runner utilization and bottlenecks
- Understand timing and duration of pipelines across the organization
- Monitor pipeline execution in real-time with auto-refresh

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [CLI Arguments Reference](#cli-arguments-reference)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Security](#security)
- [Dependencies](#dependencies)

## Installation

### Prerequisites

1. **Nix package manager** (recommended for reproducible environment)
   ```bash
   # Install Nix (if not already installed)
   curl -L https://nixos.org/nix/install | sh
   ```

2. **GitLab CLI (`glab`)** - Required for authentication
   - Included in nix-shell
   - Or install manually: https://gitlab.com/gitlab-org/cli

3. **Python 3.8+** (if not using Nix)
   - Backend uses only Python standard library (no pip dependencies)

### Setup

#### Option 1: Using Nix (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd gitlab_ci_viz

# Enter development environment (automatically installs all dependencies)
nix-shell

# Authenticate with GitLab
glab auth login

# You're ready to use the tool
```

#### Option 2: Without Nix

```bash
# Clone the repository
git clone <repository-url>
cd gitlab_ci_viz

# Install glab CLI manually
# See: https://gitlab.com/gitlab-org/cli

# Authenticate with GitLab
glab auth login

# Ensure Python 3.8+ is installed
python3 --version

# You're ready to use the tool (no pip install needed!)
```

### Verify Installation

```bash
# Check that glab authentication works
glab auth status

# Run the help command
python serve.py --help
```

## Quick Start

### View pipelines for a GitLab group

```bash
python serve.py --group 12345 --since "2 days ago"
```

Then open http://localhost:8000 in your browser.

### View pipelines for specific projects

```bash
python serve.py --projects 100,200,300 --since "1 week ago"
```

### Use absolute date

```bash
python serve.py --group 12345 --since "2025-01-10"
```

## Usage

### Basic Workflows

#### 1. Monitor Team Activity Across Group

View all pipeline activity for your team's GitLab group over the past 7 days:

```bash
python serve.py --group 12345 --since "7 days ago"
```

**Use case**: DevOps lead wants to see overall CI/CD patterns across all team projects.

#### 2. Track Specific Projects

Monitor specific high-priority projects:

```bash
python serve.py --projects 100,200,300 --since "3 days ago"
```

**Use case**: Developer wants to track CI activity for related microservices.

#### 3. Investigate Recent Bottlenecks

View detailed pipeline activity from a specific date to troubleshoot runner issues:

```bash
python serve.py --group 12345 --since "2025-01-13T14:00:00"
```

**Use case**: DevOps engineer investigating reported slowdowns on a specific afternoon.

#### 4. Live Monitoring Dashboard

Set up a live monitoring view with fast refresh:

```bash
python serve.py --group 12345 --since "1 hour ago" --refresh-interval 30
```

**Use case**: Monitor ongoing deployments during a release window.

#### 5. Custom GitLab Instance

Use with self-hosted GitLab:

```bash
python serve.py --group 12345 --since "2 days ago" --gitlab-url https://gitlab.company.com
```

**Use case**: Enterprise environment with private GitLab instance.

### Advanced Usage

#### Custom Port

Run on a different port (useful if 8000 is already in use):

```bash
python serve.py --group 12345 --since "2 days ago" --port 9000
```

#### Disable Auto-Refresh

Disable auto-refresh for static analysis:

```bash
python serve.py --group 12345 --since "7 days ago" --refresh-interval 0
```

#### Network Access (Use with Caution)

**⚠️ Security Warning**: This exposes your GitLab token to your network.

```bash
# Only use on trusted networks!
python serve.py --group 12345 --since "2 days ago" --allow-non-localhost
```

Access from another device on your LAN using your machine's IP address:
```
http://192.168.1.100:8000
```

**When to use**: Testing mobile responsiveness, demo on local network.
**Never use**: Public WiFi, conferences, coffee shops, untrusted networks.

## CLI Arguments Reference

### Required Arguments

#### Project Selection (choose one)

| Argument | Type | Description | Example |
|----------|------|-------------|---------|
| `--group GROUP_ID` | Integer | GitLab group ID to fetch all projects from | `--group 12345` |
| `--projects IDS` | Comma-separated | Specific project IDs to monitor | `--projects 100,200,300` |

**Note**: You must specify either `--group` or `--projects`, but not both.

#### Time Range

| Argument | Type | Description | Examples |
|----------|------|-------------|----------|
| `--since TIME_SPEC` | String | Start of time range to fetch pipelines | See [Time Specification](#time-specification) below |

##### Time Specification

The `--since` argument accepts multiple formats:

**Relative time:**
```bash
--since "2 days ago"      # 2 days before now
--since "1 week ago"      # 7 days before now
--since "3 hours ago"     # 3 hours before now
--since "last week"       # Special: exactly 7 days ago
```

**Absolute date:**
```bash
--since "2025-01-10"                # Midnight on Jan 10, 2025
--since "2025-01-13T14:30:00"       # Specific time on Jan 13, 2025
```

**Supported relative units**: second, minute, hour, day, week (singular or plural)

### Optional Arguments

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--port PORT` | Integer | 8000 | HTTP server port (1-65535) |
| `--gitlab-url URL` | String | https://gitlab.com | GitLab instance URL |
| `--refresh-interval SECONDS` | Integer | 60 | Auto-refresh interval (0 to disable, max 86400) |
| `--allow-non-localhost` | Flag | False | Bind to all interfaces (⚠️ insecure) |

### CLI Examples

```bash
# Monitor group since midnight today
python serve.py --group 12345 --since "$(date +%Y-%m-%d)"

# Track multiple projects with fast refresh
python serve.py --projects 100,200 --since "6 hours ago" --refresh-interval 30

# Self-hosted GitLab on custom port
python serve.py --group 999 --since "1 week ago" \
  --gitlab-url https://gitlab.internal.company.com \
  --port 9000

# Disable auto-refresh for performance
python serve.py --group 12345 --since "30 days ago" --refresh-interval 0
```

## Architecture

### Overview

GitLab CI GANTT Visualizer uses a minimal backend + rich frontend architecture:

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                            │
│  ┌──────────────────────────────────────────────────┐   │
│  │  JavaScript Frontend (index.html)                │   │
│  │  - Fetches data from GitLab API v4               │   │
│  │  - Transforms pipelines → GANTT items            │   │
│  │  - Renders vis.js Timeline                       │   │
│  │  - Auto-refreshes periodically                   │   │
│  └──────────────────────────────────────────────────┘   │
│           ↑                             ↓                │
│           │ GitLab API v4 calls         │ Static files   │
│           ↓                             ↑                │
└───────────────────────────────────────────────────────────┘
            │                             │
            │                             │
            ↓                             ↓
     ┌─────────────┐             ┌──────────────┐
     │   GitLab    │             │  Python      │
     │   Server    │             │  Backend     │
     │             │             │  (serve.py)  │
     └─────────────┘             └──────────────┘
                                        │
                                        ↓
                                ┌──────────────┐
                                │ glab CLI     │
                                │ (auth token) │
                                └──────────────┘
```

### Backend Responsibilities

The Python backend (`serve.py`) is intentionally minimal:

1. **Obtain GitLab token**: Execute `glab auth token` command
2. **Parse CLI arguments**: Validate configuration (group/projects, time range, port)
3. **Inject configuration**: Embed token and config as JavaScript in HTML
4. **Serve static files**: HTTP server for HTML, CSS, JS assets

**What it does NOT do**:
- Query GitLab API (frontend responsibility)
- Store or cache data
- Process pipeline data
- Maintain state

### Frontend Responsibilities

The JavaScript frontend (`index.html`) handles all application logic:

1. **Query GitLab API v4**: Direct API calls from browser
   - Fetch projects from group
   - Fetch pipelines for each project
   - Fetch jobs for each pipeline
2. **Transform data**: Convert GitLab API responses to vis.js format
   - Group by user
   - Create collapsible containers
   - Calculate timeline positions
3. **Render visualization**: Interactive GANTT chart using vis.js Timeline
4. **Auto-refresh**: Poll API periodically and update display

### Why This Architecture?

**Benefits of minimal backend:**

1. **Zero Python dependencies**: Uses only stdlib (http.server, argparse, subprocess)
2. **Easy deployment**: No pip, no virtualenv, just Python 3.8+
3. **Token security**: Token only in memory during session, not persisted
4. **Offline-capable**: All assets served locally (no CDN dependencies)
5. **Hackability**: Simple codebase easy to understand and modify

**Trade-offs:**

- Frontend must handle API pagination and rate limiting
- Browser CORS must allow localhost (usually default)
- Token visible in browser DevTools (acceptable for local dev tool)
- Single-threaded server (fine for local use)

### Data Flow

1. **Startup**: `serve.py` obtains token via `glab auth token`
2. **Configuration injection**: Token + config embedded in HTML as `CONFIG` object
3. **Browser loads**: Fetch `index.html` with injected config
4. **Initial data fetch**: JavaScript queries GitLab API for all configured projects
5. **Render timeline**: Transform API data → vis.js DataSet → Timeline render
6. **Auto-refresh loop**: Poll API every N seconds, update timeline incrementally

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **glab command not found** | Run `nix-shell` (glab included) or install manually: `brew install glab` (macOS) |
| **Failed to get GitLab token** | Run `glab auth login` and verify with `glab auth status` |
| **CORS errors in browser** | gitlab.com works by default. Self-hosted: contact admin to allowlist localhost |
| **Port already in use** | Use `--port 9000` or kill process: `lsof -ti:8000 \| xargs kill` |
| **No pipelines showing** | Check time range not too old, verify project IDs exist, ensure token has `read_api` scope |
| **Invalid time format** | Use "N days ago", "2025-01-10", or "last week" (not "yesterday" or "last Tuesday") |
| **Slow timeline rendering** | Reduce time range, use `--projects` instead of `--group`, disable auto-refresh with `--refresh-interval 0` |
| **Token visible in DevTools** | Expected behavior for localhost tool. Close browser when done to clear from memory |

**Performance guidance**: 10 projects × 7 days ≈ 100-500 pipelines (good), 50+ projects × 30 days = thousands (slow)

**Debug steps**: Check browser console (F12), review server logs (stderr), verify API access with curl, check GitLab instance status.

## Development

### Development Environment

This project uses Nix for reproducible development environments.

#### Enter Development Shell

```bash
nix-shell

# This provides:
# - Python 3.12.8
# - glab CLI 1.51.0
# - pytest 8.3.3 with coverage
# - just task runner
```

### Available Commands

The project uses `just` for task automation. All commands should be run inside `nix-shell`.

```bash
# Show all available commands
just

# Run tests with coverage
just test

# Run linting (not yet configured)
just lint

# Start development server with custom args
just run --group 12345 --since "2 days ago"

# Clean temporary files and caches
just clean

# Update vis.js library to new version
just update-visjs 8.4.0
```

### Running Tests

```bash
# Enter nix-shell first
nix-shell

# Run all tests with coverage
just test

# Or run pytest directly
pytest -v --cov=. --cov-report=term-missing --cov-report=html

# View HTML coverage report
open htmlcov/index.html
```

### Project Structure

```
gitlab_ci_viz/
├── serve.py              # Python backend (stdlib only)
├── index.html            # Frontend application
├── static/               # Static assets
│   ├── vis-timeline-graph2d-8.3.1.min.js
│   └── vis-timeline-graph2d-8.3.1.min.css
├── shell.nix             # Nix development environment
├── justfile              # Task automation
├── test_serve.py         # Unit tests
├── test_integration.py   # Integration tests
├── backlog/              # Project management
│   ├── tasks/           # Task tracking
│   └── docs/            # Documentation
└── README.md            # This file
```

## Security

### Token Visibility Model

**Where your GitLab token is visible:**
- Browser memory, DevTools, page source, HTTP requests
- Accessible to browser extensions and any process with browser memory access

**Where it's NOT:**
- Not persisted to disk, localStorage, or sessionStorage
- Not logged (redacted with `[REDACTED]`)
- Not transmitted except to configured GitLab instance

**Threat model:** Localhost-only development tool. Token no more exposed than using curl or Postman.

### Security Practices

| Do | Don't |
|----|-------|
| Use localhost only (default `127.0.0.1` binding) | Use `--allow-non-localhost` on untrusted networks |
| Close browser when done | Screen share with DevTools open |
| Use minimal token scopes (`read_api`) | Grant write/admin permissions |
| Rotate tokens regularly | Share tokens or save in configs |

**Network binding**: Default localhost-only. Use `--allow-non-localhost` to bind all interfaces (⚠️ exposes token to LAN).

**When not to use this tool**: Shared computers, multi-user access needs, compliance-restricted environments, public WiFi.

## Dependencies

### vis.js Timeline Library

- **Version**: 8.3.1
- **Downloaded**: 2025-11-13
- **Build**: Standalone (no external dependencies)
- **Files**:
  - `static/vis-timeline-graph2d-8.3.1.min.js` (529KB)
  - `static/vis-timeline-graph2d-8.3.1.min.css` (20KB)
- **Source**: https://unpkg.com/vis-timeline@8.3.1/

#### API Features Used

The following vis.js Timeline API features are used in this project:

- `vis.Timeline` - Main timeline component
- `vis.DataSet` - Data management for timeline items and groups
- Timeline options: width, height, grouping
- Item properties: id, content, start, end
- (Additional features will be documented as implementation progresses)

#### Updating vis.js

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

### Python Backend: Standard Library Only

#### Why Standard Library Only?

The Python backend (`serve.py`) intentionally uses **only the Python standard library** with no external dependencies. This constraint serves three key purposes:

1. **Zero-dependency deployment**: Users can run the tool anywhere Python 3 is installed without pip, virtual environments, or package management. This is critical for:
   - Corporate environments with restricted PyPI access
   - Air-gapped networks and secure environments
   - Quick deployment on minimal systems (containers, CI runners)
   - Educational contexts where dependency management is a distraction

2. **Learning and hackability**: The codebase remains approachable for developers at all levels. Anyone comfortable with Python can read, understand, and modify the code without learning external frameworks or libraries.

3. **Principle of least power**: The backend's role is minimal (token injection and static file serving). Using only stdlib keeps the tool simple, maintainable, and aligned with UNIX philosophy - do one thing well.

#### What Breaks If Dependencies Are Added?

Adding external dependencies would break the tool for users in:

- **Restricted environments**: Companies with PyPI blocked, air-gapped networks, or security policies prohibiting unapproved packages
- **Minimal environments**: Containers, CI runners, or systems without pip/virtualenv
- **Educational settings**: Classrooms where dependency installation creates friction
- **Quick deployments**: Scenarios where users want to clone and run immediately without setup

The frontend already handles all complex logic (API calls, data transformation, visualization), so the backend doesn't need external libraries to accomplish its goals.

#### Known Limitations

The stdlib-only constraint creates specific limitations:

1. **Date parsing**: `--since` argument parsing implemented with basic regex (supports "N days ago", ISO dates, "last week"). Complex relative dates ("last Tuesday", "3 business days ago") are not supported due to lack of dateutil library.

2. **HTTP server**: Uses `http.server.SimpleHTTPRequestHandler` which is:
   - Single-threaded (adequate for local use)
   - Less performant than production servers (uvicorn, gunicorn)
   - Limited error handling compared to frameworks like Flask/FastAPI

3. **Configuration**: Uses CLI arguments rather than config file libraries (YAML/TOML parsers)

4. **Testing utilities**: Limited to pytest (dev dependency) rather than specialized HTTP testing libraries

These limitations are acceptable because:
- The tool targets **local development use** (single user, localhost only)
- The backend is **intentionally minimal** (config injection and file serving)
- Complex features are **frontend responsibilities** (JavaScript handles API, parsing, visualization)

#### When to Reconsider This Constraint

Consider lifting the stdlib-only constraint if:

1. **Maintenance burden exceeds benefits**: Implementing stdlib workarounds becomes significantly more complex than using well-tested libraries

2. **Feature requirements change fundamentally**:
   - Multi-user support requiring authentication/authorization
   - Production deployment needs (SSL, load balancing, caching)
   - Complex backend processing (data aggregation, caching layers)

3. **User base shifts**: If the primary audience moves from "quick local use" to "deployed service," deployment friction becomes less critical

4. **stdlib implementations prove buggy**: If custom date parsing or HTTP handling causes persistent issues that would be solved by dependencies

#### Decision Record

- **Decision**: Use Python standard library only for backend
- **Date**: 2025-11-14
- **Status**: Active constraint
- **Review trigger**: Maintenance burden or fundamental feature change
- **Documented in**: README.md

## License

(To be determined)
