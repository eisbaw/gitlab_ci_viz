---
id: task-030
title: Write unit tests for Python backend
status: To Do
assignee: []
created_date: '2025-11-13 15:43'
labels:
  - backend
  - testing
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create comprehensive unit tests for serve.py covering token retrieval, argument parsing, HTML injection, and server startup
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Test: glab auth token command execution with mocked subprocess
- [ ] #2 Test: Invalid token (command fails) raises clear error message
- [ ] #3 Test: CLI argument parsing for all flags (--group, --projects, --since, --port, --gitlab-url)
- [ ] #4 Test: Invalid argument combinations detected (both --group and --projects)
- [ ] #5 Test: HTML template injection with various config combinations
- [ ] #6 Test: Config special characters escaped properly in HTML
- [ ] #7 Test: Server startup on occupied port fails gracefully
- [ ] #8 Coverage: >90% of serve.py lines
<!-- AC:END -->
