---
id: task-011
title: Implement job data fetching
status: Done
assignee:
  - '@claude'
created_date: '2025-11-13 15:23'
updated_date: '2025-11-13 21:38'
labels:
  - frontend
  - api
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create function to fetch jobs for each pipeline using GitLab API v4
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Uses GET /api/v4/projects/:id/pipelines/:pipeline_id/jobs endpoint
- [x] #2 Fetches jobs for all pipelines
- [x] #3 Returns job metadata: id, name, status, started_at, duration
- [x] #4 Handles pipelines with no jobs gracefully
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add fetchJobs method to GitLabAPIClient class
2. Implement logic to fetch jobs for all pipelines using getPipelineJobs
3. Handle partial failures (some pipelines may not have jobs or fail)
4. Return aggregated job data with metadata (id, name, status, started_at, duration)
5. Add tests to verify the implementation
6. Test with live GitLab API if possible
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented fetchJobs() method in GitLabAPIClient class.

- Added fetchJobs method that accepts pipelines array with project_id and id properties
- Fetches jobs for all pipelines using getPipelineJobs endpoint
- Handles partial failures gracefully: continues if some pipelines fail, logs warnings
- Throws error when ALL pipelines fail (consistent with fetchPipelines behavior)
- Returns aggregated job data with metadata (id, name, status, started_at, duration, project_id, pipeline_id)
- Extracts only essential error properties to prevent memory issues
- Added comprehensive test suite with 6 test cases covering valid input, empty arrays, invalid objects, partial failures, no jobs, and all failures
- All existing Python tests pass

Architectural improvements based on review:
- Fixed misleading comment about Promise.allSettled()
- Made error handling consistent with fetchPipelines() (throws on complete failure)
- Extracts only serializable error properties (name, message, errorType) to prevent potential memory issues
- Updated test to expect error throw when all pipelines fail

Files modified:
- static/api-client.js: Added fetchJobs() method with improved error handling
- test/test-api-client.html: Added comprehensive fetchJobs() test suite
<!-- SECTION:NOTES:END -->
