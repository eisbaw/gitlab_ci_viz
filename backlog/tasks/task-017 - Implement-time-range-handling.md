---
id: task-017
title: Implement time range handling
status: To Do
assignee: []
created_date: '2025-11-13 15:24'
updated_date: '2025-11-13 16:03'
labels:
  - backend
  - frontend
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Parse and handle --since parameter for both relative ('2 days ago') and absolute ('2025-01-10') time specifications
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Relative time strings parsed correctly ('2 days ago', 'last week')
- [ ] #2 Absolute date strings parsed correctly (ISO 8601 format)
- [ ] #3 Converted to updated_after parameter for GitLab API
- [ ] #4 Invalid time specifications show user-friendly error

- [ ] #5 Unsupported format shows: 'Time format not supported. Use: 2 days ago, 2025-01-10, or last week'
<!-- AC:END -->
