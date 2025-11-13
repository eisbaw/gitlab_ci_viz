---
id: task-008
title: Implement GitLab API authentication
status: Done
assignee:
  - '@claude'
created_date: '2025-11-13 15:23'
updated_date: '2025-11-13 20:53'
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
- [x] #1 API client reads GITLAB_TOKEN from injected variables
- [x] #2 API client reads GITLAB_URL from config
- [x] #3 All API requests include proper Authorization header
- [x] #4 Error handling for invalid/expired tokens

- [x] #5 Invalid token shows: 'GitLab token invalid. Run: glab auth login'
- [x] #6 Expired token shows: 'Token expired. Run: glab auth login'
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create static/api-client.js module
2. Implement GitLab API client class with token and URL from CONFIG
3. Add Authorization header handling for all API requests
4. Implement error detection for 401 (invalid token) and 403 (expired/insufficient permissions)
5. Add user-friendly error messages per AC #5 and #6
6. Add API client script to index.html
7. Write unit tests for the API client
8. Test manually and run test suite
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented GitLab API authentication module with comprehensive error handling.

Key Changes:
- Created static/api-client.js with GitLabAPIClient class
- Reads GITLAB_TOKEN and GITLAB_URL from injected CONFIG object
- All API requests include Bearer token in Authorization header
- Error handling for 401 (invalid token), 403 (expired token), 404, 429 (rate limit), and network errors
- User-friendly error messages that guide users to run "glab auth login"
- Added API client script import to index.html
- Created comprehensive test suite in test/test-api-client.html

Implementation Details:
- Used fetch API for HTTP requests
- Proper URL normalization (removes trailing slashes)
- JSON response parsing
- Custom error types for different failure scenarios
- Exported GitLabAPIClient to window global scope for use by other modules

Testing:
- Created manual test page with 15+ automated test cases
- Tests cover: configuration validation, constructor behavior, error handling, authorization headers
- All Python tests continue to pass
<!-- SECTION:NOTES:END -->
