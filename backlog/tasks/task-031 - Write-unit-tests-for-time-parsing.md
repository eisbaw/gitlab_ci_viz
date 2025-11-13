---
id: task-031
title: Write unit tests for time parsing
status: To Do
assignee: []
created_date: '2025-11-13 15:44'
labels:
  - backend
  - frontend
  - testing
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Test all relative and absolute time formats with edge cases, boundary conditions, and error handling
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Test: Valid relative times ('2 days ago', 'last week', '3 hours ago')
- [ ] #2 Test: Valid absolute times ('2025-01-10', '2025-01-10T14:30:00Z')
- [ ] #3 Test: Invalid formats ('yesterday', 'foo', '2025-13-45', empty, null)
- [ ] #4 Test: Boundary conditions ('0 days ago', future dates rejected)
- [ ] #5 Test: Timezone handling (input with/without TZ, output always UTC)
- [ ] #6 Test: Year boundary ('last week' on January 1st)
- [ ] #7 Property test: Generated relative times always result in past dates
- [ ] #8 Coverage: 100% of time parsing functions
<!-- AC:END -->
