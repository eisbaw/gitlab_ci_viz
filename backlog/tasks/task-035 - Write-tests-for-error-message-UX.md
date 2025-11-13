---
id: task-035
title: Write tests for error message UX
status: To Do
assignee: []
created_date: '2025-11-13 15:49'
labels:
  - frontend
  - testing
  - usability
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Verify all error scenarios show user-friendly, actionable messages with resolution steps rather than technical stack traces
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Collect all error messages from codebase into test file
- [ ] #2 Test: Each error includes 1) What happened 2) Why 3) How to fix
- [ ] #3 Test: No raw stack traces shown to users
- [ ] #4 Test: Error messages use plain language (avoid jargon like 'CORS', '401')
- [ ] #5 Test: Token errors include fix command: 'glab auth login'
- [ ] #6 Test: CORS errors include link to GitLab configuration docs
- [ ] #7 Test: Network errors suggest checking GitLab instance URL
- [ ] #8 Test: Console logs technical details for debugging (separate from user message)
- [ ] #9 Manual review: Non-technical user can understand all errors
<!-- AC:END -->
