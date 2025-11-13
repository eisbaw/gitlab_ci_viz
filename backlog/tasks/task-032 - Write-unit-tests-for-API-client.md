---
id: task-032
title: Write unit tests for API client
status: To Do
assignee: []
created_date: '2025-11-13 15:44'
labels:
  - frontend
  - testing
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Test GitLab API client with mocked fetch covering request construction, error handling, and response parsing for all HTTP status codes
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Mock fetch API for all tests (no real network calls)
- [ ] #2 Test: Authorization header includes token correctly
- [ ] #3 Test: API URLs constructed correctly for projects, pipelines, jobs
- [ ] #4 Test: 401 response throws specific authentication error
- [ ] #5 Test: 403 response throws permission error with details
- [ ] #6 Test: 429 response triggers retry with exponential backoff (3 attempts)
- [ ] #7 Test: Network timeout (30s) throws timeout error
- [ ] #8 Test: Invalid JSON response throws parse error with context
- [ ] #9 Test: Empty response body handled gracefully
- [ ] #10 Coverage: >95% of API client code
<!-- AC:END -->
