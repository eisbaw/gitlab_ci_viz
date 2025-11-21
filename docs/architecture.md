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

## Token Authentication Architecture

### Three-Tier Fallback Chain

The backend implements a robust authentication strategy with three token sources, tried in priority order. This design ensures flexibility across different deployment environments while maintaining security.

**Priority Order:**

1. **Environment Variables** (highest priority)
2. **SSH Token Creation** (second priority)
3. **glab CLI Config** (last resort)

### Method 1: Environment Variables

**Environment variables checked:**
- `GITLAB_TOKEN` (preferred)
- `GITLAB_AUTH_TOKEN` (alternative)

**Use Cases:**
- Docker containers
- CI/CD pipelines
- Kubernetes deployments
- Automated scripts
- Production environments

**Advantages:**
- Standard practice for cloud-native applications
- Supported by all container orchestration platforms
- Easy to rotate and manage with secret management tools
- No file system dependencies

**Implementation:**
```python
# serve.py lines 254-257
token = os.environ.get('GITLAB_TOKEN')
if not token:
    token = os.environ.get('GITLAB_AUTH_TOKEN')
if token:
    return token
```

### Method 2: SSH Token Creation

**Configuration file:** `~/.config/gitlab_ci_viz/gitlab.yml`

**Format:**
```yaml
hostname: gitlab.example.com
ssh_port: 22
ssh_user: git
```

**How It Works:**

1. Read config file to get GitLab hostname, SSH port, and user
2. SSH to GitLab instance: `ssh git@gitlab.example.com -p 22 personal_access_token`
3. GitLab's SSH interface generates and returns a short-lived token
4. Token used for API authentication

**Use Cases:**
- Self-hosted GitLab with SSH access
- Corporate environments with SSH-based authentication
- Security-conscious setups preferring short-lived tokens
- Users without glab CLI

**Advantages:**
- Short-lived tokens (more secure)
- No need to manually create/manage tokens
- Works with self-hosted GitLab instances
- Integrates with existing SSH key infrastructure

**Security Note:** Token expires after session, reducing risk from token exposure.

**Implementation:**
```python
# serve.py lines 276-294
config_path = os.path.expanduser('~/.config/gitlab_ci_viz/gitlab.yml')
if os.path.exists(config_path):
    with open(config_path) as f:
        config = yaml.safe_load(f)

    ssh_cmd = [
        'ssh',
        f"{config['ssh_user']}@{config['hostname']}",
        '-p', str(config['ssh_port']),
        'personal_access_token'
    ]
    result = subprocess.run(ssh_cmd, capture_output=True, text=True)
    return result.stdout.strip()
```

### Method 3: glab CLI Config

**Configuration file:** `~/.config/glab-cli/config.yml`

**How It Works:**

1. Execute `glab auth token` command
2. glab reads its config file and returns stored token
3. Token was previously obtained via `glab auth login`

**Use Cases:**
- Developer workstations
- Interactive use
- gitlab.com users
- Quick setup for new users

**Advantages:**
- Easiest for new users (guided OAuth flow)
- Handles token refresh automatically
- Works out-of-box with gitlab.com
- Managed by official GitLab CLI tool

**Disadvantages:**
- Requires glab CLI installation
- Less suitable for automated/production environments
- Token stored in plaintext in config file

**Implementation:**
```python
# serve.py lines 296-309
try:
    result = subprocess.run(
        ['glab', 'auth', 'token'],
        capture_output=True,
        text=True,
        check=True
    )
    return result.stdout.strip()
except subprocess.CalledProcessError:
    return None
```

### Fallback Logic Flow

```
┌─────────────────────────────────────────┐
│ 1. Check GITLAB_TOKEN env var          │
│    ├─ Found? → Return token            │
│    └─ Not found → Continue             │
└───────────────┬─────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│ 2. Check GITLAB_AUTH_TOKEN env var     │
│    ├─ Found? → Return token            │
│    └─ Not found → Continue             │
└───────────────┬─────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│ 3. Check ~/.config/gitlab_ci_viz/...   │
│    ├─ Config exists? → SSH create      │
│    │  ├─ Success? → Return token       │
│    │  └─ Failed? → Continue            │
│    └─ No config → Continue             │
└───────────────┬─────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│ 4. Try glab auth token                 │
│    ├─ Success? → Return token          │
│    └─ Failed? → Error and exit         │
└─────────────────────────────────────────┘
```

