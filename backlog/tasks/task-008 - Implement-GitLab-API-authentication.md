---
id: task-008
title: Implement GitLab API authentication
status: To Do
assignee: []
created_date: '2025-11-13 15:23'
updated_date: '2025-11-13 16:02'
labels:
  - frontend
  - api
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create JavaScript module to handle GitLab API requests with token authentication from injected config
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 API client reads GITLAB_TOKEN from injected variables
- [ ] #2 API client reads GITLAB_URL from config
- [ ] #3 All API requests include proper Authorization header
- [ ] #4 Error handling for invalid/expired tokens

- [ ] #5 Invalid token shows: 'GitLab token invalid. Run: glab auth login'
- [ ] #6 Expired token shows: 'Token expired. Run: glab auth login'
<!-- AC:END -->
