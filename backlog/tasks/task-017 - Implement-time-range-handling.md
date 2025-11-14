---
id: task-017
title: Implement time range handling
status: Done
assignee:
  - '@claude'
created_date: '2025-11-13 15:24'
updated_date: '2025-11-14 00:57'
labels:
  - backend
  - frontend
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Parse and handle --since parameter for both relative ('2 days ago') and absolute ('2025-01-10') time specifications
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Relative time strings parsed correctly ('2 days ago', 'last week')
- [x] #2 Absolute date strings parsed correctly (ISO 8601 format)
- [x] #3 Converted to updated_after parameter for GitLab API
- [x] #4 Invalid time specifications show user-friendly error

- [x] #5 Unsupported format shows: 'Time format not supported. Use: 2 days ago, 2025-01-10, or last week'
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add parse_time_spec() function to serve.py to convert relative/absolute time strings to ISO 8601
2. Add unit tests for parse_time_spec() covering all AC scenarios
3. Integrate parse_time_spec() into config generation to add updated_after parameter
4. Update error handling to show user-friendly messages for invalid formats
5. Test with various time formats via unit tests
6. Run full test suite to ensure no regressions
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented time range parsing with comprehensive support for multiple formats:

- Added parse_time_spec() function in serve.py:84-152
- Supports relative time: "N days/weeks/hours/minutes/seconds ago"
- Supports absolute ISO 8601 dates: "YYYY-MM-DD" and "YYYY-MM-DDTHH:MM:SS"
- Supports special keyword: "last week" (case insensitive)
- Returns ISO 8601 timestamps with Z suffix for GitLab API
- Integrated into validate_arguments() to parse --since parameter
- Updated create_config_js() to include updatedAfter in config

Added comprehensive test coverage (15 new tests):
- All time format variations (absolute, relative, special)
- Error handling with user-friendly messages
- Edge cases (whitespace, case sensitivity, invalid formats)
- Updated existing tests to include updated_after parameter

All 52 tests pass with 87% code coverage.

Files modified:
- serve.py: Added parse_time_spec(), updated validate_arguments() and create_config_js()
- test/test_serve.py: Added TestTimeSpecParsing class with 15 tests, updated existing tests
<!-- SECTION:NOTES:END -->