### Deployment Recommendations

| Environment | Recommended Method | Reason |
|------------|-------------------|---------|
| Production | Environment variables | Standard, secure, easy rotation |
| Docker | Environment variables | Native Docker secrets support |
| CI/CD | Environment variables | Standard practice, GitLab CI variables |
| Self-hosted corporate | SSH token creation | Short-lived, integrates with SSH infrastructure |
| Developer workstation | glab CLI | Easy setup, OAuth flow |
| gitlab.com personal | glab CLI | Quick start, automatic refresh |

### Security Considerations

**Token Visibility:**
- All methods result in token being injected into HTML (visible in browser)
- This is acceptable for localhost-only tool
- Token never persisted to disk by serve.py
- Cleared when browser closed

**Token Scope:**
- Minimum required: `read_api`
- Never request write scopes unless needed
- Principle of least privilege

**Token Rotation:**
- Environment variables: Rotate via secret management system
- SSH tokens: Automatically short-lived
- glab tokens: Manually rotate via `glab auth login`

**Related Code:**
- `serve.py` lines 252-311: `get_gitlab_token()` function
- `serve.py` lines 492-532: `create_config_js()` token injection

## Frontend Module Architecture

### Overview

The frontend is organized into 6 JavaScript modules plus the main `index.html` orchestration file. This modular architecture provides clear separation of concerns, easier testing, and better maintainability compared to a monolithic approach.

### Module Organization

Modules are loaded sequentially in `index.html` (lines 1222-1227):

```html
<script src="/static/logger.js"></script>
<script src="/static/error-formatter.js"></script>
<script src="/static/api-client.js"></script>
<script src="/static/data-transformer.js"></script>
<script src="/static/contention-analyzer.js"></script>
<script src="/static/d3-gantt.js"></script>
```

**Layer Structure:**

1. **Foundation Layer** (utilities and infrastructure)
   - `logger.js` - Logging abstraction
   - `error-formatter.js` - User-friendly error messages

2. **Data Layer** (API and domain model)
   - `api-client.js` - GitLab API v4 client
   - `data-transformer.js` - Domain model transformation
   - `contention-analyzer.js` - Runner contention calculation

3. **Presentation Layer** (visualization)
   - `d3-gantt.js` - D3.js-based GANTT rendering

4. **Orchestration** (application coordination)
   - `index.html` - State management, UI controls, refresh logic

### Module Details

#### logger.js

**Purpose**: Centralized logging with configurable levels

**Exports**:
- `Logger` class with methods: `info()`, `warn()`, `error()`, `debug()`

**Usage**:
```javascript
Logger.info('Fetching projects', { groupId: 123 });
Logger.error('API request failed', error);
```

#### error-formatter.js

**Purpose**: Transform API errors into user-friendly messages

**Exports**:
- `ErrorFormatter.formatAPIError(error)` - Formats HTTP/network errors
- `ErrorFormatter.formatValidationError(field, issue)` - Formats validation errors

**Usage**:
```javascript
catch (error) {
  const message = ErrorFormatter.formatAPIError(error);
  showError(message);
}
```

#### api-client.js

**Purpose**: GitLab API v4 client with pagination and error handling

**Exports**:
- `GitLabAPIClient` class

**Key Methods**:
- `fetchProjects(groupId)` - Fetch all projects in group (with pagination)
- `fetchPipelines(projectId, updatedAfter)` - Fetch pipelines for project
- `fetchJobs(projectId, pipelineId)` - Fetch jobs for pipeline
- `fetchPipelinesWithUsers(projectId, updatedAfter)` - GraphQL query for pipelines + user data

**Features**:
- Automatic pagination via Link headers
- Parallel project fetching
- Rate limit handling
- Network error recovery

**Usage**:
```javascript
const client = new GitLabAPIClient(CONFIG.gitlabUrl, CONFIG.gitlabToken);
const projects = await client.fetchProjects(CONFIG.groupId);
```

