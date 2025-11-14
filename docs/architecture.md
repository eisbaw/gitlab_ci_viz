# Configuration Architecture

## Overview

GitLab CI GANTT Visualizer has a clear split between **startup-time configuration** (handled by Python backend) and **runtime configuration** (handled by JavaScript frontend). Understanding this boundary is essential for adding new features correctly.

## Configuration Boundaries

### Startup-Time Configuration (Backend)

**Handled by**: Python (`serve.py`) via CLI arguments
**Scope**: Configuration that must be known before the browser loads
**Lifecycle**: Set once at server startup, injected into HTML, immutable during session

**What belongs here:**

1. **Authentication**: GitLab token (obtained via `glab auth token`)
2. **Data scope**: What data to fetch
   - `--group <id>`: GitLab group to query
   - `--projects <ids>`: Specific project IDs
   - `--since <time>`: Time range start
3. **Server configuration**:
   - `--port <n>`: HTTP server port
   - `--gitlab-url <url>`: GitLab instance URL
   - `--allow-non-localhost`: Network binding policy
4. **Frontend behavior presets**:
   - `--refresh-interval <seconds>`: Auto-refresh timing

### Runtime Configuration (Frontend)

**Handled by**: JavaScript (`index.html`)
**Scope**: User interactions and dynamic behavior
**Lifecycle**: Can change during session via user interaction

**What belongs here:**

1. **Visualization state**:
   - Timeline zoom level and position
   - Collapsed/expanded groups
   - Selected time window
2. **Interactive features**:
   - Auto-refresh enabled/disabled state
   - Filter toggles
   - Display preferences
3. **Dynamic data updates**:
   - Incremental data fetching
   - Timeline updates from API polling

## Configuration Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. CLI Arguments                                                 │
│    $ python serve.py --group 123 --since "2 days ago" --port 8000│
└──────────────────────────────────┬───────────────────────────────┘
                                   ↓
┌──────────────────────────────────────────────────────────────────┐
│ 2. Python Parsing & Validation (serve.py)                       │
│    - parse_arguments(): argparse.ArgumentParser                 │
│    - validate_arguments(): Port range, refresh interval         │
│    - parse_time_spec(): Convert "2 days ago" → ISO timestamp    │
└──────────────────────────────────┬───────────────────────────────┘
                                   ↓
┌──────────────────────────────────────────────────────────────────┐
│ 3. Configuration Object Building (build_config_js)              │
│    Python dict with validated values:                           │
│    {                                                             │
│      'gitlabToken': '...',                                       │
│      'gitlabUrl': 'https://gitlab.com',                          │
│      'groupId': '123',                                           │
│      'since': '2 days ago',                                      │
│      'updatedAfter': '2025-01-12T10:00:00Z',                     │
│      'refreshInterval': 60                                       │
│    }                                                             │
└──────────────────────────────────┬───────────────────────────────┘
                                   ↓
┌──────────────────────────────────────────────────────────────────┐
│ 4. JSON Serialization + XSS Protection                          │
│    - json.dumps(config, indent=2)                               │
│    - Escape </script> → <\/script> (XSS prevention)              │
│    - Wrap as: const CONFIG = {...};                             │
└──────────────────────────────────┬───────────────────────────────┘
                                   ↓
┌──────────────────────────────────────────────────────────────────┐
│ 5. HTML Injection (ConfigInjectingHandler)                      │
│    - Read index.html template                                   │
│    - Find </head> tag                                            │
│    - Inject: <script>const CONFIG = {...};</script>             │
│    - Send to browser                                            │
└──────────────────────────────────┬───────────────────────────────┘
                                   ↓
