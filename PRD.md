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
A dynamic web page that fetches GitLab CI data via the GitLab API v4 and displays it as an interactive GANTT chart using vis.js Timeline component.

## User Personas
**Primary**: DevOps engineers, team leads managing CI/CD infrastructure
**Secondary**: Developers wanting to understand pipeline timing and resource usage

## Architecture

### Backend (Minimal Python Script)
**Responsibilities:**
- Obtain GitLab authentication token using `glab auth token` command
- Parse command-line arguments for configuration
- Inject token and configuration into HTML template as JavaScript variables
- Serve static HTML page and vis.js assets via HTTP server

**Does NOT:**
- Query GitLab API
- Store or cache data
- Maintain state

### Frontend (JavaScript + vis.js)
**Responsibilities:**
- Execute all GitLab API v4 queries directly from browser
- Fetch and aggregate pipeline/job data
- Render interactive GANTT chart
- Auto-refresh data periodically
- Handle user interactions (collapse/expand, zoom, pan)

## Features

### Core Features (MVP)

#### 1. User-Centric Organization
- **Primary grouping**: Pipelines grouped by triggering user
- **Hierarchy**: User → Pipelines → Jobs
- **Visual structure**: Each user is a collapsible container

#### 2. Timeline Visualization
- **X-axis**: Real-time timeline with hours and minutes
- **Y-axis**: Users (rows)
- **Items**:
  - Pipelines positioned at their start time
  - Duration represented by box width
  - Jobs within pipelines positioned at their start time with their duration

#### 3. Multi-Project Support
- Query multiple projects within a GitLab group
- Query specific list of projects by ID
- Aggregate all pipelines across projects in single view

#### 4. Collapsible Containers
- Users can be collapsed/expanded
- Pipelines within users can be collapsed/expanded
- Maintains view state during session

#### 5. Time Range Configuration
- User-configurable time range via CLI arguments
- Support for relative time: "2 days ago", "last week"
- Support for absolute time: "2025-01-10"

#### 6. Auto-Refresh
- JavaScript polls GitLab API periodically (default: 60 seconds)
- Updates GANTT chart without full page reload
- Shows last update timestamp

#### 7. Job Status Visualization
- Color-coded by status:
  - Success: Green
  - Failed: Red
  - Running: Blue
  - Pending: Gray
  - Canceled: Orange

### Local Asset Serving
- vis.js library served locally (no CDN dependency)
- Ensures tool works offline and without external dependencies

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
  users: [
    {
      username: "user1",
      pipelines: [
        {
          id: 12345,
          project: "project-name",
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
- **Visualization**: vis.js Timeline (v7.x latest)
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
├── index.html                # HTML template
├── static/
│   ├── vis-timeline-graph2d.min.js
│   └── vis-timeline-graph2d.min.css
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

## Future Enhancements (Out of Scope for MVP)
- Filter by pipeline status
- Search/filter by job name
- Export timeline as image
- Save/load custom views
- Runner-centric view (instead of user-centric)
- Stage visualization (currently skipped to reduce clutter)
- Responsive mobile view

## Completed Beyond MVP
- Click-through to GitLab pipeline and job pages (task-049)

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
