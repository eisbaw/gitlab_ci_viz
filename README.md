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

## Security Model

### Token Handling: Threat Model and Limitations

This tool is designed as a **localhost development tool** with specific security properties. Understanding what we protect against—and what we don't—is critical for safe usage.

#### Where Your GitLab Token Is Visible

When you run this tool, your GitLab authentication token is:

1. **In browser memory**: The token is stored in JavaScript variables in the browser's runtime
2. **In DevTools**: Visible in browser Developer Tools (Console, Network tab, Sources)
3. **In browser extensions**: Accessible to any browser extensions you have installed
4. **In page source**: Embedded in the HTML served by the local server
5. **In HTTP requests**: Included in API requests visible in Network tab

The token is **NOT**:
- Stored in browser localStorage or sessionStorage
- Persisted to disk by the application
- Transmitted to any server except your configured GitLab instance
- Logged to server logs (redacted with `[REDACTED]`)

#### What We Protect Against

✅ **Token persistence**: Token only exists in memory during the browser session
✅ **Accidental logging**: Token redacted from server error messages and logs
✅ **Network exposure**: Localhost-only binding prevents LAN/WAN exposure
✅ **Unintentional sharing**: Token not saved in config files or browser storage

#### What We DON'T Protect Against

❌ **Malicious browser extensions**: Extensions can read all page JavaScript and DOM
❌ **Local malware**: Any process with access to your browser memory can extract the token
❌ **Screen sharing**: Token visible in DevTools Network tab during screen shares
❌ **Physical access**: Anyone at your computer can open DevTools and view the token
❌ **Browser history**: Page source with embedded token may be in browser cache

#### Why This Approach Is Acceptable

This tool targets **local development use** by authenticated developers who:

1. **Already have the token**: You must authenticate with `glab auth login` first
2. **Run on trusted machines**: Development workstations with existing GitLab access
3. **Use localhost only**: Default binding to 127.0.0.1 prevents network exposure
4. **Accept browser visibility**: Similar to any client-side API tool (Postman, curl, etc.)

**Key principle**: The token is no more exposed than using `curl` with a token in the command line or using browser-based GitLab access.

#### Security Best Practices

1. **Use localhost only**: Never use `--allow-non-localhost` on untrusted networks
2. **Close browser when done**: Terminate the browser session to clear token from memory
3. **Use token scopes**: Create GitLab tokens with minimal required scopes (read_api, read_repository)
4. **Rotate tokens regularly**: Especially if you suspect exposure
5. **Monitor token usage**: Check GitLab's "Active Sessions" and "Personal Access Tokens" pages
6. **Disable risky extensions**: Remove or disable browser extensions on development profiles
7. **Don't screen share DevTools**: Close DevTools before screen sharing or presentations

#### Localhost-Only Enforcement

By default, the server binds to `127.0.0.1` (localhost only), preventing access from other machines:

```bash
# Safe: Only accessible from your machine
python serve.py --group 12345 --since "2 days ago"
```

To bind to all interfaces (e.g., for testing from another device), you must explicitly override:

```bash
# ⚠️ INSECURE: Token exposed to your network
python serve.py --group 12345 --since "2 days ago" --allow-non-localhost
```

**Warning**: Using `--allow-non-localhost` on untrusted networks (coffee shops, conferences, public WiFi) exposes your GitLab token to anyone on that network.

#### Token Redaction in Logs

All error messages and server logs automatically redact the token:

```
# What you see in logs:
[ERROR] API request failed: 401 Unauthorized for token [REDACTED]

# What attackers might see in logs:
[REDACTED]  # Token never appears in server logs or error output
```

This prevents accidental token leakage when:
- Sharing log files for debugging
- Posting error messages in bug reports
- Screen sharing terminal output

#### When to Reconsider Using This Tool

**Don't use this tool if**:

1. **You don't control the machine**: Shared computers, internet cafes, untrusted environments
2. **You must share access**: Multiple users need to view the dashboard (deploy a proper backend instead)
3. **Token has broad permissions**: Token has write access, admin privileges, or access to sensitive projects
4. **Compliance requires**: Your organization mandates token encryption or hardware security modules
5. **Network is untrusted**: Public WiFi, conference networks, or any non-localhost usage

**Alternative approaches**:

- **GitLab-native views**: Use GitLab's built-in pipeline views for basic monitoring
- **Deployed backend**: Build a server-side application that never exposes tokens to browsers
- **CI/CD integration**: Generate reports in CI pipelines without interactive tools

#### Security Review and Updates

This security model was designed for **local development use only**. If you need:

- Multi-user access → Deploy a backend with authentication
- Production monitoring → Use GitLab's native monitoring or commercial tools
- Compliance requirements → Consult your security team before using

**Last reviewed**: 2025-11-14
**Review trigger**: Any change to token handling or network binding

---

## Project Status

Currently in initial setup phase. See `backlog/tasks/` for implementation tasks.

## License

(To be determined)