┌──────────────────────────────────────────────────────────────────┐
│ 6. JavaScript Consumption (index.html)                          │
│    - Global CONFIG object available                             │
│    - Used in: API client, refresh logic, status display         │
│    Examples:                                                     │
│      apiClient = new GitLabAPI(CONFIG.gitlabUrl, CONFIG.token)  │
│      setInterval(..., CONFIG.refreshInterval * 1000)            │
└──────────────────────────────────────────────────────────────────┘
```

## Decision Guide: When to Add New Configuration

### Add as CLI Argument (Python) if:

1. **Must be known at startup** before any browser interaction
2. **Changes require server restart** (e.g., different GitLab instance)
3. **Affects data scope** (what to fetch from API)
4. **Security-sensitive** (tokens, network binding)
5. **Validation required** before serving HTML (fail-fast)

**Examples:**
- GitLab instance URL (`--gitlab-url`)
- Time range filter (`--since`)
- Project selection (`--group`, `--projects`)
- Server port (`--port`)

**How to add:**

1. Add argument to `parse_arguments()` in `serve.py`:
   ```python
   parser.add_argument(
       '--my-option',
       type=str,
       default='default-value',
       help='Description for --help'
   )
   ```

2. Add validation to `validate_arguments()` if needed:
   ```python
   if args.my_option not in VALID_VALUES:
       logging.error(f"Invalid value: {args.my_option}")
       sys.exit(1)
   ```

3. Add to config dict in `build_config_js()`:
   ```python
   config = {
       # ... existing config
       'myOption': args.my_option
   }
   ```

4. Use in JavaScript:
   ```javascript
   const value = CONFIG.myOption;
   ```

### Add as JavaScript Variable (Frontend) if:

1. **User can change it** during session (interactive feature)
2. **Doesn't affect data fetching** (visualization preference)
3. **No validation needed** at startup
4. **UI state** (collapsed groups, zoom level)

**Examples:**
- Timeline zoom level (user interaction)
- Collapsed/expanded state (UI preference)
- Auto-refresh pause/resume toggle (user control)

**How to add:**

1. Define variable in `index.html`:
   ```javascript
   let myFeatureEnabled = true;
   ```

2. Add UI controls if needed:
   ```html
   <button onclick="myFeatureEnabled = !myFeatureEnabled">
       Toggle Feature
   </button>
   ```

3. Use in application logic:
   ```javascript
   if (myFeatureEnabled) {
       // feature logic
   }
   ```

## Common Configuration Change Patterns

### Pattern 1: Add New Data Filter

**Scenario**: Want to filter pipelines by status (success/failed)

**Decision**: CLI argument (affects what data to fetch)

**Implementation**:
```python
# serve.py
parser.add_argument(
    '--status',
    type=str,
    choices=['success', 'failed', 'running', 'all'],
    default='all',
    help='Filter pipelines by status'
)

# In build_config_js()
config['pipelineStatus'] = args.status

# index.html
const statusFilter = CONFIG.pipelineStatus;
// Use in API query or post-filter
```

### Pattern 2: Add Interactive Display Toggle

**Scenario**: Want to hide job details (show only pipelines)

**Decision**: JavaScript variable (UI preference, no data impact)

**Implementation**:
```javascript
// index.html
let showJobDetails = true;

function toggleJobDetails() {
    showJobDetails = !showJobDetails;
    renderTimeline(); // re-render with new setting
}

// In rendering logic
if (showJobDetails) {
    // include job items
}
```

### Pattern 3: Add Server Behavior Configuration

**Scenario**: Want to set CORS headers for custom domains

**Decision**: CLI argument (server-level configuration)

**Implementation**:
```python
# serve.py
parser.add_argument(
    '--cors-origin',
    type=str,
    help='Custom CORS origin (default: localhost only)'
)

# In ConfigInjectingHandler.end_headers()
if self.cors_origin:
    self.send_header('Access-Control-Allow-Origin', self.cors_origin)
```

### Pattern 4: Add Derived Configuration

**Scenario**: Want to compute API pagination size based on time range

**Decision**: Python computes at startup, injects as config value

**Implementation**:
```python
# serve.py in build_config_js()
# Compute based on existing config
days_diff = compute_days_from_since(args.since)
page_size = 100 if days_diff > 7 else 50

config['paginationSize'] = page_size

# index.html
const pageSize = CONFIG.paginationSize;
```

## Why Certain Features Must Be Frontend/Backend

### Why Caching Cannot Be Backend

**Problem**: Why can't we cache GitLab API responses in Python?

**Reason**: Architectural constraint - backend is stateless by design

1. **Backend is ephemeral**: HTTP server just injects config and serves files
2. **No persistence layer**: No database, no file cache, no in-memory store
3. **Frontend does all queries**: Python never touches GitLab API
4. **Simplicity is a feature**: Zero dependencies, zero state management

**If you need caching:**
- Implement in frontend (localStorage, IndexedDB)
- Or redesign with stateful backend (breaks architecture)

### Why Data Fetching Is Frontend

**Problem**: Why doesn't Python fetch and aggregate pipeline data?

**Reason**: Intentional design for hackability and security

1. **No GitLab API library**: Would require dependency (requests, urllib3)
2. **Token in browser**: Acceptable for local dev tool (visible in DevTools anyway)
3. **Easier to debug**: Browser DevTools show all API calls
4. **User can hack it**: JavaScript is easier to modify than Python server

**If you need backend fetching:**
- Violates "zero dependencies" principle
- Requires persistent backend (goes against stateless design)
- Consider if this tool is right fit for your use case

### Why Configuration Is Injected (Not API Endpoint)

**Problem**: Why not serve config via `/api/config` endpoint?

**Reason**: Reduces complexity and attack surface

1. **One request instead of two**: Browser gets HTML + config in single load
2. **No endpoint to expose**: Simpler security model
3. **No JSON parsing race**: Config guaranteed available when JS executes
4. **Fail-fast**: Invalid config detected at startup, not runtime

## Configuration Validation Strategy

### Python-Side Validation (Startup)

**Philosophy**: Fail fast before serving any content

**What to validate:**
- Argument types and ranges (port 1-65535)
- Mutually exclusive options (--group XOR --projects)
- Format validation (time specs, URLs)
- Token availability (`glab auth token` works)

**Example**:
```python
# serve.py validate_arguments()
if not (1 <= args.port <= 65535):
    logging.error(f"Invalid port {args.port}. Must be 1-65535.")
    sys.exit(1)

