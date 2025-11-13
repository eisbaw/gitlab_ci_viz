---
id: task-005
title: Implement Python backend server
status: Done
assignee:
  - '@claude'
created_date: '2025-11-13 15:22'
updated_date: '2025-11-13 20:20'
labels:
  - backend
  - foundation
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create serve.py script that obtains GitLab token, parses CLI arguments, and serves static files via HTTP server
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 serve.py executes 'glab auth token' and captures output
- [x] #2 CLI arguments parsed: --group, --projects, --since, --port, --gitlab-url
- [x] #3 Token and config injected into HTML as JavaScript variables
- [x] #4 HTTP server serves static files on specified port
- [x] #5 Server runs with only Python standard library dependencies
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create serve.py with argument parsing using argparse
2. Implement glab auth token execution and capture
3. Create HTTP request handler to inject config into HTML
4. Implement static file serving
5. Test server startup and token injection
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented complete Python backend server with the following components:

- Created serve.py with argparse for CLI argument parsing
- Implemented glab auth token execution with proper error handling
- Created ConfigInjectingHandler that extends SimpleHTTPRequestHandler
- Token and configuration injected as JavaScript CONFIG object into index.html
- Static file serving for vis.js assets and other resources
- Only uses Python standard library (subprocess, argparse, http.server, pathlib)

Created comprehensive unit tests covering:
- Token acquisition (success and error cases)
- Argument parsing (group/projects modes, custom ports/URLs)
- JavaScript config generation (with proper escaping)

All 9 unit tests pass successfully.

Files created:
- serve.py (main server script)
- index.html (minimal template for config injection testing)
- test/test_serve.py (unit test suite)
<!-- SECTION:NOTES:END -->
