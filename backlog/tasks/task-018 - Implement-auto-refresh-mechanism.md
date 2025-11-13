---
id: task-018
title: Implement auto-refresh mechanism
status: To Do
assignee: []
created_date: '2025-11-13 15:24'
labels:
  - frontend
  - feature
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add JavaScript polling to periodically fetch updated data from GitLab API and refresh the timeline without full page reload
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Data refreshes every 60 seconds by default
- [ ] #2 Timeline updates without losing user's zoom/pan state
- [ ] #3 Only new/updated pipelines fetched on refresh
- [ ] #4 Refresh interval configurable via injected config
<!-- AC:END -->
