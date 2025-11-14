---
id: task-046
title: Make CONFIG dependency explicit in GitLabAPIClient
status: Done
assignee:
  - '@claude'
created_date: '2025-11-14 04:16'
updated_date: '2025-11-14 04:46'
labels:
  - refactor
  - frontend
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
GitLabAPIClient reads global CONFIG object directly without validation at instantiation. This can fail silently if CONFIG is missing or malformed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CONFIG passed explicitly to GitLabAPIClient constructor
- [x] #2 Constructor validates CONFIG has required fields
- [x] #3 Fails fast with clear error if CONFIG invalid
- [x] #4 Tests verify constructor validation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Modify GitLabAPIClient constructor to accept config parameter
2. Add validation for required CONFIG fields (gitlabToken, gitlabUrl)
3. Update all instantiation sites to pass CONFIG explicitly
4. Create comprehensive unit tests for constructor validation
5. Run tests via justfile to verify changes
6. Run mped-architect and qa-test-runner reviews
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Refactored GitLabAPIClient to accept CONFIG as explicit constructor parameter.

Changes:
- Constructor now requires config parameter with validation
- Validates config object type (rejects null, undefined, arrays)
- Validates required fields (gitlabToken, gitlabUrl) for presence and type
- Validates optional fields (groupId, projectIds) for type if provided
- Improved error messages to differentiate missing vs wrong type
- Updated all instantiation sites to pass CONFIG explicitly
- Created comprehensive constructor validation tests

Files modified:
- static/api-client.js: Constructor signature and validation
- index.html: Pass CONFIG to constructor
- test/*.html: Updated all instantiations
- test/test_api_client_constructor.html: New test file with 21 test cases

All acceptance criteria met with enhanced validation beyond requirements.
<!-- SECTION:NOTES:END -->
