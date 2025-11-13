---
id: task-010
title: Implement pipeline data fetching
status: To Do
assignee: []
created_date: '2025-11-13 15:23'
updated_date: '2025-11-13 16:03'
labels:
  - frontend
  - api
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create function to fetch pipelines for given projects within specified time range using GitLab API v4
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Uses GET /api/v4/projects/:id/pipelines endpoint
- [ ] #2 Filters by updated_after parameter based on --since config
- [ ] #3 Fetches pipelines for all configured projects
- [ ] #4 Returns array with pipeline metadata: id, status, user, timestamps, duration
- [ ] #5 Handles pagination for projects with many pipelines

- [ ] #6 Test: Mock API with 250 pipelines across 3 pages verifies all 250 returned
<!-- AC:END -->
