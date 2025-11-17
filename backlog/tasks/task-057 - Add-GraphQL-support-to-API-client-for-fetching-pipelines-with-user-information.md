---
id: task-057
title: Add GraphQL support to API client for fetching pipelines with user information
status: Done
assignee:
  - '@claude'
created_date: '2025-11-17 14:42'
updated_date: '2025-11-17 14:45'
labels: []
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The REST API endpoint /projects/{id}/pipelines doesn't return user information, so we can't show who triggered each pipeline. Use GitLab's GraphQL API to fetch pipelines with user data in a single efficient query.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add graphqlQuery() method to APIClient class
- [x] #2 Add fetchPipelinesGraphQL() method that uses GraphQL
- [x] #3 Transform GraphQL response to match REST API format
- [x] #4 Update fetchPipelines() to try GraphQL first, fall back to REST
- [x] #5 Add error handling and logging for GraphQL queries
- [x] #6 GraphQL queries return user information (id, username, name, avatarUrl)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Research GitLab GraphQL API schema for pipeline queries\n2. Add graphqlQuery() base method to APIClient class\n3. Create fetchPipelinesGraphQL() with proper query structure\n4. Add response transformation logic (GraphQL -> REST format)\n5. Update fetchPipelines() with GraphQL-first fallback strategy\n6. Add comprehensive error handling\n7. Test with existing test fixtures
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added GraphQL support to the APIClient class with fallback to REST API.

## Implementation Summary

**GraphQL Query Method**
- Added `graphqlQuery(query, variables, timeout)` base method
- Handles POST requests to `/api/graphql` endpoint
- Proper error handling for GraphQL-specific errors (200 OK with errors array)
- Timeout support (30s default)
- Logging for debugging

**Pipeline Fetching via GraphQL**
- Added `fetchPipelinesGraphQL(projects, updatedAfter)` method
- Query fetches pipelines with user information in single request
- Queries multiple projects in parallel using GraphQL batch queries
- Returns data in REST API-compatible format

**Response Transformation**
- Converts GraphQL global IDs (gid://gitlab/Project/123) to numeric IDs
- Maps GraphQL field names to REST API format:
  - createdAt -> created_at
  - updatedAt -> updated_at
  - avatarUrl -> avatar_url
  - status: UPPERCASE -> lowercase
- Constructs web_url from project fullPath and pipeline ID

**Fallback Strategy**
- `fetchPipelines()` tries GraphQL first
- If GraphQL fails, falls back to REST API automatically
- Logs fallback for debugging
- Maintains backward compatibility with existing code

## GraphQL Query Structure
```graphql
query GetPipelines($projectIds: [ID\!]\!, $updatedAfter: Time) {
  projects(ids: $projectIds) {
    nodes {
      id
      fullPath
      pipelines(updatedAfter: $updatedAfter, first: 100) {
        nodes {
          id, iid, status, ref, sha
          createdAt, updatedAt, startedAt, finishedAt
          duration
          user { id, username, name, avatarUrl }
        }
      }
    }
  }
}
```

## Benefits
- User information now available directly from pipelines
- Single query instead of multiple REST calls
- More efficient data fetching
- Graceful degradation to REST if GraphQL unavailable
<!-- SECTION:NOTES:END -->
