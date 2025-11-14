---
id: task-049
title: Add click-through links to GitLab pipeline pages
status: Done
assignee:
  - '@claude'
created_date: '2025-11-14 05:33'
updated_date: '2025-11-14 05:39'
labels:
  - enhancement
  - ui
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enable users to click on pipelines and jobs in the visualization to open the corresponding GitLab pages in a new tab. This improves workflow by allowing quick navigation from the visualization to detailed pipeline/job information in GitLab.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pipeline items are clickable and open the correct GitLab pipeline page
- [x] #2 Job items are clickable and open the correct GitLab job page
- [x] #3 Links open in a new browser tab
- [x] #4 Cursor changes to pointer on hover over clickable items
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add click event listener to timeline in initializeTimeline()
2. Extract pipeline/job ID and project info from clicked item
3. Construct GitLab URL using CONFIG.gitlabUrl, project ID, and pipeline/job ID
4. Open URL in new tab using window.open()
5. Add CSS for pointer cursor on hover
6. Test with manual interaction
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added click-through functionality to pipeline and job items in the visualization.

- Enriched both pipeline and job items with projectId, pipelineId, and jobId during data transformation
- Added click event listener to vis.js Timeline that constructs GitLab URLs based on item type
- Pipeline items link to: {gitlabUrl}/{projectId}/-/pipelines/{pipelineId}
- Job items link to: {gitlabUrl}/{projectId}/-/jobs/{jobId}
- Links open in new tab with noopener,noreferrer for security
- Added CSS cursor:pointer styling for all pipeline and job status classes
- All existing tests pass

Modified files:
- index.html: Enhanced item enrichment (lines 670-730), added click handler (lines 456-484), added CSS (lines 189-209)

Architect Review Findings:
- Added fail-fast error logging when clicked item not found
- Added observability logging for URL construction
- Security: window.open with noopener,noreferrer is correct
- Note: Current implementation couples URL logic to UI handler; acceptable for MVP but should be refactored to extract URL builder function in future enhancement
- Note: Uses string prefix parsing to detect item types; works but fragile (depends on DataTransformer ID format)
<!-- SECTION:NOTES:END -->
