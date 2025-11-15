# Product Requirements Document: GitLab CI GANTT Visualizer

## Overview
A web-based GANTT chart visualization tool for GitLab CI/CD pipelines and jobs, showing activity across multiple projects and runners organized by user.

## Problem Statement
GitLab's native pipeline view shows individual project pipelines but lacks a unified timeline view across:
- Multiple projects within a group
- Multiple runners
- All users' activity in one view

This makes it difficult to:
- See overall team CI/CD activity patterns
- Identify runner utilization and bottlenecks
- Understand timing and duration of pipelines across the organization

## Solution
A dynamic web page that fetches GitLab CI data via the GitLab API v4 and displays it as an interactive GANTT chart using d3.js.

## User Personas
**Primary**: DevOps engineers, team leads managing CI/CD infrastructure
**Secondary**: Developers wanting to understand pipeline timing and resource usage

## Architecture

### Backend (Minimal Python Script)
**Responsibilities:**
- Obtain GitLab authentication token using `glab auth token` command
- Parse command-line arguments for configuration
- Inject token and configuration into HTML template as JavaScript variables
- Serve static HTML page and d3.js assets via HTTP server

**Does NOT:**
- Query GitLab API
- Store or cache data
- Maintain state

### Frontend (JavaScript + d3.js)
**Responsibilities:**
- Execute all GitLab API v4 queries directly from browser
- Fetch and aggregate pipeline/job data
- Render interactive GANTT chart
- Auto-refresh data periodically
- Handle user interactions (collapse/expand, zoom, pan)

## Features

### Core Features (MVP)

#### 1. Project-Centric Organization
- **Primary grouping**: Pipelines grouped by project
- **Hierarchy**: Project → Pipelines → Jobs
- **Visual structure**: Flat hierarchy with no collapsible groups - all items visible simultaneously for maximum density

#### 2. Timeline Visualization
- **X-axis**: Real-time timeline with hours and minutes
- **Y-axis**: Projects (rows)
- **Visual Design for Maximum Density**:
  - **Thin horizontal lines**: Both pipelines and jobs are rendered as thin lines (not thick bars)
  - **Minimal vertical spacing**: Very little separation between rows to maximize information density
  - **Flat hierarchy**: Jobs rendered directly under their pipeline line, no expandable/collapsible groups
  - **Pipeline lines**: Thin horizontal lines positioned at their start time, width represents duration
  - **Job lines**: Thin horizontal lines under each pipeline, positioned at their start time, width represents duration
  - **Color coding**: Status indicated by line color (success=green, failed=red, running=blue, pending=gray, canceled=orange)
  - **Tooltips**: Details shown on hover (status, duration, timestamps)
  - **No wasted space**: Minimal padding, margins, and whitespace

#### 3. Multi-Project Support
- Query multiple projects within a GitLab group
- Query specific list of projects by ID
- Aggregate all pipelines across projects in single view

#### 4. Time Range Configuration
- User-configurable time range via CLI arguments
- Support for relative time: "2 days ago", "last week"
- Support for absolute time: "2025-01-10"

#### 5. Auto-Refresh
- JavaScript polls GitLab API periodically (default: 60 seconds)
- Updates GANTT chart without full page reload
- Shows last update timestamp

#### 6. Job Status Visualization
- Color-coded by status:
  - Success: Green
  - Failed: Red
  - Running: Blue
  - Pending: Gray
  - Canceled: Orange

### Local Asset Serving
- d3.js library served from CDN (v7.x)
- Lightweight and widely available

## Technical Specifications

### GitLab API Usage

#### Required API Endpoints
```
GET /api/v4/groups/:id/projects
GET /api/v4/projects/:id/pipelines?updated_after=<timestamp>
GET /api/v4/projects/:id/pipelines/:pipeline_id/jobs
```

#### Data Model
```javascript
{
  projects: [
    {
      id: 123,
      name: "project-name",
      pipelines: [
        {
          id: 12345,
          status: "success",
          created_at: "2025-01-13T10:00:00Z",
          updated_at: "2025-01-13T10:15:00Z",
          duration: 900, // seconds
          jobs: [
            {
              id: 67890,
              name: "build",
              status: "success",
              started_at: "2025-01-13T10:00:00Z",
              duration: 300 // seconds
            }
          ]
        }
      ]
    }
  ]
}
```

