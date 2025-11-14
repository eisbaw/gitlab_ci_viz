---
id: task-054
title: Fix groupId type error in API client
status: To Do
assignee: []
created_date: '2025-11-14 07:05'
labels:
  - api
  - critical
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
API functions are receiving object instead of expected string for groupId parameter, causing 7 out of 8 integration tests to fail. This affects project/pipeline data flow, pagination, rate limiting, and error handling.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All 8 integration tests in test-api-integration.html pass
- [ ] #2 groupId parameter type validation added
- [ ] #3 All calls to API functions with groupId properly pass string values
<!-- AC:END -->
