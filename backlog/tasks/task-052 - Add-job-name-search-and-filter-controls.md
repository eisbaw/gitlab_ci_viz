---
id: task-052
title: Add job name search and filter controls
status: Done
assignee:
  - '@claude'
created_date: '2025-11-14 06:39'
updated_date: '2025-11-14 06:45'
labels:
  - enhancement
  - frontend
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Users need the ability to search and filter jobs by name to quickly identify specific job types (e.g., 'build', 'test', 'deploy') across the timeline. This complements the existing pipeline status filters and helps users focus on specific parts of their CI/CD workflows.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Filter UI includes a text input for job name search
- [x] #2 Search supports partial matching (case-insensitive substring match)
- [x] #3 Filtered jobs are highlighted or isolated in the timeline view
- [x] #4 Filter state persists during auto-refresh
- [x] #5 Filter can be cleared to show all jobs again
- [x] #6 Search works in combination with existing pipeline status filters
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Review current filter implementation (pipeline status filters) to understand the pattern
2. Add job name search input to filter controls UI
3. Implement search state management (similar to FilterState)
4. Implement job filtering logic that works with pipeline filters
5. Update applyFilters() to incorporate job name filtering
6. Test filtering with various job names
7. Ensure state preservation during auto-refresh
8. Run linting and tests
9. Commit changes
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented job name search and filter functionality that complements the existing pipeline status filters.

Key implementation details:
- Added text input with debounced search (300ms) to avoid excessive re-renders during typing
- Created JobSearchState object to manage search term state (similar to FilterState pattern)
- Search uses case-insensitive substring matching for user-friendly filtering
- Filter logic applied in both applyFilters() and fetchAndRender() functions
- Jobs are filtered after pipeline filtering, maintaining proper filter composition
- Clear button resets both input field and search state
- Filter state persists across auto-refresh cycles by maintaining in-memory state

Files modified:
- index.html: Added CSS styles, HTML elements, JavaScript state management and filtering logic

Testing:
- Linting passes with no errors
- Implementation follows existing filter patterns for consistency

Architectural improvements based on MPED review:
- Added input type validation to JobSearchState.set() for fail-fast error handling
- Added defensive check in JobSearchState.matches() for non-string job names
- Extracted computeFilteredData() function as single source of truth for filter logic
- Improved logging with detailed filter application statistics
- Eliminated code duplication between applyFilters() and fetchAndRender()
<!-- SECTION:NOTES:END -->
