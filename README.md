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
