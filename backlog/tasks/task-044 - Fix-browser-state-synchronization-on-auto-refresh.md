---
id: task-044
title: Fix browser state synchronization on auto-refresh
status: Done
assignee:
  - '@claude'
created_date: '2025-11-14 04:15'
updated_date: '2025-11-14 04:25'
labels:
  - bug
  - frontend
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When auto-refresh happens, saved window state (zoom/pan position) is not validated against new data range. This can cause UI to show data from time window A while actual data is in window B.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Window state validation added before applying saved position
- [x] #2 Falls back to default view if saved state invalid
- [x] #3 Tests added for state validation logic
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read index.html to understand current auto-refresh and state preservation logic
2. Identify where window state is saved and restored
3. Add validation to ensure saved window state intersects with new data range
4. Implement fallback to default view if validation fails
5. Add tests for state validation logic
6. Run tests to verify fix works correctly
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Fixed browser state synchronization issue on auto-refresh by adding window state validation.

## Changes Made

1. **Added validateWindowState() function** (index.html:486-542)
   - Validates saved window state against new data range
   - Calculates actual min/max time from timeline items
   - Returns null if window doesn't intersect with data
   - Logs warning with details when validation fails

2. **Updated fetchAndRender() function** (index.html:670-677)
   - Now calls validateWindowState() before restoring window
   - Falls back to default view if validation fails
   - Prevents UI showing empty time window after refresh

3. **Added comprehensive test suite** (test/test-window-state-validation.html)
   - 14 tests covering all edge cases
   - Tests for null/undefined inputs, empty items
   - Tests for overlapping, contained, and disjoint windows
   - Tests for boundary conditions
   - All tests passing

## Files Modified
- index.html: Added validation function and updated refresh logic
- test/test-window-state-validation.html: New test file (14 tests)

## Testing
- All existing tests still pass (54/54)
- New window state validation tests pass (14/14)
- Coverage remains at 87%

## MPED Review Fixes

Addressed all critical and medium-severity MPED violations:

1. **Fail-Fast & Verbose Errors**: Now returns structured result with reason code
2. **Data Validation**: Added type guards and NaN checks for date parsing
3. **Error Logging**: All failure paths now log warnings with context
4. **Meaningful Intersection**: Added 10% minimum overlap threshold
5. **Clear Contracts**: Return value now includes { valid, window, reason }

## Updated Test Suite

- Increased test coverage from 14 to 16 tests
- Added test for insufficient overlap (10% threshold)
- Added test for malformed date handling
- All tests passing with new structured return values

## Files Modified
- index.html: Enhanced validateWindowState() with MPED compliance (lines 486-591)
- index.html: Updated caller to use structured result (lines 719-727)
- test/test-window-state-validation.html: Updated all tests for new API (16 tests)
<!-- SECTION:NOTES:END -->
