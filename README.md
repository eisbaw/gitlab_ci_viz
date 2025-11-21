# GitLab CI GANTT Visualizer

A web-based GANTT chart visualization tool for GitLab CI/CD pipelines and jobs, showing activity across multiple projects and runners organized by user.

## Overview

This tool provides CI/CD Activity Intelligence by transforming GitLab's project-centric pipeline data into user-centric activity timelines. It enables DevOps engineers and team leads to:

- View overall team CI/CD activity patterns
- Identify runner utilization and bottlenecks
- Understand timing and duration of pipelines across the organization
- Monitor pipeline execution in real-time with auto-refresh

## Features

### Visualization

- **D3-based Interactive GANTT Timeline**: Custom SVG-based visualization with smooth zoom and pan
- **Color-Coded Jobs**: Projects and runners use consistent hash-based colors for easy identification
- **Expandable Pipeline/Job Hierarchy**: Click pipelines to expand and view individual jobs
- **User Avatars**: Visual identification of who triggered each pipeline
- **Runner Contention Analysis**: Background shading shows when runners are overloaded
  - Low contention (2-3 concurrent): Light yellow
  - Medium contention (4): Orange
  - High contention (5-7): Dark orange
  - Critical contention (8+): Red
- **Status Indicators**: Color-coded outlines for success (green), failure (red), running (yellow)
- **Duration Labels**: Human-readable duration displayed on timeline bars
- **Rich Tooltips**: Hover for detailed information (commit SHA, branch/tag, queue time, failure details, runner info)

### Navigation & Interaction

- **Keyboard Shortcuts**:
  - Arrow keys: Pan left/right/up/down
  - Tab: Navigate through pipelines and jobs
  - Space: Expand/collapse pipelines
  - Enter: Open pipeline/job in GitLab
- **Mouse Controls**:
  - Scroll wheel: Zoom in/out
  - Click + drag: Pan timeline
  - Click pipeline boxes: Open in GitLab
- **Viewport/Fetch Decoupling**: Fetches 6 hours beyond viewport for smooth zoom-out without re-fetching
- **URL State Sharing**: Filters, search terms, and duration settings persist to URL for shareable links

### Data Management

- **Auto-Refresh**: Configurable polling interval (default 60s) with countdown display
- **Manual Refresh**: Button to fetch latest data on demand
- **Client-Side Filtering**: Filter by pipeline status (success, failed, running, pending, cancelled, skipped, manual)
- **Job Name Search**: Real-time search to find specific jobs across all pipelines
- **Duration Selector**: Quick buttons for 1h, 6h, 1d, 2d, 1w time ranges
- **Multi-Project Support**: View activity across entire GitLab groups or specific project lists

### Developer Experience

- **Zero Python Dependencies**: Backend uses only Python stdlib - no pip install required
- **Nix-Based Reproducible Environment**: Guaranteed consistent dev environment across machines
- **Three Authentication Methods**: Environment variables, SSH token creation, or glab CLI
- **Performance Benchmarking**: Built-in tools to measure rendering and transformation performance
- **Chrome DevTools Integration**: Project-local Chrome profile for isolated testing
- **Comprehensive Keyboard Help**: Press `?` in app for full shortcut reference

### Architecture

