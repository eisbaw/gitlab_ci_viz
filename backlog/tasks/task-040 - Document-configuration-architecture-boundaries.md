---
id: task-040
title: Document configuration architecture boundaries
status: To Do
assignee: []
created_date: '2025-11-13 15:51'
labels:
  - backend
  - frontend
  - documentation
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Define and document the split between startup-time configuration (CLI args) and runtime configuration to guide future additions and prevent confusion
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Document startup-time vs runtime configuration split clearly
- [ ] #2 Document when to add Python CLI arg vs JavaScript config variable
- [ ] #3 Document configuration flow: CLI → Python parsing → HTML injection → JavaScript
- [ ] #4 Provide examples for common config change patterns
- [ ] #5 Document why caching must be frontend or why it can't be backend
- [ ] #6 Documentation added to docs/architecture.md
<!-- AC:END -->