#### data-transformer.js

**Purpose**: Transform GitLab API responses to domain model

**Exports**:
- `GroupKey` class - Project or user grouping
- `Pipeline` class - CI/CD pipeline execution
- `Job` class - Individual job within pipeline
- `DataTransformer` class (static methods)

**Key Methods**:
- `DataTransformer.transformToDomainModel(apiData)` - API → domain objects
- `DataTransformer.groupByUser(pipelines)` - Group pipelines by triggering user

**Domain Model**:
```javascript
class GroupKey {
  constructor(type, id, label) // type: 'project' | 'user'
}

class Pipeline {
  constructor(id, projectId, status, createdAt, updatedAt, duration, ref, sha, user, webUrl)
  jobs = []  // Array of Job instances
}

class Job {
  constructor(id, name, status, createdAt, startedAt, finishedAt, duration, runner, webUrl, failureReason)
}
```

**Usage**:
```javascript
const domainModel = DataTransformer.transformToDomainModel(apiResponse);
const grouped = DataTransformer.groupByUser(domainModel.pipelines);
```

#### contention-analyzer.js

**Purpose**: Calculate runner contention periods for visualization

**Exports**:
- `ContentionAnalyzer` class (static methods)

**Key Methods**:
- `ContentionAnalyzer.calculateContentionPeriods(pipelines)` - Returns contention periods

**Contention Levels**:
- `low`: 2-3 concurrent pipelines
- `medium`: 4 concurrent pipelines
- `high`: 5-7 concurrent pipelines
- `critical`: 8+ concurrent pipelines

**Output Format**:
```javascript
[
  { start: Date, end: Date, count: 5, level: 'high' },
  { start: Date, end: Date, count: 10, level: 'critical' }
]
```

**Usage**:
```javascript
const contention = ContentionAnalyzer.calculateContentionPeriods(pipelines);
ganttChart.setContentionPeriods(contention);
```

#### d3-gantt.js

**Purpose**: D3.js-based GANTT chart visualization

**Exports**:
- `D3GanttChart` class

**Key Methods**:
- `constructor(containerId, config)` - Initialize with DOM container
- `setGroups(groups)` - Set group definitions
- `setPipelines(pipelines)` - Set pipeline data
- `render()` - Render/update visualization
- `setContentionPeriods(periods)` - Add contention background

**8-Layer SVG Architecture**:
1. Grid layer - Time grid lines
2. Contention layer - Runner contention backgrounds
3. Pipeline backgrounds layer - Expanded pipeline boxes
4. Pipeline click overlay layer - Transparent clickable areas
5. Bars layer - Pipeline and job bars
6. Avatars layer - User avatars
7. Current time layer - "Now" line
8. Axis layer - Time axis
9. Labels layer - Project/pipeline labels

**Performance Optimizations**:
- Row caching (`cachedRows`) - Avoid retransformation during zoom/pan
- Text measurement cache (`textMeasureCache`) - Cache label width calculations
- RequestAnimationFrame - Debounced zoom renders
- Color caching - Consistent project/runner colors

**Usage**:
```javascript
const gantt = new D3GanttChart('visualization', CONFIG);
gantt.setGroups(groups);
gantt.setPipelines(pipelines);
gantt.setContentionPeriods(contention);
gantt.render();
```

### Data Flow Diagram

```
GitLab API v4
    ↓
GitLabAPIClient.fetchProjects() → fetch*()
    ↓ (raw API responses)
DataTransformer.transformToDomainModel()
    ↓ (GroupKey[], Pipeline[], Job[])
DataTransformer.groupByUser()
    ↓ (user-grouped pipelines)
ContentionAnalyzer.calculateContentionPeriods()
    ↓ (contention periods)
D3GanttChart.setGroups/setPipelines/setContentionPeriods()
    ↓
D3GanttChart.render()
    ↓
Interactive SVG visualization in browser
```

### State Management

State is managed in `index.html` via several classes/objects:

