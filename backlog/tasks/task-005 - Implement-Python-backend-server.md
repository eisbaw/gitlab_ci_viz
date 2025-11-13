---
id: task-005
title: Implement Python backend server
status: To Do
assignee: []
created_date: '2025-11-13 15:22'
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
- [ ] #1 serve.py executes 'glab auth token' and captures output
- [ ] #2 CLI arguments parsed: --group, --projects, --since, --port, --gitlab-url
- [ ] #3 Token and config injected into HTML as JavaScript variables
- [ ] #4 HTTP server serves static files on specified port
- [ ] #5 Server runs with only Python standard library dependencies
<!-- AC:END -->