- **Modular Frontend**: 6 JavaScript modules with clear separation of concerns
- **Domain Model**: Clean data transformation from GitLab API to application model
- **9-Layer SVG Rendering**: Optimized layer structure for performance
- **Stateless Backend**: Simple Python server with no persistent state
- **Offline-Capable**: All assets served locally, no external CDN dependencies

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage](#usage)
- [CLI Arguments Reference](#cli-arguments-reference)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Performance and Scaling](#performance-and-scaling)
- [Security](#security)
- [Dependencies](#dependencies)

## Installation

### Prerequisites

Before installing, verify you have the following:

#### Required

1. **Python 3.8 or later**
   - Check your version:
     ```bash
     python3 --version
     ```
   - Must show Python 3.8.0 or higher
   - The backend uses only Python standard library (no pip dependencies required!)

2. **GitLab CLI (`glab`)** - Version 1.30.0 or later
   - Required for GitLab authentication token management
   - Will be automatically installed if using Nix (see setup below)
   - Manual installation: https://gitlab.com/gitlab-org/cli

3. **GitLab Account** with API access
   - Personal access token (see [First-Run Setup](#first-run-setup-gitlab-authentication) for required scopes)
   - Or existing `glab` authentication

4. **Modern web browser**
   - Any browser with ES6+ JavaScript support
   - Chrome 60+, Firefox 60+, Safari 12+, Edge 79+
   - Required for D3.js visualization rendering

#### Optional but Recommended

5. **Nix package manager** - For reproducible development environment
   - Automatically provides correct Python, glab, and all dev tools
   - Install Nix:
     ```bash
     curl -L https://nixos.org/nix/install | sh
     ```
   - **Why Nix?** Guarantees consistent versions across all developers without version conflicts

### Setup

#### Option 1: Using Nix (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd gitlab_ci_viz

# Enter development environment (automatically installs all dependencies)
nix-shell
# This provides: Python 3.12+, glab 1.51+, pytest, just

# Authenticate with GitLab (first-run only)
glab auth login

# You're ready to use the tool
```

#### Option 2: Without Nix (Manual Setup)

```bash
# Clone the repository
git clone <repository-url>
cd gitlab_ci_viz

# Verify Python version (must be 3.8+)
python3 --version

# Install glab CLI
# macOS:
brew install glab

# Linux (see https://gitlab.com/gitlab-org/cli for distribution-specific instructions):
# - Debian/Ubuntu: Download .deb from releases
# - Fedora/RHEL: Download .rpm from releases
# - Arch: yay -S gitlab-glab
# - Or download binary directly

# Verify glab installation
glab --version

# Authenticate with GitLab (first-run only)
glab auth login

# You're ready to use the tool (no pip install needed!)
```

### First-Run Setup: GitLab Authentication

The tool requires a GitLab authentication token to access the API. The backend supports three authentication methods, tried in this order:

#### Authentication Methods (Priority Order)

**Method 1: Environment Variables (Highest Priority)**

Set one of these environment variables:

```bash
export GITLAB_TOKEN="your-token-here"
# OR
export GITLAB_AUTH_TOKEN="your-token-here"

# Then start the server
python serve.py --group 12345 --since "2 days ago"
```

**Best for:** Docker containers, CI/CD environments, scripted deployments

**Method 2: SSH Token Creation (Second Priority)**

Configure SSH-based token creation via `~/.config/gitlab_ci_viz/gitlab.yml`:

```bash
# Create config directory
mkdir -p ~/.config/gitlab_ci_viz

# Create config file
cat > ~/.config/gitlab_ci_viz/gitlab.yml << 'EOF'
hostname: gitlab.example.com
ssh_port: 22
ssh_user: git
EOF
```

The tool will SSH to your GitLab instance and create a short-lived token automatically.

**Best for:** Self-hosted GitLab with SSH access, corporate environments

**Method 3: glab CLI (Easiest for New Users)**

Use the GitLab CLI to manage authentication:

```bash
glab auth login
```

**Note**: `glab auth login` is idempotent - running it multiple times will re-authenticate safely. Your previous token will be replaced.

You'll be prompted to choose an authentication method:

**Option A: Browser-based OAuth (Recommended)**
```
? What GitLab instance do you want to log into? GitLab.com
? How would you like to authenticate? Login with a web browser

! First copy your one-time code: XXXX-XXXX
- Press Enter to open gitlab.com in your browser...
✓ Authenticated with GitLab.com
```

**Option B: Personal Access Token (for self-hosted GitLab or automation)**
```
? What GitLab instance do you want to log into? gitlab.company.com
? How would you like to authenticate? Paste an authentication token
? Paste your authentication token: ********
✓ Authenticated with gitlab.company.com
```

**Creating a Personal Access Token manually:**
1. Go to GitLab → Settings → Access Tokens
2. Create token with **`read_api`** scope (minimum required - other scopes are fine but not needed)
3. Copy the token (you'll only see it once!)
4. Use via environment variable or paste to `glab auth login`

**Best for:** Quick setup, gitlab.com users, development workstations

**Security Note**: Your GitLab token will be:
- Injected into HTML served to your browser (localhost only)
- Visible in browser DevTools and page source
- NOT persisted to disk or logged
- Cleared when browser is closed

This is the expected security model for a localhost development tool. See [Security](#security) for details.

#### Verify Authentication

After setting up authentication via any method, verify it works:

```bash
# If using glab, check status
glab auth status

# Or test directly with GitLab API
# Method 1: Using environment variable
curl -H "PRIVATE-TOKEN: $GITLAB_TOKEN" "https://gitlab.com/api/v4/version"

# Method 2: Using glab token
TOKEN=$(glab auth token 2>/dev/null)
curl -H "PRIVATE-TOKEN: $TOKEN" "https://gitlab.com/api/v4/version"
```

Expected output: JSON with GitLab version info
```json
{"version":"16.7.0","revision":"abc123"}
```

**If this fails**, don't proceed - fix authentication first. See [Troubleshooting](#troubleshooting).

#### Test the Tool

Once authenticated, test that the server can obtain the token:

```bash
# Start the server (it will fetch the token automatically)
python serve.py --help
```

Expected: Help output showing all CLI options

**If you see "Failed to get GitLab token"**, check your authentication setup.

### Smoke Test: Verify Installation

Run these commands to ensure everything is working:

```bash
# 1. Verify Python version (must be 3.8+)
python3 --version
# Expected: Python 3.8.0 or higher

# 2. Verify glab is installed
glab --version
# Expected: glab version 1.30.0 or higher

# 3. Verify glab authentication
glab auth status
# Expected: ✓ Logged in to <instance> as <username>

# 4. Verify serve.py runs
python serve.py --help
# Expected: usage: serve.py [-h] (--group GROUP_ID | --projects PROJECT_IDS) --since TIME_SPEC ...

# 5. Optional: Check that help command shows all options
python serve.py --help | grep -E '(--group|--projects|--since|--port|--gitlab-url)'
# Expected: Should show all 5 options
```

**All checks passed?** You're ready to use the tool! See [Quick Start](#quick-start).

**Something failed?** See [Troubleshooting](#troubleshooting) below.

### Version Requirements Summary

| Component | Minimum Version | Recommended | Provided by Nix |
|-----------|----------------|-------------|-----------------|
| Python    | 3.8.0          | 3.12+       | 3.12+ (current) |
| glab      | 1.30.0         | 1.51+       | 1.51+ (current) |
| Browser   | Any modern browser with ES6 support | Chrome/Firefox latest | N/A |

*Note: Nix package versions shown reflect current nixpkgs channel and may update over time.*

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
│  │  JavaScript Frontend (6 modules + index.html)    │   │
│  │  - Fetches data from GitLab API v4               │   │
│  │  - Transforms pipelines → domain model           │   │
│  │  - Renders D3.js GANTT visualization             │   │
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
                        ┌───────────────────────────────┐
                        │ Token Sources (priority order)│
                        │ 1. Env vars (GITLAB_TOKEN)    │
                        │ 2. SSH token creation         │
                        │ 3. glab CLI config            │
                        └───────────────────────────────┘
```

### Backend Responsibilities

The Python backend (`serve.py`) is intentionally minimal:

1. **Obtain GitLab token**: Try environment variables, SSH token creation, or glab CLI (in that order)
2. **Parse CLI arguments**: Validate configuration (group/projects, time range, port)
3. **Inject configuration**: Embed token and config as JavaScript in HTML
4. **Serve static files**: HTTP server for HTML, CSS, JS assets

**What it does NOT do**:
- Query GitLab API (frontend responsibility)
- Store or cache data
- Process pipeline data
- Maintain state

### Frontend Responsibilities

The JavaScript frontend (6 modules + `index.html`) handles all application logic:

**Module Architecture:**
- `logger.js` - Logging infrastructure
- `error-formatter.js` - User-friendly error messages
- `api-client.js` - GitLab API v4 client
- `data-transformer.js` - Domain model (GroupKey, Pipeline, Job)
- `contention-analyzer.js` - Runner contention calculation
- `d3-gantt.js` - D3.js-based GANTT rendering

**Data Flow:**
1. **Query GitLab API v4**: Direct API calls from browser
   - Fetch projects from group
   - Fetch pipelines for each project
   - Fetch jobs for each pipeline
2. **Transform data**: Convert GitLab API responses to domain model
   - Group by user
   - Analyze runner contention
   - Create collapsible containers
   - Calculate timeline positions
3. **Render visualization**: Interactive GANTT chart using D3.js v7
   - 9-layer SVG rendering (grid, contention, bars, avatars, etc.)
   - Zoom/pan/keyboard navigation
   - Color-coded by project and runner
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

1. **Startup**: `serve.py` obtains token via environment variables, SSH, or glab CLI
2. **Configuration injection**: Token + config embedded in HTML as `CONFIG` object
3. **Browser loads**: Fetch `index.html` with injected config
4. **Initial data fetch**: JavaScript queries GitLab API for all configured projects
5. **Transform to domain**: API responses → GroupKey/Pipeline/Job objects
6. **Analyze contention**: Calculate runner contention periods
7. **Render timeline**: D3.js renders 8-layer SVG GANTT chart
8. **Auto-refresh loop**: Poll API every N seconds, update timeline incrementally

## Troubleshooting

### Installation Issues

#### `glab: command not found`

**Cause:** GitLab CLI not installed or not in PATH.

**Solutions:**
```bash
# Option 1: Use nix-shell (includes glab automatically)
nix-shell

# Option 2: Install glab manually
# macOS:
brew install glab

# Linux: Download from https://gitlab.com/gitlab-org/cli/-/releases
# Or use package manager: apt, yum, pacman, etc.
```

**Verify fix:**
```bash
glab --version  # Should show version 1.30.0 or higher
```

#### `Failed to get GitLab token`

**Cause:** Not authenticated with GitLab via glab.

**Solutions:**
```bash
# Authenticate with GitLab
glab auth login

# Follow the interactive prompts:
# 1. Choose GitLab instance (gitlab.com or self-hosted)
# 2. Choose auth method (browser OAuth or personal token)
# 3. Complete authentication flow

# Verify authentication
glab auth status
```

**Expected output:**
```
✓ Logged in to gitlab.com as <username>
✓ Token scopes: api, read_api, ...
```

**Still failing?**
- Check network connectivity to GitLab instance
- Verify GitLab instance URL is correct
- Try re-authenticating: `glab auth login --hostname gitlab.com`
- Check glab config: `cat ~/.config/glab-cli/config.yml`

#### `Python version too old` or `python3: command not found`

**Cause:** Python 3.8+ not installed.

**Check version:**
```bash
python3 --version
```

**Solutions:**
```bash
# Option 1: Use nix-shell (provides Python 3.12.8)
nix-shell

# Option 2: Install/update Python
# macOS:
brew install python3

# Ubuntu/Debian:
sudo apt update && sudo apt install python3

# Or download from https://www.python.org/downloads/
```

### Runtime Issues

#### CORS errors in browser console

**Symptoms:**
```
Access to fetch at 'https://gitlab.com/api/v4/...' from origin 'http://localhost:8000'
has been blocked by CORS policy
```

**Cause:** GitLab instance doesn't allow localhost CORS requests.

**Solutions:**
- **gitlab.com**: Should work by default. If not, try different browser.
- **Self-hosted GitLab**: Contact GitLab admin to allowlist `http://localhost:8000` in CORS settings.
- **Workaround**: Use browser CORS extension (⚠️ security risk, development only).

**Verification:**
```bash
# Test API access directly
TOKEN=$(glab auth token)
curl -H "PRIVATE-TOKEN: $TOKEN" "https://gitlab.com/api/v4/version"
# Should return GitLab version info
```

#### `Port 8000 already in use`

**Symptoms:**
```
OSError: [Errno 48] Address already in use
```

**Solutions:**
```bash
# Option 1: Use different port
python serve.py --group 12345 --since "2 days ago" --port 9000

# Option 2: Kill process using port 8000
lsof -ti:8000 | xargs kill

# Option 3: Find what's using the port
lsof -i:8000
# Then decide: kill it or use different port
```

#### No pipelines showing in timeline

**Possible causes and solutions:**

1. **Time range too old (no pipelines in that period)**
   ```bash
   # Try recent time range
   python serve.py --group 12345 --since "1 day ago"
   ```

2. **Invalid project IDs**
   ```bash
   # Verify project IDs exist
   TOKEN=$(glab auth token)
   curl -H "PRIVATE-TOKEN: $TOKEN" "https://gitlab.com/api/v4/projects/12345"
   # Should return project info, not 404
   ```

3. **Token missing `read_api` scope**
   ```bash
   # Check token scopes
   glab auth status
   # Should show "read_api" in token scopes

   # If missing, re-authenticate with correct scope
   glab auth login
   ```

4. **Projects have no recent pipelines**
   - Check GitLab web UI: do these projects have pipelines in the time range?
   - Try different projects or time range

**Debug in browser:**
```
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for errors (red text)
4. Check Network tab for failed API requests
5. Look for error responses from GitLab API
```

#### `Invalid time format` error

**Cause:** Unsupported time specification format.

**Supported formats:**
```bash
# ✓ Relative time (supported)
--since "2 days ago"
--since "1 week ago"
--since "3 hours ago"
--since "last week"

# ✓ Absolute date (supported)
--since "2025-01-10"
--since "2025-01-13T14:30:00"

# ✗ Not supported
--since "yesterday"      # Use "1 day ago"
--since "last Tuesday"   # Use absolute date
--since "3 weeks"        # Use "3 weeks ago"
```

**Workaround for complex dates:**
```bash
# Use date command to generate ISO format
--since "$(date -v-2d +%Y-%m-%d)"  # macOS: 2 days ago
--since "$(date -d '2 days ago' +%Y-%m-%d)"  # Linux: 2 days ago
```

#### Slow timeline rendering / Browser freezing

**Cause:** Too many pipelines/jobs to render.

**Solutions:**

1. **Reduce time range**
   ```bash
   # Instead of 30 days, try 7 days
   --since "7 days ago"
   ```

2. **Use specific projects instead of group**
   ```bash
   # Instead of --group (all projects)
   --projects 100,200,300  # Just the busy ones
   ```

3. **Disable auto-refresh while viewing**
   ```bash
   # Set refresh interval to 0
   --refresh-interval 0
   ```

4. **Check data volume**
   - Open browser DevTools → Console
   - Look for log messages about number of pipelines/jobs fetched
   - **Performance guidance:**
     - Good: 10 projects × 7 days ≈ 100-500 pipelines
     - Slow: 50+ projects × 30 days = thousands of pipelines

### Token Security Issues

#### Token visible in browser DevTools

**Is this a problem?** No, this is expected behavior for a localhost development tool.

**Security model:**
- Token visible in browser memory, DevTools, and page source
- NOT persisted to disk, localStorage, or sessionStorage
- Only transmitted to configured GitLab instance
- Cleared when browser is closed

**Security practices:**
```bash
# ✓ Do:
# - Use localhost only (default)
# - Close browser when done
# - Use minimal token scope (read_api)
# - Rotate tokens regularly

# ✗ Don't:
# - Screen share with DevTools open
# - Use --allow-non-localhost on untrusted networks
# - Share token or save in configs
```

### Network Issues

#### Cannot connect to self-hosted GitLab

**Solutions:**
```bash
# Specify GitLab instance URL
python serve.py --group 12345 --since "2 days ago" \
  --gitlab-url https://gitlab.company.com

# Verify URL is correct and accessible
curl https://gitlab.company.com/api/v4/version

# Check if VPN is required
# Check if instance is behind firewall
# Verify TLS certificates are valid
```

#### API rate limiting

**Symptoms:** Timeline loads slowly or times out.

**Cause:** GitLab API rate limits (default: 600 requests/minute).

**Solutions:**
- Reduce number of projects
- Increase refresh interval: `--refresh-interval 300` (5 minutes)
- Contact GitLab admin to increase rate limit
- Use personal access token instead of OAuth (higher limits)

### Debug Checklist

When something isn't working, run through these checks:

```bash
# 1. Verify Python version
python3 --version  # Must be 3.8+

# 2. Verify glab installation
glab --version  # Must be 1.30.0+

# 3. Verify glab authentication
glab auth status  # Must show logged in

# 4. Test token retrieval
glab auth token  # Should output token (not error)

# 5. Test GitLab API access
TOKEN=$(glab auth token)
curl -H "PRIVATE-TOKEN: $TOKEN" "https://gitlab.com/api/v4/version"
# Should return version info

# 6. Check browser console (F12) for JavaScript errors

# 7. Check server logs (stderr) for Python errors

# 8. Verify network access to GitLab instance
ping gitlab.com  # Or your self-hosted instance
```

### Still Having Issues?

If none of the above solutions work:

1. **Check GitLab instance status:** https://status.gitlab.com
2. **Review browser console errors** (F12 → Console tab)
3. **Check server logs** (stderr output from serve.py)
4. **Test with minimal configuration:**
   ```bash
   python serve.py --projects 100 --since "1 hour ago"
   ```
5. **Verify GitLab API is accessible** with curl/wget
6. **Check firewall/proxy settings** if in corporate environment

### Getting Help

When reporting issues, include:
- Python version (`python3 --version`)
- glab version (`glab --version`)
- Operating system
- GitLab instance (gitlab.com or self-hosted)
- Full error message from browser console and server logs
- Command used to start the server

## Development

### Code Style Guide

#### JavaScript Type Annotations

All JavaScript modules use JSDoc type annotations to provide type safety without TypeScript. This enables IDE autocomplete, catches type errors before runtime, and serves as inline documentation.

**Required Annotations:**

1. **All public functions** must have `@param` and `@return` annotations:
   ```javascript
   /**
    * Format duration in human-readable format
    * @param {number|null} seconds - Duration in seconds
    * @returns {string} Human-readable duration (e.g., "1h 23m 45s")
    */
   static formatDuration(seconds) {
       // implementation
   }
   ```

2. **Complex objects** must have `@typedef` definitions:
   ```javascript
   /**
    * @typedef {Object} ContentionPeriod
    * @property {Date} start - Start time of contention period
    * @property {Date} end - End time of contention period
    * @property {number} count - Number of concurrent pipelines
    * @property {string} level - Contention level: 'low', 'medium', 'high', 'critical'
    */
   ```

3. **Class constructors** must document all parameters:
   ```javascript
   /**
    * Create a Pipeline instance
    * @param {number} id - Pipeline ID
    * @param {number} projectId - Project ID
    * @param {string} status - Pipeline status
    */
   constructor(id, projectId, status) {
       // implementation
   }
   ```

**Type Notation:**
- Optional parameters: `@param {string} [name]` or `@param {string} [name=default]`
- Nullable types: `@param {string|null} value`
- Arrays: `@param {User[]} users` or `@param {Array<User>} users`
- Objects: `@param {{groups: VisGroup[], items: VisItem[]}} data`
- Any type: `@param {*} context`
- Void return: `@returns {void}`

**Module-Level Documentation:**

Each module should have a file-level comment describing its purpose and exports:
```javascript
/**
 * Data Transformer Module
 *
 * Transforms GitLab API responses into domain model and vis.js Timeline format.
 *
 * Exports:
 * - User (class)
 * - Pipeline (class)
 * - Job (class)
 * - DataTransformer (class with static methods)
 */
```

**Benefits:**
- IDE autocomplete and IntelliSense
- Early error detection (wrong types, missing parameters)
- Self-documenting code
- Easier refactoring (type usage tracking)
- No build step required (unlike TypeScript)

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

# Run linting
just lint

# Run performance benchmarks
just benchmark

# Start development server with custom args
just run --group 12345 --since "2 days ago"

# Clean temporary files and caches
just clean

# Chrome DevTools integration
just chrome              # Launch Chrome with project profile
just chrome-devtools     # Launch with DevTools open
just clean-chrome        # Clean Chrome profile data
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
├── index.html            # Frontend application orchestration
├── static/               # JavaScript modules and assets
│   ├── logger.js                  # Logging infrastructure
│   ├── error-formatter.js         # Error formatting
│   ├── api-client.js              # GitLab API client
│   ├── data-transformer.js        # Domain model
│   ├── contention-analyzer.js     # Runner contention analysis
│   └── d3-gantt.js                # D3.js GANTT renderer
├── docs/                 # Architecture documentation
│   └── architecture.md
├── shell.nix             # Nix development environment
├── justfile              # Task automation
├── test/                 # Test suite
│   ├── test_serve.py              # Backend unit tests
│   ├── test_integration.py        # Integration tests
│   └── run_performance_benchmarks.py  # Performance tests
├── backlog/              # Project management
│   ├── tasks/                     # Task tracking
│   └── docs/                      # Domain documentation
└── README.md            # This file
```

## Performance and Scaling

### Performance Characteristics

The tool has been benchmarked with the following performance characteristics (measured on Chrome Headless):

| Operation | Duration | Threshold | % of Threshold |
|-----------|----------|-----------|----------------|
| Transform 1000 jobs to domain model | 2.9ms | 500ms | 0.6% |
| Transform to vis.js format (500 items) | 2.3ms | 100ms | 2.3% |
| Full transformation (10 projects, 100 pipelines) | 52.7ms | 2000ms | 2.6% |
| Auto-refresh (no data changes) | 2.4ms | 1000ms | 0.2% |

**Key Takeaways:**
- Data transformation is extremely fast (all operations <60ms)
- Browser rendering overhead minimal for typical datasets
- Auto-refresh is lightweight and suitable for high frequency

### Expected Data Volumes

Based on typical GitLab usage patterns:

| Time Range | Projects | Expected Pipelines | Expected Jobs | Fetch Time | Render Time |
|------------|----------|-------------------|---------------|------------|-------------|
| Last 1 day | 1-5 | 5-50 | 50-500 | <2s | <100ms |
| Last 7 days | 1-5 | 20-200 | 200-2000 | <5s | <200ms |
| Last 30 days | 1-5 | 50-500 | 500-5000 | <15s | <500ms |
| Last 7 days | 10 | 50-500 | 500-5000 | <10s | <500ms |
| Last 7 days | 25 | 100-1000 | 1000-10000 | <20s | <1s |
| Last 7 days | 50 | 200-2000 | 2000-20000 | <40s | <2s |

**Notes:**
- Fetch time depends on GitLab API responsiveness and network latency
- Render time depends on browser performance (Chrome recommended)
- Larger datasets benefit from collapse/expand functionality to reduce visible items

### Pagination Strategy

The tool implements **automatic pagination** for all GitLab API requests:

#### How Pagination Works

1. **Per-page limit**: 100 items (GitLab API maximum)
2. **Sequential fetching**: Each endpoint pages through results using Link headers
3. **Parallel project fetching**: Projects are fetched in parallel, then pipelines for each project are fetched in parallel
4. **Pagination per resource**:
   - Group projects: Paginated if group has >100 projects
   - Pipelines per project: Paginated if project has >100 pipelines in time range
   - Jobs per pipeline: Single request (GitLab returns all jobs for a pipeline)

#### Fetch Strategy

```
For each project (parallel):
  ├─ Fetch pipelines (paginated, sequential per project)
  │  └─ Page 1 → Page 2 → ... → Page N
  │
For each pipeline (parallel, after all pipeline fetches complete):
  └─ Fetch jobs (single request, not paginated)
```

**Why this approach:**
- **Parallel project fetching**: Maximizes throughput across multiple projects
- **Sequential pagination**: Simpler to implement, minimal latency impact (GitLab API is fast)
- **Batch job fetching**: Reduces API calls by fetching all pipeline jobs in parallel after pipelines are known

### Browser Memory Usage

Typical memory consumption (measured in Chrome DevTools):

| Dataset Size | DOM Nodes | Memory Usage | Recommended Action |
|--------------|-----------|--------------|-------------------|
| 100 pipelines, 1000 jobs | ~5000 | ~50MB | Normal use |
| 500 pipelines, 5000 jobs | ~25000 | ~150MB | Normal use, consider collapsing users |
| 1000 pipelines, 10000 jobs | ~50000 | ~300MB | Heavy use, collapse unused sections |
| 2000+ pipelines, 20000+ jobs | ~100000+ | ~600MB+ | Performance degradation likely |

**Memory optimization tips:**
- Collapse users with many pipelines to reduce rendered DOM nodes
- Reduce time range to limit data volume
- Close other browser tabs to free memory
- Use Chrome (better performance than Firefox/Safari)

### GitLab API Rate Limits

GitLab API has the following rate limits (as of 2025):

| Plan | Requests/minute | Requests/hour |
|------|----------------|---------------|
| Free (SaaS) | 300 | 1,800 |
| Premium/Ultimate (SaaS) | 1,000 | 10,000 |
| Self-managed | Configurable (default: no limit) |

#### How This Tool Uses API Calls

For **N projects**, **P pipelines**, fetching requires:
- **1 call** for group projects (if using `--group`)
- **N calls** for project details (if using `--projects`)
- **N × (P/100 rounded up)** calls for pipeline pagination
- **P calls** for job fetching (one per pipeline)

**Example:** 10 projects, 500 pipelines over 7 days
- Group fetch: 1 call
- Pipeline pages: 10 projects × 5 pages = 50 calls
- Jobs: 500 calls
- **Total: ~551 API calls**

**Rate limit impact:**
- Free plan: ~5 minutes to fetch (300 req/min limit)
- Premium plan: <1 minute
- Self-managed: Instant (no limit)

**Auto-refresh consideration:**
With 60-second auto-refresh interval:
- Subsequent refreshes only fetch new/updated pipelines (`updated_after` filter)
- Much cheaper than initial load (typically 10-50 calls vs 500+)
- Free plan users should consider longer refresh intervals (120-300s)

### Performance Recommendations

#### Recommended Configurations

**Daily monitoring (fast refresh):**
```bash
python serve.py --group <group-id> --since "1 day ago" --refresh-interval 30
# Data: <50 pipelines, <500 jobs
# Initial load: <5s, refresh: <2s
# API calls: <100 initial, <10 per refresh
```

**Weekly retrospective (balanced):**
```bash
python serve.py --group <group-id> --since "7 days ago" --refresh-interval 120
# Data: 50-500 pipelines, 500-5000 jobs
# Initial load: 5-15s, refresh: 2-5s
# API calls: 100-1000 initial, 10-50 per refresh
```

**Monthly analysis (heavy):**
```bash
python serve.py --group <group-id> --since "30 days ago" --refresh-interval 300
# Data: 200-2000 pipelines, 2000-20000 jobs
# Initial load: 20-60s, refresh: 5-15s
# API calls: 500-5000 initial, 50-200 per refresh
```

#### When to Stop Using This Tool (Scale Ceiling)

Consider alternative solutions when you encounter:

1. **Consistent load times >60 seconds**
   - Indicates dataset too large for browser-based visualization
   - Recommendation: Use shorter time ranges or filter specific projects

2. **Browser memory usage >1GB**
   - Risk of browser crashes or severe performance degradation
   - Recommendation: Reduce time range or number of projects

3. **API rate limit errors (429) on every load**
   - GitLab Free plan limit (300 req/min) insufficient for dataset
   - Recommendation: Upgrade GitLab plan or reduce refresh frequency

4. **Need for >50 projects or >30 days**
   - Tool designed for team-level visibility, not organization-wide dashboards
   - Recommendation: Use GitLab's native analytics or build a dedicated backend

5. **Requirement for historical data persistence**
   - Tool fetches fresh data on each load, no database/caching
   - Recommendation: Use dedicated monitoring solution (Prometheus, Grafana, GitLab Analytics)

**Hard limits:**
- **Browser DOM limit**: ~100,000 timeline items before severe performance degradation
- **GitLab API timeout**: 30 seconds per request (tool will fail if single project has excessive pagination)
- **Python SimpleHTTPServer**: Single-threaded, not suitable for team-wide deployments

#### Performance Tuning

If experiencing slow performance:

1. **Reduce time range**: Use `--since "3 days ago"` instead of `--since "7 days ago"`
2. **Filter projects**: Use `--projects` with specific IDs instead of entire group
3. **Increase refresh interval**: Use `--refresh-interval 300` (5 min) instead of default 60s
4. **Use Chrome**: Better JavaScript performance than Firefox/Safari
5. **Close other browser tabs**: Free up memory
6. **Collapse inactive users**: Reduces rendered DOM nodes
7. **Consider shorter business hours**: Fetch only recent activity when monitoring

### Time-to-First-Render

Measured from page load to interactive timeline (includes API fetch + transformation + render):

| Scenario | Projects | Pipelines | Jobs | Time-to-Render |
|----------|----------|-----------|------|----------------|
| Small (1 day) | 5 | 20 | 200 | <3s |
| Medium (7 days) | 10 | 200 | 2000 | 5-10s |
| Large (30 days) | 10 | 500 | 5000 | 15-30s |
| Very Large (30 days) | 25 | 1000 | 10000 | 30-60s |

**Factors affecting render time:**
1. **GitLab API latency**: Varies by server load and network
2. **Number of API calls**: More projects/pipelines = more requests
3. **Browser performance**: Chrome > Firefox > Safari
4. **Network speed**: Faster network reduces fetch time
5. **CPU performance**: Affects JavaScript transformation

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

### D3.js Visualization Library

- **Version**: 7 (latest)
- **Source**: CDN (https://d3js.org/d3.v7.min.js)
- **Loading**: Loaded from CDN in `index.html`
- **Size**: ~250KB (minified)
- **License**: BSD 3-Clause

#### Why D3.js?

D3.js was chosen over traditional timeline libraries (like vis.js) for:

1. **Flexibility**: Full control over SVG rendering for custom visualizations
2. **Performance**: Efficient rendering with virtual DOM and layer caching
3. **Customization**: Easy to add custom features (runner contention, avatars, clickable areas)
4. **Modern**: Active development, excellent documentation, large community
5. **Lightweight**: Only load what we use, no unused features

#### D3.js Features Used

The project uses these D3.js modules:

- **d3-selection**: DOM manipulation and SVG element creation
- **d3-scale**: Time scales for X-axis, linear scales for Y-axis
- **d3-axis**: Automatic axis generation with time formatting
- **d3-zoom**: Pan and zoom interactions
- **d3-drag**: Drag interactions for panning
- **d3-color**: Color manipulation for runner hashing
- **d3-time-format**: Human-readable time formatting

#### Custom D3 Implementation

`static/d3-gantt.js` implements a custom GANTT chart with:

- **9-layer SVG architecture**: Separate layers for grid, contention, backgrounds, overlays, bars, avatars, current time line, axis, labels
- **Row-based layout**: Flat row structure for pipelines and jobs
- **Zoom/pan**: Smooth interactions with D3 zoom behavior
- **Performance optimizations**: Row caching, text measurement cache, RequestAnimationFrame
- **Color management**: Consistent project and runner colors via hashing

#### Updating D3.js

D3.js is loaded from CDN, so updates are automatic when D3 releases new versions. To pin to a specific version:

```html
<!-- In index.html, change: -->
<script src="https://d3js.org/d3.v7.min.js"></script>
<!-- To specific version: -->
<script src="https://d3js.org/d3.v7.9.0.min.js"></script>
```

**Note**: Major version changes (v7 → v8) may require code updates. Test thoroughly after upgrading.

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
