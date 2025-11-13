---
id: task-034
title: Write integration tests for API data flow
status: To Do
assignee: []
created_date: '2025-11-13 15:49'
labels:
  - frontend
  - testing
  - integration
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Test complete data flow from GitLab API through transformation to visualization format using mocked API responses and realistic fixtures
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Create JSON fixtures with realistic multi-page GitLab API responses
- [ ] #2 Test: Fetch projects → pipelines → jobs → transform → verify output structure
- [ ] #3 Test: Pagination across 3 pages with 30/30/10 items aggregated correctly
- [ ] #4 Test: Rate limit on page 2 triggers backoff, retry, and success
- [ ] #5 Test: One project API fails, others succeed with partial results + error
- [ ] #6 Test: Project with 0 pipelines returns empty result without error
- [ ] #7 Test: Large dataset (50 projects, 500 pipelines) completes in <10 seconds
- [ ] #8 5+ realistic API response scenarios saved as fixtures in test/
- [ ] #9 All tests run in isolation with no shared state
<!-- AC:END -->
