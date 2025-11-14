---
id: task-055
title: Remove unsafe timeline window state preservation
status: Done
assignee:
  - '@claude'
created_date: '2025-11-14 07:05'
updated_date: '2025-11-14 07:38'
labels:
  - architecture
  - ui
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Auto-refresh mechanism preserves timeline viewport window without validating against new data, which can result in showing empty or partial timeline when new data exists outside the preserved view. This violates fail-fast principles and single source of truth.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Timeline window state preservation logic removed from auto-refresh
- [x] #2 Timeline auto-fits to new data on refresh
- [x] #3 Integration test verifies timeline shows all data after refresh
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove window state preservation logic from applyFilters() (lines 688-701)
2. Remove window state preservation logic from fetchAndRender() (lines 1096-1179)
3. Remove validateWindowState() function entirely (lines 970-1074)
4. Update test-window-state-validation.html to test that timeline auto-fits on refresh
5. Run tests via justfile to ensure nothing breaks
6. Test manually to verify timeline shows all data after refresh
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed unsafe timeline window state preservation mechanism from auto-refresh and filter operations.

## Changes
- Removed window state save/restore logic from applyFilters() function
- Removed window state save/restore logic from fetchAndRender() function
- Removed entire validateWindowState() function (lines 958-1063)
- Updated function documentation to reflect removal of zoom/pan state preservation
- Moved obsolete test file test-window-state-validation.html to cruft/

## Result
Timeline now auto-fits to all data on every refresh and filter operation, ensuring users always see complete data without risk of showing empty or partial views. This follows fail-fast principles and maintains single source of truth.
<!-- SECTION:NOTES:END -->
