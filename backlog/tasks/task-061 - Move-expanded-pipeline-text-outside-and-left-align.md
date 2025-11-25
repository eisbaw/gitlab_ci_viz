---
id: task-061
title: Move expanded pipeline text outside and left-align
status: Done
assignee:
  - '@claude'
created_date: '2025-11-25 21:15'
updated_date: '2025-11-25 21:27'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When a pipeline is expanded, the text label should be positioned outside the pipeline box instead of inside, and should be left-aligned. This improves readability and visual layout.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Move pipeline text from inside to outside of the expanded pipeline box
- [x] #2 Left-align the text relative to the pipeline
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Analyze current implementation:
   - Labels are in renderPipelineBackgrounds() method (lines 1048-1122)
   - Currently positioned inside box at right edge with right-align (text-anchor: end)
   - Position calculated at line 1105 (boxWidth - 10px padding)

2. Modify positioning logic:
   - Change text-anchor from "end" to "start" for left-alignment
   - Move x-position from right edge to left edge of box
   - Add small left padding (e.g., -5px to position slightly outside)

3. Test the changes:
   - Run the development server with mock data
   - Visually verify expanded pipelines show text outside and left-aligned
   - Check text doesn't overlap with job bars or other elements

4. Run QA checks:
   - Use mped-architect to review code changes
   - Use qa-test-runner to run linting and tests
   - Fix any issues reported

5. Commit atomically:
   - Stage both code changes and backlog task updates
   - Create single commit with descriptive message
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Modified renderPipelineBackgrounds() method in d3-gantt.js:

- Changed text-anchor from "end" to "start" for all three pipeline labels (project, sha, ref) to enable left-alignment
- Repositioned text from right edge (boxWidth - 10) to left edge (minTime - 10) of the expanded pipeline box
- Text now appears 10px to the left of the pipeline box instead of 10px inside from the right edge

The text labels are now positioned outside and to the left of expanded pipelines, improving readability and visual layout.
<!-- SECTION:NOTES:END -->