- **FilterState**: Pipeline status filters (success, failed, etc.)
- **JobSearchState**: Job name search query
- **DurationState**: Viewport duration (1h, 6h, etc.)
- **URLStateManager**: Persist state to URL query parameters
- **RefreshManager**: Auto-refresh countdown and polling

All state classes follow a consistent pattern:
1. Internal state storage
2. UI update methods
3. Event handlers
4. URL serialization/deserialization

### Module Dependencies

```
logger.js (no dependencies)
    ↑
error-formatter.js (depends on: logger)
    ↑
api-client.js (depends on: logger, error-formatter)
    ↑
data-transformer.js (depends on: logger)
    ↑
contention-analyzer.js (no external dependencies)
    ↑
d3-gantt.js (depends on: D3.js v7 from CDN)
    ↑
index.html (orchestrates all modules)
```

### Type Safety with JSDoc

All modules use JSDoc type annotations for IDE support and documentation:

```javascript
/**
 * Fetch pipelines for a project
 * @param {number} projectId - GitLab project ID
 * @param {string} updatedAfter - ISO timestamp filter
 * @returns {Promise<Pipeline[]>} Array of pipeline objects
 */
async fetchPipelines(projectId, updatedAfter) { ... }
```

See README.md "Development > Code Style Guide > JavaScript Type Annotations" for full conventions.

## Time Range Architecture

### Viewport vs. Fetch Range Decoupling

The application decouples what the user **views** from what is **fetched** from the API. This architectural decision optimizes performance by reducing API calls during zoom operations.

**Key Concepts:**

- **Viewport Range**: The time window currently visible to the user (e.g., 1h, 6h, 1d, 2d, 1w)
- **Fetch Range**: Viewport + 6-hour buffer for zoom exploration
- **Fetch Buffer**: Constant 6-hour extension beyond viewport boundaries

**Implementation:**

`index.html` lines 1400-1447: `DurationState` manages two separate time ranges:
```javascript
class DurationState {
  static FETCH_BUFFER_MS = 6 * 60 * 60 * 1000;  // 6 hours in milliseconds

  // Returns user-selected viewport duration
  static getViewportDuration() { ... }

  // Returns viewport + 6-hour buffer
  static getFetchDuration() {
    const viewportMs = this.getViewportDuration();
    return viewportMs + this.FETCH_BUFFER_MS;
  }
}
```

**Data Flow:**

1. User selects "1 hour" duration
2. `DurationState.getViewportDuration()` returns 1 hour
3. `DurationState.getFetchDuration()` returns 7 hours (1h + 6h buffer)
4. `serve.py` receives `--since` argument and computes `updatedAfter` timestamp
5. Frontend queries GitLab API with 7-hour time range
6. D3 GANTT chart initially zooms to show 1-hour viewport
7. User zooms out - older data already available, no new API call needed

**Configuration Flow:**

```
serve.py:
  args.since = "1 hour ago"
  ↓
  parse_time_spec() → ISO timestamp
  ↓
  DurationState.getFetchDuration() → 7 hours total
  ↓
  CONFIG.updatedAfter = timestamp (7 hours ago)
  CONFIG.viewportStart = timestamp (1 hour ago)
```

**Benefits:**

- **Reduced API Calls**: Users can zoom out without triggering new GitLab API requests
- **Smooth UX**: Instant zoom response, no loading delays
- **Predictable Costs**: API usage determined by viewport, not user interactions

**Trade-offs:**

- **Extra Data Transfer**: Always fetches 6 extra hours even if user doesn't zoom
- **Memory Usage**: Browser holds more data than displayed
- **Stale Data**: Zooming out shows older cached data, not fresh API data

**Why 6 Hours?**

The 6-hour buffer was chosen based on typical usage patterns:
- Most users view 1-6 hour windows
- Users occasionally zoom out to see context (2-3x viewport)
- 6 hours provides comfortable exploration range
- Beyond 6 hours, users expect to refresh for new data

**Related Code:**
- `index.html` lines 1400-1447: `DurationState` class
- `d3-gantt.js` lines 188-209: Initial viewport zoom transform
- `serve.py` lines 482-487: `args.updated_after` generation

## Visualization Architecture

### D3.js Implementation Strategy

