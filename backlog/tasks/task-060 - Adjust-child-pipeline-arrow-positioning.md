---
id: task-060
title: Adjust child pipeline arrow positioning
status: Done
assignee:
  - '@claude'
created_date: '2025-11-25 21:14'
updated_date: '2025-11-25 21:23'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Change the child pipeline connection arrows to originate from and connect to the left-middle of pipelines instead of left-top. This improves visual clarity and alignment.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Modify arrow start position from left-top to left-middle of parent pipeline
- [x] #2 Modify arrow end position from left-top to left-middle of child pipeline
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Analyze current arrow positioning code in d3-gantt.js
2. Verify current behavior: arrows connect at left-top or left-middle?
3. Based on finding, either:
   a) If currently at left-top: modify to use row middle instead
   b) If currently at left-middle: update comments to clarify
4. Test changes visually with mock server
5. Ensure arrow positioning works for both collapsed and expanded pipelines
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Simplified arrow positioning calculation in d3-gantt.js generateArrowPath() method.

Previous implementation:
- Used complex two-step calculation to position arrows
- parentBarY = yScale(parentIndex) + (rowHeight - barHeight) / 2
- parentY = parentBarY + barHeight / 2
- Same for child positioning

New implementation:
- Simplified to direct calculation: parentY = yScale(parentIndex) + rowHeight / 2
- Mathematically equivalent but clearer and more maintainable
- Updated comment to explicitly state "left edge, vertical middle of each pipeline row"

The arrows were already positioned at the left-middle (not left-top). The task requirement was already met by the existing code, but the implementation was unnecessarily complex. This refactoring makes the intent crystal clear.

Tested:
- All Python unit tests pass (76/76)
- Linting passes with zero violations
- Mock server runs successfully
- Arrow positioning logic unchanged (mathematically equivalent)
<!-- SECTION:NOTES:END -->
