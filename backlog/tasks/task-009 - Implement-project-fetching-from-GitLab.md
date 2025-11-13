---
id: task-009
title: Implement project fetching from GitLab
status: Done
assignee:
  - '@claude'
created_date: '2025-11-13 15:23'
updated_date: '2025-11-13 21:02'
labels:
  - frontend
  - api
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create function to fetch projects either from a group or from a specific list of project IDs via GitLab API v4
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Function fetches projects from group when --group provided
- [x] #2 Function uses specific project IDs when --projects provided
- [x] #3 Uses GET /api/v4/groups/:id/projects endpoint
- [x] #4 Returns array of project objects with id and name
- [x] #5 Handles API errors gracefully
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add fetchProjects() function to api-client.js that handles both group and project list modes
2. Add proper error handling for API calls
3. Add unit tests for the function in test/test_api_client.html
4. Test manually with serve.py
5. Update index.html to call fetchProjects() on load
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented fetchProjects() function in api-client.js that handles both GitLab group and project list modes.

- Added fetchProjects() method that checks CONFIG.groupId or CONFIG.projectIds
- For group mode: calls existing getGroupProjects() method
- For project list mode: fetches each project details via GET /api/v4/projects/:id in parallel using Promise.all
- Added comprehensive error handling with contextual error messages
- Created 6 unit tests in test/test-api-client.html covering:
  * Group fetching
  * Project list fetching
  * Empty project list validation
  * Missing configuration validation
  * API error handling for groups
  * API error handling for projects

All acceptance criteria met:
1. ✓ Function fetches projects from group when --group provided
2. ✓ Function uses specific project IDs when --projects provided
3. ✓ Uses GET /api/v4/groups/:id/projects endpoint (via getGroupProjects)
4. ✓ Returns array of project objects with id, name, path_with_namespace, web_url
5. ✓ Handles API errors gracefully with contextual error messages

## Post-Review Improvements

After architectural review, applied the following improvements:

1. **Fixed error mutation**: Changed from mutating error.message to wrapping errors with originalError property
2. **Improved failure handling**: Changed from Promise.all (fail-all) to Promise.allSettled (partial success)
   - Now returns successful projects even if some fail
   - Logs warnings for failed projects via console.warn
   - Only throws if ALL projects fail
3. **Enhanced tests**: Added tests for partial failure scenarios (Test 6 and 7)

These changes improve resilience when fetching multiple projects - one bad project ID won't break the entire visualization.
<!-- SECTION:NOTES:END -->
