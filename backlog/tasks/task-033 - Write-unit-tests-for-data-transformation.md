---
id: task-033
title: Write unit tests for data transformation
status: To Do
assignee: []
created_date: '2025-11-13 15:45'
labels:
  - frontend
  - testing
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Test transformation of GitLab API responses to domain model with extensive edge case coverage for null values, missing fields, and type mismatches
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Test: Valid pipeline/job data transforms correctly to domain model
- [ ] #2 Test: Null created_at in pipeline skipped with warning logged
- [ ] #3 Test: Null started_at in job shown at pipeline start with duration 0
- [ ] #4 Test: Running job (no finished_at) duration calculated from current time
- [ ] #5 Test: Missing user field defaults to 'Unknown User' or 'System'
- [ ] #6 Test: Empty pipelines array results in empty output
- [ ] #7 Test: Empty jobs array for pipeline shown without children
- [ ] #8 Test: Special characters in project/job names escaped properly
- [ ] #9 Test: Duration as string '300' converted to number
- [ ] #10 Property test: All output items have valid start <= end
- [ ] #11 Property test: Job start times >= parent pipeline start
- [ ] #12 Coverage: >95% of transformation code
<!-- AC:END -->
