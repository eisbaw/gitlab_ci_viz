---
id: task-040
title: Document configuration architecture boundaries
status: Done
assignee:
  - '@claude'
created_date: '2025-11-13 15:51'
updated_date: '2025-11-14 01:36'
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
- [x] #1 Document startup-time vs runtime configuration split clearly
- [x] #2 Document when to add Python CLI arg vs JavaScript config variable
- [x] #3 Document configuration flow: CLI → Python parsing → HTML injection → JavaScript
- [x] #4 Provide examples for common config change patterns
- [x] #5 Document why caching must be frontend or why it can't be backend
- [x] #6 Documentation added to docs/architecture.md
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Review serve.py to understand CLI argument parsing and validation
2. Review serve.py config injection mechanism (build_config_js)
3. Review index.html to see how CONFIG is consumed
4. Create docs/architecture.md with comprehensive configuration documentation
5. Document startup vs runtime config boundary
6. Document when to use CLI args vs JavaScript variables
7. Document configuration flow with examples
8. Document why certain features must be frontend/backend
9. Test documentation clarity
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created comprehensive configuration architecture documentation in docs/architecture.md.

The document covers:
- Clear boundary between startup-time (Python CLI) and runtime (JavaScript) configuration
- Configuration flow from CLI arguments through Python parsing, JSON injection, to JavaScript consumption
- Decision guide with patterns for common configuration changes
- Examples for adding new CLI arguments vs JavaScript variables
- Explanation of why caching must be frontend and why data fetching is frontend-only
- Security considerations for token handling and XSS prevention
- Configuration validation strategy split between Python (fail-fast) and JavaScript (graceful degradation)
- Complete decision tree for adding new configuration options

Files created:
- docs/architecture.md (comprehensive configuration architecture documentation)

All acceptance criteria met with detailed examples and clear guidance for future development.
<!-- SECTION:NOTES:END -->
