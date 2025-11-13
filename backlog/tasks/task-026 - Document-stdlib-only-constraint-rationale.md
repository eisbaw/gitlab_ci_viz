---
id: task-026
title: Document stdlib-only constraint rationale
status: Done
assignee:
  - '@claude'
created_date: '2025-11-13 15:42'
updated_date: '2025-11-13 23:27'
labels:
  - backend
  - documentation
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Document why Python backend uses only standard library, what breaks if dependencies are added, and when to reconsider this constraint to guide future maintenance decisions
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Document WHY stdlib-only is required (deployment, learning, principle)
- [x] #2 Document WHAT breaks if we add dependencies (pypi blocked, air-gapped, etc)
- [x] #3 Document WHEN to reconsider (maintenance burden threshold)
- [x] #4 Document known limitations this creates (date parsing, HTTP client)
- [x] #5 Add requirements.txt.example showing what we'd use if constraint lifted
- [x] #6 Documentation added to README.md or docs/
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Review current codebase to understand stdlib usage
2. Research deployment contexts (PyPI blocked, air-gapped)
3. Identify specific limitations in current implementation
4. Draft documentation covering WHY, WHAT, WHEN
5. Create requirements.txt.example with alternative dependencies
6. Add documentation section to README.md
7. Review and verify completeness
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added comprehensive documentation to README.md explaining stdlib-only constraint.

Documentation covers:
- WHY: Zero-dependency deployment, learning/hackability, principle of least power
- WHAT breaks: Restricted environments (PyPI blocked, air-gapped), minimal systems, educational settings
- WHEN to reconsider: Maintenance burden threshold, fundamental feature changes, user base shifts
- Known limitations: Date parsing, HTTP server performance, config file support
- Created requirements.txt.example showing hypothetical dependencies (flask, python-dateutil, requests, pyyaml, click)

The documentation provides decision context for future maintainers and clearly explains the trade-offs between deployment simplicity and developer convenience.
<!-- SECTION:NOTES:END -->
