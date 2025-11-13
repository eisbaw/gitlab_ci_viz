---
id: task-011
title: Implement job data fetching
status: To Do
assignee: []
created_date: '2025-11-13 15:23'
labels:
  - frontend
  - api
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create function to fetch jobs for each pipeline using GitLab API v4
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Uses GET /api/v4/projects/:id/pipelines/:pipeline_id/jobs endpoint
- [ ] #2 Fetches jobs for all pipelines
- [ ] #3 Returns job metadata: id, name, status, started_at, duration
- [ ] #4 Handles pipelines with no jobs gracefully
<!-- AC:END -->