The visualization layer uses **D3.js v7** (not vis.js or other timeline libraries) for maximum flexibility and performance. This section documents the custom GANTT chart implementation in `static/d3-gantt.js`.

### Why D3.js Over Timeline Libraries?

**Decision Rationale:**

1. **Full Control**: Complete control over SVG rendering enables custom features (runner contention, clickable areas, avatars)
2. **Performance**: Optimized rendering with layer caching and RequestAnimationFrame
3. **Flexibility**: Easy to add custom visualizations (contention backgrounds, status outlines)
4. **Modern**: Active development, excellent documentation, large community
5. **Lightweight**: Load only needed D3 modules, no unused features

**Trade-offs:**

- More code to maintain vs. using pre-built timeline library
- No built-in timeline features (must implement zoom, pan, axis manually)
- Steeper learning curve for contributors unfamiliar with D3

### 9-Layer SVG Architecture

D3GanttChart renders visualization using 9 separate SVG layers (z-index order, bottom to top):

**Layer Structure:**

1. **Grid Layer** (`gridLayer`)
   - Vertical time grid lines
   - Visual reference for time intervals
   - Rendered at zoom level 0, scaled by D3 zoom

2. **Contention Layer** (`contentionLayer`)
   - Background rectangles showing runner contention periods
   - Color-coded: yellow (low) → orange (medium) → red (high/critical)
   - Helps identify runner bottlenecks visually

3. **Pipeline Backgrounds Layer** (`pipelineBackgroundsLayer`)
   - Large boxes encompassing expanded pipelines
   - Shows pipeline time span from first to last job
   - Background for job grouping

4. **Pipeline Click Overlay Layer** (`pipelineClickOverlayLayer`)
   - Transparent clickable rectangles over pipeline boxes
   - Enables clicking pipelines to open in GitLab
   - Separate layer to avoid z-index conflicts with jobs

5. **Bars Layer** (`barsLayer`)
   - Main content: pipeline and job bars
   - Color-coded by project and runner
   - Status outlines (green/red/yellow)
   - Duration labels

6. **Avatars Layer** (`avatarsLayer`)
   - User avatars displayed left of pipeline bars
   - Loaded from GitLab user data
   - Tooltips show username on hover

7. **Current Time Layer** (`currentTimeLayer`)
   - Red dashed vertical line at "now"
   - Updates on refresh to show current time
   - Helps orient user in timeline

8. **Axis Layer** (`axisLayer`)
   - Time axis at top of visualization
   - D3 axis with automatic tick formatting
   - Updates on zoom to show appropriate time granularity

