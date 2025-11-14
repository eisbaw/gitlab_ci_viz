---
id: task-056
title: Eliminate time parsing duplication between backend and frontend
status: To Do
assignee: []
created_date: '2025-11-14 07:05'
labels:
  - architecture
  - refactoring
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Time specification parsing logic exists in both Python backend (parse_time_spec) and JavaScript frontend, violating single source of truth principle. This creates drift risk and maintenance burden.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Backend is sole parser of time specifications
- [ ] #2 Frontend only receives ISO 8601 timestamps
- [ ] #3 Frontend only formats timestamps for display, never parses
- [ ] #4 No time parsing logic duplication exists
<!-- AC:END -->