### Command Line Interface

```bash
python serve.py --group <group_id> --since "2 days ago"
python serve.py --projects <id1,id2,id3> --since "2025-01-10"
```

#### Arguments
- `--group GROUP_ID`: GitLab group ID to fetch projects from
- `--projects PROJECT_IDS`: Comma-separated list of project IDs
- `--since TIME_SPEC`: Time range start (relative or absolute)
- `--port PORT`: HTTP server port (default: 8000)
- `--gitlab-url URL`: GitLab instance URL (default: https://gitlab.com)

### Technology Stack

#### Backend
- **Language**: Python 3.x
- **Libraries**:
  - `argparse`: CLI argument parsing
  - `subprocess`: Execute glab command
  - `http.server`: Serve static files
  - Standard library only (no external dependencies)

#### Frontend
- **Visualization**: d3.js (v7.x)
- **JavaScript**: Vanilla ES6+ (no framework dependencies)
- **HTTP Client**: Fetch API

#### Development Environment
- **Nix**: shell.nix for reproducible environment
- **Task Runner**: justfile for common commands

## File Structure

```
gitlab_ci_viz/
├── PRD.md                    # This document
├── README.md                 # Usage documentation
├── serve.py                  # Python backend script
├── templates/
│   └── index.html            # HTML template
├── static/
│   └── d3-gantt.js           # d3.js GANTT visualization
├── shell.nix                 # Nix development environment
├── justfile                  # Task automation
└── .gitignore
```

## User Stories

### US-1: View Team Activity
**As a** team lead
**I want to** see all pipeline activity across my team's projects
**So that** I can understand overall CI/CD usage patterns

### US-2: Identify Bottlenecks
**As a** DevOps engineer
**I want to** see when pipelines overlap and how long they take
**So that** I can identify runner capacity issues

### US-3: Investigate Pipeline Duration
**As a** developer
**I want to** see job timing within pipelines
**So that** I can understand which jobs are slow

### US-4: Monitor Running Pipelines
**As a** developer
**I want to** see currently running pipelines update automatically
**So that** I can monitor progress without manual refresh

## Success Metrics
- Time to visualize multi-project CI activity: < 5 seconds
- Ability to view last 7 days of activity for 10+ projects
- Clear identification of pipeline overlaps and timing

## Information Density Requirements

**Critical Design Principle**: Maximize information density to show as much CI/CD activity as possible in a single viewport.

### Density Targets
- **Vertical density**: Display 50+ pipeline/job rows within a standard 1080p viewport
- **Horizontal density**: Utilize full timeline width with minimal padding
- **Line thickness**: Pipeline and job lines should be 2-4px tall (thin lines, not bars)
- **Vertical spacing**: 1-2px between rows (minimal separation)
- **No expandable UI**: Everything visible at once - no hidden/collapsed content
- **Compact labels**: Project names truncated if needed to save horizontal space

### Visual Hierarchy via Color, Not Size
- **Status differentiation**: Use color (green/red/blue/gray/orange), not thickness
- **Importance**: Use saturation or brightness, not size
- **Tooltips for details**: Hover shows full information, keeping visual lightweight

## Future Enhancements (Out of Scope for MVP)
- Export timeline as image
- Save/load custom views
- Runner-centric view (instead of project-centric)
- User-centric view grouping
- Stage visualization (currently skipped to reduce clutter)
- Responsive mobile view
- Zoom and pan controls (beyond native browser scroll)

## Completed Beyond MVP
- Click-through to GitLab pipeline and job pages (task-049)
- Filter by pipeline status (task-050)
- Search/filter by job name (task-052)

## Security Considerations
- Token never stored on server or in browser storage (injected per session)
- Token only in memory during page lifetime
- All API calls from browser (token not exposed to backend logs)
- Local serving only (localhost)

## Constraints & Limitations
- Requires `glab` CLI installed and authenticated
- GitLab API rate limits apply (client-side fetching)
- Browser CORS may require GitLab instance to allow localhost
- Large time ranges may cause slow initial load
- No persistence (data not cached)

## Open Questions
- Should we show stage information despite clutter concern?
- Default refresh interval (30s, 60s, 120s)?
- Maximum number of projects to query efficiently?
- Pagination strategy for large result sets?
