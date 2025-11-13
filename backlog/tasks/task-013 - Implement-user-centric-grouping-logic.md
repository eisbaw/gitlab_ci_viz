---
id: task-013
title: Implement user-centric grouping logic
status: To Do
assignee: []
created_date: '2025-11-13 15:23'
labels:
  - frontend
  - data
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Organize pipelines by triggering user, creating a hierarchical structure: User → Pipelines → Jobs
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Pipelines grouped by user.username from API response
- [ ] #2 Each user becomes a vis.js group
- [ ] #3 Pipelines nested under their respective users
- [ ] #4 Jobs nested under their respective pipelines
- [ ] #5 Unknown users handled with fallback label
<!-- AC:END -->
