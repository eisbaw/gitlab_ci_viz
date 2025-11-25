---
id: task-058
title: Download and lock d3.js version locally
status: Done
assignee:
  - '@claude'
created_date: '2025-11-25 21:12'
updated_date: '2025-11-25 21:22'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Remove CDN dependency by downloading d3.js locally. This ensures the application works offline and has a reproducible, locked version.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Download d3.js to local static assets
- [x] #2 Update HTML to reference local d3.js instead of CDN
- [x] #3 Update README with information about d3.js versioning
- [x] #4 Add justfile recipe to update d3.js version
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Download d3.v7.min.js from official CDN to /static/d3.v7.min.js
2. Update index.html to reference local d3.js file
3. Update test/test-d3-gantt.html to reference local d3.js file
4. Update README.md to document local d3.js versioning approach
5. Add justfile recipe "update-d3" to download/update d3.js version
6. Test that the application still works with local d3.js
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Downloaded d3.js v7.9.0 to static/d3.v7.min.js and updated all HTML references.

Changes:
- Downloaded d3.js v7.9.0 (274KB) to static/d3.v7.min.js
- Updated index.html to use /static/d3.v7.min.js instead of CDN
- Updated test/test-d3-gantt.html to use local d3.js
- Updated README.md Dependencies section with new version info and update instructions
- Added justfile recipe "update-d3 VERSION" to simplify future updates

Benefits:
- Application now works offline (no CDN dependency)
- Reproducible builds with locked version
- Controlled, explicit version upgrades
<!-- SECTION:NOTES:END -->