if args.refresh_interval < 0 or args.refresh_interval > 86400:
    logging.error("Refresh interval must be 0-86400 seconds")
    sys.exit(1)
```

### JavaScript-Side Validation (Runtime)

**Philosophy**: Graceful degradation, user-friendly errors

**What to validate:**
- API responses (handle 404, 401, rate limits)
- Data format from GitLab API
- User input to interactive features

**Example**:
```javascript
// index.html error handling
try {
    const projects = await apiClient.fetchProjects();
} catch (error) {
    showError(`Failed to fetch projects: ${error.message}`);
}
```

## Security Considerations

### Token Handling

1. **Never logged**: Token redacted from all server logs
2. **Never stored**: Exists only in memory during session
3. **Injected once**: Embedded in HTML, available as `CONFIG.gitlabToken`
4. **Visible in browser**: Acceptable trade-off for local dev tool
5. **Network isolation**: Default localhost-only (unless `--allow-non-localhost`)

### XSS Prevention

Configuration injection includes XSS protection:

```python
# serve.py build_config_js()
json_str = json.dumps(config, indent=2)

# Critical: Escape HTML-significant sequences
json_str = json_str.replace('</script>', r'<\/script>')
json_str = json_str.replace('<script>', r'<\script>')
```

**Why needed**: Malicious group names like `</script><script>alert(1)</script>` would break out of JSON context without escaping.

### Input Validation

All CLI arguments validated before injection:

- URLs: Format validation via `urlparse()`
- Time specs: Parse to ISO timestamp or fail
- Port: Must be 1-65535
- Refresh interval: Must be 0-86400 (max 24 hours)

## Configuration State Management

### Immutable Configuration

Once server starts, configuration is frozen:

- No way to change `--group` without restart
- No way to change `--since` without restart
- Forces intentional session boundaries

**Why immutable**:
1. Simplicity: No state management logic
2. Predictability: Config matches command line
3. Security: No endpoints to change config dynamically

### Mutable UI State

Frontend can change visualization settings:

- Zoom level and pan position (vis.js Timeline state)
- Collapsed/expanded groups (stored in Timeline DataSet)
- Auto-refresh pause/resume (JavaScript variable)

**Not persisted**: Refresh page → state resets to defaults

**If you need persistence**:
- Use localStorage in JavaScript
- Or accept ephemeral state (current design)

## Summary Decision Tree

```
Do you want to add a configuration option?
│
├─ Yes → Ask: Must it be known at server startup?
│        │
│        ├─ Yes → Ask: Does it affect what data to fetch?
│        │        │
│        │        ├─ Yes → CLI argument (--option)
│        │        │        Add to parse_arguments()
│        │        │        Add validation to validate_arguments()
│        │        │        Add to config dict in build_config_js()
│        │        │        Use as CONFIG.option in JavaScript
│        │        │
│        │        └─ No → Ask: Is it server configuration?
│        │                 │
│        │                 ├─ Yes → CLI argument (e.g., --port)
│        │                 │
│        │                 └─ No → Consider: Should it be hardcoded?
│        │
│        └─ No → JavaScript variable
│                 Define in index.html
│                 Add UI controls if needed
│                 Use in application logic
│
└─ No → Congratulations! One less thing to configure.
```

## Related Documentation

- [PRD.md](../PRD.md): Overall architecture and responsibilities split
- [README.md](../README.md#architecture): High-level architecture overview
- [serve.py](../serve.py): Backend implementation with inline documentation
- [index.html](../index.html): Frontend implementation with CONFIG usage examples
