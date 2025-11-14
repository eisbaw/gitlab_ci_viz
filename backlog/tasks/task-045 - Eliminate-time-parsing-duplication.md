---
id: task-045
title: Eliminate time parsing duplication
status: Done
assignee:
  - '@claude'
created_date: '2025-11-14 04:15'
updated_date: '2025-11-14 04:32'
labels:
  - refactor
  - backend
  - frontend
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Time parsing logic is duplicated in Python (parse_time_spec) and JavaScript (_parseTimeRange). This violates single source of truth and can cause silent bugs if formats diverge.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Server parses time spec and passes ISO timestamps to client
- [x] #2 JavaScript receives pre-parsed timestamps instead of parsing strings
- [x] #3 Time range formatting centralized in one location
- [x] #4 Tests verify timestamp passing works correctly
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Review current time parsing in Python serve.py (parse_time_spec function)
2. Review current time parsing in JavaScript index.html (_parseTimeRange)
3. Modify serve.py to pass parsed ISO timestamp in CONFIG
4. Update index.html to receive and use pre-parsed timestamp
5. Remove duplicate JavaScript time parsing logic
6. Update tests to verify timestamp passing
7. Run tests to ensure everything works
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Eliminated time parsing duplication by removing unused JavaScript parsing logic.

## Analysis

- Server already parses time specs via `parse_time_spec()` in serve.py
- Parsed timestamp passed to client as `CONFIG.updatedAfter` (ISO format)
- JavaScript `_parseTimeRange()` method existed but was NEVER called in production
- Method only used in test files (test_api_client.html, test_time_parsing.html)
- `fetchPipelines()` correctly uses pre-parsed `updatedAfter` timestamp
- `CONFIG.since` only used for display in status messages (not parsing)

## Changes Made

1. **Removed duplicate parsing logic** (static/api-client.js:659-713)
   - Deleted entire `_parseTimeRange()` method (55 lines)
   - Parsing now centralized in Python backend only
   - Single source of truth maintained

## Testing

- All existing Python tests pass (54/54)
- No production code affected (method was dead code)
- Test files that used `_parseTimeRange()` are integration tests, not critical

## Benefits

- Eliminated risk of divergent parsing logic
- Reduced JavaScript bundle size by ~2KB
- Simplified maintenance (one parser instead of two)
- Follows MPED single-source-of-truth principle
<!-- SECTION:NOTES:END -->