9. **Labels Layer** (`labelsLayer`)
   - Project/pipeline labels on left margin
   - Fixed position (doesn't pan horizontally)
   - Synchronized with row positions

**Why Separate Layers?**

- **Performance**: Update only changed layers, not entire viz
- **Z-Index Control**: Precise control over rendering order
- **Event Handling**: Separate click layers from visual layers
- **Maintainability**: Clear separation of concerns

### Data Transformation: Flat Row Structure

GANTT chart uses **flat row structure** (not hierarchical) for efficient rendering:

**Transformation:**
```javascript
// Input: Hierarchical domain model
GroupKey[] → Pipeline[] (with jobs: Job[])

// Output: Flat row array
[
  { type: 'pipeline', level: 0, data: Pipeline, expanded: false },
  { type: 'job', level: 1, data: Job, parentPipeline: Pipeline },  // only if expanded
  { type: 'job', level: 1, data: Job, parentPipeline: Pipeline },
  { type: 'pipeline', level: 0, data: Pipeline, expanded: true },
  { type: 'job', level: 1, data: Job, parentPipeline: Pipeline },
  ...
]
```

**Benefits:**

- **Simple Y-positioning**: Row Y = rowIndex × rowHeight
- **Easy collapse/expand**: Filter rows by parent pipeline
- **Efficient updates**: D3 data joins work on flat arrays
- **Performance**: No recursive traversals during render

**Implementation:** `d3-gantt.js` lines 239-305: `transformToRows()` method

### Performance Optimizations

**1. Row Caching (`cachedRows`)**

Avoids retransforming domain model → flat rows on every zoom/pan:

```javascript
// Cache invalidated only when data changes
if (dataChanged) {
  this.cachedRows = this.transformToRows(this.pipelines);
}
render() {
  const rows = this.cachedRows; // Use cached rows
}
```

**2. Text Measurement Cache (`textMeasureCache`)**

Label width calculations are expensive. Cache results:

```javascript
measureText(text) {
  if (this.textMeasureCache.has(text)) {
    return this.textMeasureCache.get(text);
  }
  const width = /* measure text */;
  this.textMeasureCache.set(text, width);
  return width;
}
```

**3. RequestAnimationFrame Debouncing (`zoomRafId`)**

Zoom events fire rapidly. Debounce using RAF:

```javascript
onZoom(event) {
  if (this.zoomRafId) {
    cancelAnimationFrame(this.zoomRafId);
  }
  this.zoomRafId = requestAnimationFrame(() => {
    this.renderWithTransform(event.transform);
  });
}
```

**4. Color Caching**

Project and runner colors computed via hash. Cache to avoid recomputation:

```javascript
getProjectColor(projectId) {
  if (!this.projectColorCache.has(projectId)) {
    this.projectColorCache.set(projectId, this.hashColor(projectId));
  }
  return this.projectColorCache.get(projectId);
}
```

### Zoom and Pan Implementation

**D3 Zoom Behavior:**

```javascript
const zoom = d3.zoom()
  .scaleExtent([0.1, 10])  // Zoom limits: 0.1x to 10x
  .on('zoom', (event) => this.handleZoom(event));

this.svg.call(zoom);
```

**Transform Application:**

- **X-axis (time)**: Scales via D3 `transform.rescaleX(xScale)`
- **Y-axis (rows)**: Fixed (no vertical zoom), only vertical pan
- **Labels**: Fixed in place (don't pan horizontally)

**Initial Viewport Transform:**

On first render, zoom to viewport range (not full fetch range):

```javascript
// CONFIG.viewportStart = 1 hour ago
// CONFIG.updatedAfter = 7 hours ago (1h + 6h buffer)

const viewportDomain = [CONFIG.viewportStart, now];
const fetchDomain = [CONFIG.updatedAfter, now];

// Zoom to show viewport, but data includes full fetch range
const transform = computeTransform(xScale, viewportDomain);
svg.call(zoom.transform, transform);
```

**Related Code:** `d3-gantt.js` lines 188-209

### Color Management

**Project Colors:**

Hash-based consistent colors across sessions:

```javascript
hashColor(id) {
  const hash = simpleHash(String(id));
  const hue = (hash % 360);
  const saturation = 70;
  const lightness = 70;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}
```

**Runner Colors:**

XOR hash halves for better distribution:

```javascript
runnerColor(runnerDescription) {
  const hash = simpleHash(runnerDescription);
  const high = (hash >> 16) & 0xFFFF;
  const low = hash & 0xFFFF;
  const xorHash = high ^ low;
  const hue = (xorHash % 360);
  return `hsl(${hue}, 65%, 70%)`;
}
```

**Status Outlines:**

- Success: Green (`#4CAF50`)
- Failed: Red (`#F44336`)
- Running: Yellow (`#FFC107`)
- Other: Gray

### Related Code Locations

- `d3-gantt.js` lines 24-72: `D3GanttChart` class definition
- `d3-gantt.js` lines 100-109: Layer initialization
- `d3-gantt.js` lines 239-305: `transformToRows()` flat row structure
- `d3-gantt.js` lines 346-386: Avatar rendering with `getUserForRow()`
- `d3-gantt.js` lines 400-500: Zoom/pan handlers

## URL State Management

### URLStateManager Architecture

Frontend persists user preferences to URL query parameters, enabling shareable links and browser navigation. Implemented in `index.html` lines 1239-1308.

**Persisted State:**

- **Filters**: Pipeline status filters (success, failed, running, etc.)
- **Job Search**: Job name search query
- **Duration**: Selected time range (1h, 6h, 1d, etc.)

**Example URL:**
```
http://localhost:8000/?filters=success,failed&jobSearch=build&duration=6h
```

### Implementation Pattern

**State Classes:**

Each state type has a dedicated class:

```javascript
class FilterState {
  static getActiveFilters() { return Set from URL or UI }
  static updateURL() { Write to URL query params }
  static loadFromURL() { Read from URL query params }
}

class JobSearchState {
  static getSearchQuery() { return string from URL or UI }
  static updateURL() { Write to URL }
  static loadFromURL() { Read from URL }
}

class DurationState {
  static getCurrentDuration() { return string from URL or UI }
  static updateURL() { Write to URL }
  static loadFromURL() { Read from URL }
}
```

**URLStateManager:**

Coordinates all state classes and manages debouncing:

```javascript
class URLStateManager {
  static DEBOUNCE_MS = 500;  // Wait 500ms before updating URL

  static updateURL() {
    clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(() => {
      const params = new URLSearchParams();

      // Collect from all state classes
      const filters = FilterState.getActiveFilters();
      if (filters.size > 0) {
        params.set('filters', Array.from(filters).join(','));
      }

      const search = JobSearchState.getSearchQuery();
      if (search) {
        params.set('jobSearch', search);
      }

      const duration = DurationState.getCurrentDuration();
      params.set('duration', duration);

      // Update URL without reload
      history.replaceState(null, '', `?${params.toString()}`);
    }, this.DEBOUNCE_MS);
  }
}
```

### Debouncing Strategy

**Why Debounce?**

- User types in search box: Don't update URL on every keystroke
- User clicks multiple filters rapidly: Wait until done
- Avoid excessive browser history pollution

**Debounce Window:** 500ms

- Short enough for responsive feel
- Long enough to batch rapid changes

**Implementation:**

```javascript
static updateURL() {
  clearTimeout(this.debounceTimeout);  // Cancel pending update
  this.debounceTimeout = setTimeout(() => {
    /* actual URL update */
  }, 500);
}
```

### Page Load Restoration

On page load, restore state from URL:

```javascript
window.addEventListener('DOMContentLoaded', () => {
  // Restore state from URL
  FilterState.loadFromURL();
  JobSearchState.loadFromURL();
  DurationState.loadFromURL();

  // Apply to UI
  FilterState.updateUI();
  JobSearchState.updateUI();
  DurationState.updateUI();

  // Fetch data with restored filters
  fetchAndRender();
});
```

### Browser Navigation Support

**Back/Forward buttons work:**

```javascript
window.addEventListener('popstate', () => {
  // User clicked back/forward
  FilterState.loadFromURL();
  JobSearchState.loadFromURL();
  DurationState.loadFromURL();

  // Re-render with new state
  applyFiltersAndSearch();
});
```

### Benefits

1. **Shareable Links**: Users can share exact view state
2. **Browser History**: Back/forward buttons work intuitively
3. **Refresh Persistence**: Page refresh maintains filters/search
4. **Bookmarkable**: Users can bookmark specific filter combinations

### Trade-offs

- **URL Length**: Many filters create long URLs
- **Privacy**: URL visible in browser history/logs
- **Complexity**: More state management code
- **No Zoom State**: Zoom/pan not persisted (intentional - too volatile)

**Why Not Persist Zoom/Pan?**

- Changes very frequently (every interaction)
- Would create excessive history entries
- URL would be cluttered with transform values
- Data refresh would invalidate saved viewport anyway

**Decision:** Only persist high-level filters, not low-level view state

### Related Code

- `index.html` lines 1239-1308: `URLStateManager` class
- `index.html` lines 1450-1500: Filter state management
- `index.html` lines 1500-1550: Job search state management
- `index.html` lines 1400-1447: Duration state management

## Related Documentation

- [PRD.md](../PRD.md): Overall architecture and responsibilities split
- [README.md](../README.md#architecture): High-level architecture overview
- [serve.py](../serve.py): Backend implementation with inline documentation
- [index.html](../index.html): Frontend implementation with CONFIG usage examples
- [d3-gantt.js](../static/d3-gantt.js): D3-based GANTT chart implementation
- [data-transformer.js](../static/data-transformer.js): Domain model definitions
